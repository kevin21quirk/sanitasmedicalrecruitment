import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const { status, user_id } = req.query;
    const where = [], params = [];
    if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`t.user_id = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT t.*, u.name AS user_name, u.initials, u.color,
        CASE t.entity_type
          WHEN 'candidate' THEN (SELECT first_name || ' ' || last_name FROM candidates WHERE id = t.entity_id)
          WHEN 'client' THEN (SELECT name FROM clients WHERE id = t.entity_id)
          WHEN 'vacancy' THEN (SELECT title FROM vacancies WHERE id = t.entity_id)
          ELSE NULL
        END AS entity_name
       FROM tasks t LEFT JOIN users u ON u.id = t.user_id
       ${whereSql} ORDER BY t.status = 'done', t.due_date NULLS LAST`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const { user_id, title, description, due_date, priority = 'medium', entity_type, entity_id } = req.body;
    const { rows } = await query(
      `INSERT INTO tasks (user_id, title, description, due_date, priority, entity_type, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [user_id, title, description, due_date || null, priority, entity_type, entity_id]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['user_id','title','description','due_date','priority','status'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (req.body.status === 'done') sets.push(`completed_at = now()`);
    if (req.body.status && req.body.status !== 'done') sets.push(`completed_at = NULL`);
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM tasks WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
