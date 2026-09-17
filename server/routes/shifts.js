import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const { from, to, candidate_id, client_id, status, timesheet_status } = req.query;
    const where = [], params = [];
    if (from) { params.push(from); where.push(`s.shift_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`s.shift_date <= $${params.length}`); }
    if (candidate_id) { params.push(candidate_id); where.push(`s.candidate_id = $${params.length}`); }
    if (client_id) { params.push(client_id); where.push(`s.client_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`s.status = $${params.length}`); }
    if (timesheet_status) { params.push(timesheet_status); where.push(`s.timesheet_status = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT s.*, c.first_name || ' ' || c.last_name AS candidate_name, c.role AS candidate_role,
        cl.name AS client_name
       FROM shifts s
       JOIN candidates c ON c.id = s.candidate_id
       JOIN clients cl ON cl.id = s.client_id
       ${whereSql} ORDER BY s.shift_date, s.start_time`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

r.get('/timesheets', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, c.first_name || ' ' || c.last_name AS candidate_name, cl.name AS client_name,
        (s.hours * s.pay_rate) AS pay_amount, (s.hours * s.charge_rate) AS charge_amount
       FROM shifts s
       JOIN candidates c ON c.id = s.candidate_id
       JOIN clients cl ON cl.id = s.client_id
       WHERE s.status = 'completed'
       ORDER BY s.timesheet_status, s.shift_date DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO shifts (placement_id, candidate_id, client_id, shift_date, start_time, end_time, hours, shift_type, pay_rate, charge_rate, status, timesheet_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [b.placement_id || null, b.candidate_id, b.client_id, b.shift_date, b.start_time, b.end_time,
       b.hours, b.shift_type || 'day', b.pay_rate, b.charge_rate, b.status || 'booked', b.timesheet_status || 'not_submitted']);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['shift_date','start_time','end_time','hours','shift_type','pay_rate','charge_rate','status','timesheet_status'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(`UPDATE shifts SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM shifts WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
