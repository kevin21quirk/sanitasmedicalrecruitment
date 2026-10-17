import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { getSetting, setSetting } from '../lib/settings.js';
import { upload } from '../lib/files.js';
import { parseCsv, parseDate } from '../lib/csv.js';

const r = Router();

// ─── Neuven neutral-vendor feed (BETA) ─────────────────────────────────────
// Neuven don't publish a public API — live sync requires an integration
// agreement with them. Until then this section supports a CSV import that
// lands jobs as real shift requests (source='neuven') so they flow straight
// into the allocation pipeline, plus a stored connection profile + a
// reachability check that proves the plumbing once credentials exist.

const SHIFT_TYPES = new Set(['day', 'night', 'early', 'late', 'long_day', 'sleep_in', 'twilight']);
const TYPE_ALIASES = {
  'long day': 'long_day', longday: 'long_day', 'sleep in': 'sleep_in', sleepin: 'sleep_in',
  'awake night': 'night', waking: 'night', day_shift: 'day', night_shift: 'night',
};

function guessJobMapping(header) {
  const h = header.map((x) => x.toLowerCase().trim());
  const find = (...needles) => { const i = h.findIndex((c) => needles.some((n) => c === n || c.includes(n))); return i >= 0 ? i : null; };
  return {
    reference: find('reference', 'ref', 'booking id', 'job id', 'req id', 'shift id'),
    client: find('client', 'site', 'organisation', 'location', 'home', 'unit', 'buyer'),
    date: find('shift date', 'date', 'day'),
    shift_type: find('shift type', 'type', 'shift'),
    start: find('start', 'from'),
    end: find('end', 'finish', 'to'),
    hours: find('hours', 'duration'),
    role: find('role', 'grade', 'position', 'title', 'job title'),
    qty: find('qty', 'quantity', 'workers', 'positions', 'staff needed'),
    urgency: find('urgent', 'priority'),
    notes: find('note', 'comment', 'detail', 'description'),
  };
}

async function validateJobRows(dataRows, mapping, fallbackClientId) {
  const { rows: clients } = await query(`SELECT id, name FROM clients WHERE status != 'inactive'`);
  const findClient = (name) => {
    const q = name.toLowerCase().trim();
    return clients.find((c) => c.name.toLowerCase() === q)
        ?? clients.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
  };
  const fallback = fallbackClientId ? clients.find((c) => c.id === +fallbackClientId) : null;

  const out = [];
  const seenRef = new Set();
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const get = (k) => (mapping[k] == null ? '' : (row[mapping[k]] ?? '').trim());
    const errors = [], warnings = [];

    const ref = get('reference') || null;
    const clientName = get('client');
    let client = clientName ? findClient(clientName) : null;
    if (clientName && !client && !fallback) errors.push(`no client matching "${clientName}"`);
    if (clientName && !client && fallback) { client = fallback; warnings.push(`client "${clientName}" not found — assigned to ${fallback.name}`); }
    if (!clientName && fallback) { client = fallback; }
    if (!client && !clientName) errors.push('no client column value');

    const date = parseDate(get('date'));
    if (date === undefined) errors.push(`unreadable date "${get('date')}"`);
    if (!date && date !== undefined) errors.push('missing date');

    let shiftType = get('shift_type').toLowerCase().replace(/[\s-]+/g, '_') || 'day';
    if (!SHIFT_TYPES.has(shiftType)) {
      const aliased = TYPE_ALIASES[get('shift_type').toLowerCase().trim()];
      if (aliased) shiftType = aliased;
      else { warnings.push(`unknown shift type "${get('shift_type')}" — treated as day`); shiftType = 'day'; }
    }

    const qty = Math.max(1, parseInt(get('qty'), 10) || 1);
    const hours = get('hours') ? parseFloat(get('hours')) : null;
    if (get('hours') && isNaN(hours)) warnings.push(`unreadable hours "${get('hours')}"`);
    const urgency = /urgent|asap|high/i.test(get('urgency')) ? 'urgent' : 'normal';

    // already imported? ref dedup against previous neuven requests + this file
    if (ref) {
      if (seenRef.has(ref)) { errors.push('duplicate reference in this file'); }
      else {
        seenRef.add(ref);
        const { rows: dupe } = await query(
          `SELECT id FROM shift_requests WHERE external_ref = $1 LIMIT 1`, [ref]);
        if (dupe.length) errors.push(`reference already imported as request #${dupe[0].id}`);
      }
    }

    out.push({
      row: i + 2, reference: ref, client_id: client?.id ?? null, client: client?.name ?? (clientName || null),
      date: date ?? null, shift_type: shiftType,
      start_time: get('start') || null, end_time: get('end') || null, hours,
      role: get('role') || null, qty, urgency, notes: get('notes') || null,
      action: errors.length ? 'reject' : 'insert', errors, warnings,
    });
  }
  return out;
}

const summariseJobs = (rows) => ({
  total: rows.length,
  insert: rows.filter((x) => x.action === 'insert').length,
  reject: rows.filter((x) => x.action === 'reject').length,
});

// Connection profile — stored in settings; api_key never returned to clients.
async function getConfig() {
  const cfg = await getSetting('neuven_config');
  return cfg && typeof cfg === 'object' ? cfg : null;
}
const publicConfig = (c) => (c ? { endpoint: c.endpoint, org_ref: c.org_ref, has_key: !!c.api_key, saved_at: c.saved_at } : null);

r.get('/neuven/status', async (_req, res, next) => {
  try {
    const cfg = await getConfig();
    const { rows: stats } = await query(
      `SELECT COUNT(*) AS imported,
              COUNT(*) FILTER (WHERE status = 'pending') AS open,
              COUNT(*) FILTER (WHERE status = 'filled') AS filled,
              MAX(created_at) AS last_imported
       FROM shift_requests WHERE source = 'neuven'`);
    const { rows: batches } = await query(
      `SELECT id, filename, row_count, status, summary, created_at, committed_at
       FROM import_batches WHERE kind = 'neuven' ORDER BY id DESC LIMIT 10`);
    res.json({
      beta: true,
      api_note: 'Neuven do not publish a public API — automatic sync requires an integration agreement with Neuven. CSV import works today.',
      connection: publicConfig(cfg),
      stats: stats[0],
      batches,
    });
  } catch (e) { next(e); }
});

r.post('/neuven/connect', async (req, res, next) => {
  try {
    const { endpoint, org_ref, api_key } = req.body || {};
    if (!endpoint || !/^https?:\/\/.+/i.test(endpoint)) {
      return res.status(400).json({ error: 'A valid https:// endpoint URL is required' });
    }
    const existing = await getConfig();
    const cfg = {
      endpoint: endpoint.trim(), org_ref: (org_ref || '').trim() || null,
      api_key: api_key ? api_key.trim() : existing?.api_key ?? null, // blank keeps the stored key
      saved_at: new Date().toISOString(), saved_by: req.account?.userId ?? null,
    };
    await setSetting('neuven_config', cfg);
    await audit(req, 'neuven.configured', 'setting', null, { endpoint: cfg.endpoint, org_ref: cfg.org_ref });
    res.json({ ok: true, connection: publicConfig(cfg) });
  } catch (e) { next(e); }
});

r.delete('/neuven/connect', async (req, res, next) => {
  try {
    await setSetting('neuven_config', null);
    await audit(req, 'neuven.disconnected', 'setting', null, {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Beta reachability check — proves the outbound connection path once Neuven
// grant API access. Reports status rather than failing hard.
r.post('/neuven/sync', async (req, res, next) => {
  try {
    const cfg = await getConfig();
    if (!cfg?.endpoint) return res.status(409).json({ error: 'No Neuven connection configured' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(cfg.endpoint, {
        signal: controller.signal,
        headers: { ...(cfg.api_key ? { authorization: `Bearer ${cfg.api_key}` } : {}), accept: 'application/json' },
      });
      await audit(req, 'neuven.sync_attempted', 'setting', null, { endpoint: cfg.endpoint, http: resp.status });
      res.json({
        reachable: true, http_status: resp.status,
        note: resp.ok
          ? 'Endpoint reachable — job pulling would be enabled here once Neuven confirm the feed format.'
          : `Endpoint responded HTTP ${resp.status} — check credentials with Neuven.`,
      });
    } catch (err) {
      res.json({
        reachable: false, http_status: null,
        note: `Could not reach ${cfg.endpoint} (${err.name === 'AbortError' ? 'timed out' : 'connection failed'}) — the integration plumbing works, but this endpoint refused or does not exist yet.`,
      });
    } finally { clearTimeout(timer); }
  } catch (e) { next(e); }
});

r.post('/neuven/import/preview', upload.single('file'), async (req, res, next) => {
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : (req.body?.csv || '');
    const grid = parseCsv(text);
    if (grid.length < 2) return res.status(400).json({ error: 'File needs a header row and at least one data row' });
    const header = grid[0];
    const mapping = req.body?.mapping ? JSON.parse(req.body.mapping) : guessJobMapping(header);
    if (mapping.date == null) return res.status(400).json({ error: 'Could not find a date column — include a "date" column in the CSV' });
    const rows = await validateJobRows(grid.slice(1), mapping, req.body?.client_id || req.body?.fallback_client_id);
    const { rows: batch } = await query(
      `INSERT INTO import_batches (kind, filename, mapping, row_count, status, summary, rows, created_by)
       VALUES ('neuven',$1,$2,$3,'preview',$4,$5,$6) RETURNING id`,
      [req.file?.originalname ?? 'pasted.csv', JSON.stringify(mapping), rows.length,
       JSON.stringify({ ...summariseJobs(rows), header, raw: grid.slice(1).slice(0, 2000) }), JSON.stringify(rows), req.account?.userId ?? null]);
    res.json({ batch_id: batch[0].id, header, mapping, summary: summariseJobs(rows), rows });
  } catch (e) { next(e); }
});

r.post('/neuven/import/:batchId/commit', async (req, res, next) => {
  try {
    const { rows: b } = await query(`SELECT * FROM import_batches WHERE id = $1`, [req.params.batchId]);
    const batch = b[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'preview') return res.status(409).json({ error: `Batch already ${batch.status}` });
    const results = { inserted: 0, rejected: 0, rejected_rows: [] };
    for (const row of batch.rows) {
      if (row.action === 'reject' || !row.client_id || !row.date) {
        results.rejected++; results.rejected_rows.push({ row: row.row, errors: row.errors }); continue;
      }
      await query(
        `INSERT INTO shift_requests (client_id, date, start_time, end_time, hours, shift_type, role, qty,
           urgency, source, notes, external_ref, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'neuven',$10,$11,$12)`,
        [row.client_id, row.date, row.start_time, row.end_time, row.hours, row.shift_type, row.role,
         row.qty, row.urgency, row.notes, row.reference, req.account?.id ?? null]);
      results.inserted++;
    }
    await query(`UPDATE import_batches SET status = 'committed', committed_at = now(), summary = summary || $1 WHERE id = $2`,
      [JSON.stringify({ result: results }), batch.id]);
    await audit(req, 'neuven.imported', 'import_batch', batch.id, results);
    res.json({ batch_id: batch.id, ...results });
  } catch (e) { next(e); }
});

r.post('/neuven/import/:batchId/discard', async (req, res, next) => {
  try {
    await query(`UPDATE import_batches SET status = 'discarded' WHERE id = $1 AND status = 'preview'`, [req.params.batchId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Jobs landed via Neuven — same pipeline aggregates as the requests list so the
// UI can show live stage chips.
r.get('/neuven/jobs', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sr.*, cl.name AS client_name,
              (SELECT COUNT(*) FROM shifts s WHERE s.request_id = sr.id AND s.status != 'cancelled') AS filled_count,
              (SELECT string_agg(c.first_name || ' ' || c.last_name, ', ')
               FROM shifts s JOIN candidates c ON c.id = s.candidate_id
               WHERE s.request_id = sr.id AND s.status != 'cancelled') AS filled_by,
              (SELECT COUNT(*) FROM offers o WHERE o.request_id = sr.id AND o.status = 'sent') AS pending_offers,
              (SELECT COUNT(*) FROM shifts s WHERE s.request_id = sr.id AND s.status = 'booked') AS booked_count,
              (SELECT COUNT(*) FROM shifts s WHERE s.request_id = sr.id
                AND s.status = 'completed' AND s.timesheet_status IN ('not_submitted','submitted')) AS awaiting_ts,
              (SELECT COUNT(*) FROM shifts s WHERE s.request_id = sr.id
                AND s.timesheet_status = 'approved' AND s.invoice_id IS NULL) AS to_invoice,
              (SELECT COUNT(*) FROM shifts s WHERE s.request_id = sr.id
                AND (s.timesheet_status = 'paid' OR s.invoice_id IS NOT NULL)) AS finished_count
       FROM shift_requests sr JOIN clients cl ON cl.id = sr.client_id
       WHERE sr.source = 'neuven'
       ORDER BY sr.date DESC LIMIT 100`);
    res.json(rows);
  } catch (e) { next(e); }
});

export default r;
