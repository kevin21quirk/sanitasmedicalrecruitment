import { Router } from 'express';
import { query } from '../db.js';
import {
  checkPassword, hashPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie,
} from '../lib/auth.js';
import { audit } from '../lib/audit.js';

const r = Router();

// Naive per-IP+email login throttle — an obvious-weakness guard until a real
// rate limiter is fronting this (see HANDOVER.md § security).
const attempts = new Map(); // key -> { fails, lockedUntil }
function throttled(req, email) {
  const k = `${req.ip}|${email}`;
  const a = attempts.get(k);
  return !!(a?.lockedUntil && a.lockedUntil > Date.now());
}
function noteFailure(req, email) {
  const k = `${req.ip}|${email}`;
  const a = attempts.get(k) ?? { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= 6) { a.lockedUntil = Date.now() + 10 * 60 * 1000; a.fails = 0; }
  attempts.set(k, a);
  if (attempts.size > 5000) attempts.clear();
}
const clearFailures = (req, email) => attempts.delete(`${req.ip}|${email}`);

r.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const key = email.toLowerCase().trim();
    if (key.length > 254 || password.length > 200) return res.status(400).json({ error: 'Invalid credentials' });
    if (throttled(req, key)) return res.status(429).json({ error: 'Too many attempts — try again in 10 minutes' });
    const { rows } = await query(`SELECT * FROM accounts WHERE email = $1`, [key]);
    const acc = rows[0];
    if (!acc || !checkPassword(password, acc.password_hash)) {
      noteFailure(req, key);
      req.account = { id: acc?.id ?? null, name: key };
      await audit(req, 'auth.login_failed', 'account', acc?.id ?? null, { reason: 'bad_credentials' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!acc.is_active) {
      req.account = { id: acc.id, name: key };
      await audit(req, 'auth.login_failed', 'account', acc.id, { reason: 'deactivated' });
      return res.status(403).json({ error: 'This account has been deactivated' });
    }
    // portal accounts for suspended workers are refused at login too
    if (acc.kind === 'worker' && acc.candidate_id) {
      const { rows: c } = await query(`SELECT suspended, erased_at FROM candidates WHERE id = $1`, [acc.candidate_id]);
      if (c[0]?.suspended || c[0]?.erased_at) {
        req.account = { id: acc.id, name: key };
        await audit(req, 'auth.login_failed', 'account', acc.id, { reason: 'suspended' });
        return res.status(403).json({ error: 'This account has been suspended' });
      }
    }
    const token = await createSession(acc.id, { ip: req.ip, userAgent: req.headers['user-agent'] });
    setSessionCookie(res, token);
    clearFailures(req, key);
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
    if (req.account) await audit(req, 'auth.logout', 'account', req.account.id);
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
