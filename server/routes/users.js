import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM users WHERE is_active ORDER BY name`);
    res.json(rows);
  } catch (e) { next(e); }
});

export default r;
