// Email delivery. Provider is chosen by env:
//   EMAIL_PROVIDER=resend  + RESEND_API_KEY (+ EMAIL_FROM)   → HTTPS API, no extra dependency
//   EMAIL_PROVIDER=none (default)                             → messages stay 'queued' and are
//                                                               sent by staff via mailto links.
// Each attempt is recorded on the message row (attempts, last_error, provider_id)
// so failures are visible and retryable rather than silent.
import { query } from '../db.js';

const MAX_ATTEMPTS = 5;

export const emailConfigured = () =>
  (process.env.EMAIL_PROVIDER || 'none') !== 'none' && !!process.env.RESEND_API_KEY;

async function sendViaResend({ to, subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Sanitas <no-reply@sanitasmedicalrecruitment.co.uk>', to: [to], subject, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || body?.error || `Provider HTTP ${res.status}`);
  return body.id || null;
}

// Attempts delivery of one outbox message. Returns the updated row.
export async function deliverMessage(id) {
  const { rows } = await query(`SELECT * FROM messages WHERE id = $1`, [id]);
  const m = rows[0];
  if (!m) throw new Error('Message not found');
  if (m.channel !== 'email') throw new Error('Only email messages can be sent automatically');
  if (m.status === 'sent') return m;
  if (!m.to_contact) {
    await query(`UPDATE messages SET status = 'failed', last_error = 'No recipient address', last_attempt_at = now() WHERE id = $1`, [id]);
    return (await query(`SELECT * FROM messages WHERE id = $1`, [id])).rows[0];
  }
  if (!emailConfigured()) {
    await query(`UPDATE messages SET last_error = 'No email provider configured — send via mail link', last_attempt_at = now() WHERE id = $1`, [id]);
    return (await query(`SELECT * FROM messages WHERE id = $1`, [id])).rows[0];
  }
  if (m.attempts >= MAX_ATTEMPTS) {
    await query(`UPDATE messages SET status = 'failed', last_error = COALESCE(last_error,'') || ' (max attempts reached)' WHERE id = $1`, [id]);
    return (await query(`SELECT * FROM messages WHERE id = $1`, [id])).rows[0];
  }
  try {
    const providerId = await sendViaResend({ to: m.to_contact, subject: m.subject || '(no subject)', text: m.body || '' });
    await query(
      `UPDATE messages SET status = 'sent', sent_at = now(), attempts = attempts + 1, last_attempt_at = now(), last_error = NULL, provider_id = $2 WHERE id = $1`,
      [id, providerId]);
  } catch (e) {
    await query(
      `UPDATE messages SET status = CASE WHEN attempts + 1 >= $2 THEN 'failed' ELSE 'queued' END,
         attempts = attempts + 1, last_attempt_at = now(), last_error = $3 WHERE id = $1`,
      [id, MAX_ATTEMPTS, String(e.message).slice(0, 500)]);
  }
  return (await query(`SELECT * FROM messages WHERE id = $1`, [id])).rows[0];
}

// Processes queued emails (called by POST /messages/send-queued or a scheduler).
export async function deliverQueued(limit = 50) {
  if (!emailConfigured()) return { configured: false, processed: 0 };
  const { rows } = await query(
    `SELECT id FROM messages WHERE channel = 'email' AND status = 'queued' AND attempts < $1
     ORDER BY created_at LIMIT $2`, [MAX_ATTEMPTS, limit]);
  let sent = 0, failed = 0;
  for (const r of rows) {
    const m = await deliverMessage(r.id);
    if (m.status === 'sent') sent++; else failed++;
  }
  return { configured: true, processed: rows.length, sent, failed };
}
