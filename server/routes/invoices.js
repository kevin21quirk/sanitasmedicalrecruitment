import { Router } from 'express';
import crypto from 'crypto';
import { query, pool } from '../db.js';
import { audit } from '../lib/audit.js';
import { isoDate } from '../lib/dates.js';
import { notify } from '../lib/notify.js';
import { getSetting } from '../lib/settings.js';
import { requireAccess } from '../lib/auth.js';
import { snapshotShift, marginForShift, fromPence, resolveUplift } from '../lib/money.js';

const r = Router();
const newToken = () => crypto.randomBytes(24).toString('hex');

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
    if (shift.timesheet_status === 'approved') {
      return res.status(409).json({ error: 'Timesheet is already approved — the financial snapshot is frozen' });
    }
    if (shift.timesheet_status === 'paid') {
      return res.status(409).json({ error: 'Timesheet is already paid — it cannot be re-approved' });
    }
    if (!shift.client_sig_at && !req.body?.force) {
      return res.status(409).json({ error: 'Client signature is still outstanding — approve anyway?', needs_force: true });
    }
    if (shift.pay_rate == null || shift.charge_rate == null) {
      return res.status(422).json({ error: 'Pay and charge rates must be set on the shift before approval', missing: ['pay_rate', 'charge_rate'].filter((k) => shift[k] == null) });
    }
    await query(`UPDATE shifts SET timesheet_status = 'approved', approved_by = $1, approved_at = now(),
                  timesheet_locked = TRUE, status = 'completed', updated_at = now()
                 WHERE id = $2`, [req.account?.userId ?? null, req.params.id]);
    // D/F — freeze the financial result at approval so later rate/uplift changes
    // cannot rewrite history. Reports read the snapshot from here on.
    const fin = await snapshotShift(+req.params.id);
    await audit(req, 'timesheet.approved', 'shift', +req.params.id, {
      snapshot: { pay_pence: fin.pay_amount_pence, charge_pence: fin.charge_amount_pence, uplift: fin.uplift_rule, multiplier: fin.uplift_multiplier },
    });
    res.json({ ok: true, financials: fin });
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
    // Only issued ('sent') invoices are debt. Drafts are unissued, paid/cancelled
    // are closed — none of those belong on a debtors report.
    const { rows } = await query(
      `SELECT cl.name AS client_name, i.id AS invoice_id, i.number, i.issue_date, i.due_date, i.subtotal,
              CASE
                WHEN i.due_date >= CURRENT_DATE THEN 'current'
                WHEN i.due_date >= CURRENT_DATE - 30 THEN '1-30'
                WHEN i.due_date >= CURRENT_DATE - 60 THEN '31-60'
                ELSE '60+'
              END AS bucket
       FROM invoices i JOIN clients cl ON cl.id = i.client_id
       WHERE i.status = 'sent' ORDER BY i.due_date NULLS LAST`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Generate an invoice for a client over a period — approved timesheets only (6.10c).
// Runs in one transaction so a failure can't leave a header without lines or
// shifts half-linked to an invoice.
r.post('/invoices', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { client_id, from, to, due_days = 30, notes } = req.body || {};
    if (!client_id || !from || !to) return res.status(400).json({ error: 'client_id, from, to required' });
    if (from > to) return res.status(400).json({ error: 'from must be on or before to' });

    const { rows: cl } = await query(`SELECT id, name FROM clients WHERE id = $1`, [client_id]);
    if (!cl[0]) return res.status(404).json({ error: 'Client not found' });

    await client.query('BEGIN');
    const { rows: shifts } = await client.query(
      `SELECT s.*, c.first_name || ' ' || c.last_name AS worker_name
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id
       WHERE s.client_id = $1 AND s.shift_date BETWEEN $2 AND $3
         AND s.timesheet_status = 'approved' AND s.invoice_id IS NULL
       ORDER BY s.shift_date
       FOR UPDATE OF s`, [client_id, from, to]);
    if (!shifts.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No approved, uninvoiced timesheets in that period' });
    }

    // Snapshot is written at approval; backfill for any legacy approved shift.
    let subtotalPence = 0;
    const lines = [];
    for (const s of shifts) {
      if (s.charge_amount_pence == null) await snapshotShift(s.id);
      const { rows: fresh } = await client.query(`SELECT * FROM shifts WHERE id = $1`, [s.id]);
      const f = fresh[0];
      if (f.charge_amount_pence == null) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          error: `Shift #${s.id} (${s.worker_name}, ${isoDate(s.shift_date)}) has no chargeable amount — set pay/charge rates and re-approve`,
        });
      }
      const amountPence = +f.charge_amount_pence;
      subtotalPence += amountPence;
      const hours = f.paid_hours;
      const mult = +f.uplift_multiplier;
      lines.push({ shift_id: s.id, description:
        `${s.worker_name} — ${isoDate(s.shift_date)} ${s.shift_type} (${hours}h${mult > 1 ? `, ${f.uplift_rule} ×${f.uplift_multiplier}` : ''})`,
        hours, rate: fromPence(Math.round(amountPence / (+hours || 1))), amount: fromPence(amountPence) });
    }
    const subtotal = fromPence(subtotalPence);

    const year = new Date().getFullYear();
    const { rows: seq } = await client.query(
      `SELECT COALESCE(MAX(CAST(NULLIF(split_part(number, '-', 3), '') AS int)), 0) + 1 AS n
       FROM invoices WHERE number LIKE $1`, [`INV-${year}-%`]);
    const number = `INV-${year}-${String(seq[0].n).padStart(4, '0')}`;
    const { rows: inv } = await client.query(
      `INSERT INTO invoices (client_id, number, status, issue_date, due_date, subtotal, notes, created_by)
       VALUES ($1,$2,'draft',CURRENT_DATE, CURRENT_DATE + $3::int, $4, $5, $6) RETURNING *`,
      [client_id, number, +due_days, subtotal, notes || null, req.account?.userId ?? null]);
    for (const l of lines) {
      await client.query(`INSERT INTO invoice_lines (invoice_id, shift_id, description, hours, rate, amount)
                   VALUES ($1,$2,$3,$4,$5,$6)`, [inv[0].id, l.shift_id, l.description, l.hours, l.rate, l.amount]);
      await client.query(`UPDATE shifts SET invoice_id = $1 WHERE id = $2`, [inv[0].id, l.shift_id]);
    }
    await client.query('COMMIT');
    await audit(req, 'invoice.created', 'invoice', inv[0].id, { client_id, number, subtotal, lines: lines.length });
    res.status(201).json({ ...inv[0], lines });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

const INVOICE_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

r.patch('/invoices/:id', async (req, res, next) => {
  try {
    const { status, paid_date } = req.body || {};
    const { rows: cur } = await query(
      `SELECT i.*, cl.name AS client_name, cl.billing_email FROM invoices i JOIN clients cl ON cl.id = i.client_id WHERE i.id = $1`,
      [req.params.id]);
    const inv = cur[0];
    if (!inv) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'sent', 'paid', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === inv.status) return res.json(inv);
    if (!INVOICE_TRANSITIONS[inv.status].includes(status)) {
      return res.status(409).json({ error: `Cannot move an invoice from '${inv.status}' to '${status}'` });
    }

    const sets = [`status = $1`];
    const params = [status];
    if (status === 'sent') sets.push(`sent_at = now()`);
    if (status === 'paid') {
      if (paid_date && !/^\d{4}-\d{2}-\d{2}$/.test(paid_date)) {
        return res.status(400).json({ error: 'paid_date must be YYYY-MM-DD' });
      }
      params.push(paid_date || null);
      sets.push(`paid_at = COALESCE($${params.length}::date, now())`);
    }
    params.push(req.params.id);
    const { rows } = await query(`UPDATE invoices SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    let mailto_link = null;
    if (status === 'cancelled') {
      // Release the shifts so they can be re-invoiced; lines stay on the
      // cancelled invoice as the audit trail.
      await query(`UPDATE shifts SET invoice_id = NULL WHERE invoice_id = $1`, [inv.id]);
    }
    if (status === 'sent' && inv.billing_email) {
      const { rows: lines } = await query(`SELECT description, amount FROM invoice_lines WHERE invoice_id = $1 ORDER BY id`, [inv.id]);
      const body =
        `Dear ${inv.client_name},\n\nPlease find invoice ${inv.number} for ${lines.length} shift${lines.length === 1 ? '' : 's'}, ` +
        `due ${isoDate(rows[0].due_date)}.\n\n` +
        lines.map((l) => `• ${l.description} — £${l.amount}`).join('\n') +
        `\n\nTotal: £${rows[0].subtotal}\n\nThank you,\nSanitas Medical Recruitment`;
      const msg = await notify({
        channel: 'email', toName: inv.client_name, toContact: inv.billing_email,
        subject: `Invoice ${inv.number} — Sanitas Medical Recruitment`, body,
        entityType: 'invoice', entityId: inv.id, createdBy: req.account?.userId,
      });
      mailto_link = msg.mailto_link;
    }
    await audit(req, `invoice.${status}`, 'invoice', +req.params.id,
      status === 'paid' ? { paid_date: paid_date || null } : undefined);
    res.json({ ...rows[0], mailto_link });
  } catch (e) { next(e); }
});

// Draft invoices can be removed entirely (lines cascade; shift links release
// via ON DELETE SET NULL). Issued invoices must be cancelled, not deleted.
r.delete('/invoices/:id', async (req, res, next) => {
  try {
    const { rows: cur } = await query(`SELECT id, status, number FROM invoices WHERE id = $1`, [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: 'Not found' });
    if (cur[0].status !== 'draft') {
      return res.status(409).json({ error: 'Only draft invoices can be deleted — cancel issued invoices instead' });
    }
    await query(`DELETE FROM invoices WHERE id = $1`, [req.params.id]);
    await audit(req, 'invoice.deleted', 'invoice', +req.params.id, { number: cur[0].number });
    res.status(204).end();
  } catch (e) { next(e); }
});

r.get('/invoices/:id', async (req, res, next) => {
  try {
    const { rows: inv } = await query(
      `SELECT i.*, cl.name AS client_name, cl.address AS client_address, cl.town AS client_town,
              cl.postcode AS client_postcode, cl.billing_email
       FROM invoices i JOIN clients cl ON cl.id = i.client_id WHERE i.id = $1`, [req.params.id]);
    if (!inv[0]) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await query(`SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY id`, [req.params.id]);
    res.json({ ...inv[0], lines });
  } catch (e) { next(e); }
});

// ─── 6.8 payroll export — PAYE vs Ltd, validated, run-tracked ──────────────
// Provisional column format ('provisional-v1'); provider-specific layouts are
// an open decision (see HANDOVER.md). Every row is validated; rejected rows
// are reported with reasons rather than dropped silently.

async function payrollCandidates(from, to, engagement) {
  const { rows } = await query(
    `SELECT s.id AS shift_id, s.shift_date, s.shift_type, s.paid_hours, s.pay_amount_pence, s.uplift_rule,
            s.uplift_multiplier, s.payroll_export_id, s.timesheet_status, s.approved_at,
            s.engagement_type_at_approval,
            c.id AS candidate_id, c.engagement_type, c.first_name || ' ' || c.last_name AS worker_name,
            c.payroll_ref, cl.name AS client_name
     FROM shifts s JOIN candidates c ON c.id = s.candidate_id JOIN clients cl ON cl.id = s.client_id
     WHERE s.shift_date BETWEEN $1 AND $2 AND s.timesheet_status IN ('approved','paid')
       AND COALESCE(s.engagement_type_at_approval, c.engagement_type, 'paye') = $3
     ORDER BY c.last_name, s.shift_date`, [from, to, engagement]);
  const accepted = [], rejected = [];
  for (const s of rows) {
    // Legacy approved/paid shifts may predate the snapshot write; backfill so
    // they are payable and margin can report them as 'actual'.
    if (s.pay_amount_pence == null) {
      try {
        const fin = await snapshotShift(s.shift_id);
        s.pay_amount_pence = fin.pay_amount_pence;
        s.paid_hours = fin.paid_hours;
        s.uplift_rule = fin.uplift_rule;
        s.uplift_multiplier = fin.uplift_multiplier;
        s.engagement_type_at_approval = fin.engagement_type_at_approval;
      } catch { /* leave null — rejected below with a reason */ }
    }
    const reasons = [];
    if (s.payroll_export_id) reasons.push(`already exported in run #${s.payroll_export_id}`);
    else if (s.timesheet_status === 'paid') reasons.push('marked paid manually — no payroll run recorded');
    if (s.pay_amount_pence == null) reasons.push('no approved financial snapshot');
    if (!s.payroll_ref) reasons.push('worker has no payroll reference');
    if (!s.approved_at) reasons.push('timesheet not approved by office');
    if (s.engagement_type_at_approval && s.engagement_type_at_approval !== s.engagement_type) {
      reasons.push(`engagement changed since approval (${s.engagement_type_at_approval} → ${s.engagement_type})`);
    }
    const row = {
      shift_id: s.shift_id, candidate_id: s.candidate_id, worker: s.worker_name, payroll_ref: s.payroll_ref,
      engagement, client: s.client_name, date: isoDate(s.shift_date), shift_type: s.shift_type,
      hours: s.paid_hours, uplift_rule: s.uplift_rule, uplift_multiplier: s.uplift_multiplier,
      amount: fromPence(s.pay_amount_pence == null ? null : +s.pay_amount_pence),
      amount_pence: s.pay_amount_pence == null ? null : +s.pay_amount_pence,
      already_exported: !!s.payroll_export_id,
    };
    if (reasons.length) rejected.push({ ...row, reasons }); else accepted.push(row);
  }
  return { accepted, rejected };
}

const PAYROLL_COLUMNS = ['payroll_ref', 'worker', 'engagement', 'client', 'date', 'shift_type', 'hours', 'uplift_rule', 'uplift_multiplier', 'amount'];
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) =>
  cols.map((c) => `"${String(r[c] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');

// Preview (no side effects): both bureaux, with rejections.
r.get('/payroll', requireAccess('finance'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    const [paye, ltd] = await Promise.all([payrollCandidates(from, to, 'paye'), payrollCandidates(from, to, 'ltd')]);
    const sum = (rows) => rows.reduce((a, r) => a + (r.amount_pence ?? 0), 0);
    res.json({
      from, to, format: 'provisional-v1', columns: PAYROLL_COLUMNS,
      paye: paye.accepted, ltd: ltd.accepted,
      rejected: { paye: paye.rejected, ltd: ltd.rejected },
      totals: {
        paye_hours: paye.accepted.reduce((a, r) => a + +r.hours, 0), paye_amount: fromPence(sum(paye.accepted)),
        ltd_hours: ltd.accepted.reduce((a, r) => a + +r.hours, 0), ltd_amount: fromPence(sum(ltd.accepted)),
      },
    });
  } catch (e) { next(e); }
});

// Commit a run for ONE bureau: marks shifts exported (duplicate guard), records
// the run + rejections, returns CSV. Re-running the same period yields nothing new.
r.post('/payroll/export', requireAccess('finance'), async (req, res, next) => {
  try {
    const { from, to, engagement } = req.body || {};
    if (!from || !to || !['paye', 'ltd'].includes(engagement)) {
      return res.status(400).json({ error: 'from, to and engagement (paye|ltd) required' });
    }
    const { accepted, rejected } = await payrollCandidates(from, to, engagement);
    if (!accepted.length) return res.status(409).json({ error: 'No exportable rows — see rejected', rejected });
    const total = accepted.reduce((a, r) => a + r.amount_pence, 0);
    const { rows: run } = await query(
      `INSERT INTO payroll_exports (engagement, period_from, period_to, shift_count, total_pence, rejected, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [engagement, from, to, accepted.length, total,
       JSON.stringify(rejected.map((x) => ({ shift_id: x.shift_id, reasons: x.reasons }))), req.account?.userId ?? null]);
    await query(`UPDATE shifts SET payroll_export_id = $1, timesheet_status = 'paid', updated_at = now() WHERE id = ANY($2::int[])`,
      [run[0].id, accepted.map((x) => x.shift_id)]);
    await audit(req, 'payroll.exported', 'payroll_export', run[0].id,
      { engagement, from, to, shifts: accepted.length, total_pence: total, rejected: rejected.length });
    if (req.query.format === 'csv' || req.body?.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-${engagement}-${from}-${to}-run${run[0].id}.csv"`);
      return res.send(toCsv(accepted, PAYROLL_COLUMNS));
    }
    res.status(201).json({ run: run[0], accepted, rejected });
  } catch (e) { next(e); }
});

r.get('/payroll/runs', requireAccess('finance'), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name AS created_by_name FROM payroll_exports p LEFT JOIN users u ON u.id = p.created_by ORDER BY p.created_at DESC LIMIT 100`);
    res.json(rows.map((x) => ({ ...x, total: fromPence(+x.total_pence) })));
  } catch (e) { next(e); }
});

// Re-download a previous run's CSV (same rows, no re-processing).
r.get('/payroll/runs/:id/csv', requireAccess('finance'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id AS shift_id, s.shift_date, s.shift_type, s.paid_hours, s.pay_amount_pence, s.uplift_rule, s.uplift_multiplier,
              c.first_name || ' ' || c.last_name AS worker, c.payroll_ref, cl.name AS client, p.engagement
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id JOIN clients cl ON cl.id = s.client_id
       JOIN payroll_exports p ON p.id = s.payroll_export_id WHERE s.payroll_export_id = $1 ORDER BY c.last_name, s.shift_date`, [req.params.id]);
    const data = rows.map((x) => ({ ...x, date: isoDate(x.shift_date), hours: x.paid_hours, amount: fromPence(+x.pay_amount_pence) }));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${req.params.id}.csv"`);
    res.send(toCsv(data, PAYROLL_COLUMNS));
  } catch (e) { next(e); }
});

// ─── 6.12 gross margin — actual (snapshot) vs estimated, per shift & client ─
r.get('/margin', requireAccess('finance'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    const { rows } = await query(
      `SELECT s.*, c.engagement_type, cl.name AS client_name, cl.id AS cid,
              c.first_name || ' ' || c.last_name AS worker_name
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id JOIN clients cl ON cl.id = s.client_id
       WHERE s.shift_date BETWEEN $1 AND $2 AND s.status = 'completed' AND s.timesheet_status != 'queried'
       ORDER BY s.shift_date`, [from, to]);
    const lines = [];
    for (const s of rows) {
      const m = await marginForShift(s, { engagement_type: s.engagement_type });
      lines.push({
        shift_id: s.id, date: isoDate(s.shift_date), worker: s.worker_name, client: s.client_name, client_id: s.cid,
        engagement: s.engagement_type_at_approval ?? s.engagement_type, basis: m.basis, problems: m.problems ?? [],
        hours: s.paid_hours ?? s.actual_hours ?? s.hours, uplift: m.uplift_rule, multiplier: m.uplift_multiplier,
        charge: fromPence(m.charge_amount_pence), pay: fromPence(m.pay_amount_pence), ni: fromPence(m.employer_ni_pence),
        fee: fromPence(m.bureau_fee_pence), margin: fromPence(m.margin_pence),
        _p: { charge: m.charge_amount_pence ?? 0, pay: m.pay_amount_pence ?? 0, ni: m.employer_ni_pence ?? 0, fee: m.bureau_fee_pence ?? 0, margin: m.margin_pence ?? 0 },
      });
    }
    const agg = (ls) => {
      const t = ls.reduce((a, l) => ({ charge: a.charge + l._p.charge, pay: a.pay + l._p.pay, ni: a.ni + l._p.ni, fee: a.fee + l._p.fee, margin: a.margin + l._p.margin }),
        { charge: 0, pay: 0, ni: 0, fee: 0, margin: 0 });
      return { charge: fromPence(t.charge), pay: fromPence(t.pay), ni: fromPence(t.ni), fee: fromPence(t.fee), margin: fromPence(t.margin),
        margin_pct: t.charge ? ((t.margin / t.charge) * 100).toFixed(1) : null,
        shifts: ls.length, actual: ls.filter((l) => l.basis === 'actual').length,
        estimated: ls.filter((l) => l.basis === 'estimated').length, unavailable: ls.filter((l) => l.basis === 'unavailable').length };
    };
    const byClient = {};
    for (const l of lines) (byClient[l.client] ??= []).push(l);
    const [niPct, feePaye, feeLtd, precedence] = await Promise.all([
      getSetting('employers_ni_pct'), getSetting('bureau_fee_paye_per_shift'), getSetting('bureau_fee_ltd_per_shift'), getSetting('uplift_precedence')]);
    res.json({
      from, to,
      assumptions: { employers_ni_pct: niPct, bureau_fee_paye_per_shift: feePaye, bureau_fee_ltd_per_shift: feeLtd, uplift_precedence: precedence,
        note: 'Actual = frozen at approval. Estimated = computed from current settings for unapproved shifts. Unavailable = missing rate/hours.' },
      totals: agg(lines),
      by_client: Object.entries(byClient).map(([client, ls]) => ({ client, ...agg(ls) })).sort((a, b) => +b.margin - +a.margin),
      lines: lines.map(({ _p, ...l }) => l),
    });
  } catch (e) { next(e); }
});

// How a shift's money was derived (finance sees amounts; others see rule only).
r.get('/shifts/:id/financials', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, c.engagement_type FROM shifts s JOIN candidates c ON c.id = s.candidate_id WHERE s.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const s = rows[0];
    const m = await marginForShift(s, { engagement_type: s.engagement_type });
    const live = await resolveUplift(s);
    const finance = ['admin', 'finance'].includes(req.account?.accessRole);
    res.json({
      basis: m.basis, uplift_rule: m.uplift_rule, uplift_multiplier: m.uplift_multiplier, live_uplift: live,
      hours: s.paid_hours ?? s.actual_hours ?? s.hours, snapshot: finance ? s.financial_snapshot : null,
      ...(finance ? { pay: fromPence(m.pay_amount_pence), charge: fromPence(m.charge_amount_pence), ni: fromPence(m.employer_ni_pence), fee: fromPence(m.bureau_fee_pence), margin: fromPence(m.margin_pence) } : {}),
    });
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
