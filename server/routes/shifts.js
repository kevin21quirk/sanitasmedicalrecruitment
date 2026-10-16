import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { workerComplianceFor } from '../lib/compliance.js';

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
      'request_id','individual_id','actual_start','actual_end','actual_hours','signatory_notes',
      'cancel_reason','cancelled_by','worker_confirmed_at'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    // 2.4 — re-check compliance if moving the shift to a different client/worker
    const newClient = req.body.client_id ?? existing.client_id;
    const newCand = req.body.candidate_id ?? existing.candidate_id;
    const newStatus = req.body.status ?? existing.status;
    if (newStatus === 'booked' && existing.status !== 'booked') {
      const comp = await workerComplianceFor(newCand, newClient);
      if (!comp.ok) {
        return res.status(422).json({ error: 'Worker is not compliant for this client', gaps: comp.gaps });
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
