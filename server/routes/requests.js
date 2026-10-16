import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify, waReplyFooter, appUrlFor } from '../lib/notify.js';
import { workerComplianceFor } from '../lib/compliance.js';
import { getSetting } from '../lib/settings.js';

const r = Router();

// ─── Shift requests (3.0, 4.7-4.9) ────────────────────────────────────────

r.get('/requests', async (req, res, next) => {
  try {
    const { status, client_id, from, to } = req.query;
    const where = [], params = [];
    if (status) { params.push(status); where.push(`sr.status = $${params.length}`); }
    if (client_id) { params.push(client_id); where.push(`sr.client_id = $${params.length}`); }
    if (from) { params.push(from); where.push(`sr.date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`sr.date <= $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT sr.*, cl.name AS client_name, i.name AS individual_name,
              (SELECT COUNT(*) FROM shifts s WHERE s.request_id = sr.id AND s.status != 'cancelled') AS filled_count,
              (SELECT COUNT(*) FROM offers o WHERE o.request_id = sr.id AND o.status = 'sent') AS pending_offers
       FROM shift_requests sr
       JOIN clients cl ON cl.id = sr.client_id
       LEFT JOIN individuals i ON i.id = sr.individual_id
       ${whereSql}
       ORDER BY sr.status = 'pending' DESC, sr.urgency = 'urgent' DESC, sr.date`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// Office records a request that arrived by email/phone (email stays an option, 4.7).
r.post('/requests', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.client_id || !b.date) return res.status(400).json({ error: 'client_id and date required' });
    const { rows } = await query(
      `INSERT INTO shift_requests (client_id, date, start_time, end_time, hours, shift_type, role, qty,
         individual_id, urgency, source, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.client_id, b.date, b.start_time || null, b.end_time || null, b.hours || null,
       b.shift_type || 'day', b.role || null, b.qty || 1, b.individual_id || null,
       b.urgency === 'urgent' ? 'urgent' : 'normal', b.source || 'office', b.notes || null, req.account?.id ?? null]);
    await audit(req, 'request.created', 'shift_request', rows[0].id, { client_id: b.client_id, date: b.date });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.post('/requests/:id/cancel', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE shift_requests SET status = 'cancelled', cancelled_at = now(), cancel_reason = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [req.body?.reason || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    await audit(req, 'request.cancelled', 'shift_request', +req.params.id, { reason: req.body?.reason });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ─── 3.2 availability board: who replied, who hasn't ──────────────────────
r.get('/availability', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT c.id AS candidate_id, c.first_name || ' ' || c.last_name AS candidate_name, c.role,
              c.status AS candidate_status, c.suspended, c.first_choice_since,
              a.id AS availability_id, a.shift_type, a.status AS availability_status, a.source, a.notes
       FROM candidates c
       LEFT JOIN availability a ON a.candidate_id = c.id AND a.date = $2
       WHERE c.erased_at IS NULL AND c.status != 'do_not_use' AND c.suspended = FALSE
         AND ($1::text IS NULL OR a.shift_type = 'any' OR a.shift_type = $1 OR a.id IS NULL)
       ORDER BY a.status = 'available' DESC, c.last_name`, [req.query.shift_type || null, date]);
    res.json({ date, workers: rows });
  } catch (e) { next(e); }
});

// 3.4 — office records availability on a worker's behalf (telephone-ins).
r.post('/availability', async (req, res, next) => {
  try {
    const { candidate_id, date, shift_type = 'any', status = 'available', notes } = req.body || {};
    if (!candidate_id || !date) return res.status(400).json({ error: 'candidate_id and date required' });
    const { rows } = await query(
      `INSERT INTO availability (candidate_id, date, shift_type, status, source, notes)
       VALUES ($1,$2,$3,$4,'office',$5)
       ON CONFLICT (candidate_id, date, shift_type)
       DO UPDATE SET status = EXCLUDED.status, source = 'office', notes = EXCLUDED.notes
       RETURNING *`,
      [candidate_id, date, shift_type, status, notes || null]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// ─── 3.5 / 3.7 / 3.8 — allocation list for a request ─────────────────────
// Presents eligible workers with all context; a human decides. No scoring.
r.get('/requests/:id/eligible', async (req, res, next) => {
  try {
    const { rows: reqs } = await query(`SELECT * FROM shift_requests WHERE id = $1`, [req.params.id]);
    const request = reqs[0];
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const autoRank = await getSetting('auto_ranking'); // 3.8 — off by default

    const { rows: workers } = await query(
      `SELECT c.id, c.first_name || ' ' || c.last_name AS name, c.role, c.status, c.suspended,
              c.compliance_score, c.travel_miles, c.willing_client_ids, c.preferred_shift,
              c.first_choice_since, c.phone, c.email,
              a.shift_type AS avail_type, a.status AS avail_status,
              (SELECT COUNT(*) FROM shifts s WHERE s.candidate_id = c.id AND s.client_id = $2 AND s.status = 'completed') AS worked_at_client,
              (SELECT COUNT(*) FROM shifts s WHERE s.candidate_id = c.id AND s.individual_id = $3 AND s.status = 'completed') AS worked_with_individual,
              (SELECT b.reason FROM candidate_blocks b WHERE b.candidate_id = c.id
                AND (b.client_id = $2 OR (b.individual_id IS NOT NULL AND b.individual_id = $3)) LIMIT 1) AS block_reason,
              (SELECT o.status FROM offers o WHERE o.request_id = $1 AND o.candidate_id = c.id) AS offer_status
       FROM candidates c
       LEFT JOIN availability a ON a.candidate_id = c.id AND a.date = $4
         AND (a.shift_type = 'any' OR a.shift_type = $5)
       WHERE c.erased_at IS NULL AND c.status != 'do_not_use' AND c.suspended = FALSE
         AND ($5::text IS NULL OR a.shift_type IS NOT NULL OR TRUE)
       ORDER BY c.last_name`,
      [request.id, request.client_id, request.individual_id, request.date, request.shift_type]);

    // annotate each candidate with live compliance for this client (2.4 context)
    const annotated = [];
    for (const w of workers) {
      const comp = await workerComplianceFor(w.id, request.client_id);
      annotated.push({
        ...w,
        compliant: comp.ok,
        compliance_gaps: comp.gaps,
        willing_here: !w.willing_client_ids?.length || w.willing_client_ids.includes(request.client_id),
        continuity: +w.worked_with_individual > 0 ? 'individual' : +w.worked_at_client > 0 ? 'site' : null,
      });
    }
    if (autoRank) {
      // optional ordering only when the agency switches it on (3.8)
      annotated.sort((a, b) =>
        (b.avail_status === 'available') - (a.avail_status === 'available') ||
        (b.compliant - a.compliant) || (+b.worked_at_client - +a.worked_at_client));
    }
    res.json({ request, auto_ranking: !!autoRank, workers: annotated });
  } catch (e) { next(e); }
});

// 4.1/3.10 — send offers to chosen workers (creates outbox messages with wa.me links).
r.post('/requests/:id/offer', async (req, res, next) => {
  try {
    const { candidate_ids = [] } = req.body || {};
    if (!candidate_ids.length) return res.status(400).json({ error: 'candidate_ids required' });
    const { rows: reqs } = await query(
      `SELECT sr.*, cl.name AS client_name, cl.id AS cid FROM shift_requests sr JOIN clients cl ON cl.id = sr.client_id WHERE sr.id = $1`,
      [req.params.id]);
    const request = reqs[0];
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const created = [];
    for (const cid of candidate_ids) {
      // 3.11 — honour do-not-offer marks
      const { rows: blk } = await query(
        `SELECT 1 FROM candidate_blocks WHERE candidate_id = $1 AND (client_id = $2 OR individual_id = $3)`,
        [cid, request.client_id, request.individual_id]);
      if (blk.length) { created.push({ candidate_id: cid, skipped: 'blocked' }); continue; }

      const { rows: o } = await query(
        `INSERT INTO offers (request_id, candidate_id, created_by) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING RETURNING *`,
        [request.id, cid, req.account?.userId ?? null]);
      if (!o.length) continue;
      const { rows: w } = await query(`SELECT first_name || ' ' || last_name AS name, phone, email FROM candidates WHERE id = $1`, [cid]);
      const body = `Hi ${w[0]?.name?.split(' ')[0]}, shift available at ${request.client_name} on ${request.date}` +
        `${request.start_time ? ` ${request.start_time}–${request.end_time}` : ''} (${request.shift_type}).` +
        waReplyFooter(appUrlFor(req), { offer: true });
      if (w[0]?.phone) {
        await notify({ channel: 'whatsapp', toName: w[0].name, toContact: w[0].phone, subject: 'Shift offer',
          body, entityType: 'offer', entityId: o[0].id, createdBy: req.account?.userId });
      }
      created.push({ candidate_id: cid, offer: o[0] });
    }
    await audit(req, 'offers.sent', 'shift_request', +req.params.id, { count: created.length });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// Direct allocation by the office (human decision — 3.8). Enforces 2.4 + 3.11.
r.post('/requests/:id/allocate', async (req, res, next) => {
  try {
    const { candidate_id, pay_rate, charge_rate } = req.body || {};
    if (!candidate_id) return res.status(400).json({ error: 'candidate_id required' });
    const { rows: reqs } = await query(`SELECT * FROM shift_requests WHERE id = $1`, [req.params.id]);
    const request = reqs[0];
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const { rows: blk } = await query(
      `SELECT reason FROM candidate_blocks WHERE candidate_id = $1 AND (client_id = $2 OR individual_id = $3)`,
      [candidate_id, request.client_id, request.individual_id]);
    if (blk.length) {
      return res.status(422).json({ error: `Worker is marked do-not-offer for this client${blk[0].reason ? `: ${blk[0].reason}` : ''}` });
    }
    const comp = await workerComplianceFor(candidate_id, request.client_id);
    if (!comp.ok) return res.status(422).json({ error: 'Worker is not compliant for this client', gaps: comp.gaps });

    const { rows } = await query(
      `INSERT INTO shifts (request_id, candidate_id, client_id, shift_date, start_time, end_time, hours, shift_type,
         pay_rate, charge_rate, individual_id, status, allocated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'booked',$12) RETURNING *`,
      [request.id, candidate_id, request.client_id, request.date,
       request.start_time || '07:30', request.end_time || '20:00', request.hours || 12,
       request.shift_type, pay_rate ?? null, charge_rate ?? null, request.individual_id, req.account?.userId ?? null]);

    const { rows: filled } = await query(
      `SELECT COUNT(*) AS n FROM shifts WHERE request_id = $1 AND status != 'cancelled'`, [request.id]);
    if (+filled[0].n >= request.qty) {
      await query(`UPDATE shift_requests SET status = 'filled', filled_at = COALESCE(filled_at, now()), updated_at = now() WHERE id = $1`, [request.id]);
      // 3.9 — workers who were offered but not allocated become first choice
      await query(
        `UPDATE candidates SET first_choice_since = now()
         WHERE id IN (SELECT candidate_id FROM offers WHERE request_id = $1 AND status = 'sent')`,
        [request.id]);
      await query(`UPDATE offers SET status = 'withdrawn' WHERE request_id = $1 AND status = 'sent'`, [request.id]);
    }
    // clear first-choice flag on the worker who got the shift
    await query(`UPDATE candidates SET first_choice_since = NULL WHERE id = $1`, [candidate_id]);

    // 4.2/4.3 — confirmations to worker (wa.me) and client (email)
    const { rows: w } = await query(`SELECT first_name || ' ' || last_name AS name, phone, email FROM candidates WHERE id = $1`, [candidate_id]);
    const { rows: cl } = await query(`SELECT name, email, standing_instructions FROM clients WHERE id = $1`, [request.client_id]);
    const { rows: ind } = request.individual_id
      ? await query(`SELECT name FROM individuals WHERE id = $1`, [request.individual_id]) : { rows: [] };
    const confirmBody = `Confirmed: ${request.shift_type} shift at ${cl[0]?.name} on ${request.date}, ${request.start_time || ''}–${request.end_time || ''}${ind[0] ? `, with ${ind[0].name}` : ''}.${cl[0]?.standing_instructions ? `\n\nSite instructions: ${cl[0].standing_instructions}` : ''}` +
      waReplyFooter(appUrlFor(req));
    if (w[0]?.phone) {
      await notify({ channel: 'whatsapp', toName: w[0].name, toContact: w[0].phone, subject: 'Shift confirmed',
        body: confirmBody, entityType: 'shift', entityId: rows[0].id, createdBy: req.account?.userId });
    }
    if (cl[0]?.email) {
      await notify({ channel: 'email', toName: cl[0].name, toContact: cl[0].email,
        subject: `Worker confirmed — ${w[0]?.name} on ${request.date}`,
        body: `${w[0]?.name} is booked for the ${request.shift_type} shift on ${request.date} at ${cl[0]?.name}.`,
        entityType: 'shift', entityId: rows[0].id, createdBy: req.account?.userId });
    }
    await audit(req, 'shift.allocated', 'shift', rows[0].id, { request_id: request.id, candidate_id });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// 3.10 — a dropped shift is re-offered to eligible workers in one action.
r.post('/shifts/:id/reoffer', async (req, res, next) => {
  try {
    const { rows: s } = await query(`SELECT * FROM shifts WHERE id = $1`, [req.params.id]);
    const shift = s[0];
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (!['cancelled', 'no_show'].includes(shift.status)) {
      return res.status(400).json({ error: 'Only a cancelled/dropped shift can be re-offered' });
    }
    let requestId = shift.request_id;
    if (!requestId) {
      const { rows: nr } = await query(
        `INSERT INTO shift_requests (client_id, date, start_time, end_time, hours, shift_type, individual_id, urgency, source, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'urgent','office',$8) RETURNING id`,
        [shift.client_id, shift.shift_date, shift.start_time, shift.end_time, shift.hours,
         shift.shift_type, shift.individual_id, `Re-offer of dropped shift #${shift.id}`]);
      requestId = nr[0].id;
    }
    // reopen the request and offer to workers available that day
    await query(`UPDATE shift_requests SET status = 'pending', updated_at = now() WHERE id = $1`, [requestId]);
    const { rows: avail } = await query(
      `SELECT a.candidate_id FROM availability a
       JOIN candidates c ON c.id = a.candidate_id
       WHERE a.date = $1 AND a.status = 'available'
         AND (a.shift_type = 'any' OR a.shift_type = $2)
         AND c.suspended = FALSE AND c.status != 'do_not_use' AND c.erased_at IS NULL
         AND c.id != $3
         AND NOT EXISTS (SELECT 1 FROM candidate_blocks b WHERE b.candidate_id = c.id AND (b.client_id = $4 OR b.individual_id = $5))
         AND NOT EXISTS (SELECT 1 FROM shifts s2 WHERE s2.candidate_id = c.id AND s2.shift_date = $1 AND s2.status IN ('booked','completed'))
       GROUP BY a.candidate_id, c.first_choice_since
       ORDER BY c.first_choice_since ASC NULLS LAST`,
      [shift.shift_date, shift.shift_type, shift.candidate_id, shift.client_id, shift.individual_id]);
    const offered = [];
    for (const a of avail) {
      const comp = await workerComplianceFor(a.candidate_id, shift.client_id);
      if (!comp.ok) continue;
      await query(`INSERT INTO offers (request_id, candidate_id, created_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [requestId, a.candidate_id, req.account?.userId ?? null]);
      offered.push(a.candidate_id);
    }
    await audit(req, 'shift.reoffered', 'shift', shift.id, { request_id: requestId, offered: offered.length });
    res.json({ ok: true, request_id: requestId, offered_count: offered.length, offered });
  } catch (e) { next(e); }
});

// 3.9 — manual first-choice flag control.
r.post('/candidates/:id/first-choice', async (req, res, next) => {
  try {
    const on = req.body?.on !== false;
    await query(`UPDATE candidates SET first_choice_since = $1 WHERE id = $2`, [on ? new Date() : null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
