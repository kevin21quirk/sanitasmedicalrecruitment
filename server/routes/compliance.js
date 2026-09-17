import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

// Compliance overview
r.get('/overview', async (_req, res, next) => {
  try {
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
    const allowed = ['type','reference_no','status','issue_date','expiry_date','verified_by','notes'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE compliance_documents SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default r;
