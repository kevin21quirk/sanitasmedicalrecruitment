import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { getSetting } from '../lib/settings.js';
import { notify } from '../lib/notify.js';
import { upload, storeFile } from '../lib/files.js';
import { recomputeComplianceScore } from '../lib/compliance.js';

const r = Router();
const newToken = () => crypto.randomBytes(24).toString('hex');

// ─── 1.x Public candidate registration ────────────────────────────────────

// Client site names only — used for "which sites will you travel to" (1.2).
r.get('/register-clients', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, town FROM clients WHERE status = 'active' ORDER BY name`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Custom field definitions shown on the public form (1.2)
r.get('/register-fields', async (_req, res, next) => {
  try {
    res.json({ fields: await getSetting('registration_fields') });
  } catch (e) { next(e); }
});

// Start (or resume) a registration. Idempotent on the browser-held token (1.7).
r.post('/register', async (req, res, next) => {
  try {
    const token = req.body?.token;
    if (token) {
      const { rows } = await query(`SELECT * FROM registrations WHERE token = $1`, [token]);
      if (rows[0] && rows[0].status === 'draft') return res.json({ token });
    }
    const t = newToken();
    await query(`INSERT INTO registrations (token) VALUES ($1)`, [t]);
    res.status(201).json({ token: t });
  } catch (e) { next(e); }
});

r.get('/register/:token', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM registrations WHERE token = $1`, [req.params.token]);
    if (!rows[0]) return res.status(404).json({ error: 'Registration not found' });
    const { rows: files } = await query(
      `SELECT id, filename, label, created_at FROM files WHERE owner_type = 'registration' AND owner_id = $1`,
      [rows[0].id]);
    res.json({ token: rows[0].token, status: rows[0].status, payload: rows[0].payload, files });
  } catch (e) { next(e); }
});

// Save partial progress (1.7) — called on each step/blur.
r.put('/register/:token', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE registrations SET payload = $1, updated_at = now()
       WHERE token = $2 AND status = 'draft' RETURNING token`,
      [JSON.stringify(req.body?.payload ?? {}), req.params.token]);
    if (!rows.length) return res.status(404).json({ error: 'Registration not found or already submitted' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Candidate uploads their own documents (1.3) — attached to the draft.
r.post('/register/:token/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, status FROM registrations WHERE token = $1`, [req.params.token]);
    if (!rows[0] || rows[0].status !== 'draft') return res.status(404).json({ error: 'Registration not found or already submitted' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const file = await storeFile({
      buffer: req.file.buffer, filename: req.file.originalname, mime: req.file.mimetype,
      ownerType: 'registration', ownerId: rows[0].id, label: req.body.label || 'document',
    });
    res.status(201).json({ id: file.id, filename: file.filename, label: file.label });
  } catch (e) { next(e); }
});

// Submit: create the candidate record + pending compliance docs, then send the
// agency-worded acknowledgement (1.4).
r.post('/register/:token/submit', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM registrations WHERE token = $1`, [req.params.token]);
    const reg = rows[0];
    if (!reg || reg.status !== 'draft') return res.status(404).json({ error: 'Registration not found or already submitted' });
    const p = reg.payload || {};
    if (!p.first_name || !p.last_name) return res.status(400).json({ error: 'Name is required' });

    const { rows: c } = await query(
      `INSERT INTO candidates (first_name, last_name, email, phone, role, nmc_pin, address, town, postcode,
        status, source, preferred_shift, employment_pref, travel_miles, has_transport,
        next_of_kin_name, next_of_kin_phone, rtw_status, rtw_expiry, driving, uniform_size,
        willing_client_ids, custom_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'in_progress',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [p.first_name, p.last_name, p.email || null, p.phone || null, p.role || 'Healthcare Assistant',
       p.nmc_pin || null, p.address || null, p.town || null, p.postcode || null,
       'Website', p.preferred_shift || null, p.employment_pref || null, p.travel_miles || null,
       !!p.has_transport, p.next_of_kin_name || null, p.next_of_kin_phone || null,
       p.rtw_status || null, p.rtw_expiry || null, p.driving || null, p.uniform_size || null,
       p.willing_client_ids || [], p.custom_fields || {}]);
    const candidateId = c[0].id;

    // Re-home uploaded files to the candidate and create pending doc records (1.3)
    const { rows: files } = await query(
      `UPDATE files SET owner_type = 'candidate', owner_id = $1 WHERE owner_type = 'registration' AND owner_id = $2 RETURNING *`,
      [candidateId, reg.id]);
    for (const f of files) {
      await query(
        `INSERT INTO compliance_documents (candidate_id, type, status, file_id) VALUES ($1,$2,'pending',$3)`,
        [candidateId, f.label || 'Document', f.id]);
    }
    if (files.length) await recomputeComplianceScore(candidateId);
    // CV text for matching (keeps AI screening useful on self-registered CVs)
    if (p.cv_text) {
      await query(`UPDATE candidates SET notes = COALESCE(notes,'') || $1 WHERE id = $2`,
        [`\n\n--- CV ---\n${p.cv_text.slice(0, 20000)}`, candidateId]);
    }

    await query(`UPDATE registrations SET status = 'submitted', submitted_at = now(), candidate_id = $1, updated_at = now() WHERE id = $2`,
      [candidateId, reg.id]);

    // 1.4 acknowledgement — wording comes from settings; goes to the outbox.
    const subject = await getSetting('registration_ack_subject');
    const body = (await getSetting('registration_ack_body') || '').replaceAll('{name}', p.first_name);
    if (p.email) {
      await notify({ channel: 'email', toName: `${p.first_name} ${p.last_name}`, toContact: p.email,
        subject, body, entityType: 'candidate', entityId: candidateId });
    }
    if (p.phone) {
      await notify({ channel: 'whatsapp', toName: `${p.first_name} ${p.last_name}`, toContact: p.phone,
        subject, body, entityType: 'candidate', entityId: candidateId });
    }
    res.status(201).json({ ok: true, candidateId });
  } catch (e) { next(e); }
});

// ─── 6.2 Public phone-signing links for timesheets ────────────────────────

async function loadToken(token) {
  const { rows } = await query(
    `SELECT t.*, s.shift_date, s.start_time, s.end_time, s.hours, s.actual_hours, s.shift_type,
            s.signatory_notes, s.worker_sig_at, s.client_sig_at, s.timesheet_locked, s.status AS shift_status,
            c.first_name || ' ' || c.last_name AS worker_name, c.role AS worker_role,
            cl.name AS client_name, cl.standing_instructions
     FROM sign_tokens t
     JOIN shifts s ON s.id = t.shift_id
     JOIN candidates c ON c.id = s.candidate_id
     JOIN clients cl ON cl.id = s.client_id
     WHERE t.token = $1 AND t.expires_at > now()`, [token]);
  return rows[0];
}

r.get('/sign/:token', async (req, res, next) => {
  try {
    const t = await loadToken(req.params.token);
    if (!t) return res.status(404).json({ error: 'Link expired or invalid' });
    // Worker-facing view: deliberately no pay/charge rates (6.1)
    res.json({
      kind: t.kind,
      used: !!t.used_at,
      shift: {
        id: t.shift_id, date: t.shift_date, start: t.start_time, end: t.end_time,
        hours: t.actual_hours ?? t.hours, type: t.shift_type,
        worker_name: t.worker_name, client_name: t.client_name,
        instructions: t.standing_instructions,
      },
      already_signed: t.kind === 'worker_signature' ? !!t.worker_sig_at : !!t.client_sig_at,
      locked: t.timesheet_locked,
    });
  } catch (e) { next(e); }
});

r.post('/sign/:token', async (req, res, next) => {
  try {
    const t = await loadToken(req.params.token);
    if (!t) return res.status(404).json({ error: 'Link expired or invalid' });
    if (t.used_at) return res.status(409).json({ error: 'This link has already been used' });
    const { name, notes } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Signer name required' });
    const col = t.kind === 'worker_signature' ? 'worker' : 'client';
    await query(
      `UPDATE shifts SET ${col}_sig_name = $1, ${col}_sig_at = now(),
         signatory_notes = COALESCE($2, signatory_notes),
         timesheet_status = CASE WHEN timesheet_status = 'not_submitted' THEN 'submitted' ELSE timesheet_status END,
         updated_at = now()
       WHERE id = $3`,
      [name.trim(), notes?.trim() || null, t.shift_id]);
    // fully signed (both parties) → locked
    await query(
      `UPDATE shifts SET timesheet_locked = TRUE WHERE id = $1 AND worker_sig_at IS NOT NULL AND client_sig_at IS NOT NULL`,
      [t.shift_id]);
    await query(`UPDATE sign_tokens SET used_at = now() WHERE id = $1`, [t.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
