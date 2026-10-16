import { query } from '../db.js';
import { isoDate } from './dates.js';

// Document types that must be valid before a worker can be booked (blocking).
// The baseline list applies to every client; client_requirements rows add or
// remove per-site requirements (2.3).
export const BASE_REQUIRED_DOCS = [
  'DBS Enhanced', 'Right to Work', 'Passport/ID', 'Mandatory Training',
];

export const NURSE_EXTRA_DOCS = ['NMC PIN']; // blocking only for nurses (2.7)

const BLOCKING_STATUS = ['expired', 'missing'];

export function docHealth(doc) {
  // recompute live status from dates so a passed expiry flips automatically
  if (doc.status === 'missing' || doc.status === 'pending') return doc.status;
  if (doc.expiry_date && new Date(doc.expiry_date) < new Date()) return 'expired';
  return doc.status;
}

// Required doc types for a worker at a client = base + role extras + per-site adds − per-site removes.
export async function requiredDocsFor(candidate, clientId) {
  const reqs = new Set(BASE_REQUIRED_DOCS);
  if ((candidate.role || '').includes('Nurse')) NURSE_EXTRA_DOCS.forEach((d) => reqs.add(d));
  if (clientId == null) return [...reqs];
  const { rows } = await query(
    `SELECT doc_type, required FROM client_requirements WHERE client_id = $1`, [clientId]);
  for (const r of rows) {
    if (r.required) reqs.add(r.doc_type); else reqs.delete(r.doc_type);
  }
  return [...reqs];
}

// Returns { ok, gaps[] } — gaps are required docs that are expired or missing (2.4).
export async function workerComplianceFor(candidateId, clientId) {
  const { rows: cands } = await query(`SELECT * FROM candidates WHERE id = $1`, [candidateId]);
  const candidate = cands[0];
  if (!candidate) return { ok: false, gaps: [{ type: 'record', problem: 'Candidate not found' }] };
  const gaps = [];
  if (candidate.suspended) gaps.push({ type: 'status', problem: 'Worker is suspended' });
  if (candidate.status === 'do_not_use') gaps.push({ type: 'status', problem: 'Worker is marked do-not-use' });
  if (candidate.erased_at) gaps.push({ type: 'status', problem: 'Record erased' });

  const required = await requiredDocsFor(candidate, clientId);
  const { rows: docs } = await query(
    `SELECT type, status, expiry_date FROM compliance_documents WHERE candidate_id = $1`,
    [candidateId]);
  const byType = new Map();
  for (const d of docs) {
    const cur = byType.get(d.type);
    // keep the "best" document per type
    if (!cur || (docHealth(cur) !== 'valid' && docHealth(d) === 'valid')) byType.set(d.type, d);
  }
  for (const type of required) {
    const doc = byType.get(type);
    if (!doc) gaps.push({ type, problem: 'missing' });
    else {
      const health = docHealth(doc);
      if (BLOCKING_STATUS.includes(health)) gaps.push({ type, problem: health, expiry_date: isoDate(doc.expiry_date) });
      else if (health === 'pending') gaps.push({ type, problem: 'pending verification', expiry_date: isoDate(doc.expiry_date) });
    }
  }
  return { ok: gaps.length === 0, gaps, candidate };
}

// Workers the agency cannot currently place because of lapsed/missing
// documents (7.4). With clientId, checks that site's list; without, baseline.
export async function nonPlaceable(clientId = null) {
  const { rows: cands } = await query(
    `SELECT id, first_name, last_name, role, status, suspended FROM candidates
     WHERE erased_at IS NULL AND status != 'do_not_use' AND suspended = FALSE`);
  const out = [];
  for (const c of cands) {
    const { gaps } = await workerComplianceFor(c.id, clientId);
    const docGaps = gaps.filter((g) => g.type !== 'status');
    if (docGaps.length) out.push({ ...c, gaps: docGaps });
  }
  return out;
}
