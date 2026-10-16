import { query } from '../db.js';

// wa.me deep link — click-to-send, no API account required (spec answer 4.6).
export const waLink = (phone, body) => {
  const num = (phone || '').replace(/[^\d]/g, '').replace(/^0/, '44');
  return `https://wa.me/${num}?text=${encodeURIComponent(body)}`;
};

export const mailtoLink = (email, subject, body) =>
  `mailto:${email}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;

// Base URL of the app for links inside messages — APP_URL env wins, else the
// request's origin/host (works on Vercel and local dev).
export const appUrlFor = (req) =>
  (process.env.APP_URL || req.headers.origin || `https://${req.headers.host}`).replace(/\/$/, '');

// Numbered reply options appended to worker WhatsApp messages. wa.me is
// click-to-send with no webhook, so replies land back in the sender's own
// WhatsApp; the portal link is what produces a structured response in-app.
export const waReplyFooter = (appUrl, { offer = false } = {}) =>
  `\n\nReply with a number:\n` +
  (offer
    ? `1 — Accept this offer\n2 — Decline\n3 — Need to speak to the office`
    : `1 — Confirm you can work it\n2 — Can't make it\n3 — Need to speak to the office`) +
  `\n\nOr sign in to your portal to respond: ${appUrl}\n\n— Sanitas Medical Recruitment`;

// Queue a notification in the outbox. Email/WhatsApp rows are sent by staff
// via generated wa.me / mailto links; 'system' rows are pure log entries.
export async function notify({
  channel = 'email', toName = null, toContact = null, subject = null, body = '',
  entityType = null, entityId = null, createdBy = null, status = 'queued',
}) {
  const { rows } = await query(
    `INSERT INTO messages (channel, to_name, to_contact, subject, body, status, entity_type, entity_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [channel, toName, toContact, subject, body, status, entityType, entityId, createdBy]);
  const msg = rows[0];
  return {
    ...msg,
    wa_link: channel === 'whatsapp' ? waLink(toContact, body) : null,
    mailto_link: channel === 'email' ? mailtoLink(toContact, subject, body) : null,
  };
}
