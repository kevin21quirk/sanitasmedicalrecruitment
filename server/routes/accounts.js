import { Router } from 'express';
import { query } from '../db.js';
import { hashPassword, requireAuth, requireAccess } from '../lib/auth.js';
import { audit } from '../lib/audit.js';

const r = Router();
r.use(requireAuth);

// List portal accounts (worker/client/supervisor) — staff accounts are managed via users.
r.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.kind, a.email, a.is_active, a.last_login_at, a.created_at,
              a.user_id, a.candidate_id, a.client_id, a.contact_id,
              u.name AS staff_name, u.access_role,
              c.first_name || ' ' || c.last_name AS worker_name,
              cl.name AS client_name, cc.name AS contact_name
       FROM accounts a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN candidates c ON c.id = a.candidate_id
       LEFT JOIN clients cl ON cl.id = a.client_id
       LEFT JOIN client_contacts cc ON cc.id = a.contact_id
       ORDER BY a.kind, a.id`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Create a portal or staff login. Admin only for staff; office+ can create portal accounts.
r.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const kind = b.kind;
    if (!['staff', 'worker', 'client', 'supervisor'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be staff | worker | client | supervisor' });
    }
    if (kind === 'staff' && req.account.accessRole !== 'admin') {
      return res.status(403).json({ error: 'Only an admin can create staff logins' });
    }
    if (!b.email || !b.password || b.password.length < 8) {
      return res.status(400).json({ error: 'Email and a password of 8+ characters are required' });
    }
    const { rows } = await query(
      `INSERT INTO accounts (kind, user_id, candidate_id, client_id, contact_id, email, password_hash, must_reset)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id, kind, email`,
      [kind, b.user_id || null, b.candidate_id || null, b.client_id || null, b.contact_id || null,
       b.email.toLowerCase().trim(), hashPassword(b.password)]);
    await audit(req, 'account.created', 'account', rows[0].id, { kind, email: b.email });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' });
    next(e);
  }
});

// Activate / deactivate — instant revoke: deleting sessions kills live access (5.3).
r.patch('/:id', async (req, res, next) => {
  try {
    const { is_active, reset_password } = req.body || {};
    if (is_active === undefined && !reset_password) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    if (is_active !== undefined) {
      await query(`UPDATE accounts SET is_active = $1 WHERE id = $2`, [!!is_active, req.params.id]);
      if (!is_active) await query(`DELETE FROM sessions WHERE account_id = $1`, [req.params.id]);
      await audit(req, is_active ? 'account.activated' : 'account.deactivated', 'account', +req.params.id);
    }
    if (reset_password) {
      if (reset_password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });
      await query(`UPDATE accounts SET password_hash = $1, must_reset = TRUE WHERE id = $2`,
        [hashPassword(reset_password), req.params.id]);
      await query(`DELETE FROM sessions WHERE account_id = $1`, [req.params.id]);
      await audit(req, 'account.password_reset', 'account', +req.params.id);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin: set a staff member's access role (admin|office|compliance|finance).
r.patch('/users/:userId/access', requireAccess('admin'), async (req, res, next) => {
  try {
    const { access_role } = req.body || {};
    if (!['admin', 'office', 'compliance', 'finance'].includes(access_role)) {
      return res.status(400).json({ error: 'Invalid access role' });
    }
    await query(`UPDATE users SET access_role = $1 WHERE id = $2`, [access_role, req.params.userId]);
    await audit(req, 'access.changed', 'user', +req.params.userId, { access_role });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
