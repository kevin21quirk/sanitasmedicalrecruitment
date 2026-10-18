import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (_req, res, next) => {
  try {
    const [kpis, revenue, placementsByMonth, complianceAlerts, recentActivity, tasksDue, pipelineSummary, shiftsThisWeek,
      candidatesByRole, candidatesBySource, candidatesByStatus, requestStats, shiftOutcomes, recentCandidates] = await Promise.all([
      query(`SELECT
        (SELECT COUNT(*) FROM candidates WHERE status IN ('compliant','on_assignment')) AS active_candidates,
        (SELECT COUNT(*) FROM candidates WHERE registered_at > now() - interval '30 days') AS new_candidates_30d,
        (SELECT COUNT(*) FROM clients WHERE status = 'active') AS active_clients,
        (SELECT COUNT(*) FROM vacancies WHERE stage NOT IN ('filled','lost')) AS open_vacancies,
        (SELECT COUNT(*) FROM placements WHERE stage IN ('placed','active')) AS active_placements,
        (SELECT COALESCE(SUM(hours * charge_rate), 0) FROM shifts WHERE status = 'completed' AND shift_date > date_trunc('month', now())::date) AS revenue_mtd,
        (SELECT COALESCE(SUM(hours * (charge_rate - pay_rate)), 0) FROM shifts WHERE status = 'completed' AND shift_date > date_trunc('month', now())::date) AS margin_mtd,
        (SELECT COUNT(*) FROM compliance_documents WHERE status IN ('expired','expiring')) AS compliance_alerts`),
      query(`SELECT to_char(date_trunc('month', shift_date), 'Mon') AS month,
               date_trunc('month', shift_date) AS m,
               COALESCE(SUM(hours * charge_rate), 0) AS revenue,
               COALESCE(SUM(hours * (charge_rate - pay_rate)), 0) AS margin
             FROM shifts WHERE status = 'completed'
             GROUP BY 2 ORDER BY 2`),
      query(`SELECT to_char(date_trunc('month', placed_at), 'Mon') AS month,
               date_trunc('month', placed_at) AS m, COUNT(*) AS count
             FROM placements WHERE placed_at IS NOT NULL
             GROUP BY 2 ORDER BY 2`),
      query(`SELECT d.id, d.type, d.status, d.expiry_date, c.id AS candidate_id,
               c.first_name || ' ' || c.last_name AS candidate_name, c.role AS candidate_role
             FROM compliance_documents d JOIN candidates c ON c.id = d.candidate_id
             WHERE d.status IN ('expired','expiring')
             ORDER BY d.status = 'expired' DESC, d.expiry_date LIMIT 10`),
      query(`SELECT a.*, u.name AS user_name, u.initials, u.color,
               CASE a.entity_type
                 WHEN 'candidate' THEN (SELECT first_name || ' ' || last_name FROM candidates WHERE id = a.entity_id)
                 WHEN 'client' THEN (SELECT name FROM clients WHERE id = a.entity_id)
                 WHEN 'vacancy' THEN (SELECT title FROM vacancies WHERE id = a.entity_id)
                 ELSE 'Placement #' || a.entity_id
               END AS entity_name
             FROM activities a LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at DESC LIMIT 12`),
      query(`SELECT t.*, u.name AS user_name, u.initials, u.color
             FROM tasks t LEFT JOIN users u ON u.id = t.user_id
             WHERE t.status != 'done' ORDER BY t.due_date NULLS LAST LIMIT 8`),
      query(`SELECT stage, COUNT(*) AS count FROM vacancies GROUP BY stage`),
      query(`SELECT s.shift_date, s.shift_type, s.status,
               c.first_name || ' ' || c.last_name AS candidate_name, cl.name AS client_name
             FROM shifts s JOIN candidates c ON c.id = s.candidate_id JOIN clients cl ON cl.id = s.client_id
             WHERE s.shift_date BETWEEN date_trunc('week', now())::date AND date_trunc('week', now())::date + 6
             ORDER BY s.shift_date, s.start_time`),
      // Analytics breakdowns for the dashboard charts
      query(`SELECT role, COUNT(*) AS count FROM candidates WHERE status <> 'do_not_use' GROUP BY role ORDER BY count DESC`),
      query(`SELECT COALESCE(NULLIF(source, ''), 'Unknown') AS source, COUNT(*) AS count FROM candidates GROUP BY 1 ORDER BY count DESC`),
      query(`SELECT status, COUNT(*) AS count FROM candidates GROUP BY status`),
      query(`SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'filled') AS filled,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE status = 'pending' AND urgency = 'urgent') AS urgent,
        COUNT(*) FILTER (WHERE date >= date_trunc('month', now())::date) AS this_month,
        COUNT(*) FILTER (WHERE date >= date_trunc('month', now())::date AND status = 'filled') AS filled_this_month
        FROM shift_requests`),
      query(`SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'booked') AS booked,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE status = 'no_show') AS no_show
        FROM shifts WHERE shift_date > now()::date - 90`),
      query(`SELECT c.id, c.first_name || ' ' || c.last_name AS name, c.role, c.status, c.source,
               c.registered_at, c.last_worked_at, c.compliance_score, c.photo_file_id
             FROM candidates c ORDER BY c.registered_at DESC LIMIT 10`),
    ]);
    res.json({
      kpis: kpis.rows[0],
      revenue: revenue.rows,
      placementsByMonth: placementsByMonth.rows,
      complianceAlerts: complianceAlerts.rows,
      recentActivity: recentActivity.rows,
      tasksDue: tasksDue.rows,
      pipeline: pipelineSummary.rows,
      shiftsThisWeek: shiftsThisWeek.rows,
      candidatesByRole: candidatesByRole.rows,
      candidatesBySource: candidatesBySource.rows,
      candidatesByStatus: candidatesByStatus.rows,
      requestStats: requestStats.rows[0],
      shiftOutcomes: shiftOutcomes.rows[0],
      recentCandidates: recentCandidates.rows,
    });
  } catch (e) { next(e); }
});

export default r;
