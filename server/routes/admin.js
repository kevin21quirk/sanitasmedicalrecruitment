import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify } from '../lib/notify.js';
import { allSettings, setSetting, getSetting } from '../lib/settings.js';
import { requireAccess } from '../lib/auth.js';

const r = Router();

// ─── 8.9 audit log viewer ──────────────────────────────────────────────────
r.get('/audit', async (req, res, next) => {
  try {
    const { entity_type, action, limit = 300 } = req.query;
    const where = [], params = [];
    if (entity_type) { params.push(entity_type); where.push(`entity_type = $${params.length}`); }
    if (action) { params.push(`%${action}%`); where.push(`action ILIKE $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM audit_log ${whereSql} ORDER BY created_at DESC LIMIT $${params.push(+limit)}`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// ─── Settings administration (admin only) ──────────────────────────────────
r.get('/settings', requireAccess('admin'), async (_req, res, next) => {
  try { res.json(await allSettings()); } catch (e) { next(e); }
});
r.put('/settings', requireAccess('admin'), async (req, res, next) => {
  try {
    for (const [k, v] of Object.entries(req.body || {})) await setSetting(k, v);
    await audit(req, 'settings.updated', null, null, { keys: Object.keys(req.body || {}) });
    res.json(await allSettings());
  } catch (e) { next(e); }
});

// ─── 8.5 retention: delete never-worked candidates past the retention window ─
r.post('/retention/purge-never-worked', requireAccess('admin'), async (req, res, next) => {
  try {
    const months = +(req.body?.months ?? await getSetting('retention_never_worked_months') ?? 24);
    const { rows: doomed } = await query(
      `SELECT c.id, c.first_name || ' ' || c.last_name AS name FROM candidates c
       WHERE c.created_at < now() - ($1 || ' months')::interval
         AND NOT EXISTS (SELECT 1 FROM shifts s WHERE s.candidate_id = c.id AND s.status IN ('booked','completed'))
         AND NOT EXISTS (SELECT 1 FROM placements p WHERE p.candidate_id = c.id)
         AND c.erased_at IS NULL`,
      [`${months}`]);
    if (req.body?.dry_run !== false) {
      return res.json({ dry_run: true, months, count: doomed.length, candidates: doomed.slice(0, 100) });
    }
    for (const c of doomed) {
      await query(`DELETE FROM candidates WHERE id = $1`, [c.id]);
    }
    await audit(req, 'retention.purged', null, null, { months, count: doomed.length });
    res.json({ dry_run: false, months, deleted: doomed.length });
  } catch (e) { next(e); }
});

// ─── 8.6 SAR: everything held on a worker (staff-side; worker has self-export) ─
r.get('/candidates/:id/export', async (req, res, next) => {
  try {
    const cid = +req.params.id;
    const [profile, docs, oh, shifts, avail, offers, queries_, acks] = await Promise.all([
      query(`SELECT * FROM candidates WHERE id = $1`, [cid]),
      query(`SELECT * FROM compliance_documents WHERE candidate_id = $1`, [cid]),
      query(`SELECT * FROM oh_records WHERE candidate_id = $1`, [cid]),
      query(`SELECT * FROM shifts WHERE candidate_id = $1`, [cid]),
      query(`SELECT * FROM availability WHERE candidate_id = $1`, [cid]),
      query(`SELECT * FROM offers WHERE candidate_id = $1`, [cid]),
      query(`SELECT q.* FROM timesheet_queries q JOIN shifts s ON s.id = q.shift_id WHERE s.candidate_id = $1`, [cid]),
      query(`SELECT * FROM instruction_acks WHERE candidate_id = $1`, [cid]),
    ]);
    await audit(req, 'data.sar_export', 'candidate', cid);
    res.json({ exported_at: new Date(), profile: profile.rows[0] ?? null, documents: docs.rows,
      occupational_health: oh.rows, shifts: shifts.rows, availability: avail.rows,
      offers: offers.rows, timesheet_queries: queries_.rows, instruction_acks: acks.rows });
  } catch (e) { next(e); }
});

// 8.6 — erasure where lawful: anonymise the record, keep signed timesheets' legal references.
r.post('/candidates/:id/erase', requireAccess('admin'), async (req, res, next) => {
  try {
    const cid = +req.params.id;
    const { rows: live } = await query(
      `SELECT COUNT(*) AS n FROM shifts WHERE candidate_id = $1 AND status = 'booked' AND shift_date >= CURRENT_DATE`, [cid]);
    if (+live[0].n > 0) return res.status(409).json({ error: 'Worker has upcoming booked shifts — cancel them first' });
    await query(
      `UPDATE candidates SET first_name = 'Erased', last_name = 'Worker', email = NULL, phone = NULL,
         address = NULL, postcode = NULL, town = NULL, notes = NULL, nmc_pin = NULL,
         next_of_kin_name = NULL, next_of_kin_phone = NULL, rtw_status = NULL, rtw_expiry = NULL,
         payroll_ref = NULL, bank_details = NULL, custom_fields = '{}', erased_at = now(),
         status = 'do_not_use'
       WHERE id = $1`, [cid]);
    await query(`DELETE FROM oh_records WHERE candidate_id = $1`, [cid]);
    await query(`DELETE FROM availability WHERE candidate_id = $1`, [cid]);
    await query(`UPDATE accounts SET is_active = FALSE WHERE candidate_id = $1`, [cid]);
    await audit(req, 'data.erased', 'candidate', cid);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── 0.6 / 8.7 full data export — the agency owns everything ───────────────
r.get('/export-all', requireAccess('admin'), async (req, res, next) => {
  try {
    const tables = ['users', 'accounts', 'candidates', 'compliance_documents', 'oh_records',
      'clients', 'client_contacts', 'client_requirements', 'individuals', 'vacancies', 'placements',
      'shifts', 'shift_requests', 'offers', 'availability', 'candidate_blocks', 'timesheet_queries',
      'instruction_acks', 'invoices', 'invoice_lines', 'messages', 'activities', 'tasks',
      'registrations', 'audit_log', 'bank_holidays', 'settings', 'files', 'cv_matches', 'sign_tokens'];
    const out = { exported_at: new Date(), data: {} };
    for (const t of tables) {
      const { rows } = await query(`SELECT * FROM ${t}`);
      out.data[t] = rows;
    }
    await audit(req, 'data.full_export', null, null);
    res.setHeader('Content-Disposition', `attachment; filename="sanitas-export-${Date.now()}.json"`);
    res.json(out);
  } catch (e) { next(e); }
});

// ─── 7.x operational reports ───────────────────────────────────────────────
r.get('/operational', async (req, res, next) => {
  try {
    const [drops, reoffer, withdrawals, nonPlaceable, fillRate, tsNotes] = await Promise.all([
      // 7.1 confirmed shifts subsequently dropped by the worker
      query(
        `SELECT c.first_name || ' ' || c.last_name AS worker,
                COUNT(*) FILTER (WHERE s.status = 'cancelled' AND s.cancelled_by NOT ILIKE '%client%') AS dropped,
                COUNT(*) FILTER (WHERE s.status = 'no_show') AS no_shows,
                COUNT(*) FILTER (WHERE s.status IN ('completed')) AS completed
         FROM shifts s JOIN candidates c ON c.id = s.candidate_id
         GROUP BY c.id, c.first_name, c.last_name HAVING COUNT(*) FILTER (WHERE s.status != 'booked') > 0
         ORDER BY dropped DESC`),
      // 7.2 how long a re-offered shift takes to fill
      query(
        `SELECT AVG(EXTRACT(EPOCH FROM (filled_at - created_at)) / 3600)::numeric(10,1) AS avg_hours,
                COUNT(*) AS filled_requests
         FROM shift_requests WHERE status = 'filled' AND filled_at IS NOT NULL`),
      // 7.3 recorded withdrawal reasons
      query(
        `SELECT o.decline_reason AS reason, COUNT(*) AS count,
                c.first_name || ' ' || c.last_name AS worker
         FROM offers o JOIN candidates c ON c.id = o.candidate_id
         WHERE o.status = 'declined' GROUP BY c.id, c.first_name, c.last_name, o.decline_reason
         ORDER BY count DESC LIMIT 100`),
      // 7.4 workers blocked by lapsed docs (delegates to compliance overview data)
      query(
        `SELECT c.id, c.first_name || ' ' || c.last_name AS worker, c.role, COUNT(*) AS gaps
         FROM candidates c
         JOIN compliance_documents d ON d.candidate_id = c.id AND d.status IN ('expired','missing')
         WHERE c.erased_at IS NULL
         GROUP BY c.id, c.first_name, c.last_name, c.role ORDER BY gaps DESC`),
      // 7.5 fill rate by client by week
      query(
        `SELECT cl.name AS client, date_trunc('week', sr.date) AS week,
                SUM(sr.qty) AS requested,
                COUNT(s.id) FILTER (WHERE s.status != 'cancelled') AS filled
         FROM shift_requests sr
         JOIN clients cl ON cl.id = sr.client_id
         LEFT JOIN shifts s ON s.request_id = sr.id
         GROUP BY cl.name, 2 ORDER BY 2 DESC LIMIT 200`),
      // 6.10b — signatory notes retained with signed timesheets, reportable by worker/client
      query(
        `SELECT s.id AS shift_id, s.shift_date, cl.name AS client_name,
                c.first_name || ' ' || c.last_name AS worker_name, s.signatory_notes AS note
         FROM shifts s JOIN clients cl ON cl.id = s.client_id JOIN candidates c ON c.id = s.candidate_id
         WHERE s.signatory_notes IS NOT NULL AND s.signatory_notes != ''
         ORDER BY s.shift_date DESC LIMIT 200`),
    ]);
    res.json({
      drops: drops.rows,
      reoffer_fill_hours: reoffer.rows[0].avg_hours,
      reoffer_filled_count: +reoffer.rows[0].filled_requests,
      withdrawals: withdrawals.rows,
      non_placeable: nonPlaceable.rows,
      timesheet_notes: tsNotes.rows,
      fill_rate: fillRate.rows.map((r) => ({
        ...r, requested: +r.requested, filled: +r.filled,
        pct: +r.requested ? Math.round((+r.filled / +r.requested) * 100) : 0,
      })),
    });
  } catch (e) { next(e); }
});

// CSV wrapper for the operational report (7.6).
r.get('/operational.csv', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT cl.name AS client, date_trunc('week', sr.date)::date AS week,
              SUM(sr.qty) AS requested, COUNT(s.id) FILTER (WHERE s.status != 'cancelled') AS filled
       FROM shift_requests sr JOIN clients cl ON cl.id = sr.client_id
       LEFT JOIN shifts s ON s.request_id = sr.id
       GROUP BY cl.name, 2 ORDER BY 2 DESC`);
    const csv = ['client,week,requested,filled,fill_pct',
      ...rows.map((r) => [r.client, r.week, r.requested, r.filled, +r.requested ? Math.round(100 * r.filled / r.requested) : 0]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="fill-rate.csv"');
    res.send(csv);
  } catch (e) { next(e); }
});

// 7.6 — scheduled digest: queues the week's fill-rate + compliance summary to
// the outbox for the office (triggered manually or by an external cron ping).
r.post('/digest', async (req, res, next) => {
  try {
    const { rows: fill } = await query(
      `SELECT cl.name, SUM(sr.qty) AS requested,
              COUNT(s.id) FILTER (WHERE s.status != 'cancelled') AS filled
       FROM shift_requests sr JOIN clients cl ON cl.id = sr.client_id
       LEFT JOIN shifts s ON s.request_id = sr.id
       WHERE sr.date >= CURRENT_DATE - 7 GROUP BY cl.name`);
    const { rows: expiring } = await query(
      `SELECT COUNT(*) AS n FROM compliance_documents
       WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND status != 'expired'`);
    const lines = fill.map((f) => `${f.name}: ${f.filled}/${f.requested} filled`).join('\n') || 'No requests this week.';
    const body = `Weekly digest\n\nFill rate (last 7 days):\n${lines}\n\nCompliance documents expiring in 30 days: ${expiring[0].n}`;
    const msg = await notify({ channel: 'email', toName: 'Sanitas office', toContact: req.body?.to || 'office@sanitas.example',
      subject: `Weekly digest — ${new Date().toISOString().slice(0, 10)}`, body, createdBy: req.account?.userId });
    await audit(req, 'digest.queued', null, null);
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

export default r;
