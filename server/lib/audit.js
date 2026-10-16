import { query } from '../db.js';

// 8.9 — records who did what: allocations, approvals, rate changes, access events.
export async function audit(req, action, entityType = null, entityId = null, detail = {}) {
  try {
    await query(
      `INSERT INTO audit_log (account_id, actor_name, action, entity_type, entity_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.account?.id ?? null, req.account?.name ?? 'system', action, entityType, entityId,
       JSON.stringify(detail)]);
  } catch (e) {
    console.error('audit failed:', e.message);
  }
}
