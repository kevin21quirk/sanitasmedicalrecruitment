// Integration suite covering the Phase-4 acceptance scenarios.
// Runs the real Express app against the dev database (DATABASE_URL / .env),
// creating TEST-* fixtures and removing them afterwards. Never truncates or
// reseeds shared data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import { query, pool } from '../db.js';
import { hashPassword } from '../lib/auth.js';
import { getSetting, setSetting } from '../lib/settings.js';

let server, base;
const cookies = {};
const SETTING_KEYS = ['weekend_uplift', 'night_uplift', 'bank_holiday_uplift', 'uplift_precedence',
  'employers_ni_pct', 'bureau_fee_paye_per_shift', 'bureau_fee_ltd_per_shift'];
const savedSettings = {};
const fx = { clients: [], candidates: [], shifts: [], accounts: [], users: [], batches: [], requests: [], payrollRuns: [], reqs: [] };

const nextDay = (dow) => { // next date with this day-of-week (0=Sun)
  const d = new Date(); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
};
const SAT = nextDay(6), MON = nextDay(1), TUE = nextDay(2);
// On Fri–Sun runs MON lands before SAT — range params must be sorted.
const LO = SAT < MON ? SAT : MON, HI = SAT < MON ? MON : SAT;

async function api(path, { method = 'GET', body, cookie = cookies.admin } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, body: data };
}

async function login(email, password) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login ${email}`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^sanitas_session=/);
  return cookie;
}

const BASE_DOCS = [
  ['DBS Enhanced', '2025-01-01', '2028-01-01'],
  ['Right to Work', '2025-01-01', '2028-01-01'],
  ['Passport/ID', '2025-01-01', '2028-01-01'],
  ['Mandatory Training', '2025-01-01', '2027-06-01'],
];
async function addDocs(candidateId, docs = BASE_DOCS) {
  for (const [type, issue, expiry] of docs) {
    const { rows } = await query(
      `INSERT INTO compliance_documents (candidate_id, type, status, issue_date, expiry_date)
       VALUES ($1,$2,'valid',$3,$4) RETURNING id`, [candidateId, type, issue, expiry]);
    fx.docs?.push?.(rows[0].id);
  }
}
// Audit rows are append-only by trigger; the suite's own teardown must briefly
// lift that guard (table-owner only) to remove rows its activity produced.
async function deleteTestAuditRows() {
  try {
    await query(`ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update`);
    await query(
      `DELETE FROM audit_log
       WHERE actor_name LIKE 'TEST %' OR actor_name LIKE 'test-%@example.invalid'
          OR account_id IN (SELECT id FROM accounts WHERE email LIKE 'test-%@example.invalid')
          OR (entity_type = 'account' AND entity_id IN
              (SELECT id FROM accounts WHERE email LIKE 'test-%@example.invalid'))`);
  } finally {
    await query(`ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update`);
  }
}
// Re-runnable cleanup: remove leftovers from a previous failed run.
async function purgeTestData() {
  const { rows: cands } = await query(`SELECT id FROM candidates WHERE email LIKE 'test-%@example.invalid'`);
  const { rows: cls } = await query(`SELECT id FROM clients WHERE name LIKE 'TEST Home %'`);
  const candIds = cands.map((r) => r.id), clientIds = cls.map((r) => r.id);
  if (candIds.length) {
    const { rows: runs } = await query(
      `SELECT DISTINCT payroll_export_id FROM shifts WHERE (candidate_id = ANY($1::int[]) OR client_id = ANY($2::int[])) AND payroll_export_id IS NOT NULL`,
      [candIds, clientIds.length ? clientIds : [0]]);
    await query(`DELETE FROM shifts WHERE candidate_id = ANY($1::int[]) OR client_id = ANY($2::int[])`, [candIds, clientIds.length ? clientIds : [0]]);
    if (runs.length) await query(`DELETE FROM payroll_exports WHERE id = ANY($1::int[])`, [runs.map((r) => r.payroll_export_id)]);
    await query(`DELETE FROM messages WHERE entity_type = 'candidate' AND entity_id = ANY($1::int[]) OR to_contact LIKE 'test-%@example.invalid'`, [candIds]);
    const { rows: accs } = await query(`SELECT id FROM accounts WHERE candidate_id = ANY($1::int[]) OR client_id = ANY($2::int[]) OR email LIKE 'test-%@example.invalid'`, [candIds, clientIds.length ? clientIds : [0]]);
    if (accs.length) {
      await query(`DELETE FROM sessions WHERE account_id = ANY($1::int[])`, [accs.map((a) => a.id)]);
      await query(`DELETE FROM accounts WHERE id = ANY($1::int[])`, [accs.map((a) => a.id)]);
    }
    await query(`DELETE FROM candidates WHERE id = ANY($1::int[])`, [candIds]);
  }
  if (clientIds.length) await query(`DELETE FROM clients WHERE id = ANY($1::int[])`, [clientIds]);
  await query(`DELETE FROM import_batches WHERE filename = 'pasted.csv'`, []);
  // staff fixtures from a failed run (accounts already removed by email pattern above)
  const { rows: tu } = await query(`SELECT id FROM users WHERE email LIKE 'test-staff-%@example.invalid'`);
  if (tu.length) {
    const uids = tu.map((r) => r.id);
    await query(`DELETE FROM messages WHERE created_by = ANY($1::int[])`, [uids]);
    await query(`DELETE FROM users WHERE id = ANY($1::int[])`, [uids]);
  }
  // The suite runs against a live DB — sweep audit rows its activity produced
  // so test traffic never masquerades as real history.
  await deleteTestAuditRows();
}
async function addCandidate(tag, { engagement = 'paye', payrollRef = null, docs = BASE_DOCS } = {}) {
  const { rows } = await query(
    `INSERT INTO candidates (first_name, last_name, email, role, status, engagement_type, payroll_ref)
     VALUES ('TEST','${tag}',$1,'Healthcare Assistant','compliant',$2,$3) RETURNING id`,
    [`test-${tag.toLowerCase()}@example.invalid`, engagement, payrollRef]);
  fx.candidates.push(rows[0].id);
  if (docs) await addDocs(rows[0].id, docs);
  return rows[0].id;
}
async function addClient(tag) {
  const { rows } = await query(
    `INSERT INTO clients (name, type, status) VALUES ($1,'Residential Home','active') RETURNING id`,
    [`TEST Home ${tag}`]);
  fx.clients.push(rows[0].id);
  return rows[0].id;
}

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  await purgeTestData();
  // Dedicated TEST staff accounts — never touch real seeded accounts.
  const staffPw = hashPassword('sanitas123');
  for (const [role, name] of [['admin', 'TEST Admin'], ['finance', 'TEST Finance'],
                              ['compliance', 'TEST Compliance'], ['office', 'TEST Office']]) {
    const email = `test-staff-${role}@example.invalid`;
    const u = await query(
      `INSERT INTO users (name, email, role, initials, color, access_role) VALUES ($1,$2,'Tester','TT','#64748b',$3) RETURNING id`,
      [name, email, role]);
    fx.users.push(u.rows[0].id);
    const a = await query(
      `INSERT INTO accounts (kind, user_id, email, password_hash) VALUES ('staff',$1,$2,$3) RETURNING id`,
      [u.rows[0].id, email, staffPw]);
    fx.accounts.push(a.rows[0].id);
    cookies[role] = await login(email, 'sanitas123');
  }

  // deterministic financial assumptions for the test run — originals are
  // captured so `after` can restore them (the suite may run against a live DB)
  for (const k of SETTING_KEYS) savedSettings[k] = await getSetting(k);
  await setSetting('weekend_uplift', 1.25);
  await setSetting('night_uplift', 1.15);
  await setSetting('bank_holiday_uplift', 1.5);
  await setSetting('uplift_precedence', 'highest');
  await setSetting('employers_ni_pct', 15);
  await setSetting('bureau_fee_paye_per_shift', 3.5);
  await setSetting('bureau_fee_ltd_per_shift', 2.0);

  fx.clientA = await addClient('A');            // baseline requirements only
  fx.clientB = await addClient('B');            // + PMVA
  await query(`INSERT INTO client_requirements (client_id, doc_type, required) VALUES ($1,'PMVA',TRUE)`, [fx.clientB]);

  fx.candOk = await addCandidate('WorkerPaye', { payrollRef: 'TEST-PAYE-001' });
  fx.candLtd = await addCandidate('WorkerLtd', { engagement: 'ltd', payrollRef: 'TEST-LTD-001' });
  fx.candExpired = await addCandidate('WorkerExpired', {
    docs: BASE_DOCS.map(([t, i, e]) => (t === 'DBS Enhanced' ? [t, '2019-01-01', '2020-01-01'] : [t, i, e])),
  });
  // flip the expired DBS row's stored status too (docHealth also catches it)
  await query(`UPDATE compliance_documents SET status = 'expired' WHERE candidate_id = $1 AND type = 'DBS Enhanced'`, [fx.candExpired]);

  // portal logins
  const pw = hashPassword('portal123');
  const { rows: wa } = await query(
    `INSERT INTO accounts (kind, candidate_id, email, password_hash) VALUES ('worker',$1,$2,$3) RETURNING id`,
    [fx.candOk, 'test-workerpaye@example.invalid', pw]);
  fx.accounts.push(wa[0].id);
  const { rows: ca } = await query(
    `INSERT INTO accounts (kind, client_id, email, password_hash) VALUES ('client',$1,$2,$3) RETURNING id`,
    [fx.clientA, 'test-clienta@example.invalid', pw]);
  fx.accounts.push(ca[0].id);
  const { rows: sa } = await query(
    `INSERT INTO accounts (kind, client_id, email, password_hash) VALUES ('supervisor',$1,$2,$3) RETURNING id`,
    [fx.clientA, 'test-supva@example.invalid', pw]);
  fx.accounts.push(sa[0].id);
  cookies.worker = await login('test-workerpaye@example.invalid', 'portal123');
  cookies.client = await login('test-clienta@example.invalid', 'portal123');
  cookies.supervisor = await login('test-supva@example.invalid', 'portal123');
});

after(async () => {
  try {
    if (fx.requests.length) await query(`DELETE FROM shift_requests WHERE id = ANY($1::int[])`, [fx.requests]);
    if (fx.shifts.length) await query(`DELETE FROM shifts WHERE id = ANY($1::int[])`, [fx.shifts]);
    if (fx.payrollRuns.length) await query(`DELETE FROM payroll_exports WHERE id = ANY($1::int[])`, [fx.payrollRuns]);
    if (fx.batches.length) await query(`DELETE FROM import_batches WHERE id = ANY($1::int[])`, [fx.batches]);
    if (fx.clients.length) await query(`DELETE FROM client_requirements WHERE client_id = ANY($1::int[])`, [fx.clients]);
    await query(`DELETE FROM messages WHERE entity_type = 'candidate' AND entity_id = ANY($1::int[])`, [fx.candidates]);
    await query(`DELETE FROM messages WHERE to_contact LIKE 'test-%@example.invalid'`, []);
    // audit trail must not retain test traffic on a live DB — sweep while the
    // test accounts still exist so account_id/entity_id matches also apply
    await deleteTestAuditRows();
    if (fx.accounts.length) {
      await query(`DELETE FROM sessions WHERE account_id = ANY($1::int[])`, [fx.accounts]);
      await query(`DELETE FROM accounts WHERE id = ANY($1::int[])`, [fx.accounts]);
    }
    if (fx.candidates.length) await query(`DELETE FROM candidates WHERE id = ANY($1::int[])`, [fx.candidates]);
    if (fx.clients.length) await query(`DELETE FROM clients WHERE id = ANY($1::int[])`, [fx.clients]);
    if (fx.users.length) {
      await query(`DELETE FROM messages WHERE created_by = ANY($1::int[])`, [fx.users]);
      await query(`DELETE FROM users WHERE id = ANY($1::int[])`, [fx.users]);
    }
    // restore settings mutated mid-run (e.g. weekend_uplift -> 2.0 in test 8)
    for (const k of SETTING_KEYS) {
      if (savedSettings[k] !== undefined) await setSetting(k, savedSettings[k]);
    }
  } finally {
    server.close();
    await pool.end();
  }
});

// ── 1/2/3. Per-site compliance gates booking ────────────────────────────────
test('1: worker compliant at Home A but missing PMVA at Home B can only be booked at A', async () => {
  const a = await api('/shifts', { method: 'POST', body: {
    candidate_id: fx.candOk, client_id: fx.clientA, shift_date: SAT,
    start_time: '08:00', end_time: '20:00', hours: 8, shift_type: 'day',
    pay_rate: '14.50', charge_rate: '20.00' } });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  fx.shifts.push(a.body.id);

  const b = await api('/shifts', { method: 'POST', body: {
    candidate_id: fx.candOk, client_id: fx.clientB, shift_date: MON,
    start_time: '08:00', end_time: '20:00', hours: 8, shift_type: 'day',
    pay_rate: '14.50', charge_rate: '20.00' } });
  assert.equal(b.status, 422);
  assert.ok(b.body.gaps.some((g) => g.type === 'PMVA'), 'gap explains the missing PMVA');
});

test('2: expired mandatory document blocks booking', async () => {
  const r = await api('/shifts', { method: 'POST', body: {
    candidate_id: fx.candExpired, client_id: fx.clientA, shift_date: MON,
    start_time: '08:00', end_time: '20:00', hours: 8, shift_type: 'day',
    pay_rate: '14.50', charge_rate: '20.00' } });
  assert.equal(r.status, 422);
  assert.ok(r.body.gaps.some((g) => g.type === 'DBS Enhanced' && g.problem === 'expired'));
});

test('3: updating the compliance record changes the compliance result', async () => {
  const { rows } = await query(
    `SELECT id FROM compliance_documents WHERE candidate_id = $1 AND type = 'DBS Enhanced'`, [fx.candExpired]);
  const patched = await api(`/compliance/documents/${rows[0].id}`, {
    method: 'PATCH', cookie: cookies.compliance,
    body: { status: 'valid', issue_date: '2025-06-01', expiry_date: '2028-06-01' } });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));

  const check = await api(`/candidates/${fx.candExpired}/compliance/${fx.clientA}`);
  assert.equal(check.body.ok, true, `still failing: ${JSON.stringify(check.body.gaps)}`);
});

// ── 4. Manual DBS/NMC recording is labelled as staff-recorded ───────────────
test('4: register checks carry manual_staff provenance', async () => {
  const r = await api(`/candidates/${fx.candOk}/register-checks`, { method: 'POST', body: {
    register: 'dbs_update_service', identifier: 'DBS-TEST-1', result: 'clear', notes: 'checked on gov.uk' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.source, 'manual_staff');
  assert.ok(r.body.checked_by, 'recorder captured');

  const file = await api(`/candidates/${fx.candOk}/compliance-file`);
  assert.ok(file.body.register_checks.length >= 1);
});

// ── 5. Training import: preview → validate → commit, no dupes ───────────────
test('5: spreadsheet import validates, reports errors, avoids duplicates', async () => {
  const csv = [
    'Email,Course,Completed,Expires,Cert Ref',
    'test-workerpaye@example.invalid,First Aid,01/01/2025,01/01/2028,FA-1',
    'nobody@example.invalid,First Aid,01/01/2025,01/01/2028,',
    'test-workerpaye@example.invalid,First Aid,02/01/2025,02/01/2028,FA-1', // dup within file
    'test-workerpaye@example.invalid,Fire Safety,not-a-date,01/01/2028,',
  ].join('\n');
  const preview = await api('/compliance/import-training/preview', { method: 'POST', body: { csv } });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  fx.batches.push(preview.body.batch_id);
  assert.equal(preview.body.summary.insert, 1);
  assert.equal(preview.body.summary.reject, 3); // unknown email, in-file dup, bad date
  const rejected = preview.body.rows.filter((r2) => r2.action === 'reject');
  assert.ok(rejected.some((r2) => r2.errors.some((e) => e.includes('no worker'))));

  const commit = await api(`/compliance/import-training/${preview.body.batch_id}/commit`, { method: 'POST', body: {} });
  assert.equal(commit.status, 200);
  assert.equal(commit.body.inserted, 1);
  assert.equal(commit.body.rejected, 3);

  // re-commit is refused
  const again = await api(`/compliance/import-training/${preview.body.batch_id}/commit`, { method: 'POST', body: {} });
  assert.equal(again.status, 409);

  // re-importing the same record is detected as a duplicate (skip/update, not insert)
  const preview2 = await api('/compliance/import-training/preview', { method: 'POST', body: { csv } });
  fx.batches.push(preview2.body.batch_id);
  const row1 = preview2.body.rows.find((r2) => r2.doc_type === 'First Aid' && !r2.errors.length);
  assert.ok(['skip', 'update'].includes(row1.action), 'existing record detected, not duplicated');
});

// ── 6. Named-resident data is staff/client-scoped, not worker-visible ───────
test('6: worker accounts cannot reach resident/staff endpoints', async () => {
  await query(`INSERT INTO individuals (client_id, name) VALUES ($1,'TEST Resident R')`, [fx.clientA]);
  const w = await api(`/clients/${fx.clientA}`, { cookie: cookies.worker });
  assert.equal(w.status, 401);
  const indiv = await api('/portal/client/individuals', { cookie: cookies.worker });
  assert.equal(indiv.status, 401);
  const okClient = await api('/portal/client/individuals', { cookie: cookies.client });
  assert.equal(okClient.status, 200);
  await query(`DELETE FROM individuals WHERE client_id = $1 AND name = 'TEST Resident R'`, [fx.clientA]);
});

// ── 7/8. Rates, enhancements, historical snapshots ──────────────────────────
let shiftSat;
test('7: pay/charge with weekend uplift computed in pence at approval', async () => {
  const res = await api(`/shifts/${fx.shifts[0]}/approve`, { method: 'POST', body: { force: true } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  shiftSat = res.body.financials;
  assert.equal(shiftSat.uplift_rule, 'weekend');
  assert.equal(shiftSat.pay_amount_pence, 14500);      // £14.50 × 8 × 1.25
  assert.equal(shiftSat.charge_amount_pence, 20000);   // £20.00 × 8 × 1.25
  assert.equal(shiftSat.employer_ni_pence, 2175);      // 15% of pay
  assert.equal(shiftSat.bureau_fee_pence, 350);        // PAYE per-shift fee
});

test('8: later rate/setting changes do not rewrite approved history', async () => {
  await setSetting('weekend_uplift', 2.0);             // pretend rates changed later
  const { rows } = await query(`SELECT * FROM shifts WHERE id = $1`, [fx.shifts[0]]);
  assert.equal(+rows[0].pay_amount_pence, 14500, 'snapshot unchanged');
  assert.equal(rows[0].financial_snapshot.pay_rate, '14.50');
  assert.equal(rows[0].financial_snapshot.uplift.rule, 'weekend');

  const margin = await api(`/margin?from=${SAT}&to=${SAT}`, { cookie: cookies.finance });
  const line = margin.body.lines.find((l) => l.shift_id === fx.shifts[0]);
  assert.equal(line.basis, 'actual');
  assert.equal(line.margin, '29.75'); // 200.00 − 145.00 − 21.75 − 3.50
});

// ── 9/10. Payroll separation + margin completeness ──────────────────────────
let ltdShift;
test('9: payroll export separates PAYE and Ltd workers', async () => {
  // book + approve a weekday shift for the Ltd worker
  const s = await api('/shifts', { method: 'POST', body: {
    candidate_id: fx.candLtd, client_id: fx.clientA, shift_date: MON,
    start_time: '08:00', end_time: '20:00', hours: 8, shift_type: 'day',
    pay_rate: '18.00', charge_rate: '24.00' } });
  assert.equal(s.status, 201);
  ltdShift = s.body.id; fx.shifts.push(ltdShift);
  await api(`/shifts/${ltdShift}/approve`, { method: 'POST', body: { force: true } });

  const p = await api(`/payroll?from=${LO}&to=${HI}`, { cookie: cookies.finance });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.ok(p.body.paye.some((r2) => r2.shift_id === fx.shifts[0]));
  assert.ok(p.body.ltd.some((r2) => r2.shift_id === ltdShift));
  assert.ok(!p.body.paye.some((r2) => r2.shift_id === ltdShift));
  assert.ok(!p.body.ltd.some((r2) => r2.shift_id === fx.shifts[0]));

  // export PAYE run — second export of the same period finds nothing new
  const run = await api('/payroll/export', { method: 'POST', cookie: cookies.finance,
    body: { from: LO, to: HI, engagement: 'paye' } });
  assert.equal(run.status, 201, JSON.stringify(run.body));
  fx.payrollRuns.push(run.body.run.id);
  const dup = await api('/payroll/export', { method: 'POST', cookie: cookies.finance,
    body: { from: LO, to: HI, engagement: 'paye' } });
  assert.ok([409].includes(dup.status), 'duplicate export prevented');
  if (dup.status === 409) {
    assert.ok(dup.body.rejected.some((r2) => r2.reasons.some((x) => x.includes('already exported'))));
  }
});

test('10: margin includes NI + bureau fee and flags missing inputs', async () => {
  // completed shift with no rates → 'unavailable', not silently £0
  const s = await api('/shifts', { method: 'POST', body: {
    candidate_id: fx.candOk, client_id: fx.clientA, shift_date: MON,
    start_time: '22:00', end_time: '08:00', hours: 8, shift_type: 'night' } });
  assert.equal(s.status, 201);
  fx.shifts.push(s.body.id);
  await api(`/shifts/${s.body.id}`, { method: 'PATCH', body: { status: 'completed' } });

  const m = await api(`/margin?from=${LO}&to=${HI}`, { cookie: cookies.finance });
  const missing = m.body.lines.find((l) => l.shift_id === s.body.id);
  assert.equal(missing.basis, 'unavailable');
  assert.ok(missing.problems.length, 'missing inputs flagged');
  const ltd = m.body.lines.find((l) => l.shift_id === ltdShift);
  assert.equal(ltd.basis, 'actual');
  assert.equal(+ltd.ni, 0, 'Ltd workers carry no employer NI');
  assert.equal(ltd.fee, '2.00', 'Ltd bureau fee applied');
});

// ── 11/12. Access control ───────────────────────────────────────────────────
test('11/12: workers and clients cannot reach finance or staff endpoints', async () => {
  for (const cookie of [cookies.worker, cookies.client]) {
    for (const p of ['/payroll?from=2025-01-01&to=2025-01-31', '/margin?from=2025-01-01&to=2025-01-31', '/invoices', '/shifts']) {
      const r = await api(p, { cookie });
      assert.equal(r.status, 401, `${p} should be closed to portal accounts`);
    }
  }
  // office staff lack finance role → 403; finance staff lack compliance role → 403
  const officePay = await api('/payroll?from=2025-01-01&to=2025-01-31', { cookie: cookies.office });
  assert.equal(officePay.status, 403);
  const { rows: doc } = await query(`SELECT id FROM compliance_documents WHERE candidate_id = $1 LIMIT 1`, [fx.candOk]);
  const finEdit = await api(`/compliance/documents/${doc[0].id}`, { method: 'PATCH', cookie: cookies.finance, body: { status: 'valid' } });
  assert.equal(finEdit.status, 403, 'finance cannot edit compliance documents');
});

// ── 13. Audit trail ─────────────────────────────────────────────────────────
test('13: sensitive changes produce audit records with before/after', async () => {
  const { rows } = await query(
    `SELECT action, detail FROM audit_log WHERE entity_type = 'shift' AND entity_id = $1`, [fx.shifts[0]]);
  const actions = rows.map((r2) => r2.action);
  assert.ok(actions.includes('shift.allocated'));
  assert.ok(actions.includes('timesheet.approved'));
  const ap = rows.find((r2) => r2.action === 'timesheet.approved');
  assert.equal(ap.detail.snapshot.pay_pence, 14500);
  const rc = await query(
    `SELECT 1 FROM audit_log WHERE action = 'register.checked' AND entity_id = $1`, [fx.candOk]);
  assert.ok(rc.rows.length);
});

// ── 14. Messaging success + failure paths ───────────────────────────────────
test('14: in-app messages reach the worker inbox; unconfigured email fails visibly', async () => {
  const inapp = await api('/messages', { method: 'POST', body: {
    channel: 'inapp', candidate_id: fx.candOk, subject: 'TEST hello', body: 'Test in-app message' } });
  assert.equal(inapp.status, 201, JSON.stringify(inapp.body));

  const inbox = await api('/portal/me/messages', { cookie: cookies.worker });
  const mine = inbox.body.find((m) => m.subject === 'TEST hello');
  assert.ok(mine, 'message visible in worker inbox');
  assert.equal(mine.read_at, null);
  await api(`/portal/me/messages/${mine.id}/read`, { method: 'POST', cookie: cookies.worker });
  const inbox2 = await api('/portal/me/messages', { cookie: cookies.worker });
  assert.ok(inbox2.body.find((m) => m.id === mine.id).read_at, 'read state persisted');

  const em = await api('/messages', { method: 'POST', body: {
    channel: 'email', to_contact: 'test-workerpaye@example.invalid', subject: 'TEST mail', body: 'hi' } });
  assert.equal(em.status, 201);
  const send = await api(`/messages/${em.body.id}/send`, { method: 'POST' });
  assert.notEqual(send.body.status, 'sent', 'no provider configured → not silently sent');
  assert.ok(send.body.last_error, 'failure reason recorded');
});

// ── 15. No automatic carer selection ────────────────────────────────────────
test('15: allocation is human-led — eligible list is advisory only', async () => {
  const { rows: req } = await query(
    `INSERT INTO shift_requests (client_id, date, shift_type, status) VALUES ($1,$2,'day','pending') RETURNING id`,
    [fx.clientA, MON]);
  fx.requests.push(req[0].id);
  const { rows: before_ } = await query(`SELECT COUNT(*) AS n FROM shifts`);
  const list = await api(`/requests/${req[0].id}/eligible`);
  assert.equal(list.status, 200);
  assert.equal(list.body.auto_ranking, false);
  assert.ok(Array.isArray(list.body.workers));
  const { rows: after_ } = await query(`SELECT COUNT(*) AS n FROM shifts`);
  assert.equal(before_[0].n, after_[0].n, 'viewing eligibility creates no shifts');
  // and no field scores or ranks a worker for the user
  assert.ok(!list.body.workers.some((w) => 'score' in w || 'rank' in w || 'recommended' in w));
});

// ── 15b. WhatsApp shift details to the worker ───────────────────────────────
test('15b: POST /shifts/:id/notify composes and logs a WhatsApp message', async () => {
  const s = await api('/shifts', { method: 'POST', body: {
    candidate_id: fx.candOk, client_id: fx.clientA, shift_date: nextDay(3),
    start_time: '07:30', end_time: '20:00', hours: 12, shift_type: 'day',
    pay_rate: '14.50', charge_rate: '20.00' } });
  assert.equal(s.status, 201, JSON.stringify(s.body));
  fx.shifts.push(s.body.id);

  // no phone on file → visible failure, nothing logged
  const noPhone = await api(`/shifts/${s.body.id}/notify`, { method: 'POST', body: { channel: 'whatsapp' } });
  assert.equal(noPhone.status, 422);

  await query(`UPDATE candidates SET phone = '07123456789' WHERE id = $1`, [fx.candOk]);
  const r = await api(`/shifts/${s.body.id}/notify`, { method: 'POST', body: { channel: 'whatsapp', note: 'Bring photo ID.' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.channel, 'whatsapp');
  assert.equal(r.body.entity_type, 'shift');
  assert.equal(r.body.entity_id, s.body.id);
  assert.match(r.body.wa_link, /^https:\/\/wa\.me\/447123456789\?text=/);
  const body = decodeURIComponent(r.body.wa_link.split('text=')[1]);
  assert.ok(body.includes('TEST Home A'), 'client name included');
  assert.ok(body.includes('Bring photo ID.'), 'staff note appended');
  assert.ok(body.includes('Reply with a number'), 'numbered reply options included');
  assert.ok(!body.includes('14.50') && !body.includes('20.00'), 'no rates leaked');
});

// ── 17. Supervisors see site requests and can allocate a compliant worker ────
test('17: supervisor sees the client request, allocates without rates, worker notified', async () => {
  const date = nextDay(5); // Friday — TEST WorkerPaye has no other shift this day
  const made = await api('/portal/client/requests', { method: 'POST', cookie: cookies.client, body: {
    date, shift_type: 'day', start_time: '07:30', end_time: '20:00', role: 'Healthcare Assistant', qty: 1 } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  fx.requests.push(made.body.id);

  // visible to the site supervisor
  const list = await api('/portal/client/requests', { cookie: cookies.supervisor });
  assert.equal(list.status, 200);
  assert.ok(list.body.some((rq) => rq.id === made.body.id), 'supervisor sees the new request');
  // workers cannot reach it; supervisors cannot create requests (client-only)
  assert.equal((await api('/portal/client/requests', { cookie: cookies.worker })).status, 401);
  const supCreate = await api('/portal/client/requests', { method: 'POST', cookie: cookies.supervisor, body: { date, shift_type: 'day' } });
  assert.ok([401, 403].includes(supCreate.status));

  // eligibility is advisory: compliant flags + gap reasons, no pay/charge fields
  const noDocs = await addCandidate('WorkerNoDocs', { docs: null });
  const elig = await api(`/portal/client/requests/${made.body.id}/eligible`, { cookie: cookies.supervisor });
  assert.equal(elig.status, 200, JSON.stringify(elig.body));
  const okRow = elig.body.workers.find((w) => w.id === fx.candOk);
  assert.equal(okRow.compliant, true);
  const badRow = elig.body.workers.find((w) => w.id === noDocs);
  assert.equal(badRow.compliant, false);
  assert.ok(badRow.compliance_gaps.length > 0, 'undocumented worker carries gap reasons');
  assert.ok(!elig.body.workers.some((w) => 'pay_rate' in w || 'charge_rate' in w), 'no rates exposed');

  // non-compliant worker refused with structured gaps
  const badAlloc = await api(`/portal/client/requests/${made.body.id}/allocate`, {
    method: 'POST', cookie: cookies.supervisor, body: { candidate_id: noDocs } });
  assert.equal(badAlloc.status, 422);
  assert.ok(badAlloc.body.gaps.some((g) => g.type === 'DBS Enhanced' && g.problem === 'missing'));

  // supervisor can ping the worker — offer lands in the worker's portal
  const ping = await api(`/portal/client/requests/${made.body.id}/contact-worker`, {
    method: 'POST', cookie: cookies.supervisor, body: { candidate_id: fx.candOk, channel: 'email' } });
  assert.equal(ping.status, 201, JSON.stringify(ping.body));
  assert.match(ping.body.message.mailto_link, /^mailto:/);
  const workerOffers = await api('/portal/offers', { cookie: cookies.worker });
  assert.ok(workerOffers.body.some((o) => o.request_id === made.body.id), 'offer visible in worker portal');
  const badChannel = await api(`/portal/client/requests/${made.body.id}/contact-worker`, {
    method: 'POST', cookie: cookies.supervisor, body: { candidate_id: fx.candOk, channel: 'pigeon' } });
  assert.equal(badChannel.status, 400);

  // a site contact exists → allocate returns WhatsApp + email send links
  await query(`INSERT INTO client_contacts (client_id, name, email, phone) VALUES ($1,'TEST Contact','test-contact@example.invalid','07111000111')`, [fx.clientA]);

  // compliant worker allocated: shift created, no rates, request fills, worker notified
  const alloc = await api(`/portal/client/requests/${made.body.id}/allocate`, {
    method: 'POST', cookie: cookies.supervisor, body: { candidate_id: fx.candOk } });
  assert.equal(alloc.status, 201, JSON.stringify(alloc.body));
  fx.shifts.push(alloc.body.id);
  assert.equal(alloc.body.pay_rate, null, 'supervisor booking carries no pay rate');
  assert.equal(alloc.body.charge_rate, null, 'supervisor booking carries no charge rate');
  const waN = alloc.body.notifications.find((n) => n.channel === 'whatsapp');
  const emN = alloc.body.notifications.find((n) => n.channel === 'email');
  assert.match(waN.wa_link, /^https:\/\/wa\.me\/447111000111/, 'client WhatsApp link returned');
  assert.match(emN.mailto_link, /^mailto:test-contact@example\.invalid/, 'client email link returned');
  const { rows: rq } = await query(`SELECT status FROM shift_requests WHERE id = $1`, [made.body.id]);
  assert.equal(rq[0].status, 'filled');
  const { rows: inbox } = await query(
    `SELECT id FROM messages WHERE entity_type = 'shift' AND entity_id = $1 AND channel = 'inapp'`, [alloc.body.id]);
  assert.equal(inbox.length, 1, 'worker got an in-app notification');
  await query(`DELETE FROM client_contacts WHERE client_id = $1 AND name = 'TEST Contact'`, [fx.clientA]);

  // second allocation refused (filled); request for another site invisible
  const again = await api(`/portal/client/requests/${made.body.id}/allocate`, {
    method: 'POST', cookie: cookies.supervisor, body: { candidate_id: fx.candOk } });
  assert.equal(again.status, 409);
  const { rows: other } = await query(
    `INSERT INTO shift_requests (client_id, date, shift_type, status) VALUES ($1,$2,'night','pending') RETURNING id`,
    [fx.clientB, date]);
  fx.requests.push(other[0].id);
  const scoped = await api(`/portal/client/requests/${other[0].id}/eligible`, { cookie: cookies.supervisor });
  assert.equal(scoped.status, 404, 'request at another site is not reachable');
});

// ── 18. Invoicing lifecycle: generate → send → reconcile → cancel ──────────
test('18: invoices build from approved timesheets, reconcile, and release on cancel', async () => {
  // ltdShift is approved + uninvoiced; fx.shifts[0] was exported to payroll (paid) — not invoiceable
  const inv = await api('/invoices', { method: 'POST', body: { client_id: fx.clientA, from: LO, to: HI, due_days: 14 } });
  assert.equal(inv.status, 201, JSON.stringify(inv.body));
  assert.equal(inv.body.lines.length, 1);
  assert.equal(inv.body.lines[0].shift_id, ltdShift);
  const { rows: linked } = await query(`SELECT invoice_id FROM shifts WHERE id = $1`, [ltdShift]);
  assert.equal(linked[0].invoice_id, inv.body.id, 'shift linked to invoice');

  // a paid (already-payrolled) shift is not pulled onto the invoice
  assert.ok(!inv.body.lines.some((l) => l.shift_id === fx.shifts[0]));

  // illegal transition refused: draft cannot jump straight to paid
  const bad = await api(`/invoices/${inv.body.id}`, { method: 'PATCH', body: { status: 'paid' } });
  assert.equal(bad.status, 409);

  // send → appears in aged debtors; paid → leaves it
  const sent = await api(`/invoices/${inv.body.id}`, { method: 'PATCH', body: { status: 'sent' } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const debtors = await api('/invoices/aged-debtors', { cookie: cookies.finance });
  assert.ok(debtors.body.some((d) => d.invoice_id === inv.body.id), 'sent invoice is a debtor');
  const paid = await api(`/invoices/${inv.body.id}`, { method: 'PATCH', body: { status: 'paid', paid_date: MON } });
  assert.equal(paid.status, 200);
  const debtors2 = await api('/invoices/aged-debtors', { cookie: cookies.finance });
  assert.ok(!debtors2.body.some((d) => d.invoice_id === inv.body.id), 'paid invoice is not a debtor');
  assert.equal((await api(`/invoices/${inv.body.id}`, { method: 'PATCH', body: { status: 'sent' } })).status,
    409, 'paid is terminal');

  // direct status write to 'approved' is refused — must go through the gate
  const s2 = await api('/shifts', { method: 'POST', body: {
    candidate_id: fx.candOk, client_id: fx.clientA, shift_date: TUE,
    start_time: '08:00', end_time: '20:00', hours: 8, shift_type: 'day',
    pay_rate: '14.50', charge_rate: '20.00' } });
  assert.equal(s2.status, 201, JSON.stringify(s2.body));
  fx.shifts.push(s2.body.id);
  const direct = await api(`/shifts/${s2.body.id}`, { method: 'PATCH', body: { timesheet_status: 'approved' } });
  assert.equal(direct.status, 400, 'PATCH cannot approve a timesheet');

  // office role cannot mark paid; finance can (after real approval)
  const officePaid = await api(`/shifts/${s2.body.id}`, { method: 'PATCH', cookie: cookies.office,
    body: { timesheet_status: 'paid' } });
  assert.equal(officePaid.status, 403);
  await api(`/shifts/${s2.body.id}`, { method: 'PATCH', body: { status: 'completed' } });
  const ap = await api(`/shifts/${s2.body.id}/approve`, { method: 'POST', body: { force: true } });
  assert.equal(ap.status, 200, JSON.stringify(ap.body));
  // re-approval of a frozen timesheet is refused
  assert.equal((await api(`/shifts/${s2.body.id}/approve`, { method: 'POST', body: { force: true } })).status, 409);

  // cancel releases the shift so it can be re-invoiced
  const inv2 = await api('/invoices', { method: 'POST', body: { client_id: fx.clientA, from: TUE, to: TUE } });
  assert.equal(inv2.status, 201, JSON.stringify(inv2.body));
  assert.ok(inv2.body.lines.some((l) => l.shift_id === s2.body.id));
  const cancel = await api(`/invoices/${inv2.body.id}`, { method: 'PATCH', body: { status: 'cancelled' } });
  assert.equal(cancel.status, 200);
  const { rows: released } = await query(`SELECT invoice_id FROM shifts WHERE id = $1`, [s2.body.id]);
  assert.equal(released[0].invoice_id, null, 'cancelled invoice releases its shifts');

  // deleting a draft also releases; deleting a sent invoice is refused
  const inv3 = await api('/invoices', { method: 'POST', body: { client_id: fx.clientA, from: TUE, to: TUE } });
  assert.equal(inv3.status, 201);
  const del = await api(`/invoices/${inv3.body.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
  const gone = await api(`/invoices/${inv3.body.id}`);
  assert.equal(gone.status, 404);
});

// ── 16. Existing features still respond ─────────────────────────────────────
test('16: smoke — core staff endpoints still work', async () => {
  for (const p of ['/candidates', '/clients', '/compliance/overview', '/dashboard', '/messages', '/payroll/runs']) {
    const r = await api(p, { cookie: cookies.admin });
    assert.ok([200].includes(r.status), `${p} → ${r.status}`);
  }
  // Dashboard analytics breakdowns used by the chart tiles
  const d = (await api('/dashboard', { cookie: cookies.admin })).body;
  for (const k of ['candidatesByRole', 'candidatesBySource', 'candidatesByStatus', 'recentCandidates']) assert.ok(Array.isArray(d[k]), k);
  for (const k of ['pending', 'filled', 'cancelled', 'urgent', 'this_month', 'filled_this_month']) assert.ok(k in d.requestStats, `requestStats.${k}`);
  for (const k of ['completed', 'booked', 'cancelled', 'no_show']) assert.ok(k in d.shiftOutcomes, `shiftOutcomes.${k}`);
});
