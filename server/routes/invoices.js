import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify } from '../lib/notify.js';
import { getSetting } from '../lib/settings.js';
import { requireAccess } from '../lib/auth.js';

const r = Router();
const newToken = () => crypto.randomBytes(24).toString('hex');

// ─── 6.7 rate uplifts ──────────────────────────────────────────────────────
// Highest applicable multiplier wins (bank holiday > weekend > night).
async function upliftFor(shift) {
  const [night, weekend, bankHol] = await Promise.all([
    getSetting('night_uplift'), getSetting('weekend_uplift'), getSetting('bank_holiday_uplift'),
  ]);
  const { rows } = await query(`SELECT 1 FROM bank_holidays WHERE date = $1`, [shift.shift_date]);
  if (rows.length) return bankHol;
  const dow = new Date(shift.shift_date).getDay();
  if (dow === 0 || dow === 6) return weekend;
  if (shift.shift_type === 'night' || shift.shift_type === 'sleep_in') return night;
  return 1;
}

// ─── 6.2 signing links for phone signatories ───────────────────────────────
r.post('/shifts/:id/sign-link', async (req, res, next) => {
  try {
    const kind = req.body?.kind === 'worker_signature' ? 'worker_signature' : 'client_signature';
    const { rows: s } = await query(
      `SELECT s.*, c.first_name || ' ' || c.last_name AS worker_name, c.phone AS worker_phone,
              cl.name AS client_name, cl.billing_email
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id JOIN clients cl ON cl.id = s.client_id
       WHERE s.id = $1`, [req.params.id]);
    const shift = s[0];
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    const token = newToken();
    await query(`INSERT INTO sign_tokens (shift_id, token, kind, expires_at) VALUES ($1,$2,$3, now() + interval '14 days')`,
      [req.params.id, token, kind]);
    const link = `/sign/${token}`;
    const body = kind === 'client_signature'
      ? `Please sign the timesheet for ${shift.worker_name}'s ${shift.shift_type} shift on ${shift.shift_date} (${shift.start_time}–${shift.end_time}). Link: ${link}`
      : `Please confirm your timesheet for ${shift.client_name} on ${shift.shift_date}. Link: ${link}`;
    const to = kind === 'client_signature' ? shift.billing_email : shift.worker_phone;
    const msg = await notify({
      channel: kind === 'client_signature' ? 'email' : 'whatsapp',
      toName: kind === 'client_signature' ? shift.client_name : shift.worker_name,
      toContact: to, subject: 'Timesheet signature needed', body,
      entityType: 'shift', entityId: shift.id, createdBy: req.account?.userId,
    });
    res.status(201).json({ token, link, message: msg });
  } catch (e) { next(e); }
});

// ─── 6.3 paper timesheet entry ─────────────────────────────────────────────
// Office keys in a paper form; records who entered it and marks signatures done.
r.post('/shifts/:id/paper-entry', async (req, res, next) => {
  try {
    const { rows: cur } = await query(`SELECT * FROM shifts WHERE id = $1`, [req.params.id]);
    const shift = cur[0];
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.timesheet_locked) return res.status(423).json({ error: 'Timesheet is locked' });
    const { actual_start, actual_end, actual_hours, signed_by, notes } = req.body || {};
    if (actual_hours == null) return res.status(400).json({ error: 'actual_hours required' });
    const { rows } = await query(
      `UPDATE shifts SET actual_start = $1, actual_end = $2, actual_hours = $3,
         worker_sig_name = COALESCE(worker_sig_name, $4), worker_sig_at = COALESCE(worker_sig_at, now()),
         client_sig_name = COALESCE(client_sig_name, $4), client_sig_at = COALESCE(client_sig_at, now()),
         signatory_notes = COALESCE($5, signatory_notes),
         timesheet_status = 'submitted', updated_at = now()
       WHERE id = $6 RETURNING *`,
      [actual_start || null, actual_end || null, actual_hours,
       `${signed_by || 'Paper'} (paper entry)`, notes || null, req.params.id]);
    await audit(req, 'timesheet.paper_entry', 'shift', +req.params.id, { hours: actual_hours });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ─── 6.10 query / return-for-correction ────────────────────────────────────
r.post('/shifts/:id/query', async (req, res, next) => {
  try {
    const { note } = req.body || {};
    if (!note?.trim()) return res.status(400).json({ error: 'Query note required' });
    const { rows: cur } = await query(`SELECT * FROM shifts WHERE id = $1`, [req.params.id]);
    const shift = cur[0];
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    await query(`INSERT INTO timesheet_queries (shift_id, raised_by, note) VALUES ($1,$2,$3)`,
      [req.params.id, req.account?.userId ?? null, note.trim()]);
    await query(`UPDATE shifts SET timesheet_status = 'queried', timesheet_locked = FALSE,
                  worker_sig_at = NULL, worker_sig_name = NULL, updated_at = now() WHERE id = $1`,
      [req.params.id]);
    // tell the worker to re-check and re-sign
    const { rows: w } = await query(`SELECT first_name || ' ' || last_name AS name, phone FROM candidates WHERE id = $1`, [shift.candidate_id]);
    if (w[0]?.phone) {
      await notify({ channel: 'whatsapp', toName: w[0].name, toContact: w[0].phone,
        subject: 'Timesheet query', entityType: 'shift', entityId: shift.id,
        body: `Hi ${w[0].name.split(' ')[0]}, there's a query on your ${shift.shift_date} timesheet: ${note}. Please check and re-sign in the portal. — Sanitas`,
        createdBy: req.account?.userId });
    }
    await audit(req, 'timesheet.queried', 'shift', +req.params.id, { note });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/shifts/:id/resolve-query', async (req, res, next) => {
  try {
    await query(`UPDATE timesheet_queries SET status = 'resolved', resolved_at = now()
                 WHERE shift_id = $1 AND status = 'open'`, [req.params.id]);
    await query(`UPDATE shifts SET timesheet_status = 'submitted', updated_at = now()
                 WHERE id = $1 AND timesheet_status = 'queried'`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get('/shifts/:id/queries', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT q.*, u.name AS raised_by_name FROM timesheet_queries q LEFT JOIN users u ON u.id = q.raised_by
       WHERE q.shift_id = $1 ORDER BY q.created_at DESC`, [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ─── 6.10c approval gate — only approved timesheets can be invoiced ───────
r.post('/shifts/:id/approve', async (req, res, next) => {
  try {
    const { rows: cur } = await query(`SELECT * FROM shifts WHERE id = $1`, [req.params.id]);
    const shift = cur[0];
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (!shift.client_sig_at && !req.body?.force) {
      return res.status(409).json({ error: 'Client signature is still outstanding — approve anyway?', needs_force: true });
    }
    await query(`UPDATE shifts SET timesheet_status = 'approved', approved_by = $1, approved_at = now(),
                  timesheet_locked = TRUE, status = 'completed', updated_at = now()
                 WHERE id = $2`, [req.account?.userId ?? null, req.params.id]);
    await audit(req, 'timesheet.approved', 'shift', +req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─── 6.6 / 6.11 invoices ───────────────────────────────────────────────────
r.get('/invoices', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT i.*, cl.name AS client_name,
              GREATEST(0, CURRENT_DATE - i.due_date) AS days_overdue
       FROM invoices i JOIN clients cl ON cl.id = i.client_id
       ORDER BY i.issue_date DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

r.get('/invoices/aged-debtors', requireAccess('finance'), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT cl.name AS client_name, i.id AS invoice_id, i.number, i.issue_date, i.due_date, i.subtotal,
              CASE
                WHEN i.due_date >= CURRENT_DATE THEN 'current'
                WHEN i.due_date >= CURRENT_DATE - 30 THEN '1-30'
                WHEN i.due_date >= CURRENT_DATE - 60 THEN '31-60'
                ELSE '60+'
              END AS bucket
       FROM invoices i JOIN clients cl ON cl.id = i.client_id
       WHERE i.status IN ('sent','draft') ORDER BY i.due_date NULLS LAST`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Generate an invoice for a client over a period — approved timesheets only (6.10c).
r.post('/invoices', async (req, res, next) => {
  try {
    const { client_id, from, to, due_days = 30, notes } = req.body || {};
    if (!client_id || !from || !to) return res.status(400).json({ error: 'client_id, from, to required' });
    const { rows: shifts } = await query(
      `SELECT s.*, c.first_name || ' ' || c.last_name AS worker_name
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id
       WHERE s.client_id = $1 AND s.shift_date BETWEEN $2 AND $3
         AND s.timesheet_status = 'approved' AND s.invoice_id IS NULL
       ORDER BY s.shift_date`, [client_id, from, to]);
    if (!shifts.length) return res.status(400).json({ error: 'No approved, uninvoiced timesheets in that period' });

    let subtotal = 0;
    const lines = [];
    for (const s of shifts) {
      const uplift = await upliftFor(s);
      const hours = +(s.actual_hours ?? s.hours);
      const rate = +(+s.charge_rate * uplift).toFixed(2);
      const amount = +(hours * rate).toFixed(2);
      subtotal += amount;
      lines.push({ shift_id: s.id, description:
        `${s.worker_name} — ${String(s.shift_date).slice(0, 10)} ${s.shift_type} (${hours}h${uplift > 1 ? `, ${uplift}× uplift` : ''})`,
        hours, rate, amount });
    }
    subtotal = +subtotal.toFixed(2);

    const { rows: seq } = await query(`SELECT COUNT(*) AS n FROM invoices`);
    const number = `INV-${new Date().getFullYear()}-${String(+seq[0].n + 1).padStart(4, '0')}`;
    const { rows: inv } = await query(
      `INSERT INTO invoices (client_id, number, status, issue_date, due_date, subtotal, notes, created_by)
       VALUES ($1,$2,'draft',CURRENT_DATE, CURRENT_DATE + $3::int, $4, $5, $6) RETURNING *`,
      [client_id, number, +due_days, subtotal, notes || null, req.account?.userId ?? null]);
    for (const l of lines) {
      await query(`INSERT INTO invoice_lines (invoice_id, shift_id, description, hours, rate, amount)
                   VALUES ($1,$2,$3,$4,$5,$6)`, [inv[0].id, l.shift_id, l.description, l.hours, l.rate, l.amount]);
      await query(`UPDATE shifts SET invoice_id = $1 WHERE id = $2`, [inv[0].id, l.shift_id]);
    }
    await audit(req, 'invoice.created', 'invoice', inv[0].id, { client_id, number, subtotal, lines: lines.length });
    res.status(201).json({ ...inv[0], lines });
  } catch (e) { next(e); }
});

r.patch('/invoices/:id', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['draft', 'sent', 'paid', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const sets = [`status = $1`];
    const params = [status];
    if (status === 'sent') sets.push(`sent_at = now()`);
    if (status === 'paid') sets.push(`paid_at = now()`);
    params.push(req.params.id);
    const { rows } = await query(`UPDATE invoices SET ${sets.join(', ')} WHERE id = $2 RETURNING *`, params);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    await audit(req, `invoice.${status}`, 'invoice', +req.params.id);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.get('/invoices/:id', async (req, res, next) => {
  try {
    const { rows: inv } = await query(
      `SELECT i.*, cl.name AS client_name, cl.address AS client_address, cl.billing_email
       FROM invoices i JOIN clients cl ON cl.id = i.client_id WHERE i.id = $1`, [req.params.id]);
    if (!inv[0]) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await query(`SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY id`, [req.params.id]);
    res.json({ ...inv[0], lines });
  } catch (e) { next(e); }
});

// ─── 6.8 payroll export — PAYE vs Ltd separated ────────────────────────────
r.get('/payroll', requireAccess('finance'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    const { rows } = await query(
      `SELECT s.id AS shift_id, s.shift_date, s.shift_type, s.hours, s.actual_hours,
              s.pay_rate, c.engagement_type,
              c.first_name || ' ' || c.last_name AS worker_name, c.payroll_ref
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id
       WHERE s.shift_date BETWEEN $1 AND $2 AND s.timesheet_status IN ('approved','paid')
       ORDER BY c.engagement_type, c.last_name, s.shift_date`, [from, to]);
    const out = [];
    for (const s of rows) {
      const uplift = await upliftFor(s);
      out.push({
        shift_id: s.shift_id, date: s.shift_date, worker: s.worker_name,
        payroll_ref: s.payroll_ref, engagement: s.engagement_type || 'paye',
        shift_type: s.shift_type, hours: +(s.actual_hours ?? s.hours),
        uplift, rate: +(+s.pay_rate * uplift).toFixed(2),
        amount: +(+(s.actual_hours ?? s.hours) * +s.pay_rate * uplift).toFixed(2),
      });
    }
    if (req.query.format === 'csv') {
      const head = 'worker,payroll_ref,engagement,date,shift_type,hours,uplift,rate,amount';
      const csv = [head, ...out.map((o) =>
        [o.worker, o.payroll_ref ?? '', o.engagement, o.date, o.shift_type, o.hours, o.uplift, o.rate, o.amount]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-${from}-${to}.csv"`);
      return res.send(csv);
    }
    const paye = out.filter((o) => o.engagement !== 'ltd');
    const ltd = out.filter((o) => o.engagement === 'ltd');
    res.json({ from, to, paye, ltd, totals: {
      paye_hours: paye.reduce((s, o) => s + o.hours, 0),
      paye_amount: +paye.reduce((s, o) => s + o.amount, 0).toFixed(2),
      ltd_hours: ltd.reduce((s, o) => s + o.hours, 0),
      ltd_amount: +ltd.reduce((s, o) => s + o.amount, 0).toFixed(2),
    }});
  } catch (e) { next(e); }
});

// ─── 6.12 margin: charge minus pay, employer NI and payroll fee ────────────
r.get('/margin', requireAccess('finance'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    const { rows } = await query(
      `SELECT s.id, s.shift_date, s.shift_type, s.hours, s.actual_hours, s.pay_rate, s.charge_rate,
              c.engagement_type, cl.name AS client_name,
              c.first_name || ' ' || c.last_name AS worker_name
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id JOIN clients cl ON cl.id = s.client_id
       WHERE s.shift_date BETWEEN $1 AND $2 AND s.timesheet_status IN ('approved','paid')
       ORDER BY s.shift_date`, [from, to]);
    const niPct = +(await getSetting('employers_ni_pct')) / 100;
    const payrollFee = +(await getSetting('payroll_fee_per_worker_week'));
    const lines = [];
    for (const s of rows) {
      const uplift = await upliftFor(s);
      const hours = +(s.actual_hours ?? s.hours);
      const charge = +(hours * +s.charge_rate * uplift).toFixed(2);
      const pay = +(hours * +s.pay_rate * uplift).toFixed(2);
      // employer's NI applies to PAYE workers only
      const ni = s.engagement_type === 'ltd' ? 0 : +(pay * niPct).toFixed(2);
      lines.push({ shift_id: s.id, date: s.shift_date, worker: s.worker_name, client: s.client_name,
        hours, charge, pay, ni, fee: payrollFee, margin: +(charge - pay - ni - payrollFee).toFixed(2) });
    }
    const totals = lines.reduce((a, l) => ({
      charge: +(a.charge + l.charge).toFixed(2), pay: +(a.pay + l.pay).toFixed(2),
      ni: +(a.ni + l.ni).toFixed(2), fee: +(a.fee + l.fee).toFixed(2), margin: +(a.margin + l.margin).toFixed(2),
    }), { charge: 0, pay: 0, ni: 0, fee: 0, margin: 0 });
    res.json({ from, to, lines, totals });
  } catch (e) { next(e); }
});

// 6.9 — booked vs actual, for the timesheets screen and reports.
r.get('/shifts/actual-vs-booked', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [], where = [`s.status = 'completed'`];
    if (from) { params.push(from); where.push(`s.shift_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`s.shift_date <= $${params.length}`); }
    const { rows } = await query(
      `SELECT s.id, s.shift_date, s.hours AS booked_hours, s.actual_hours, s.start_time, s.end_time,
              s.actual_start, s.actual_end, s.shift_type, s.timesheet_status,
              c.first_name || ' ' || c.last_name AS worker_name, cl.name AS client_name,
              COALESCE(s.actual_hours, s.hours) - s.hours AS variance_hours
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id JOIN clients cl ON cl.id = s.client_id
       WHERE ${where.join(' AND ')} ORDER BY s.shift_date DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

export default r;
