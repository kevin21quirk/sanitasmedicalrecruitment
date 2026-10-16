import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { upload, replacePhoto } from '../lib/files.js';
import { workerComplianceFor } from '../lib/compliance.js';

const r = Router();

// Care-home logo upload (multipart field "file", images only).
r.post('/:id/logo', upload.single('file'), async (req, res, next) => {
  try {
    const stored = await replacePhoto({ table: 'clients', column: 'logo_file_id', id: +req.params.id,
      file: req.file, uploadedBy: req.account?.id });
    await audit(req, 'client.logo_updated', 'client', +req.params.id);
    res.status(201).json({ logo_file_id: stored.id });
  } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
});

r.get('/', async (req, res, next) => {
  try {
    const { search, type, status, cqc } = req.query;
    const where = [], params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.name ILIKE $${params.length} OR c.group_name ILIKE $${params.length} OR c.town ILIKE $${params.length})`);
    }
    if (type) { params.push(type); where.push(`c.type = $${params.length}`); }
    if (status) { params.push(status); where.push(`c.status = $${params.length}`); }
    if (cqc) { params.push(cqc); where.push(`c.cqc_rating = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT c.*, u.name AS am_name, u.initials AS am_initials, u.color AS am_color,
        (SELECT COUNT(*) FROM vacancies v WHERE v.client_id = c.id AND v.stage NOT IN ('filled','lost')) AS open_vacancies,
        (SELECT COUNT(*) FROM placements p WHERE p.client_id = c.id AND p.stage IN ('placed','active')) AS active_workers,
        (SELECT COUNT(*) FROM client_contacts cc WHERE cc.client_id = c.id) AS contact_count
       FROM clients c LEFT JOIN users u ON u.id = c.account_manager_id
       ${whereSql} ORDER BY c.name`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const [c, contacts, vacancies, placements, acts, shifts, reqs, individuals] = await Promise.all([
      query(`SELECT c.*, u.name AS am_name, u.initials AS am_initials, u.color AS am_color
             FROM clients c LEFT JOIN users u ON u.id = c.account_manager_id WHERE c.id = $1`, [id]),
      query(`SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, name`, [id]),
      query(`SELECT v.*, u.name AS owner_name,
               (SELECT COUNT(*) FROM placements p WHERE p.vacancy_id = v.id) AS submissions
             FROM vacancies v LEFT JOIN users u ON u.id = v.owner_id
             WHERE v.client_id = $1 ORDER BY v.posted_at DESC`, [id]),
      query(`SELECT p.*, c.first_name || ' ' || c.last_name AS candidate_name, c.role AS candidate_role
             FROM placements p JOIN candidates c ON c.id = p.candidate_id
             WHERE p.client_id = $1 ORDER BY p.submitted_at DESC LIMIT 50`, [id]),
      query(`SELECT a.*, u.name AS user_name, u.initials, u.color FROM activities a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.entity_type = 'client' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 50`, [id]),
      query(`SELECT s.*, c.first_name || ' ' || c.last_name AS candidate_name FROM shifts s
             JOIN candidates c ON c.id = s.candidate_id
             WHERE s.client_id = $1 ORDER BY s.shift_date DESC LIMIT 60`, [id]),
      query(`SELECT * FROM client_requirements WHERE client_id = $1 ORDER BY doc_type`, [id]),
      query(`SELECT * FROM individuals WHERE client_id = $1 ORDER BY is_active DESC, name`, [id]),
    ]);
    if (!c.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ...c.rows[0], contacts: contacts.rows, vacancies: vacancies.rows, placements: placements.rows,
      activities: acts.rows, shifts: shifts.rows, requirements: reqs.rows, individuals: individuals.rows });
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO clients (name, group_name, type, address, town, postcode, phone, email, website, beds, cqc_rating, status, payment_terms, account_manager_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [b.name, b.group_name, b.type, b.address, b.town, b.postcode, b.phone, b.email, b.website,
       b.beds, b.cqc_rating, b.status || 'prospect', b.payment_terms || 30, b.account_manager_id, b.notes]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['name','group_name','type','address','town','postcode','phone','email','website','beds','cqc_rating','status','payment_terms','account_manager_id','notes','standing_instructions','share_profile_fields'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(`UPDATE clients SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.post('/:id/contacts', async (req, res, next) => {
  try {
    const { name, role, email, phone, is_primary = false, is_signatory = false } = req.body;
    const { rows } = await query(
      `INSERT INTO client_contacts (client_id, name, role, email, phone, is_primary, is_signatory) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, name, role, email, phone, is_primary, is_signatory]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Mark a contact as an authorised timesheet signatory (6.2/6.10a) or portal user.
r.patch('/:id/contacts/:contactId', async (req, res, next) => {
  try {
    const allowed = ['name', 'role', 'email', 'phone', 'is_primary', 'is_signatory'];
    const sets = [], params = [];
    for (const k of allowed) if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.contactId, req.params.id);
    const { rows } = await query(
      `UPDATE client_contacts SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND client_id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ─── 2.3 per-site required-document list ──────────────────────────────────
r.put('/:id/requirements', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items[] required: {doc_type, required}' });
    for (const it of items) {
      await query(
        `INSERT INTO client_requirements (client_id, doc_type, required) VALUES ($1,$2,$3)
         ON CONFLICT (client_id, doc_type) DO UPDATE SET required = EXCLUDED.required`,
        [req.params.id, it.doc_type, !!it.required]);
    }
    await audit(req, 'requirements.updated', 'client', +req.params.id, { count: items.length });
    const { rows } = await query(`SELECT * FROM client_requirements WHERE client_id = $1 ORDER BY doc_type`, [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ─── Care-home compliance board — placeable workers for THIS site (2.3/2.4) ─
// Runs the per-candidate × per-site matrix so staff can see at a glance who can
// be booked here and exactly why the others can't. Staff-only (portal accounts
// never reach this router).
r.get('/:id/compliance-board', async (req, res, next) => {
  try {
    const { rows: cands } = await query(
      `SELECT id, first_name, last_name, role, status, suspended, photo_file_id
       FROM candidates WHERE erased_at IS NULL ORDER BY last_name, first_name`);
    const workers = [];
    let okCount = 0;
    for (const c of cands) {
      const { ok, gaps } = await workerComplianceFor(c.id, req.params.id);
      if (ok) okCount++;
      else workers.push({ ...c, gaps });
    }
    const placeable = cands.filter((c) => !workers.some((w) => w.id === c.id));
    res.json({ placeable, blocked: workers, total: cands.length, compliant: okCount });
  } catch (e) { next(e); }
});

// ─── 3.7 named individuals at this site ───────────────────────────────────
r.post('/:id/individuals', async (req, res, next) => {
  try {
    const { name, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { rows } = await query(
      `INSERT INTO individuals (client_id, name, notes) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, name, notes || null]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id/individuals/:iid', async (req, res, next) => {
  try {
    const allowed = ['name', 'notes', 'is_active'];
    const sets = [], params = [];
    for (const k of allowed) if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.iid, req.params.id);
    const { rows } = await query(
      `UPDATE individuals SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND client_id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.post('/:id/activities', async (req, res, next) => {
  try {
    const { type = 'note', subject, body, user_id } = req.body;
    const { rows } = await query(
      `INSERT INTO activities (entity_type, entity_id, type, subject, body, user_id) VALUES ('client',$1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, type, subject, body, user_id]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

export default r;
