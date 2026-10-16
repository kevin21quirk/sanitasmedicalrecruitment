import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify, waLink, mailtoLink } from '../lib/notify.js';
import { deliverMessage, deliverQueued, emailConfigured } from '../lib/mailer.js';

const r = Router();

const decorate = (m) => ({
  ...m,
  wa_link: m.channel === 'whatsapp' ? waLink(m.to_contact, m.body) : null,
  mailto_link: m.channel === 'email' ? mailtoLink(m.to_contact, m.subject, m.body) : null,
});

// Outbox: queued/logged notifications with click-to-send links (4.6).
r.get('/', async (req, res, next) => {
  try {
    const { status, channel, limit = 200 } = req.query;
    const where = [], params = [];
    if (status) { params.push(status); where.push(`m.status = $${params.length}`); }
    if (channel) { params.push(channel); where.push(`m.channel = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT m.*, u.name AS created_by_name FROM messages m
       LEFT JOIN users u ON u.id = m.created_by
       ${whereSql} ORDER BY m.created_at DESC LIMIT $${params.push(+limit)}`, params);
    res.json(rows.map(decorate));
  } catch (e) { next(e); }
});

r.get('/config', (_req, res) => res.json({ email_configured: emailConfigured(), provider: process.env.EMAIL_PROVIDER || 'none' }));

// Compose a manual message — email / whatsapp (link) / inapp (worker inbox).
// Content is capped and must not include rates (G: no confidential data by email).
r.post('/', async (req, res, next) => {
  try {
    const { channel, to_name, to_contact, subject, body, entity_type, entity_id, candidate_id, send_now } = req.body || {};
    if (!['email', 'whatsapp', 'inapp'].includes(channel)) return res.status(400).json({ error: 'channel must be email|whatsapp|inapp' });
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required' });
    if (body.length > 5000) return res.status(400).json({ error: 'Message too long' });

    let toAccount = null;
    if (channel === 'inapp') {
      if (!candidate_id) return res.status(400).json({ error: 'candidate_id required for in-app messages' });
      const { rows } = await query(`SELECT id FROM accounts WHERE candidate_id = $1 AND kind = 'worker' AND is_active`, [candidate_id]);
      if (!rows[0]) return res.status(422).json({ error: 'Worker has no active portal account' });
      toAccount = rows[0].id;
    } else if (!to_contact) return res.status(400).json({ error: 'to_contact required' });

    let msg = await notify({ channel, toName: to_name, toContact: to_contact, subject, body,
      entityType: entity_type ?? (candidate_id ? 'candidate' : null), entityId: entity_id ?? candidate_id ?? null,
      createdBy: req.account?.userId, status: channel === 'inapp' ? 'sent' : 'queued' });
    if (toAccount) {
      await query(`UPDATE messages SET to_account_id = $1, from_account_id = $2, sent_at = now() WHERE id = $3`, [toAccount, req.account.id, msg.id]);
    }
    if (channel === 'email' && send_now) msg = decorate(await deliverMessage(msg.id));
    await audit(req, 'message.composed', entity_type ?? 'candidate', entity_id ?? candidate_id ?? null, { channel, to: to_contact ?? `account:${toAccount}` });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

// Attempt (or retry) delivery of one email via the configured provider.
r.post('/:id/send', async (req, res, next) => {
  try {
    const m = await deliverMessage(+req.params.id);
    await audit(req, m.status === 'sent' ? 'message.sent' : 'message.send_failed', 'message', m.id, { attempts: m.attempts, error: m.last_error });
    res.json(decorate(m));
  } catch (e) { next(e); }
});

// Process everything queued (manual trigger or external scheduler ping).
r.post('/send-queued', async (req, res, next) => {
  try {
    const out = await deliverQueued();
    await audit(req, 'message.batch_sent', null, null, out);
    res.json(out);
  } catch (e) { next(e); }
});

// Mark queued → sent/logged/failed once the staff member has sent it by hand.
r.patch('/:id', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['queued', 'sent', 'logged', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await query(
      `UPDATE messages SET status = $1, sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END
       WHERE id = $2 RETURNING *`, [status, req.params.id]);
    res.json(rows[0] ? decorate(rows[0]) : null);
  } catch (e) { next(e); }
});

// Conversation thread for a candidate (in-app + emails sent to them).
r.get('/thread/candidate/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.*, u.name AS created_by_name FROM messages m LEFT JOIN users u ON u.id = m.created_by
       WHERE m.entity_type = 'candidate' AND m.entity_id = $1
       ORDER BY m.created_at DESC LIMIT 100`, [req.params.id]);
    res.json(rows.map(decorate));
  } catch (e) { next(e); }
});

export default r;
