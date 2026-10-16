import { Router } from 'express';
import { query } from '../db.js';
import {
  checkPassword, hashPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie,
} from '../lib/auth.js';
import { audit } from '../lib/audit.js';

const r = Router();

r.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const { rows } = await query(`SELECT * FROM accounts WHERE email = $1`, [email.toLowerCase().trim()]);
    const acc = rows[0];
    if (!acc || !checkPassword(password, acc.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!acc.is_active) return res.status(403).json({ error: 'This account has been deactivated' });
    // portal accounts for suspended workers are refused at login too
    if (acc.kind === 'worker' && acc.candidate_id) {
      const { rows: c } = await query(`SELECT suspended, erased_at FROM candidates WHERE id = $1`, [acc.candidate_id]);
      if (c[0]?.suspended || c[0]?.erased_at) {
        return res.status(403).json({ error: 'This account has been suspended' });
      }
    }
    const token = await createSession(acc.id);
    setSessionCookie(res, token);
    await query(`UPDATE accounts SET last_login_at = now() WHERE id = $1`, [acc.id]);
    req.account = { id: acc.id, name: acc.email };
    await audit(req, 'auth.login', 'account', acc.id, { kind: acc.kind });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req.sessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get('/me', (req, res) => {
  if (!req.account) return res.status(401).json({ error: 'Not signed in' });
  res.json({ account: req.account });
});

r.post('/change-password', async (req, res, next) => {
  try {
    if (!req.account) return res.status(401).json({ error: 'Not signed in' });
    const { current, next: nextPw } = req.body || {};
    if (!nextPw || nextPw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const { rows } = await query(`SELECT password_hash FROM accounts WHERE id = $1`, [req.account.id]);
    if (!checkPassword(current || '', rows[0]?.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    await query(`UPDATE accounts SET password_hash = $1, must_reset = FALSE WHERE id = $2`,
      [hashPassword(nextPw), req.account.id]);
    await audit(req, 'auth.password_changed', 'account', req.account.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
