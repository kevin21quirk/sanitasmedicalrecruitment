import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify } from '../lib/notify.js';
import { getSetting } from '../lib/settings.js';
import { nonPlaceable } from '../lib/compliance.js';
import { upload } from '../lib/files.js';

const r = Router();

// Keep document statuses honest: expiry_date in the past → expired,
// within 60 days → expiring (unless already pending/missing).
async function refreshStatuses() {
  await query(`
    UPDATE compliance_documents SET status = 'expired', updated_at = now()
    WHERE expiry_date < CURRENT_DATE AND status IN ('valid','expiring')`);
  await query(`
    UPDATE compliance_documents SET status = 'expiring', updated_at = now()
    WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + 60 AND status = 'valid'`);
}

// Compliance overview
r.get('/overview', async (_req, res, next) => {
  try {
    await refreshStatuses();
    const [summary, expiring, byType] = await Promise.all([
      query(`SELECT
        COUNT(*) FILTER (WHERE status = 'valid') AS valid,
        COUNT(*) FILTER (WHERE status = 'expiring') AS expiring,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'missing') AS missing,
        COUNT(DISTINCT candidate_id) FILTER (WHERE status IN ('expired','missing')) AS candidates_blocked
        FROM compliance_documents`),
      query(`SELECT d.*, c.first_name || ' ' || c.last_name AS candidate_name, c.role AS candidate_role, c.status AS candidate_status
             FROM compliance_documents d JOIN candidates c ON c.id = d.candidate_id
             WHERE d.status IN ('expired','expiring','missing','pending')
             ORDER BY d.status = 'expired' DESC, d.expiry_date NULLS LAST, d.expiry_date`),
      query(`SELECT type,
              COUNT(*) FILTER (WHERE status = 'valid') AS valid,
              COUNT(*) FILTER (WHERE status = 'expiring') AS expiring,
              COUNT(*) FILTER (WHERE status = 'expired') AS expired,
              COUNT(*) FILTER (WHERE status = 'pending') AS pending,
              COUNT(*) FILTER (WHERE status = 'missing') AS missing
             FROM compliance_documents GROUP BY type ORDER BY type`),
    ]);
    res.json({ summary: summary.rows[0], attention: expiring.rows, byType: byType.rows });
  } catch (e) { next(e); }
});

r.patch('/documents/:id', async (req, res, next) => {
  try {
    const allowed = ['type','reference_no','status','issue_date','expiry_date','verified_by','notes',
                     'file_id','dbs_update_service','last_checked_at','check_result'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE compliance_documents SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    await audit(req, 'document.updated', 'document', +req.params.id, req.body);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// 7.4 — workers non-placeable because of lapsed/missing documents.
r.get('/non-placeable', async (req, res, next) => {
  try {
    const clientId = req.query.client_id ? +req.query.client_id : null;
    res.json(await nonPlaceable(clientId));
  } catch (e) { next(e); }
});

// 2.10 — import externally-provided training records.
// Accepts a CSV upload or pasted CSV text with columns:
//   email (or candidate_id), doc_type, completed_date, expiry_date(optional)
r.post('/import-training', upload.single('file'), async (req, res, next) => {
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : (req.body.csv || '');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const header = lines[0]?.toLowerCase().split(',').map((s) => s.trim());
    const emailIx = header?.findIndex((h) => h.includes('email'));
    const idIx = header?.findIndex((h) => h.includes('candidate'));
    const typeIx = header?.findIndex((h) => h.includes('type') || h.includes('course'));
    const doneIx = header?.findIndex((h) => h.includes('complet') || h.includes('issue') || h.includes('date'));
    const expIx = header?.findIndex((h) => h.includes('expir'));
    const results = { imported: 0, skipped: [], rows: lines.length - 1 };
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map((s) => s.trim());
      const type = cols[typeIx] || 'Mandatory Training';
      const done = cols[doneIx] || null;
      const exp = expIx >= 0 ? cols[expIx] || null : null;
      let cid = null;
      if (idIx >= 0 && /^\d+$/.test(cols[idIx])) cid = +cols[idIx];
      else if (emailIx >= 0 && cols[emailIx]) {
        const { rows } = await query(`SELECT id FROM candidates WHERE email ILIKE $1`, [cols[emailIx]]);
        cid = rows[0]?.id;
      }
      if (!cid) { results.skipped.push(line); continue; }
      const { rows: existing } = await query(
        `SELECT id FROM compliance_documents WHERE candidate_id = $1 AND type = $2`, [cid, type]);
      const status = exp && new Date(exp) < new Date() ? 'expired' : 'valid';
      if (existing.length) {
        await query(
          `UPDATE compliance_documents SET issue_date = $1, expiry_date = $2, status = $3,
             verified_by = $4, updated_at = now() WHERE id = $5`,
          [done, exp, status, req.account?.userId, existing[0].id]);
      } else {
        await query(
          `INSERT INTO compliance_documents (candidate_id, type, status, issue_date, expiry_date, verified_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [cid, type, status, done, exp, req.account?.userId]);
      }
      results.imported++;
    }
    await audit(req, 'training.imported', null, null, results);
    res.json(results);
  } catch (e) { next(e); }
});

// 2.2 — generate expiry reminders into the outbox (worker + compliance officer)
// plus one monthly digest summary. Safe to call repeatedly; duplicates are
// avoided per document per day.
r.post('/send-reminders', async (req, res, next) => {
  try {
    await refreshStatuses();
    const windows = await getSetting('reminder_days'); // e.g. [60,30,14,7]
    const { rows: due } = await query(
      `SELECT d.id AS doc_id, d.type, d.expiry_date, d.expiry_date - CURRENT_DATE AS days_left,
              c.id AS candidate_id, c.first_name || ' ' || c.last_name AS candidate_name,
              c.email AS candidate_email, c.phone AS candidate_phone
       FROM compliance_documents d JOIN candidates c ON c.id = d.candidate_id
       WHERE d.expiry_date IS NOT NULL AND d.status IN ('valid','expiring')
         AND (d.expiry_date - CURRENT_DATE) = ANY($1) AND c.erased_at IS NULL`,
      [windows]);

    let queued = 0;
    for (const d of due) {
      const already = await query(
        `SELECT 1 FROM messages WHERE entity_type = 'compliance_document' AND entity_id = $1
           AND created_at::date = CURRENT_DATE`, [d.doc_id]);
      if (already.rows.length) continue;
      const body = `Hi ${d.candidate_name.split(' ')[0]}, your ${d.type} expires on ${d.expiry_date} (${d.days_left} days). Please send us your renewed document as soon as possible. — Sanitas`;
      await notify({ channel: 'whatsapp', toName: d.candidate_name, toContact: d.candidate_phone,
        subject: `${d.type} expiring`, body, entityType: 'compliance_document', entityId: d.doc_id,
        createdBy: req.account?.userId });
      if (d.candidate_email) {
        await notify({ channel: 'email', toName: d.candidate_name, toContact: d.candidate_email,
          subject: `Your ${d.type} expires in ${d.days_left} days`, body,
          entityType: 'compliance_document', entityId: d.doc_id, createdBy: req.account?.userId });
      }
      queued++;
    }

    // Monthly digest: single summary to the compliance team of everything due.
    let digest = null;
    if (await getSetting('monthly_digest')) {
      const { rows: all } = await query(
        `SELECT d.type, d.expiry_date, d.expiry_date - CURRENT_DATE AS days_left,
                c.first_name || ' ' || c.last_name AS candidate_name
         FROM compliance_documents d JOIN candidates c ON c.id = d.candidate_id
         WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= CURRENT_DATE + 60
           AND d.status IN ('valid','expiring','expired') AND c.erased_at IS NULL
         ORDER BY d.expiry_date`);
      const { rows: staff } = await query(
        `SELECT u.email, u.name FROM users u JOIN accounts a ON a.user_id = u.id
         WHERE u.access_role IN ('compliance','admin') AND a.is_active`);
      const body = `Compliance expiry digest (${all.length} documents due within 60 days):\n\n` +
        all.map((d) => `• ${d.candidate_name} — ${d.type}: ${d.days_left < 0 ? 'EXPIRED' : `${d.days_left}d`} (${d.expiry_date})`).join('\n');
      for (const s of staff) {
        digest = await notify({ channel: 'email', toName: s.name, toContact: s.email,
          subject: 'Monthly compliance expiry digest', body, createdBy: req.account?.userId });
      }
    }
    await audit(req, 'compliance.reminders_sent', null, null, { queued, digest: !!digest });
    res.json({ queued, digestSent: !!digest });
  } catch (e) { next(e); }
});

export default r;
