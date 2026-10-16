import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify } from '../lib/notify.js';
import { getSetting } from '../lib/settings.js';
import { nonPlaceable } from '../lib/compliance.js';
import { upload } from '../lib/files.js';
import { requireAccess } from '../lib/auth.js';
import { isoDate } from '../lib/dates.js';

const r = Router();
const canEdit = requireAccess('office', 'compliance'); // admin passes inside requireAccess

// Keep document statuses honest: expiry_date in the past → expired,
// within 60 days → expiring (unless already pending/missing).
async function refreshStatuses() {
  await query(`
    UPDATE compliance_documents SET status = 'expired', updated_at = now()
    WHERE expiry_date < CURRENT_DATE AND status IN ('valid','expiring')`);
  await query(`
    UPDATE compliance_documents SET status = 'expiring', updated_at = now()
    WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + 60 AND status = 'valid'`);
}

// Compliance overview
r.get('/overview', async (_req, res, next) => {
  try {
    await refreshStatuses();
    const [summary, expiring, byType] = await Promise.all([
      query(`SELECT
        COUNT(*) FILTER (WHERE status = 'valid') AS valid,
        COUNT(*) FILTER (WHERE status = 'expiring') AS expiring,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'missing') AS missing,
        COUNT(DISTINCT candidate_id) FILTER (WHERE status IN ('expired','missing')) AS candidates_blocked
        FROM compliance_documents`),
      query(`SELECT d.*, c.first_name || ' ' || c.last_name AS candidate_name, c.role AS candidate_role, c.status AS candidate_status
             FROM compliance_documents d JOIN candidates c ON c.id = d.candidate_id
             WHERE d.status IN ('expired','expiring','missing','pending')
             ORDER BY d.status = 'expired' DESC, d.expiry_date NULLS LAST, d.expiry_date`),
      query(`SELECT type,
              COUNT(*) FILTER (WHERE status = 'valid') AS valid,
              COUNT(*) FILTER (WHERE status = 'expiring') AS expiring,
              COUNT(*) FILTER (WHERE status = 'expired') AS expired,
              COUNT(*) FILTER (WHERE status = 'pending') AS pending,
              COUNT(*) FILTER (WHERE status = 'missing') AS missing
             FROM compliance_documents GROUP BY type ORDER BY type`),
    ]);
    res.json({ summary: summary.rows[0], attention: expiring.rows, byType: byType.rows });
  } catch (e) { next(e); }
});

r.patch('/documents/:id', canEdit, async (req, res, next) => {
  try {
    const allowed = ['type','reference_no','status','issue_date','expiry_date','verified_by','notes',
                     'file_id','dbs_update_service','last_checked_at','check_result'];
    const sets = [], params = [];
    for (const k of allowed) {
      if (k in req.body) { params.push(req.body[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE compliance_documents SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
    await audit(req, 'document.updated', 'document', +req.params.id, req.body);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// 7.4 — workers non-placeable because of lapsed/missing documents.
r.get('/non-placeable', async (req, res, next) => {
  try {
    const clientId = req.query.client_id ? +req.query.client_id : null;
    res.json(await nonPlaceable(clientId));
  } catch (e) { next(e); }
});

// ─── 2.10 / A — spreadsheet import of training records ─────────────────────
// Two-step: POST /import-training/preview parses the file, auto-detects column
// mapping, validates every row and stores a batch. The user reviews (and may
// change the mapping), then POST /import-training/:batchId/commit writes only
// the valid rows. Nothing touches candidate/document tables during preview.

const IMPORT_FIELDS = ['email', 'candidate_id', 'worker_name', 'doc_type', 'issue_date', 'expiry_date', 'reference_no'];

function parseCsv(text) {
  // RFC4180-ish: handles quoted cells with commas/newlines and "" escapes.
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function guessMapping(header) {
  const h = header.map((x) => x.toLowerCase().trim());
  const find = (...needles) => { const i = h.findIndex((c) => needles.some((n) => c.includes(n))); return i >= 0 ? i : null; };
  return {
    email: find('email'),
    candidate_id: find('candidate id', 'candidate_id', 'worker id', 'worker_id'),
    worker_name: find('name'),
    doc_type: find('course', 'training', 'qualification', 'type', 'module'),
    issue_date: find('complet', 'issue', 'achieved', 'date passed', 'awarded'),
    expiry_date: find('expir', 'renew', 'valid until', 'due'),
    reference_no: find('cert', 'reference', 'ref'),
  };
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); // UK d/m/y
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isNaN(Date.parse(d)) ? undefined : d;
  }
  return undefined; // unparseable
}

async function validateRows(dataRows, mapping) {
  const get = (r, k) => (mapping[k] == null ? '' : (r[mapping[k]] ?? '').trim());
  const out = []; const seenInFile = new Set();
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const errors = [], warnings = [];
    const email = get(r, 'email'), cidRaw = get(r, 'candidate_id'), name = get(r, 'worker_name');
    const docType = get(r, 'doc_type') || 'Mandatory Training';
    const issue = parseDate(get(r, 'issue_date')), expiry = parseDate(get(r, 'expiry_date'));
    if (issue === undefined) errors.push(`unreadable issue date "${get(r, 'issue_date')}"`);
    if (expiry === undefined) errors.push(`unreadable expiry date "${get(r, 'expiry_date')}"`);
    if (issue && expiry && expiry < issue) errors.push('expiry is before issue date');

    // resolve worker — never create one from an import
    let candidate = null;
    if (/^\d+$/.test(cidRaw)) {
      const { rows } = await query(`SELECT id, first_name, last_name FROM candidates WHERE id = $1 AND erased_at IS NULL`, [+cidRaw]);
      candidate = rows[0] ?? null;
      if (!candidate) errors.push(`no worker with id ${cidRaw}`);
    } else if (email) {
      const { rows } = await query(`SELECT id, first_name, last_name FROM candidates WHERE email ILIKE $1 AND erased_at IS NULL`, [email]);
      if (rows.length > 1) errors.push(`email matches ${rows.length} workers`);
      candidate = rows[0] ?? null;
      if (!candidate) errors.push(`no worker with email ${email}`);
    } else if (name) {
      const parts = name.split(/\s+/);
      const { rows } = await query(
        `SELECT id, first_name, last_name FROM candidates WHERE first_name ILIKE $1 AND last_name ILIKE $2 AND erased_at IS NULL`,
        [parts[0], parts.slice(1).join(' ') || '']);
      if (rows.length === 1) { candidate = rows[0]; warnings.push('matched by name only — check this is the right worker'); }
      else errors.push(rows.length ? `name matches ${rows.length} workers` : `no worker named "${name}"`);
    } else errors.push('no email, worker id or name to match');

    let action = 'insert', existing = null;
    if (candidate) {
      const key = `${candidate.id}|${docType.toLowerCase()}`;
      if (seenInFile.has(key)) errors.push('duplicate of an earlier row in this file');
      seenInFile.add(key);
      const { rows } = await query(
        `SELECT id, issue_date, expiry_date, status FROM compliance_documents WHERE candidate_id = $1 AND LOWER(type) = LOWER($2) ORDER BY expiry_date DESC NULLS LAST LIMIT 1`,
        [candidate.id, docType]);
      existing = rows[0] ?? null;
      if (existing) {
        const sameIssue = issue && existing.issue_date && isoDate(existing.issue_date) === issue;
        const sameExp = (expiry ?? null) === (existing.expiry_date ? isoDate(existing.expiry_date) : null);
        if (sameIssue && sameExp) { action = 'skip'; warnings.push('identical record already on file'); }
        else { action = 'update'; warnings.push(`will update existing record (expires ${existing.expiry_date ? isoDate(existing.expiry_date) : '—'})`); }
      }
    }
    out.push({
      row: i + 2, candidate_id: candidate?.id ?? null,
      worker: candidate ? `${candidate.first_name} ${candidate.last_name}` : (name || email || cidRaw || null),
      doc_type: docType, issue_date: issue ?? null, expiry_date: expiry ?? null, reference_no: get(r, 'reference_no') || null,
      action: errors.length ? 'reject' : action, existing_id: existing?.id ?? null, errors, warnings,
    });
  }
  return out;
}

const summarise = (rows) => ({
  total: rows.length,
  insert: rows.filter((r) => r.action === 'insert').length,
  update: rows.filter((r) => r.action === 'update').length,
  skip: rows.filter((r) => r.action === 'skip').length,
  reject: rows.filter((r) => r.action === 'reject').length,
});

r.post('/import-training/preview', canEdit, upload.single('file'), async (req, res, next) => {
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : (req.body?.csv || '');
    const grid = parseCsv(text);
    if (grid.length < 2) return res.status(400).json({ error: 'File needs a header row and at least one data row' });
    const header = grid[0];
    const mapping = req.body?.mapping ? JSON.parse(req.body.mapping) : guessMapping(header);
    const rows = await validateRows(grid.slice(1), mapping);
    const { rows: batch } = await query(
      `INSERT INTO import_batches (kind, filename, mapping, row_count, status, summary, rows, created_by)
       VALUES ('training',$1,$2,$3,'preview',$4,$5,$6) RETURNING id`,
      [req.file?.originalname ?? 'pasted.csv', JSON.stringify(mapping), rows.length, JSON.stringify(summarise(rows)), JSON.stringify(rows), req.account?.userId ?? null]);
    // keep the raw grid so the mapping can be changed without re-uploading
    await query(`UPDATE import_batches SET summary = summary || $1 WHERE id = $2`, [JSON.stringify({ header, raw: grid.slice(1).slice(0, 2000) }), batch[0].id]);
    res.json({ batch_id: batch[0].id, header, mapping, fields: IMPORT_FIELDS, summary: summarise(rows), rows });
  } catch (e) { next(e); }
});

// Re-validate the same upload with a corrected mapping.
r.post('/import-training/:batchId/remap', canEdit, async (req, res, next) => {
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

r.post('/import-training/:batchId/commit', canEdit, async (req, res, next) => {
  try {
    const { rows: b } = await query(`SELECT * FROM import_batches WHERE id = $1`, [req.params.batchId]);
    const batch = b[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'preview') return res.status(409).json({ error: `Batch already ${batch.status}` });
    const results = { inserted: 0, updated: 0, skipped: 0, rejected: 0, rejected_rows: [] };
    for (const row of batch.rows) {
      if (row.action === 'reject') { results.rejected++; results.rejected_rows.push({ row: row.row, errors: row.errors }); continue; }
      if (row.action === 'skip') { results.skipped++; continue; }
      const status = row.expiry_date && new Date(row.expiry_date) < new Date() ? 'expired' : 'valid';
      if (row.action === 'update') {
        await query(
          `UPDATE compliance_documents SET issue_date = $1, expiry_date = $2, status = $3, reference_no = COALESCE($4, reference_no),
             verified_by = $5, notes = COALESCE(notes,'') || $6, updated_at = now() WHERE id = $7`,
          [row.issue_date, row.expiry_date, status, row.reference_no, req.account?.userId ?? null, `\n[import #${batch.id}]`, row.existing_id]);
        results.updated++;
      } else {
        await query(
          `INSERT INTO compliance_documents (candidate_id, type, status, issue_date, expiry_date, reference_no, verified_by, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [row.candidate_id, row.doc_type, status, row.issue_date, row.expiry_date, row.reference_no, req.account?.userId ?? null, `[import #${batch.id}] staff-entered from spreadsheet`]);
        results.inserted++;
      }
    }
    await query(`UPDATE import_batches SET status = 'committed', committed_at = now(), summary = summary || $1 WHERE id = $2`,
      [JSON.stringify({ result: results }), batch.id]);
    await audit(req, 'training.imported', 'import_batch', batch.id, { ...results, rejected_rows: undefined });
    res.json({ batch_id: batch.id, ...results });
  } catch (e) { next(e); }
});

r.post('/import-training/:batchId/discard', canEdit, async (req, res, next) => {
  try {
    await query(`UPDATE import_batches SET status = 'discarded' WHERE id = $1 AND status = 'preview'`, [req.params.batchId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get('/import-training/batches', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT b.id, b.filename, b.row_count, b.status, b.summary - 'raw' - 'header' AS summary, b.created_at, b.committed_at, u.name AS created_by_name
       FROM import_batches b LEFT JOIN users u ON u.id = b.created_by ORDER BY b.created_at DESC LIMIT 50`);
    res.json(rows);
  } catch (e) { next(e); }
});

// 2.2 — generate expiry reminders into the outbox (worker + compliance officer)
// plus one monthly digest summary. Safe to call repeatedly; duplicates are
// avoided per document per day.
r.post('/send-reminders', canEdit, async (req, res, next) => {
  try {
    await refreshStatuses();
    const windows = await getSetting('reminder_days'); // e.g. [60,30,14,7]
    const { rows: due } = await query(
      `SELECT d.id AS doc_id, d.type, d.expiry_date, d.expiry_date - CURRENT_DATE AS days_left,
              c.id AS candidate_id, c.first_name || ' ' || c.last_name AS candidate_name,
              c.email AS candidate_email, c.phone AS candidate_phone
       FROM compliance_documents d JOIN candidates c ON c.id = d.candidate_id
       WHERE d.expiry_date IS NOT NULL AND d.status IN ('valid','expiring')
         AND (d.expiry_date - CURRENT_DATE) = ANY($1) AND c.erased_at IS NULL`,
      [windows]);

    let queued = 0;
    for (const d of due) {
      const already = await query(
        `SELECT 1 FROM messages WHERE entity_type = 'compliance_document' AND entity_id = $1
           AND created_at::date = CURRENT_DATE`, [d.doc_id]);
      if (already.rows.length) continue;
      const body = `Hi ${d.candidate_name.split(' ')[0]}, your ${d.type} expires on ${d.expiry_date} (${d.days_left} days). Please send us your renewed document as soon as possible. — Sanitas`;
      await notify({ channel: 'whatsapp', toName: d.candidate_name, toContact: d.candidate_phone,
        subject: `${d.type} expiring`, body, entityType: 'compliance_document', entityId: d.doc_id,
        createdBy: req.account?.userId });
      if (d.candidate_email) {
        await notify({ channel: 'email', toName: d.candidate_name, toContact: d.candidate_email,
          subject: `Your ${d.type} expires in ${d.days_left} days`, body,
          entityType: 'compliance_document', entityId: d.doc_id, createdBy: req.account?.userId });
      }
      queued++;
    }

    // Monthly digest: single summary to the compliance team of everything due.
    let digest = null;
    if (await getSetting('monthly_digest')) {
      const { rows: all } = await query(
        `SELECT d.type, d.expiry_date, d.expiry_date - CURRENT_DATE AS days_left,
                c.first_name || ' ' || c.last_name AS candidate_name
         FROM compliance_documents d JOIN candidates c ON c.id = d.candidate_id
         WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= CURRENT_DATE + 60
           AND d.status IN ('valid','expiring','expired') AND c.erased_at IS NULL
         ORDER BY d.expiry_date`);
      const { rows: staff } = await query(
        `SELECT u.email, u.name FROM users u JOIN accounts a ON a.user_id = u.id
         WHERE u.access_role IN ('compliance','admin') AND a.is_active`);
      const body = `Compliance expiry digest (${all.length} documents due within 60 days):\n\n` +
        all.map((d) => `• ${d.candidate_name} — ${d.type}: ${d.days_left < 0 ? 'EXPIRED' : `${d.days_left}d`} (${d.expiry_date})`).join('\n');
      for (const s of staff) {
        digest = await notify({ channel: 'email', toName: s.name, toContact: s.email,
          subject: 'Monthly compliance expiry digest', body, createdBy: req.account?.userId });
      }
    }
    await audit(req, 'compliance.reminders_sent', null, null, { queued, digest: !!digest });
    res.json({ queued, digestSent: !!digest });
  } catch (e) { next(e); }
});

export default r;
