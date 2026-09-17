import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const { search, stage, role, priority, client_id } = req.query;
    const where = [], params = [];
    if (search) { params.push(`%${search}%`); where.push(`(v.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`); }
    if (stage) { params.push(stage); where.push(`v.stage = $${params.length}`); }
    if (role) { params.push(role); where.push(`v.role = $${params.length}`); }
    if (priority) { params.push(priority); where.push(`v.priority = $${params.length}`); }
    if (client_id) { params.push(client_id); where.push(`v.client_id = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT v.*, c.name AS client_name, c.town AS client_town, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color,
        (SELECT COUNT(*) FROM placements p WHERE p.vacancy_id = v.id) AS submissions
       FROM vacancies v JOIN clients c ON c.id = v.client_id LEFT JOIN users u ON u.id = v.owner_id
       ${whereSql} ORDER BY v.posted_at DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const [v, pipeline, acts] = await Promise.all([
      query(`SELECT v.*, c.name AS client_name, c.town AS client_town, c.cqc_rating, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
             FROM vacancies v JOIN clients c ON c.id = v.client_id LEFT JOIN users u ON u.id = v.owner_id WHERE v.id = $1`, [id]),
      query(`SELECT p.*, c.first_name || ' ' || c.last_name AS candidate_name, c.role AS candidate_role, c.compliance_score
             FROM placements p JOIN candidates c ON c.id = p.candidate_id
             WHERE p.vacancy_id = $1 ORDER BY p.submitted_at DESC`, [id]),
      query(`SELECT a.*, u.name AS user_name, u.initials, u.color FROM activities a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.entity_type = 'vacancy' AND a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 50`, [id]),
    ]);
    if (!v.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ...v.rows[0], pipeline: pipeline.rows, activities: acts.rows });
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO vacancies (client_id, title, role, employment_type, shift_pattern, hours_per_week, pay_rate, charge_rate,
        stage, priority, openings, start_date, closes_at, description, requirements, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [b.client_id, b.title, b.role, b.employment_type || 'temporary', b.shift_pattern, b.hours_per_week,
       b.pay_rate, b.charge_rate, b.stage || 'open', b.priority || 'medium', b.openings || 1,
       b.start_date || null, b.closes_at || null, b.description, b.requirements || [], b.owner_id]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['client_id','title','role','employment_type','shift_pattern','hours_per_week','pay_rate','charge_rate','stage','priority','openings','start_date','closes_at','filled_at','description','requirements','owner_id'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(`UPDATE vacancies SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM vacancies WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
