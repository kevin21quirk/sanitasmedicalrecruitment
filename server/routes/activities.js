import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

// Global activity feed / comms log
r.get('/', async (req, res, next) => {
  try {
    const { type, user_id, limit = 100 } = req.query;
    const where = [], params = [];
    if (type) { params.push(type); where.push(`a.type = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`a.user_id = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const { rows } = await query(
      `SELECT a.*, u.name AS user_name, u.initials, u.color,
        CASE a.entity_type
          WHEN 'candidate' THEN (SELECT first_name || ' ' || last_name FROM candidates WHERE id = a.entity_id)
          WHEN 'client' THEN (SELECT name FROM clients WHERE id = a.entity_id)
          WHEN 'vacancy' THEN (SELECT title FROM vacancies WHERE id = a.entity_id)
          ELSE 'Placement #' || a.entity_id
        END AS entity_name
       FROM activities a LEFT JOIN users u ON u.id = a.user_id
       ${whereSql} ORDER BY a.created_at DESC LIMIT $${params.length}`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const { entity_type, entity_id, type = 'note', subject, body, direction, user_id } = req.body;
    const { rows } = await query(
      `INSERT INTO activities (entity_type, entity_id, type, subject, body, direction, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [entity_type, entity_id, type, subject, body, direction, user_id]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

export default r;
