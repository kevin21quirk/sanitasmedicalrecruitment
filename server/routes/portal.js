import { Router } from 'express';
import { query } from '../db.js';
import { requirePortal } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { notify, waReplyFooter, appUrlFor } from '../lib/notify.js';
import { upload, replacePhoto } from '../lib/files.js';
import { workerComplianceFor } from '../lib/compliance.js';
import { isoDate } from '../lib/dates.js';

const r = Router();

// Worker uploads their own profile photo.
r.post('/me/photo', requirePortal('worker'), upload.single('file'), async (req, res, next) => {
  try {
    const stored = await replacePhoto({ table: 'candidates', column: 'photo_file_id',
      id: req.account.candidateId, file: req.file, uploadedBy: req.account.id });
    res.status(201).json({ photo_file_id: stored.id });
  } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
});

// ─── Worker portal ────────────────────────────────────────────────────────
// Every route uses requirePortal('worker'); account.candidateId scopes data.

r.get('/me', requirePortal('worker', 'client', 'supervisor'), async (req, res, next) => {
  try {
    const acc = req.account;
    if (acc.kind === 'worker') {
      const { rows } = await query(
        `SELECT id, first_name, last_name, email, phone, role, status, preferred_shift,
                engagement_type, rtw_status, rtw_expiry, uniform_size, driving, created_at, photo_file_id
         FROM candidates WHERE id = $1`, [acc.candidateId]);
      return res.json({ account: acc, profile: rows[0] });
    }
    const { rows } = await query(
      `SELECT id, name, type, town, standing_instructions FROM clients WHERE id = $1`, [acc.clientId]);
    res.json({ account: acc, client: rows[0] });
  } catch (e) { next(e); }
});

// 2.5 — worker views their own documents and expiry dates.
r.get('/documents', requirePortal('worker'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.id, d.type, d.reference_no, d.status, d.issue_date, d.expiry_date, f.id AS file_id, f.filename
       FROM compliance_documents d LEFT JOIN files f ON f.id = d.file_id
       WHERE d.candidate_id = $1 ORDER BY d.type`, [req.account.candidateId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// 2.9 — the worker may see their own OH records (compliance role is the only other viewer).
r.get('/oh', requirePortal('worker'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT kind, name, record_date, expiry_date, result FROM oh_records
       WHERE candidate_id = $1 ORDER BY record_date DESC NULLS LAST`, [req.account.candidateId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// 3.1/3.3 — submit and update availability.
r.get('/availability', requirePortal('worker'), async (req, res, next) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT * FROM availability WHERE candidate_id = $1 AND date >= $2 ORDER BY date`, [req.account.candidateId, from]);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/availability', requirePortal('worker'), async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    for (const it of items) {
      if (!it.date) continue;
      await query(
        `INSERT INTO availability (candidate_id, date, shift_type, status, source, notes)
         VALUES ($1,$2,$3,$4,'worker',$5)
         ON CONFLICT (candidate_id, date, shift_type)
         DO UPDATE SET status = EXCLUDED.status, source = 'worker', notes = EXCLUDED.notes`,
        [req.account.candidateId, it.date, it.shift_type || 'any', it.status || 'available', it.notes || null]);
    }
    res.status(201).json({ ok: true, count: items.length });
  } catch (e) { next(e); }
});

// 4.1 — offers awaiting a response + history.
r.get('/offers', requirePortal('worker'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.*, sr.date AS request_date, sr.start_time, sr.end_time, sr.shift_type, sr.role AS request_role,
              sr.notes AS request_notes, cl.name AS client_name, i.name AS individual_name
       FROM offers o
       LEFT JOIN shift_requests sr ON sr.id = o.request_id
       LEFT JOIN clients cl ON cl.id = sr.client_id
       LEFT JOIN individuals i ON i.id = sr.individual_id
       WHERE o.candidate_id = $1 ORDER BY o.sent_at DESC`, [req.account.candidateId]);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/offers/:id/respond', requirePortal('worker'), async (req, res, next) => {
  try {
    const { action, reason } = req.body || {};
    if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'accept|decline' });
    const { rows } = await query(
      `SELECT o.*, sr.client_id, sr.date, sr.start_time, sr.end_time, sr.hours, sr.shift_type, sr.individual_id, sr.qty
       FROM offers o LEFT JOIN shift_requests sr ON sr.id = o.request_id
       WHERE o.id = $1 AND o.candidate_id = $2`, [req.params.id, req.account.candidateId]);
    const offer = rows[0];
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.status !== 'sent') return res.status(409).json({ error: 'Offer already answered' });

    await query(`UPDATE offers SET status = $1, responded_at = now(), decline_reason = $3 WHERE id = $2`,
      [action === 'accept' ? 'accepted' : 'declined', offer.id, action === 'decline' ? (reason || null) : null]);

    if (action === 'accept' && offer.request_id) {
      // create the booked shift and confirm it (worker accepting = confirming)
      const { rows: s } = await query(
        `INSERT INTO shifts (request_id, candidate_id, client_id, shift_date, start_time, end_time, hours, shift_type,
           individual_id, status, worker_confirmed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'booked', now()) RETURNING *`,
        [offer.request_id, req.account.candidateId, offer.client_id, offer.date,
         offer.start_time || '07:30', offer.end_time || '20:00', offer.hours || 12,
         offer.shift_type || 'day', offer.individual_id]);
      await query(`UPDATE offers SET shift_id = $1 WHERE id = $2`, [s[0].id, offer.id]);
      const { rows: filled } = await query(
        `SELECT COUNT(*) AS n FROM shifts WHERE request_id = $1 AND status != 'cancelled'`, [offer.request_id]);
      if (+filled[0].n >= (offer.qty || 1)) {
        await query(`UPDATE shift_requests SET status = 'filled', filled_at = COALESCE(filled_at, now()), updated_at = now() WHERE id = $1`, [offer.request_id]);
      }
      // 4.3 — client confirmation that a named worker is attending
      const { rows: cl } = await query(`SELECT name, email FROM clients WHERE id = $1`, [offer.client_id]);
      const { rows: w } = await query(`SELECT first_name || ' ' || last_name AS name FROM candidates WHERE id = $1`, [req.account.candidateId]);
      await notify({ channel: 'email', toName: cl[0]?.name, toContact: cl[0]?.email,
        subject: `Shift filled — ${w[0]?.name} on ${offer.date}`,
        body: `${w[0]?.name} has accepted and confirmed the ${offer.shift_type} shift on ${offer.date} at ${cl[0]?.name}.`,
        entityType: 'shift', entityId: s[0].id });
      return res.json({ ok: true, shift: s[0] });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Upcoming + recent shifts for the worker — never includes rates (6.1).
r.get('/shifts', requirePortal('worker'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.shift_date, s.start_time, s.end_time, s.hours, s.actual_start, s.actual_end,
              s.actual_hours, s.shift_type, s.status, s.timesheet_status, s.worker_confirmed_at,
              s.signatory_notes, s.worker_sig_at, s.client_sig_at, s.timesheet_locked,
              cl.name AS client_name, cl.address AS client_address, cl.standing_instructions,
              i.name AS individual_name,
              (SELECT acked_at FROM instruction_acks a WHERE a.shift_id = s.id AND a.candidate_id = $1) AS acked_instructions_at
       FROM shifts s
       JOIN clients cl ON cl.id = s.client_id
       LEFT JOIN individuals i ON i.id = s.individual_id
       WHERE s.candidate_id = $1 ORDER BY s.shift_date DESC LIMIT 100`, [req.account.candidateId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Worker confirms acceptance of an office-allocated shift (4.1).
r.post('/shifts/:id/confirm', requirePortal('worker'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE shifts SET worker_confirmed_at = now(), updated_at = now()
       WHERE id = $1 AND candidate_id = $2 AND status = 'booked' RETURNING *`,
      [req.params.id, req.account.candidateId]);
    if (!rows[0]) return res.status(404).json({ error: 'Shift not found' });
    await audit(req, 'shift.worker_confirmed', 'shift', +req.params.id);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// 4.4 — acknowledge a site's standing instructions.
r.post('/shifts/:id/ack-instructions', requirePortal('worker'), async (req, res, next) => {
  try {
    const { rows: s } = await query(`SELECT client_id FROM shifts WHERE id = $1 AND candidate_id = $2`,
      [req.params.id, req.account.candidateId]);
    if (!s[0]) return res.status(404).json({ error: 'Shift not found' });
    await query(
      `INSERT INTO instruction_acks (shift_id, candidate_id, client_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [req.params.id, req.account.candidateId, s[0].client_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 6.2 — worker signs their own timesheet (no rates visible anywhere here).
r.post('/shifts/:id/sign', requirePortal('worker'), async (req, res, next) => {
  try {
    const { rows: s } = await query(
      `SELECT * FROM shifts WHERE id = $1 AND candidate_id = $2`, [req.params.id, req.account.candidateId]);
    if (!s[0]) return res.status(404).json({ error: 'Shift not found' });
    if (s[0].worker_sig_at) return res.status(409).json({ error: 'Already signed' });
    const { actual_start, actual_end, actual_hours } = req.body || {};
    await query(
      `UPDATE shifts SET worker_sig_name = $1, worker_sig_at = now(),
         actual_start = COALESCE($2, actual_start), actual_end = COALESCE($3, actual_end),
         actual_hours = COALESCE($4, actual_hours),
         timesheet_status = CASE WHEN timesheet_status = 'not_submitted' THEN 'submitted' ELSE timesheet_status END,
         updated_at = now() WHERE id = $5`,
      [req.account.name, actual_start || null, actual_end || null, actual_hours || null, req.params.id]);
    await query(`UPDATE shifts SET timesheet_locked = TRUE WHERE id = $1 AND client_sig_at IS NOT NULL`, [req.params.id]);
    await audit(req, 'timesheet.worker_signed', 'shift', +req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 8.6 — worker downloads everything held about them.
r.get('/export', requirePortal('worker'), async (req, res, next) => {
  try {
    const cid = req.account.candidateId;
    const [profile, docs, oh, shifts, availability, offers, msgs] = await Promise.all([
      query(`SELECT * FROM candidates WHERE id = $1`, [cid]),
      query(`SELECT * FROM compliance_documents WHERE candidate_id = $1`, [cid]),
      query(`SELECT * FROM oh_records WHERE candidate_id = $1`, [cid]),
      query(`SELECT id, shift_date, start_time, end_time, hours, shift_type, status, client_id, signatory_notes FROM shifts WHERE candidate_id = $1`, [cid]),
      query(`SELECT * FROM availability WHERE candidate_id = $1`, [cid]),
      query(`SELECT * FROM offers WHERE candidate_id = $1`, [cid]),
      query(`SELECT created_at, channel, subject, body FROM messages WHERE entity_type = 'candidate' AND entity_id = $1`, [cid]),
    ]);
    await audit(req, 'data.self_exported', 'candidate', cid);
    res.json({
      exported_at: new Date(), profile: profile.rows[0], documents: docs.rows,
      occupational_health: oh.rows, shifts: shifts.rows, availability: availability.rows,
      offers: offers.rows, messages: msgs.rows,
    });
  } catch (e) { next(e); }
});

// ─── Client + supervisor portals ──────────────────────────────────────────

// 4.7/4.8/4.9 — submit shift requests and track fill status.
r.get('/client/requests', requirePortal('client', 'supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sr.*, i.name AS individual_name,
              (SELECT COUNT(*) FROM shifts s WHERE s.request_id = sr.id AND s.status != 'cancelled') AS filled_count,
              (SELECT string_agg(c.first_name || ' ' || c.last_name, ', ')
               FROM shifts s JOIN candidates c ON c.id = s.candidate_id
               WHERE s.request_id = sr.id AND s.status != 'cancelled') AS filled_by
       FROM shift_requests sr
       LEFT JOIN individuals i ON i.id = sr.individual_id
       WHERE sr.client_id = $1 ORDER BY sr.date DESC LIMIT 100`, [req.account.clientId]);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/client/requests', requirePortal('client'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.date) return res.status(400).json({ error: 'date required' });
    const { rows } = await query(
      `INSERT INTO shift_requests (client_id, date, start_time, end_time, hours, shift_type, role, qty,
         individual_id, urgency, source, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'portal',$11,$12) RETURNING *`,
      [req.account.clientId, b.date, b.start_time || null, b.end_time || null, b.hours || null,
       b.shift_type || 'day', b.role || null, b.qty || 1, b.individual_id || null,
       b.urgency === 'urgent' ? 'urgent' : 'normal', b.notes || null, req.account.id]);
    await audit(req, 'request.submitted', 'shift_request', rows[0].id, { source: 'portal', urgent: b.urgency === 'urgent' });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// 4.9 — cancel a request with a reason (4.10 applies to shifts; requests too).
r.post('/client/requests/:id/cancel', requirePortal('client'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE shift_requests SET status = 'cancelled', cancelled_at = now(), cancel_reason = $1, updated_at = now()
       WHERE id = $2 AND client_id = $3 AND status != 'filled' RETURNING *`,
      [req.body?.reason || null, req.params.id, req.account.clientId]);
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or already filled' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Supervisor allocation: which workers could cover a pending request at their
// site. Same context the office sees, minus contact details and rates (least
// privilege — 5.x supervisors coordinate on-site, the office owns contact).
r.get('/client/requests/:id/eligible', requirePortal('supervisor'), async (req, res, next) => {
  try {
    const { rows: reqs } = await query(`SELECT * FROM shift_requests WHERE id = $1`, [req.params.id]);
    const request = reqs[0];
    if (!request || request.client_id !== req.account.clientId) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const { rows: workers } = await query(
      `SELECT c.id, c.first_name || ' ' || c.last_name AS name, c.role,
              a.shift_type AS avail_type, a.status AS avail_status,
              (SELECT COUNT(*) FROM shifts s WHERE s.candidate_id = c.id AND s.client_id = $1 AND s.status = 'completed') AS worked_at_client,
              (SELECT COUNT(*) FROM shifts s WHERE s.candidate_id = c.id AND s.individual_id = $2::int AND s.status = 'completed') AS worked_with_individual,
              (SELECT b.reason FROM candidate_blocks b WHERE b.candidate_id = c.id
                AND (b.client_id = $1 OR (b.individual_id IS NOT NULL AND b.individual_id = $2::int)) LIMIT 1) AS block_reason
       FROM candidates c
       LEFT JOIN availability a ON a.candidate_id = c.id AND a.date = $3::date
         AND (a.shift_type = 'any' OR a.shift_type = $4::text)
       WHERE c.erased_at IS NULL AND c.status != 'do_not_use' AND c.suspended = FALSE
       ORDER BY c.last_name`,
      [request.client_id, request.individual_id, request.date, request.shift_type]);
    const annotated = [];
    for (const w of workers) {
      const comp = await workerComplianceFor(w.id, request.client_id);
      annotated.push({ ...w, compliant: comp.ok, compliance_gaps: comp.gaps });
    }
    res.json({ request, workers: annotated });
  } catch (e) { next(e); }
});

// Supervisor pings a worker about a pending request — creates an offer row
// (so it lands in the worker's portal inbox for a recorded response) and
// returns the wa.me / mailto link for the supervisor to send. Contact
// details are never listed in bulk; they only exist inside the link.
r.post('/client/requests/:id/contact-worker', requirePortal('supervisor'), async (req, res, next) => {
  try {
    const { candidate_id, channel, note } = req.body || {};
    if (!candidate_id) return res.status(400).json({ error: 'candidate_id required' });
    if (!['whatsapp', 'email'].includes(channel)) {
      return res.status(400).json({ error: 'channel must be whatsapp or email' });
    }
    const { rows: reqs } = await query(`SELECT * FROM shift_requests WHERE id = $1`, [req.params.id]);
    const request = reqs[0];
    if (!request || request.client_id !== req.account.clientId) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `Request is ${request.status}` });
    }
    const { rows: w } = await query(
      `SELECT first_name || ' ' || last_name AS name, phone, email FROM candidates
       WHERE id = $1 AND erased_at IS NULL`, [candidate_id]);
    if (!w[0]) return res.status(404).json({ error: 'Worker not found' });
    const to = channel === 'whatsapp' ? w[0].phone : w[0].email;
    if (!to) {
      return res.status(422).json({ error: `No ${channel === 'whatsapp' ? 'phone number' : 'email address'} on file for this worker` });
    }

    // offer row → appears in the worker's portal even if the ping goes via WhatsApp
    const { rows: o } = await query(
      `INSERT INTO offers (request_id, candidate_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING *`, [request.id, candidate_id]);
    const { rows: cl } = await query(`SELECT name FROM clients WHERE id = $1`, [request.client_id]);
    const body = `Hi ${w[0].name.split(' ')[0]}, a ${request.shift_type} shift is available at ${cl[0]?.name} ` +
      `on ${isoDate(request.date)} ${String(request.start_time || '07:30').slice(0, 5)}–${String(request.end_time || '20:00').slice(0, 5)}.` +
      (note ? ` ${note}` : '') + waReplyFooter(appUrlFor(req), { offer: true });
    const message = await notify({
      channel, toName: w[0].name, toContact: to,
      subject: `Shift available — ${cl[0]?.name} ${isoDate(request.date)}`,
      body, entityType: 'offer', entityId: o[0]?.id ?? null, status: 'queued',
    });
    await audit(req, 'offer.contacted', 'shift_request', request.id, { candidate_id, channel });
    res.status(201).json({ offer: o[0] || null, message });
  } catch (e) { next(e); }
});

// Supervisor allocates a worker to a pending request at their site.
// Compliance + do-not-offer checks are identical to office allocation; pay and
// charge rates are never set or exposed here — the office prices the shift.
r.post('/client/requests/:id/allocate', requirePortal('supervisor'), async (req, res, next) => {
  try {
    const { candidate_id } = req.body || {};
    if (!candidate_id) return res.status(400).json({ error: 'candidate_id required' });
    const { rows: reqs } = await query(`SELECT * FROM shift_requests WHERE id = $1`, [req.params.id]);
    const request = reqs[0];
    if (!request || request.client_id !== req.account.clientId) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (request.status === 'cancelled') return res.status(409).json({ error: 'Request is cancelled' });
    const { rows: filled } = await query(
      `SELECT COUNT(*) AS n FROM shifts WHERE request_id = $1 AND status != 'cancelled'`, [request.id]);
    if (+filled[0].n >= (request.qty || 1)) {
      return res.status(409).json({ error: 'Request is already filled' });
    }
    const { rows: blk } = await query(
      `SELECT reason FROM candidate_blocks WHERE candidate_id = $1 AND (client_id = $2 OR individual_id = $3::int)`,
      [candidate_id, request.client_id, request.individual_id]);
    if (blk.length) {
      return res.status(422).json({ error: `Worker is marked do-not-offer for this site${blk[0].reason ? `: ${blk[0].reason}` : ''}` });
    }
    const comp = await workerComplianceFor(candidate_id, request.client_id);
    if (!comp.ok) return res.status(422).json({ error: 'Worker is not compliant for this site', gaps: comp.gaps });
    const { rows: conflicts } = await query(
      `SELECT s.id, s.shift_date, s.start_time, s.end_time, cl.name AS client_name
       FROM shifts s JOIN clients cl ON cl.id = s.client_id
       WHERE s.candidate_id = $1 AND s.shift_date = $2 AND s.status IN ('booked','completed')`,
      [candidate_id, request.date]);
    if (conflicts.length) {
      return res.status(409).json({ error: 'Worker is already booked on this date', conflicts });
    }

    const { rows } = await query(
      `INSERT INTO shifts (request_id, candidate_id, client_id, shift_date, start_time, end_time, hours, shift_type,
         individual_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'booked') RETURNING *`,
      [request.id, candidate_id, request.client_id, request.date,
       request.start_time || '07:30', request.end_time || '20:00', request.hours || 12,
       request.shift_type, request.individual_id]);
    const { rows: nowFilled } = await query(
      `SELECT COUNT(*) AS n FROM shifts WHERE request_id = $1 AND status != 'cancelled'`, [request.id]);
    if (+nowFilled[0].n >= (request.qty || 1)) {
      await query(`UPDATE shift_requests SET status = 'filled', filled_at = COALESCE(filled_at, now()), updated_at = now() WHERE id = $1`, [request.id]);
    }

    // tell the worker via in-app inbox (they may have no WhatsApp flow from a supervisor)
    const { rows: wa } = await query(
      `SELECT id FROM accounts WHERE candidate_id = $1 AND kind = 'worker' AND is_active`, [candidate_id]);
    const { rows: w } = await query(
      `SELECT first_name || ' ' || last_name AS name FROM candidates WHERE id = $1`, [candidate_id]);
    const { rows: cl } = await query(`SELECT name, email FROM clients WHERE id = $1`, [request.client_id]);
    const { rows: ind } = request.individual_id
      ? await query(`SELECT name FROM individuals WHERE id = $1`, [request.individual_id]) : { rows: [] };
    const msg = await notify({
      channel: 'inapp', toName: null, toContact: null,
      subject: `Shift booked — ${isoDate(request.date)} at ${cl[0]?.name}`,
      body: `You've been booked for a ${request.shift_type} shift at ${cl[0]?.name} on ${isoDate(request.date)} ` +
            `${String(request.start_time || '07:30').slice(0, 5)}–${String(request.end_time || '20:00').slice(0, 5)}. ` +
            `Please confirm it in your portal.`,
      entityType: 'shift', entityId: rows[0].id, status: 'sent',
    });
    if (wa[0]) await query(`UPDATE messages SET to_account_id = $1, from_account_id = $2, sent_at = now() WHERE id = $3`,
      [wa[0].id, req.account.id, msg.id]);

    // confirm to the site's contacts — WhatsApp + email links for the
    // supervisor to send; every row is logged in the outbox regardless
    const confirmBody = `${w[0]?.name} is booked for the ${request.shift_type} shift on ${isoDate(request.date)} ` +
      `${String(request.start_time || '07:30').slice(0, 5)}–${String(request.end_time || '20:00').slice(0, 5)} ` +
      `at ${cl[0]?.name}${ind[0] ? `, with ${ind[0].name}` : ''}. — Sanitas Medical Recruitment`;
    const { rows: contacts } = await query(
      `SELECT name, email, phone FROM client_contacts WHERE client_id = $1`, [request.client_id]);
    const notifications = [];
    const targets = contacts.length ? contacts : [{ name: cl[0]?.name, email: cl[0]?.email, phone: null }];
    for (const c of targets) {
      if (c.phone) notifications.push(await notify({
        channel: 'whatsapp', toName: c.name, toContact: c.phone, subject: 'Worker booked',
        body: confirmBody, entityType: 'shift', entityId: rows[0].id, status: 'queued' }));
      if (c.email) notifications.push(await notify({
        channel: 'email', toName: c.name, toContact: c.email, subject: 'Worker booked — shift covered',
        body: confirmBody, entityType: 'shift', entityId: rows[0].id, status: 'queued' }));
    }

    await audit(req, 'shift.allocated', 'shift', rows[0].id,
      { request_id: request.id, candidate_id, by: 'supervisor', client_notified: notifications.length });
    res.status(201).json({ ...rows[0], notifications });
  } catch (e) { next(e); }
});

// Individuals for the request form.
r.get('/client/individuals', requirePortal('client', 'supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, name FROM individuals WHERE client_id = $1 AND is_active ORDER BY name`, [req.account.clientId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// 5.1/5.2 — live rota for own site only. No rates, no compliance detail.
r.get('/client/rota', requirePortal('client', 'supervisor'), async (req, res, next) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT s.id, s.shift_date, s.start_time, s.end_time, s.shift_type, s.status,
              c.first_name || ' ' || c.last_name AS worker_name, c.role AS worker_role,
              i.name AS individual_name
       FROM shifts s
       JOIN candidates c ON c.id = s.candidate_id
       LEFT JOIN individuals i ON i.id = s.individual_id
       WHERE s.client_id = $1 AND s.shift_date BETWEEN $2 AND $3 AND s.status != 'cancelled'
       ORDER BY s.shift_date, s.start_time`, [req.account.clientId, from, to]);
    res.json(rows);
  } catch (e) { next(e); }
});

// 4.5 — shared worker profiles, fields controlled per client.
r.get('/client/workers', requirePortal('client'), async (req, res, next) => {
  try {
    const { rows: cl } = await query(`SELECT share_profile_fields FROM clients WHERE id = $1`, [req.account.clientId]);
    const fields = cl[0]?.share_profile_fields || { name: true, role: true, compliance: true, training: true };
    const { rows } = await query(
      `SELECT DISTINCT c.id, c.first_name, c.last_name, c.role, c.nmc_pin, c.compliance_score,
              c.uniform_size, c.town, c.has_transport
       FROM candidates c
       JOIN shifts s ON s.candidate_id = c.id
       WHERE s.client_id = $1 AND c.erased_at IS NULL`, [req.account.clientId]);
    const masked = rows.map((w) => ({
      id: w.id,
      name: fields.name === false ? `${w.first_name} ${w.last_name[0]}.` : `${w.first_name} ${w.last_name}`,
      role: fields.role === false ? null : w.role,
      compliance_score: fields.compliance === false ? null : w.compliance_score,
      nmc_pin: fields.registration ? w.nmc_pin : null,
      uniform_size: fields.uniform ? w.uniform_size : null,
      location: fields.location ? w.town : null,
      transport: fields.transport ? w.has_transport : null,
    }));
    res.json({ fields, workers: masked });
  } catch (e) { next(e); }
});

// 6.2 — authorised signatory signs a timesheet for their site (from portal).
r.post('/client/sign/:shiftId', requirePortal('client'), async (req, res, next) => {
  try {
    const { rows: contact } = await query(
      `SELECT is_signatory, name FROM client_contacts WHERE id = $1`, [req.account.contactId]);
    if (!contact[0]?.is_signatory) {
      return res.status(403).json({ error: 'Your account is not an authorised signatory' });
    }
    const { signatory_notes, actual_hours } = req.body || {};
    const { rows } = await query(
      `UPDATE shifts SET client_sig_name = $1, client_sig_at = now(),
         signatory_notes = COALESCE($2, signatory_notes), actual_hours = COALESCE($3, actual_hours),
         timesheet_status = CASE WHEN timesheet_status = 'not_submitted' THEN 'submitted' ELSE timesheet_status END,
         updated_at = now()
       WHERE id = $4 AND client_id = $5 RETURNING id`,
      [contact[0].name, signatory_notes || null, actual_hours || null, req.params.shiftId, req.account.clientId]);
    if (!rows[0]) return res.status(404).json({ error: 'Shift not found' });
    await query(`UPDATE shifts SET timesheet_locked = TRUE WHERE id = $1 AND worker_sig_at IS NOT NULL`, [req.params.shiftId]);
    await audit(req, 'timesheet.client_signed', 'shift', +req.params.shiftId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Timesheets awaiting the client's signature.
r.get('/client/timesheets', requirePortal('client'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.shift_date, s.start_time, s.end_time, s.hours, s.actual_hours, s.shift_type,
              s.worker_sig_at, s.client_sig_at, s.signatory_notes, s.timesheet_status,
              c.first_name || ' ' || c.last_name AS worker_name, c.role AS worker_role
       FROM shifts s JOIN candidates c ON c.id = s.candidate_id
       WHERE s.client_id = $1 AND s.status = 'completed' ORDER BY s.shift_date DESC LIMIT 100`,
      [req.account.clientId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ─── In-app inbox (G) — messages addressed to this account ─────────────────
r.get('/me/messages', requirePortal('worker', 'client', 'supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.id, m.channel, m.subject, m.body, m.created_at, m.read_at, a.email AS from_email
       FROM messages m LEFT JOIN accounts a ON a.id = m.from_account_id
       WHERE m.to_account_id = $1 ORDER BY m.created_at DESC LIMIT 100`, [req.account.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

r.post('/me/messages/:id/read', requirePortal('worker', 'client', 'supervisor'), async (req, res, next) => {
  try {
    await query(`UPDATE messages SET read_at = now() WHERE id = $1 AND to_account_id = $2 AND read_at IS NULL`,
      [req.params.id, req.account.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
