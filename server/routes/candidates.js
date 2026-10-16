import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { canSeeOH, canEditCompliance } from '../lib/auth.js';

const compGuard = (req, res, next) =>
  canEditCompliance(req.account) ? next() : res.status(403).json({ error: 'Compliance records can only be changed by office/compliance staff' });
import { upload, storeFile, replacePhoto } from '../lib/files.js';
import { workerComplianceFor, docHealth } from '../lib/compliance.js';

const r = Router();

// Profile photo upload (multipart field "file", images only).
r.post('/:id/photo', upload.single('file'), async (req, res, next) => {
  try {
    const stored = await replacePhoto({ table: 'candidates', column: 'photo_file_id', id: +req.params.id,
      file: req.file, uploadedBy: req.account?.id });
    await audit(req, 'candidate.photo_updated', 'candidate', +req.params.id);
    res.status(201).json({ photo_file_id: stored.id });
  } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
});

// List with search/filter/pagination
r.get('/', async (req, res, next) => {
  try {
    const { search, role, status, compliance, owner_id, sort = 'created_at', dir = 'desc', page = 1, limit = 25 } = req.query;
    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.town ILIKE $${params.length} OR c.nmc_pin ILIKE $${params.length})`);
    }
    if (role) { params.push(role); where.push(`c.role = $${params.length}`); }
    if (status) { params.push(status); where.push(`c.status = $${params.length}`); }
    if (owner_id) { params.push(owner_id); where.push(`c.owner_id = $${params.length}`); }
    if (compliance === 'attention') where.push(`c.compliance_score < 80`);
    if (compliance === 'compliant') where.push(`c.compliance_score >= 80`);

    const sortCol = { name: 'c.last_name', created_at: 'c.created_at', compliance: 'c.compliance_score', rating: 'c.rating', last_worked: 'c.last_worked_at' }[sort] || 'c.created_at';
    const direction = dir === 'asc' ? 'ASC' : 'DESC';
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(limit, (page - 1) * limit);
    const [rows, count] = await Promise.all([
      query(
        `SELECT c.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color, u.photo_file_id AS owner_photo_file_id,
          (SELECT COUNT(*) FROM compliance_documents d WHERE d.candidate_id = c.id AND d.status IN ('expired','missing')) AS docs_attention
         FROM candidates c LEFT JOIN users u ON u.id = c.owner_id
         ${whereSql}
         ORDER BY ${sortCol} ${direction} NULLS LAST
         LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query(`SELECT COUNT(*) FROM candidates c ${whereSql}`, params.slice(0, -2)),
    ]);
    res.json({ data: rows.rows, total: +count.rows[0].count, page: +page, limit: +limit });
  } catch (e) { next(e); }
});

// Stats strip
r.get('/stats', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'compliant') AS compliant,
        COUNT(*) FILTER (WHERE status = 'on_assignment') AS on_assignment,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE registered_at > now() - interval '30 days') AS new_30d
      FROM candidates`);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const [c, docs, placements, acts, shifts, blocks, checks] = await Promise.all([
      query(`SELECT c.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
             FROM candidates c LEFT JOIN users u ON u.id = c.owner_id WHERE c.id = $1`, [id]),
      query(`SELECT d.*, u.name AS verified_by_name, f.filename AS file_name
             FROM compliance_documents d
             LEFT JOIN users u ON u.id = d.verified_by
             LEFT JOIN files f ON f.id = d.file_id
             WHERE d.candidate_id = $1 ORDER BY d.type`, [id]),
      query(`SELECT p.*, v.title AS vacancy_title, cl.name AS client_name, u.name AS owner_name
             FROM placements p
             LEFT JOIN vacancies v ON v.id = p.vacancy_id
             JOIN clients cl ON cl.id = p.client_id
             LEFT JOIN users u ON u.id = p.owner_id
             WHERE p.candidate_id = $1 ORDER BY p.submitted_at DESC`, [id]),
      query(`SELECT a.*, u.name AS user_name, u.initials, u.color FROM activities a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.entity_type = 'candidate' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 50`, [id]),
      query(`SELECT s.*, cl.name AS client_name, i.name AS individual_name FROM shifts s
             JOIN clients cl ON cl.id = s.client_id
             LEFT JOIN individuals i ON i.id = s.individual_id
             WHERE s.candidate_id = $1 ORDER BY s.shift_date DESC LIMIT 30`, [id]),
      query(`SELECT b.*, cl.name AS client_name, i.name AS individual_name
             FROM candidate_blocks b
             LEFT JOIN clients cl ON cl.id = b.client_id
             LEFT JOIN individuals i ON i.id = b.individual_id
             WHERE b.candidate_id = $1 ORDER BY b.created_at DESC`, [id]),
      query(`SELECT rc.*, u.name AS checked_by_name FROM register_checks rc
             LEFT JOIN users u ON u.id = rc.checked_by
             WHERE rc.candidate_id = $1 ORDER BY rc.checked_at DESC`, [id]),
    ]);
    if (!c.rows.length) return res.status(404).json({ error: 'Not found' });
    const out = {
      ...c.rows[0], documents: docs.rows, placements: placements.rows,
      activities: acts.rows, shifts: shifts.rows, blocks: blocks.rows, register_checks: checks.rows,
    };
    // 2.9 — occupational health is restricted to compliance/admin staff
    if (canSeeOH(req.account)) {
      const { rows: oh } = await query(
        `SELECT * FROM oh_records WHERE candidate_id = $1 ORDER BY record_date DESC NULLS LAST`, [id]);
      out.oh_records = oh;
    }
    res.json(out);
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO candidates (first_name, last_name, email, phone, role, nmc_pin, address, town, postcode,
        status, pay_min, pay_max, preferred_shift, employment_pref, travel_miles, has_transport, source, tags, owner_id, notes,
        engagement_type, next_of_kin_name, next_of_kin_phone, rtw_status, rtw_expiry, driving, uniform_size, willing_client_ids, custom_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.role, b.nmc_pin, b.address, b.town, b.postcode,
       b.status || 'in_progress', b.pay_min, b.pay_max, b.preferred_shift, b.employment_pref, b.travel_miles,
       b.has_transport || false, b.source, b.tags || [], b.owner_id, b.notes,
       b.engagement_type || 'paye', b.next_of_kin_name, b.next_of_kin_phone, b.rtw_status, b.rtw_expiry || null,
       b.driving, b.uniform_size, b.willing_client_ids || [], b.custom_fields || {}]
    );
    await audit(req, 'candidate.created', 'candidate', rows[0].id, { name: `${b.first_name} ${b.last_name}` });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['first_name','last_name','email','phone','role','nmc_pin','address','town','postcode','status','pay_min','pay_max','preferred_shift','employment_pref','travel_miles','has_transport','source','rating','tags','owner_id','notes','last_worked_at',
      'engagement_type','next_of_kin_name','next_of_kin_phone','rtw_status','rtw_expiry','driving','uniform_size','willing_client_ids','custom_fields','suspended','first_choice_since'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE candidates SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM candidates WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Add a note/activity to a candidate
r.post('/:id/activities', async (req, res, next) => {
  try {
    const { type = 'note', subject, body, user_id } = req.body;
    const { rows } = await query(
      `INSERT INTO activities (entity_type, entity_id, type, subject, body, user_id) VALUES ('candidate',$1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, type, subject, body, user_id]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Compliance docs for candidate — recording a check is staff-entered data, so
// finance-role users are excluded (A/H least-privilege).
r.post('/:id/documents', compGuard, async (req, res, next) => {
  try {
    const { type, reference_no, status = 'pending', issue_date, expiry_date, verified_by, notes, dbs_update_service } = req.body;
    const { rows } = await query(
      `INSERT INTO compliance_documents (candidate_id, type, reference_no, status, issue_date, expiry_date, verified_by, notes, dbs_update_service)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, type, reference_no, status, issue_date || null, expiry_date || null, verified_by, notes, !!dbs_update_service]);
    await audit(req, 'document.added', 'candidate', +req.params.id, { type });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Upload a file against a compliance document (or create the doc with it).
r.post('/:id/documents/upload', compGuard, upload.single('file'), async (req, res, next) => {
  try {
    const { type, reference_no, issue_date, expiry_date, document_id } = req.body;
    const file = req.file
      ? await storeFile({
          buffer: req.file.buffer, filename: req.file.originalname, mime: req.file.mimetype,
          ownerType: 'candidate', ownerId: +req.params.id, label: type || 'document',
          uploadedBy: req.account?.id,
        })
      : null;
    let doc;
    if (document_id) {
      const { rows } = await query(
        `UPDATE compliance_documents SET file_id = $1, updated_at = now() WHERE id = $2 AND candidate_id = $3 RETURNING *`,
        [file?.id, document_id, req.params.id]);
      doc = rows[0];
    } else {
      const { rows } = await query(
        `INSERT INTO compliance_documents (candidate_id, type, reference_no, status, issue_date, expiry_date, file_id)
         VALUES ($1,$2,$3,'pending',$4,$5,$6) RETURNING *`,
        [req.params.id, type || 'Document', reference_no || null, issue_date || null, expiry_date || null, file?.id]);
      doc = rows[0];
    }
    await audit(req, 'document.uploaded', 'candidate', +req.params.id, { type: doc?.type, file: req.file?.originalname });
    res.status(201).json({ document: doc, file });
  } catch (e) { next(e); }
});

// ─── Occupational health records (2.8/2.9) — compliance & admin only ───
const ohGuard = (req, res, next) =>
  canSeeOH(req.account) && req.account.kind === 'staff'
    ? next()
    : res.status(403).json({ error: 'Occupational health records are restricted to the compliance role' });

r.post('/:id/oh', ohGuard, async (req, res, next) => {
  try {
    const { kind, name, record_date, expiry_date, result, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO oh_records (candidate_id, kind, name, record_date, expiry_date, result, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, kind, name, record_date || null, expiry_date || null, result, notes]);
    await audit(req, 'oh.recorded', 'candidate', +req.params.id, { kind, name });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id/oh/:ohId', ohGuard, async (req, res, next) => {
  try {
    const allowed = ['kind', 'name', 'record_date', 'expiry_date', 'result', 'notes'];
    const sets = [], params = [];
    for (const k of allowed) if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.ohId, req.params.id);
    const { rows } = await query(
      `UPDATE oh_records SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length - 1} AND candidate_id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.delete('/:id/oh/:ohId', ohGuard, async (req, res, next) => {
  try {
    await query(`DELETE FROM oh_records WHERE id = $1 AND candidate_id = $2`, [req.params.ohId, req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── Register checks (2.6 DBS Update Service / 2.7 NMC) ──────────────────
// Manual recording of a DBS/NMC check (A) — source is always 'manual_staff';
// the app never claims independent verification of the external register.
r.post('/:id/register-checks', compGuard, async (req, res, next) => {
  try {
    const { register, identifier, result = 'clear', notes, review_due } = req.body;
    const { rows } = await query(
      `INSERT INTO register_checks (candidate_id, register, identifier, result, checked_by, notes, source, review_due)
       VALUES ($1,$2,$3,$4,$5,$6,'manual_staff',$7) RETURNING *`,
      [req.params.id, register, identifier, result, req.account?.userId, notes, review_due || null]);
    // stamp the matching document's check date + result
    const docType = register === 'nmc' ? 'NMC PIN' : 'DBS Enhanced';
    await query(
      `UPDATE compliance_documents SET last_checked_at = now(), check_result = $1, updated_at = now()
       WHERE candidate_id = $2 AND type = $3`,
      [result, req.params.id, docType]);
    await audit(req, 'register.checked', 'candidate', +req.params.id, { register, result });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ─── Per-client compliance check (2.4 driver; also used by allocation UI) ──
r.get('/:id/compliance/:clientId', async (req, res, next) => {
  try {
    const result = await workerComplianceFor(+req.params.id, +req.params.clientId);
    res.json(result);
  } catch (e) { next(e); }
});

// ─── Printable compliance file (2.11) ────────────────────────────────────
r.get('/:id/compliance-file', async (req, res, next) => {
  try {
    const id = req.params.id;
    const [c, docs, checks] = await Promise.all([
      query(`SELECT id, first_name, last_name, role, nmc_pin, status, compliance_score,
                    rtw_status, rtw_expiry, registered_at FROM candidates WHERE id = $1`, [id]),
      query(`SELECT d.type, d.reference_no, d.status, d.issue_date, d.expiry_date,
                    d.dbs_update_service, d.last_checked_at, d.check_result, u.name AS verified_by_name
             FROM compliance_documents d LEFT JOIN users u ON u.id = d.verified_by
             WHERE d.candidate_id = $1 ORDER BY d.type`, [id]),
      query(`SELECT register, identifier, checked_at, result FROM register_checks
             WHERE candidate_id = $1 ORDER BY checked_at DESC`, [id]),
    ]);
    if (!c.rows.length) return res.status(404).json({ error: 'Not found' });
    const docsOut = docs.rows.map((d) => ({ ...d, live_status: docHealth(d) }));
    const out = { candidate: c.rows[0], documents: docsOut, register_checks: checks.rows, generated_at: new Date() };
    if (canSeeOH(req.account) && req.account.kind === 'staff') {
      const { rows: oh } = await query(
        `SELECT kind, name, record_date, expiry_date, result FROM oh_records WHERE candidate_id = $1 ORDER BY name`, [id]);
      out.oh_records = oh;
    }
    res.json(out);
  } catch (e) { next(e); }
});

// ─── Do-not-offer blocks (3.11) ───────────────────────────────────────────
r.post('/:id/blocks', async (req, res, next) => {
  try {
    const { client_id, individual_id, reason } = req.body;
    if (!client_id && !individual_id) return res.status(400).json({ error: 'client_id or individual_id required' });
    const { rows } = await query(
      `INSERT INTO candidate_blocks (candidate_id, client_id, individual_id, reason, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, client_id || null, individual_id || null, reason || null, req.account?.userId]);
    await audit(req, 'block.added', 'candidate', +req.params.id, { client_id, individual_id, reason });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.delete('/:id/blocks/:blockId', async (req, res, next) => {
  try {
    await query(`DELETE FROM candidate_blocks WHERE id = $1 AND candidate_id = $2`, [req.params.blockId, req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
