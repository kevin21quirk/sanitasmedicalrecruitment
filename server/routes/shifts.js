import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { workerComplianceFor } from '../lib/compliance.js';
import { isoDate } from '../lib/dates.js';
import { notify, waReplyFooter, appUrlFor } from '../lib/notify.js';

const r = Router();

// 3.6 — overlapping shift on the same date for the same worker.
async function findDoubleBooking(candidateId, shiftDate, excludeId = null) {
  const { rows } = await query(
    `SELECT s.id, s.shift_date, s.start_time, s.end_time, cl.name AS client_name
     FROM shifts s JOIN clients cl ON cl.id = s.client_id
     WHERE s.candidate_id = $1 AND s.shift_date = $2 AND s.status IN ('booked','completed')
       AND ($3::int IS NULL OR s.id != $3)`,
    [candidateId, shiftDate, excludeId]);
  return rows;
}

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

    // 2.4 — hard block: lapsed required document ⇒ cannot book for that client
    if (b.status !== 'cancelled') {
      const comp = await workerComplianceFor(b.candidate_id, b.client_id);
      if (!comp.ok) {
        return res.status(422).json({ error: 'Worker is not compliant for this client', gaps: comp.gaps });
      }
      // 3.6 — double-booking guard (overridable with force after seeing the warning)
      if (!b.force) {
        const conflicts = await findDoubleBooking(b.candidate_id, b.shift_date);
        if (conflicts.length) {
          return res.status(409).json({ error: 'Worker is already booked on this date', conflicts });
        }
      }
    }

    const { rows } = await query(
      `INSERT INTO shifts (placement_id, candidate_id, client_id, shift_date, start_time, end_time, hours, shift_type, pay_rate, charge_rate, status, timesheet_status,
        request_id, individual_id, allocated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [b.placement_id || null, b.candidate_id, b.client_id, b.shift_date, b.start_time, b.end_time,
       b.hours, b.shift_type || 'day', b.pay_rate, b.charge_rate, b.status || 'booked', b.timesheet_status || 'not_submitted',
       b.request_id || null, b.individual_id || null, req.account?.userId ?? null]);
    await audit(req, 'shift.allocated', 'shift', rows[0].id,
      { candidate_id: b.candidate_id, client_id: b.client_id, date: b.shift_date });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// 4.6 — send the worker their shift details via WhatsApp (wa.me) or email.
// The message is composed server-side from live shift data, logged to the
// outbox, and the click-to-send link is returned for the staff member.
r.post('/:id/notify', async (req, res, next) => {
  try {
    const channel = req.body?.channel === 'email' ? 'email' : 'whatsapp';
    const { rows } = await query(
      `SELECT s.*, c.first_name || ' ' || c.last_name AS worker_name, c.phone, c.email,
              cl.name AS client_name, cl.address AS client_address, cl.town AS client_town, cl.postcode AS client_postcode,
              i.name AS individual_name
       FROM shifts s
       JOIN candidates c ON c.id = s.candidate_id
       JOIN clients cl ON cl.id = s.client_id
       LEFT JOIN individuals i ON i.id = s.individual_id
       WHERE s.id = $1`, [req.params.id]);
    const s = rows[0];
    if (!s) return res.status(404).json({ error: 'Shift not found' });
    const to = channel === 'whatsapp' ? s.phone : s.email;
    if (!to) return res.status(422).json({ error: `Worker has no ${channel === 'whatsapp' ? 'phone number' : 'email address'} on file` });

    const addr = [s.client_address, s.client_town, s.client_postcode].filter(Boolean).join(', ');
    let body =
      `Hi ${s.worker_name.split(' ')[0]} — shift details from Sanitas:\n\n` +
      `${isoDate(s.shift_date)} · ${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)} (${fmtType(s.shift_type)})\n` +
      `${s.client_name}${addr ? `\n${addr}` : ''}` +
      (s.individual_name ? `\nWith: ${s.individual_name}` : '');
    if (req.body?.note?.trim()) body += `\n\n${req.body.note.trim().slice(0, 1000)}`;
    if (channel === 'whatsapp') body += waReplyFooter(appUrlFor(req));
    else body += `\n\nPlease confirm in your portal or reply to this email. — Sanitas Medical Recruitment`;

    const msg = await notify({
      channel, toName: s.worker_name, toContact: to,
      subject: `Shift ${isoDate(s.shift_date)} — ${s.client_name}`, body,
      entityType: 'shift', entityId: s.id, createdBy: req.account?.userId,
    });
    await audit(req, 'shift.notified', 'shift', s.id, { channel, to: to });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

const fmtType = (t) => ({ day: 'Day', night: 'Night', early: 'Early', late: 'Late', long_day: 'Long day', sleep_in: 'Sleep-in' }[t] || t);

r.patch('/:id', async (req, res, next) => {
  try {
    const { rows: cur } = await query(`SELECT * FROM shifts WHERE id = $1`, [req.params.id]);
    const existing = cur[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    // 6.5 — signed timesheets are fixed records; rates/times can't be altered.
    if (existing.timesheet_locked) {
      const lockedFields = ['shift_date','start_time','end_time','hours','pay_rate','charge_rate','actual_start','actual_end','actual_hours'];
      if (lockedFields.some((f) => f in req.body)) {
        return res.status(423).json({ error: 'Timesheet is signed and locked — raise a query instead' });
      }
    }
    const allowed = ['shift_date','start_time','end_time','hours','shift_type','pay_rate','charge_rate','status','timesheet_status',
      'candidate_id','client_id','request_id','individual_id','actual_start','actual_end','actual_hours','signatory_notes',
      'cancel_reason','cancelled_by','worker_confirmed_at'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    // 2.4 — re-check compliance on (re)booking and whenever a booked shift is
    // moved to a different worker or client. Per-site rules apply to the NEW
    // pairing. No override exists by design: staff must fix the doc, not bypass.
    const newClient = req.body.client_id ?? existing.client_id;
    const newCand = req.body.candidate_id ?? existing.candidate_id;
    const newDate = req.body.shift_date ?? existing.shift_date;
    const newStatus = req.body.status ?? existing.status;
    const becomingBooked = ['booked', 'completed'].includes(newStatus) && existing.status === 'cancelled'
      ? true : (newStatus === 'booked' && existing.status !== 'booked');
    const reassigned = ['booked', 'completed'].includes(newStatus)
      && (+newClient !== +existing.client_id || +newCand !== +existing.candidate_id || isoDate(newDate) !== isoDate(existing.shift_date));
    if (becomingBooked || reassigned) {
      const comp = await workerComplianceFor(newCand, newClient);
      if (!comp.ok) {
        return res.status(422).json({ error: 'Worker is not compliant for this client', gaps: comp.gaps });
      }
      const conflicts = await findDoubleBooking(newCand, newDate, +req.params.id);
      if (conflicts.length && !req.body.force) {
        return res.status(409).json({ error: 'Worker is already booked on this date', conflicts });
      }
    }
    // A — compliance can lapse between booking and the shift: warn if it has.
    if (!becomingBooked && !reassigned && ['booked', 'completed'].includes(newStatus)) {
      const comp = await workerComplianceFor(existing.candidate_id, existing.client_id);
      if (!comp.ok) {
        await audit(req, 'shift.compliance_lapsed', 'shift', +req.params.id, { gaps: comp.gaps });
      }
    }
    // 4.10 — cancellations carry a timestamp and reason
    if (req.body.status === 'cancelled' && existing.status !== 'cancelled') {
      if (!('cancelled_by' in req.body)) {
        params.push(req.account?.name || 'office');
        sets.push(`cancelled_by = $${params.length}`);
      }
      sets.push(`cancelled_at = now()`);
    }

    // 8.9 — audit rate changes and allocation-relevant edits
    for (const k of ['pay_rate', 'charge_rate', 'status', 'timesheet_status']) {
      if (k in req.body && String(req.body[k]) !== String(existing[k])) {
        await audit(req, k === 'status' || k === 'timesheet_status' ? `shift.${req.body[k]}` : 'rate.changed',
          'shift', +req.params.id, { field: k, from: existing[k], to: req.body[k] });
      }
    }

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
