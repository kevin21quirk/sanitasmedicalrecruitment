import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const { stage, search } = req.query;
    const where = [], params = [];
    if (stage) { params.push(stage); where.push(`p.stage = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.first_name || ' ' || c.last_name ILIKE $${params.length} OR cl.name ILIKE $${params.length} OR v.title ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT p.*, c.first_name || ' ' || c.last_name AS candidate_name, c.role AS candidate_role,
        cl.name AS client_name, v.title AS vacancy_title, u.name AS owner_name, u.initials AS owner_initials, u.color AS owner_color
       FROM placements p
       JOIN candidates c ON c.id = p.candidate_id
       JOIN clients cl ON cl.id = p.client_id
       LEFT JOIN vacancies v ON v.id = p.vacancy_id
       LEFT JOIN users u ON u.id = p.owner_id
       ${whereSql} ORDER BY p.submitted_at DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO placements (vacancy_id, candidate_id, client_id, stage, pay_rate, charge_rate, start_date, owner_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.vacancy_id || null, b.candidate_id, b.client_id, b.stage || 'submitted',
       b.pay_rate, b.charge_rate, b.start_date || null, b.owner_id, b.notes]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['vacancy_id','candidate_id','client_id','stage','pay_rate','charge_rate','placed_at','start_date','end_date','end_reason','owner_id','notes'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    // Auto-set placed_at when moved into placed/active
    if (req.body.stage && ['placed', 'active'].includes(req.body.stage)) {
      sets.push(`placed_at = COALESCE(placed_at, now())`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(`UPDATE placements SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM placements WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
