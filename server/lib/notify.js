import { query } from '../db.js';

// wa.me deep link — click-to-send, no API account required (spec answer 4.6).
export const waLink = (phone, body) => {
  const num = (phone || '').replace(/[^\d]/g, '').replace(/^0/, '44');
  return `https://wa.me/${num}?text=${encodeURIComponent(body)}`;
};

export const mailtoLink = (email, subject, body) =>
  `mailto:${email}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;

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
