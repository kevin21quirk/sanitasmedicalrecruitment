import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (_req, res, next) => {
  try {
    const [revenueByClient, recruiterBoard, timeToFill, complianceByRole, shiftStats, monthlyRevenue] = await Promise.all([
      query(`SELECT cl.name, COALESCE(SUM(s.hours * s.charge_rate), 0) AS revenue,
               COALESCE(SUM(s.hours), 0) AS hours
             FROM shifts s JOIN clients cl ON cl.id = s.client_id
             WHERE s.status = 'completed'
             GROUP BY cl.name ORDER BY revenue DESC LIMIT 10`),
      query(`SELECT u.name, u.initials, u.color,
               COUNT(p.*) FILTER (WHERE p.stage IN ('placed','active')) AS placements,
               COUNT(p.*) AS submissions
             FROM users u LEFT JOIN placements p ON p.owner_id = u.id
             GROUP BY u.id, u.name, u.initials, u.color ORDER BY placements DESC`),
      query(`SELECT AVG(EXTRACT(EPOCH FROM (placed_at - submitted_at)) / 86400)::numeric(5,1) AS avg_days
             FROM placements WHERE placed_at IS NOT NULL`),
      query(`SELECT c.role,
               AVG(c.compliance_score)::numeric(5,1) AS avg_score,
               COUNT(*) FILTER (WHERE c.compliance_score >= 80) AS compliant,
               COUNT(*) AS total
             FROM candidates c GROUP BY c.role ORDER BY c.role`),
      query(`SELECT
               COUNT(*) FILTER (WHERE status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
               COUNT(*) FILTER (WHERE status = 'no_show') AS no_show,
               COUNT(*) FILTER (WHERE status = 'booked') AS booked,
               COALESCE(SUM(hours) FILTER (WHERE status = 'completed'), 0) AS hours_completed
             FROM shifts`),
      query(`SELECT to_char(date_trunc('month', shift_date), 'Mon YY') AS month,
               date_trunc('month', shift_date) AS m,
               COALESCE(SUM(hours * charge_rate), 0) AS revenue,
               COALESCE(SUM(hours * pay_rate), 0) AS pay,
               COALESCE(SUM(hours * (charge_rate - pay_rate)), 0) AS margin
             FROM shifts WHERE status = 'completed' GROUP BY 2 ORDER BY 2`),
    ]);
    res.json({
      revenueByClient: revenueByClient.rows,
      recruiterBoard: recruiterBoard.rows,
      avgTimeToFill: timeToFill.rows[0].avg_days,
      complianceByRole: complianceByRole.rows,
      shiftStats: shiftStats.rows[0],
      monthlyRevenue: monthlyRevenue.rows,
    });
  } catch (e) { next(e); }
});

export default r;
