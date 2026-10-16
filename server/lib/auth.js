import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.js';

const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'sanitas_session';

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compareSync(pw, hash || '');
export const newToken = () => crypto.randomBytes(32).toString('hex');

export async function createSession(accountId) {
  const token = newToken();
  await query(
    `INSERT INTO sessions (token, account_id, expires_at) VALUES ($1,$2, now() + interval '${SESSION_DAYS} days')`,
    [token, accountId]);
  return token;
}

export async function destroySession(token) {
  if (token) await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

export function readSessionToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Loads the account for the session cookie, enforces is_active (5.3 instant revoke),
// and slides the expiry forward. Attaches req.account.
export async function attachAccount(req, _res, next) {
  try {
    const token = readSessionToken(req);
    if (!token) return next();
    const { rows } = await query(
      `SELECT s.token, s.expires_at, a.id AS account_id, a.kind, a.user_id, a.candidate_id,
              a.client_id, a.contact_id, a.email, a.is_active, a.must_reset,
              u.name AS staff_name, u.role AS staff_role, u.access_role, u.initials, u.color,
              c.first_name || ' ' || c.last_name AS worker_name,
              cl.name AS client_name
       FROM sessions s
       JOIN accounts a ON a.id = s.account_id
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN candidates c ON c.id = a.candidate_id
       LEFT JOIN clients cl ON cl.id = a.client_id
       WHERE s.token = $1 AND s.expires_at > now()`,
      [token]);
    const row = rows[0];
    if (row && row.is_active) {
      req.account = {
        id: row.account_id,
        kind: row.kind,
        userId: row.user_id,
        candidateId: row.candidate_id,
        clientId: row.client_id,
        contactId: row.contact_id,
        email: row.email,
        accessRole: row.access_role || null,
        name: row.staff_name || row.worker_name || row.client_name || row.email,
        initials: row.initials,
        color: row.color,
      };
      req.sessionToken = token;
    }
    next();
  } catch (e) { next(e); }
}

// Staff-side guards.
export function requireAuth(req, res, next) {
  if (!req.account || req.account.kind !== 'staff') {
    return res.status(401).json({ error: 'Sign in required' });
  }
  next();
}

// 8.4 role-restricted access: 'admin' passes everything; otherwise the
// caller's access_role must be in the list.
export function requireAccess(...roles) {
  return (req, res, next) => {
    const acc = req.account;
    if (!acc || acc.kind !== 'staff') return res.status(401).json({ error: 'Sign in required' });
    if (acc.accessRole === 'admin' || roles.includes(acc.accessRole)) return next();
    return res.status(403).json({ error: 'Your role does not have access to this' });
  };
}

// Portal guards: require a specific account kind (worker | client | supervisor).
export function requirePortal(...kinds) {
  return (req, res, next) => {
    const acc = req.account;
    if (!acc || !kinds.includes(acc.kind)) {
      return res.status(401).json({ error: 'Portal sign in required' });
    }
    next();
  };
}

export const canSeeFinance = (acc) =>
  acc?.kind === 'staff' && ['admin', 'finance'].includes(acc.accessRole);
export const canSeeOH = (acc) =>
  (acc?.kind === 'staff' && ['admin', 'compliance'].includes(acc.accessRole)) ||
  acc?.kind === 'worker';
