import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify, waLink, mailtoLink } from '../lib/notify.js';

const r = Router();

// Outbox: queued/logged notifications with click-to-send links (4.6).
r.get('/', async (req, res, next) => {
  try {
    const { status, channel, limit = 200 } = req.query;
    const where = [], params = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (channel) { params.push(channel); where.push(`channel = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT m.*, u.name AS created_by_name FROM messages m
       LEFT JOIN users u ON u.id = m.created_by
       ${whereSql} ORDER BY m.created_at DESC LIMIT $${params.push(+limit)}`, params);
    res.json(rows.map((m) => ({
      ...m,
      wa_link: m.channel === 'whatsapp' ? waLink(m.to_contact, m.body) : null,
      mailto_link: m.channel === 'email' ? mailtoLink(m.to_contact, m.subject, m.body) : null,
    })));
  } catch (e) { next(e); }
});

// Compose a manual message — returns the send link for the chosen channel.
r.post('/', async (req, res, next) => {
  try {
    const { channel, to_name, to_contact, subject, body, entity_type, entity_id } = req.body || {};
    if (!['email', 'whatsapp'].includes(channel)) return res.status(400).json({ error: 'channel must be email|whatsapp' });
    if (!to_contact) return res.status(400).json({ error: 'to_contact required' });
    const msg = await notify({ channel, toName: to_name, toContact: to_contact, subject, body,
      entityType: entity_type, entityId: entity_id, createdBy: req.account?.userId });
    await audit(req, 'message.composed', entity_type, entity_id, { channel, to: to_contact });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

// Mark queued → sent/logged/failed once the staff member has sent it.
r.patch('/:id', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['queued', 'sent', 'logged', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await query(
      `UPDATE messages SET status = $1, sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END
       WHERE id = $2 RETURNING *`, [status, req.params.id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default r;
