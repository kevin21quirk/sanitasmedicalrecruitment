import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

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
        `SELECT c.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
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
    const [c, docs, placements, acts, shifts] = await Promise.all([
      query(`SELECT c.*, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
             FROM candidates c LEFT JOIN users u ON u.id = c.owner_id WHERE c.id = $1`, [id]),
      query(`SELECT d.*, u.name AS verified_by_name FROM compliance_documents d
             LEFT JOIN users u ON u.id = d.verified_by WHERE d.candidate_id = $1 ORDER BY d.type`, [id]),
      query(`SELECT p.*, v.title AS vacancy_title, cl.name AS client_name, u.name AS owner_name
             FROM placements p
             LEFT JOIN vacancies v ON v.id = p.vacancy_id
             JOIN clients cl ON cl.id = p.client_id
             LEFT JOIN users u ON u.id = p.owner_id
             WHERE p.candidate_id = $1 ORDER BY p.submitted_at DESC`, [id]),
      query(`SELECT a.*, u.name AS user_name, u.initials, u.color FROM activities a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.entity_type = 'candidate' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 50`, [id]),
      query(`SELECT s.*, cl.name AS client_name FROM shifts s JOIN clients cl ON cl.id = s.client_id
             WHERE s.candidate_id = $1 ORDER BY s.shift_date DESC LIMIT 30`, [id]),
    ]);
    if (!c.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ...c.rows[0], documents: docs.rows, placements: placements.rows, activities: acts.rows, shifts: shifts.rows });
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO candidates (first_name, last_name, email, phone, role, nmc_pin, address, town, postcode,
        status, pay_min, pay_max, preferred_shift, employment_pref, travel_miles, has_transport, source, tags, owner_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.role, b.nmc_pin, b.address, b.town, b.postcode,
       b.status || 'in_progress', b.pay_min, b.pay_max, b.preferred_shift, b.employment_pref, b.travel_miles,
       b.has_transport || false, b.source, b.tags || [], b.owner_id, b.notes]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['first_name','last_name','email','phone','role','nmc_pin','address','town','postcode','status','pay_min','pay_max','preferred_shift','employment_pref','travel_miles','has_transport','source','rating','tags','owner_id','notes','last_worked_at'];
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

// Compliance docs for candidate
r.post('/:id/documents', async (req, res, next) => {
  try {
    const { type, reference_no, status = 'pending', issue_date, expiry_date, verified_by, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO compliance_documents (candidate_id, type, reference_no, status, issue_date, expiry_date, verified_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, type, reference_no, status, issue_date || null, expiry_date || null, verified_by, notes]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

export default r;
