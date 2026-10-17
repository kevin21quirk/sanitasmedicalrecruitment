import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { getSetting, setSetting } from '../lib/settings.js';
import { requireAccess } from '../lib/auth.js';
import { upload } from '../lib/files.js';
import { parseCsv, parseDate } from '../lib/csv.js';
import { isoDate } from '../lib/dates.js';

const r = Router();
// Compliance-domain writes: office/compliance only (admin passes inside
// requireAccess). Finance is deliberately excluded, as for document edits.
const canEdit = requireAccess('office', 'compliance');

// ─── DBS check automation (BETA) ────────────────────────────────────────────
// Sanitas's DBS provider isn't fixed yet — checks may run direct on the
// gov.uk Update Service (browser-only, no public API) or via an umbrella
// body (uCheck, Personnel Checks, etc.), some of which offer APIs or CSV
// exports. This section therefore supports: a saved provider profile with a
// reachability probe for when an API exists, a CSV import that lands results
// as audited register_checks rows, and a live board of each worker's DBS
// status. Imported results remain provenance-honest: source='csv_import',
// never "system-verified".

const RECHECK_DAYS = 180; // typical employer re-check cadence on the Update Service

const RESULT_ALIASES = {
  clear: 'clear', 'no new information': 'clear', 'remains clear': 'clear', passed: 'clear',
  not_found: 'not_found', 'not found': 'not_found', 'no match': 'not_found', 'no record': 'not_found',
  lapsed: 'lapsed', expired: 'lapsed', unsubscribed: 'lapsed', withdrawn: 'lapsed',
  error: 'error', failed: 'error', failure: 'error',
  attention: 'attention', 'new information': 'attention', 'see certificate': 'attention',
  'not clear': 'attention', flagged: 'attention', changed: 'attention',
};
const normResult = (v) => RESULT_ALIASES[String(v || '').toLowerCase().trim()] ?? null;
const normBool = (v) => /^(y|yes|true|1|on|subscribed|active)/i.test(String(v || '').trim()) ? true
  : (/^(n|no|false|0|off|not)/i.test(String(v || '').trim()) ? false : null);

async function getConfig() {
  const cfg = await getSetting('dbs_config');
  return cfg && typeof cfg === 'object' ? cfg : null;
}
const publicConfig = (c) => (c ? {
  provider: c.provider, endpoint: c.endpoint ?? null, org_ref: c.org_ref ?? null,
  has_key: !!c.api_key, saved_at: c.saved_at,
} : null);

// ─── Board + status ─────────────────────────────────────────────────────────

r.get('/dbs/status', async (_req, res, next) => {
  try {
    const cfg = await getConfig();
    const { rows: stats } = await query(
      `SELECT COUNT(*) FILTER (WHERE c.erased_at IS NULL) AS workers,
              COUNT(*) FILTER (WHERE d.id IS NOT NULL) AS with_dbs_doc,
              COUNT(*) FILTER (WHERE d.dbs_update_service) AS on_update_service,
              COUNT(*) FILTER (WHERE rc.checked_at > now() - interval '${RECHECK_DAYS} days') AS checked_recently,
              COUNT(*) FILTER (WHERE rc.id IS NULL) AS never_checked,
              COUNT(*) FILTER (WHERE rc.result IN ('attention','lapsed','not_found','error')) AS needs_attention
       FROM candidates c
       LEFT JOIN LATERAL (
         SELECT * FROM compliance_documents d2
         WHERE d2.candidate_id = c.id AND d2.type ILIKE '%dbs%'
         ORDER BY d2.status = 'valid' DESC, d2.expiry_date DESC NULLS LAST LIMIT 1
       ) d ON true
       LEFT JOIN LATERAL (
         SELECT * FROM register_checks r2
         WHERE r2.candidate_id = c.id AND r2.register = 'dbs_update_service'
         ORDER BY r2.checked_at DESC LIMIT 1
       ) rc ON true`);
    const { rows: batches } = await query(
      `SELECT id, filename, row_count, status, summary - 'raw' - 'header' AS summary, created_at, committed_at
       FROM import_batches WHERE kind = 'dbs' ORDER BY id DESC LIMIT 10`);
    res.json({
      beta: true,
      api_note: "The gov.uk DBS Update Service has no public API — checks are browser-based. If you use an umbrella body (uCheck, Personnel Checks, etc.) it may offer an API or CSV export; save its details below and CSV import works today either way.",
      recheck_days: RECHECK_DAYS,
      connection: publicConfig(cfg),
      stats: stats[0],
      batches,
    });
  } catch (e) { next(e); }
});

// Per-worker DBS board — latest DBS-type document + latest Update Service check.
r.get('/dbs/workers', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id AS candidate_id, c.first_name, c.last_name, c.role, c.status AS candidate_status,
              d.id AS doc_id, d.type AS doc_type, d.status AS doc_status, d.reference_no, d.expiry_date,
              d.dbs_update_service, d.last_checked_at, d.check_result,
              rc.id AS check_id, rc.checked_at AS last_check_at, rc.result AS last_check_result, rc.review_due,
              rc.source AS last_check_source,
              CASE
                WHEN d.id IS NULL THEN 'no_doc'
                WHEN rc.result IN ('attention','lapsed','not_found','error') THEN rc.result
                WHEN rc.id IS NULL THEN 'never_checked'
                WHEN rc.review_due IS NOT NULL AND rc.review_due < CURRENT_DATE THEN 'review_due'
                WHEN rc.checked_at < now() - interval '${RECHECK_DAYS} days' THEN 'stale'
                ELSE 'ok'
              END AS attention
       FROM candidates c
       LEFT JOIN LATERAL (
         SELECT * FROM compliance_documents d2
         WHERE d2.candidate_id = c.id AND d2.type ILIKE '%dbs%'
         ORDER BY d2.status = 'valid' DESC, d2.expiry_date DESC NULLS LAST LIMIT 1
       ) d ON true
       LEFT JOIN LATERAL (
         SELECT * FROM register_checks r2
         WHERE r2.candidate_id = c.id AND r2.register = 'dbs_update_service'
         ORDER BY r2.checked_at DESC LIMIT 1
       ) rc ON true
       WHERE c.erased_at IS NULL
       ORDER BY CASE WHEN d.id IS NULL THEN 0
                     WHEN rc.result IN ('attention','lapsed','not_found','error') THEN 1
                     WHEN rc.id IS NULL THEN 2
                     WHEN rc.review_due IS NOT NULL AND rc.review_due < CURRENT_DATE THEN 3
                     WHEN rc.checked_at < now() - interval '${RECHECK_DAYS} days' THEN 4
                     ELSE 5 END,
                c.last_name, c.first_name`);
    res.json(rows);
  } catch (e) { next(e); }
});

// ─── Provider connection profile ────────────────────────────────────────────

r.post('/dbs/connect', canEdit, async (req, res, next) => {
  try {
    const { provider, endpoint, org_ref, api_key } = req.body || {};
    if (!provider || !String(provider).trim()) {
      return res.status(400).json({ error: 'Provider is required (e.g. "gov.uk Update Service" or your umbrella body)' });
    }
    if (endpoint && !/^https?:\/\/.+/i.test(endpoint)) {
      return res.status(400).json({ error: 'Endpoint must be a valid https:// URL' });
    }
    const existing = await getConfig();
    const cfg = {
      provider: String(provider).trim(),
      endpoint: endpoint ? endpoint.trim() : null,
      org_ref: (org_ref || '').trim() || null,
      api_key: api_key ? api_key.trim() : existing?.api_key ?? null, // blank keeps the stored key
      saved_at: new Date().toISOString(), saved_by: req.account?.userId ?? null,
    };
    await setSetting('dbs_config', cfg);
    await audit(req, 'dbs.configured', 'setting', null, { provider: cfg.provider, endpoint: cfg.endpoint });
    res.json({ ok: true, connection: publicConfig(cfg) });
  } catch (e) { next(e); }
});

r.delete('/dbs/connect', canEdit, async (req, res, next) => {
  try {
    await setSetting('dbs_config', null);
    await audit(req, 'dbs.disconnected', 'setting', null, {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Beta reachability probe — proves the outbound path once a provider API is
// confirmed. gov.uk has no API, so with no endpoint saved this reports
// "browser only" rather than failing.
r.post('/dbs/sync', canEdit, async (req, res, next) => {
  try {
    const cfg = await getConfig();
    if (!cfg?.provider) return res.status(409).json({ error: 'No DBS provider configured' });
    if (!cfg.endpoint) {
      return res.json({
        reachable: false, http_status: null,
        note: `${cfg.provider} has no API endpoint saved. If checks run on the gov.uk site or in a provider dashboard, use CSV import — there's nothing to connect to yet.`,
      });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(cfg.endpoint, {
        signal: controller.signal,
        headers: { ...(cfg.api_key ? { authorization: `Bearer ${cfg.api_key}` } : {}), accept: 'application/json' },
      });
      await audit(req, 'dbs.sync_attempted', 'setting', null, { endpoint: cfg.endpoint, http: resp.status });
      res.json({
        reachable: true, http_status: resp.status,
        note: resp.ok
          ? 'Endpoint reachable — automated status polling would run here once the provider confirms the response format.'
          : `Endpoint responded HTTP ${resp.status} — check credentials with the provider.`,
      });
    } catch (err) {
      res.json({
        reachable: false, http_status: null,
        note: `Could not reach ${cfg.endpoint} (${err.name === 'AbortError' ? 'timed out' : 'connection failed'}) — the plumbing works, but this endpoint refused or doesn't exist yet.`,
      });
    } finally { clearTimeout(timer); }
  } catch (e) { next(e); }
});

// ─── CSV import of check results ────────────────────────────────────────────
// Umbrella bodies and the Update Service let you export/download check
// history. Rows resolve workers by email → id → name only (never create),
// then land as register_checks + stamp the worker's DBS document.

const IMPORT_FIELDS = ['email', 'candidate_id', 'worker_name', 'certificate_no', 'result', 'check_date', 'review_due', 'update_service'];

function guessMapping(header) {
  const h = header.map((x) => x.toLowerCase().trim());
  const find = (...needles) => { const i = h.findIndex((c) => needles.some((n) => c.includes(n))); return i >= 0 ? i : null; };
  return {
    email: find('email'),
    candidate_id: find('candidate id', 'candidate_id', 'worker id', 'worker_id', 'staff id'),
    worker_name: find('name', 'worker', 'applicant', 'employee'),
    certificate_no: find('certificate', 'cert no', 'cert number', 'dbs no', 'dbs number', 'reference', 'disclosure'),
    result: find('result', 'status', 'outcome', 'check status'),
    check_date: find('check date', 'checked', 'date of check', 'verification date', 'date'),
    review_due: find('review', 'next check', 'recheck', 'renew'),
    update_service: find('update service', 'subscription', 'subscribed'),
  };
}

async function resolveCandidate(row, mapping) {
  const get = (k) => (mapping[k] == null ? '' : (row[mapping[k]] ?? '').trim());
  const email = get('email'), cidRaw = get('candidate_id'), name = get('worker_name');
  if (/^\d+$/.test(cidRaw)) {
    const { rows } = await query(`SELECT id, first_name, last_name FROM candidates WHERE id = $1 AND erased_at IS NULL`, [+cidRaw]);
    return { candidate: rows[0] ?? null, error: rows[0] ? null : `no worker with id ${cidRaw}` };
  }
  if (email) {
    const { rows } = await query(`SELECT id, first_name, last_name FROM candidates WHERE email ILIKE $1 AND erased_at IS NULL`, [email]);
    if (rows.length > 1) return { candidate: null, error: `email matches ${rows.length} workers` };
    return { candidate: rows[0] ?? null, error: rows[0] ? null : `no worker with email ${email}` };
  }
  if (name) {
    const parts = name.split(/\s+/);
    const { rows } = await query(
      `SELECT id, first_name, last_name FROM candidates WHERE first_name ILIKE $1 AND last_name ILIKE $2 AND erased_at IS NULL`,
      [parts[0], parts.slice(1).join(' ') || '']);
    if (rows.length === 1) return { candidate: rows[0], warning: 'matched by name only — check this is the right worker' };
    return { candidate: null, error: rows.length ? `name matches ${rows.length} workers` : `no worker named "${name}"` };
  }
  return { candidate: null, error: 'no email, worker id or name to match' };
}

async function validateRows(dataRows, mapping) {
  const out = []; const seenInFile = new Set();
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const get = (k) => (mapping[k] == null ? '' : (row[mapping[k]] ?? '').trim());
    const errors = [], warnings = [];

    const cert = get('certificate_no') || null;
    const rawResult = get('result');
    let result = normResult(rawResult);
    if (rawResult && !result) { errors.push(`unrecognised result "${rawResult}"`); }
    const checkDate = parseDate(get('check_date'));
    if (checkDate === undefined) errors.push(`unreadable check date "${get('check_date')}"`);
    const reviewDue = parseDate(get('review_due'));
    if (reviewDue === undefined) errors.push(`unreadable review date "${get('review_due')}"`);
    const updateService = normBool(get('update_service'));

    const { candidate, error, warning } = await resolveCandidate(row, mapping);
    if (error) errors.push(error);
    if (warning) warnings.push(warning);
    if (!result && !cert) errors.push('no result or certificate number on this row');

    let action = 'insert', existing = null;
    if (candidate) {
      const key = `${candidate.id}|${cert ?? ''}|${checkDate ?? ''}`;
      if (seenInFile.has(key)) errors.push('duplicate of an earlier row in this file');
      seenInFile.add(key);
      const { rows: dupe } = await query(
        `SELECT id, result, checked_at::date AS d FROM register_checks
         WHERE candidate_id = $1 AND register = 'dbs_update_service'
           AND COALESCE(identifier,'') = COALESCE($2,'')
           AND COALESCE(checked_at::date, now()::date) = COALESCE($3::date, now()::date)
         LIMIT 1`,
        [candidate.id, cert, checkDate ?? null]);
      existing = dupe[0] ?? null;
      if (existing) { action = 'skip'; warnings.push('identical check already recorded'); }
    }

    out.push({
      row: i + 2, candidate_id: candidate?.id ?? null,
      worker: candidate ? `${candidate.first_name} ${candidate.last_name}` : (get('worker_name') || get('email') || get('candidate_id') || null),
      certificate_no: cert, result, check_date: checkDate ?? null,
      review_due: reviewDue ?? null, update_service: updateService,
      action: errors.length ? 'reject' : action, existing_id: existing?.id ?? null, errors, warnings,
    });
  }
  return out;
}

const summarise = (rows) => ({
  total: rows.length,
  insert: rows.filter((r) => r.action === 'insert').length,
  skip: rows.filter((r) => r.action === 'skip').length,
  reject: rows.filter((r) => r.action === 'reject').length,
});

r.post('/dbs/import/preview', canEdit, upload.single('file'), async (req, res, next) => {
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : (req.body?.csv || '');
    const grid = parseCsv(text);
    if (grid.length < 2) return res.status(400).json({ error: 'File needs a header row and at least one data row' });
    const header = grid[0];
    const mapping = req.body?.mapping ? JSON.parse(req.body.mapping) : guessMapping(header);
    if (mapping.email == null && mapping.candidate_id == null && mapping.worker_name == null) {
      return res.status(400).json({ error: 'Could not find a worker column — include an email, name or worker id column' });
    }
    const rows = await validateRows(grid.slice(1), mapping);
    const { rows: batch } = await query(
      `INSERT INTO import_batches (kind, filename, mapping, row_count, status, summary, rows, created_by)
       VALUES ('dbs',$1,$2,$3,'preview',$4,$5,$6) RETURNING id`,
      [req.file?.originalname ?? 'pasted.csv', JSON.stringify(mapping), rows.length,
       JSON.stringify({ ...summarise(rows), header, raw: grid.slice(1).slice(0, 2000) }), JSON.stringify(rows), req.account?.userId ?? null]);
    res.json({ batch_id: batch[0].id, header, mapping, fields: IMPORT_FIELDS, summary: summarise(rows), rows });
  } catch (e) { next(e); }
});

// Re-validate the stored upload with a corrected mapping (same pattern as
// compliance training imports).
r.post('/dbs/import/:batchId/remap', canEdit, async (req, res, next) => {
  try {
    const { rows: b } = await query(`SELECT * FROM import_batches WHERE id = $1 AND status = 'preview'`, [req.params.batchId]);
    if (!b[0]) return res.status(404).json({ error: 'Batch not found or already committed' });
    const mapping = req.body?.mapping || b[0].mapping;
    const rows = await validateRows(b[0].summary.raw || [], mapping);
    await query(`UPDATE import_batches SET mapping = $1, rows = $2, summary = summary || $3 WHERE id = $4`,
      [JSON.stringify(mapping), JSON.stringify(rows), JSON.stringify(summarise(rows)), b[0].id]);
    res.json({ batch_id: b[0].id, header: b[0].summary.header, mapping, fields: IMPORT_FIELDS, summary: summarise(rows), rows });
  } catch (e) { next(e); }
});

r.post('/dbs/import/:batchId/commit', canEdit, async (req, res, next) => {
  try {
    const { rows: b } = await query(`SELECT * FROM import_batches WHERE id = $1`, [req.params.batchId]);
    const batch = b[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'preview') return res.status(409).json({ error: `Batch already ${batch.status}` });
    const results = { inserted: 0, skipped: 0, rejected: 0, rejected_rows: [] };
    for (const row of batch.rows) {
      if (row.action === 'reject' || !row.candidate_id) {
        results.rejected++; results.rejected_rows.push({ row: row.row, errors: row.errors }); continue;
      }
      if (row.action === 'skip') { results.skipped++; continue; }
      await query(
        `INSERT INTO register_checks (candidate_id, register, identifier, result, checked_by, notes, source, review_due, checked_at)
         VALUES ($1,'dbs_update_service',$2,$3,$4,$5,'csv_import',$6,COALESCE($7::date::timestamptz + interval '12 hours', now()))`,
        [row.candidate_id, row.certificate_no, row.result ?? 'clear', req.account?.userId ?? null,
         `[import #${batch.id}] from provider CSV${row.result ? '' : ' — certificate number only'}`, row.review_due, row.check_date]);
      // Stamp the worker's latest DBS document so the compliance file shows it.
      await query(
        `UPDATE compliance_documents SET last_checked_at = now(), check_result = $1,
           dbs_update_service = CASE WHEN $2 THEN TRUE ELSE dbs_update_service END,
           reference_no = COALESCE($3, reference_no), updated_at = now()
         WHERE id = (
           SELECT id FROM compliance_documents WHERE candidate_id = $4 AND type ILIKE '%dbs%'
           ORDER BY status = 'valid' DESC, expiry_date DESC NULLS LAST LIMIT 1)`,
        [row.result ?? 'clear', row.update_service === true, row.certificate_no, row.candidate_id]);
      results.inserted++;
    }
    await query(`UPDATE import_batches SET status = 'committed', committed_at = now(), summary = summary || $1 WHERE id = $2`,
      [JSON.stringify({ result: results }), batch.id]);
    await audit(req, 'dbs.imported', 'import_batch', batch.id, { ...results, rejected_rows: undefined });
    res.json({ batch_id: batch.id, ...results });
  } catch (e) { next(e); }
});

r.post('/dbs/import/:batchId/discard', canEdit, async (req, res, next) => {
  try {
    await query(`UPDATE import_batches SET status = 'discarded' WHERE id = $1 AND status = 'preview'`, [req.params.batchId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
