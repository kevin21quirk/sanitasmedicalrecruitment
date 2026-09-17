import { pool, query } from './db.js';

// ---------- deterministic RNG ----------
let seed = 42;
const rand = () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p) => rand() < p;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysAhead = (n) => daysAgo(-n);
const iso = (d) => d.toISOString();
const dateOnly = (d) => d.toISOString().slice(0, 10);

// ---------- reference data ----------
const TOWNS = [
  ['Ilford', 'IG1'], ['Romford', 'RM1'], ['Barking', 'IG11'], ['Dagenham', 'RM10'],
  ['Chelmsford', 'CM1'], ['Basildon', 'SS14'], ['Brentwood', 'CM14'], ['Woodford Green', 'IG8'],
  ['Chigwell', 'IG7'], ['Colchester', 'CO1'], ['Stratford', 'E15'], ['Leytonstone', 'E11'],
  ['Walthamstow', 'E17'], ['Harlow', 'CM20'], ['Grays', 'RM17'], ['Southend-on-Sea', 'SS1'],
  ['Loughton', 'IG10'], ['Billericay', 'CM12'], ['Hornchurch', 'RM12'], ['Upminster', 'RM14'],
];

const FIRST_NAMES = ['Amara','Blessing','Chinwe','Adaeze','Funke','Ngozi','Temitope','Oluwaseun','Grace','Mary','Sarah','Emma','Olivia','Sophie','Chloe','Lucy','Hannah','Rebecca','Rachel','Katie','James','Daniel','Michael','David','Samuel','Emmanuel','Chukwuemeka','Ikenna','Tunde','Adebayo','Kwame','Kofi','Andrei','Marius','Elena','Ana','Maria','Priya','Deepa','Raj','Aisha','Fatima','Zainab','Nadia','Esther','Joy','Patience','Mercy','Faith'];
const LAST_NAMES = ['Okafor','Adeyemi','Nwosu','Eze','Osei','Mensah','Boateng','Smith','Jones','Taylor','Brown','Wilson','Davies','Evans','Thomas','Roberts','Walker','Wright','Thompson','White','Hughes','Edwards','Green','Hall','Popescu','Ionescu','Stan','Dumitru','Kaur','Singh','Patel','Sharma','Ali','Hussain','Khan','Begum','Ahmed','Ibrahim','Musa','Balogun','Adeleke','Okonkwo','Nwachukwu','Chukwu','Adamu','Bello','Diallo','Sow','Koné','Dube','Ndlovu','Moyo'];

const ROLES = ['Registered Nurse', 'Senior Nurse', 'Healthcare Assistant', 'Senior HCA'];
const CANDIDATE_SOURCES = ['Website', 'Referral', 'Indeed', 'Reed', 'Facebook', 'Word of Mouth'];
const SHIFT_PREFS = ['days', 'nights', 'flexible'];

const CLIENT_NAMES = [
  ['Maple Lodge Care Home', 'Maple Care Group', 'Nursing Home', 62, 'Good'],
  ['Oakfield House', 'Oakfield Care Ltd', 'Residential Home', 44, 'Good'],
  ['The Willows Nursing Home', 'Sanctuary Care', 'Nursing Home', 78, 'Requires Improvement'],
  ['Birchwood Manor', 'Birchwood Healthcare', 'Dementia Care', 56, 'Good'],
  ['Chestnut Grange', 'Independent', 'Residential Home', 38, 'Good'],
  ['Rosewood Court', 'Rosewood Group', 'Nursing Home', 84, 'Outstanding'],
  ['Hazelmere House', 'Hazelmere Care', 'Dementia Care', 48, 'Good'],
  ['Elm Grove Care Centre', 'Elm Grove Ltd', 'Nursing Home', 70, 'Requires Improvement'],
  ['Sycamore Lodge', 'Independent', 'Residential Home', 32, 'Good'],
  ['The Poplars', 'Poplars Healthcare', 'Supported Living', 24, 'Good'],
  ['Cedar View Nursing Home', 'Cedar Group', 'Nursing Home', 66, 'Good'],
  ['Ashdown House', 'Ashdown Care', 'Dementia Care', 52, 'Outstanding'],
  ['Laurel Bank', 'Independent', 'Residential Home', 40, 'Good'],
  ['Fernleigh Court', 'Fernleigh Group', 'Nursing Home', 74, 'Requires Improvement'],
  ['Hollyoak House', 'Hollyoak Care', 'Residential Home', 36, 'Inadequate'],
  ['Magnolia Court', 'Magnolia Healthcare', 'Nursing Home', 58, 'Good'],
  ['Primrose Lodge', 'Independent', 'Supported Living', 20, 'Outstanding'],
  ['Rowan House', 'Rowan Care Group', 'Dementia Care', 46, 'Good'],
];

const VACANCY_TEMPLATES = [
  { title: 'Registered Nurse — Days', role: 'Registered Nurse', shift: 'days', pay: [24, 30], charge: [32, 40] },
  { title: 'Registered Nurse — Nights', role: 'Registered Nurse', shift: 'nights', pay: [26, 33], charge: [34, 43] },
  { title: 'Senior Nurse / Unit Lead', role: 'Senior Nurse', shift: 'days', pay: [28, 34], charge: [37, 45] },
  { title: 'Healthcare Assistant — Days', role: 'Healthcare Assistant', shift: 'days', pay: [13, 16], charge: [18, 22] },
  { title: 'Healthcare Assistant — Nights', role: 'Healthcare Assistant', shift: 'nights', pay: [14, 17], charge: [19, 23] },
  { title: 'Senior HCA — Dementia Unit', role: 'Senior HCA', shift: 'mixed', pay: [15, 18], charge: [20, 25] },
  { title: 'Weekend Nurse — Ongoing', role: 'Registered Nurse', shift: 'weekends', pay: [27, 33], charge: [36, 44] },
  { title: 'HCA — Flexible Shifts', role: 'Healthcare Assistant', shift: 'mixed', pay: [13, 16], charge: [18, 21] },
];

const DOC_TYPES_NURSE = ['DBS Enhanced', 'NMC PIN', 'Right to Work', 'Passport/ID', 'Mandatory Training', 'Practical Training', 'References', 'CV', 'Immunisation History', 'Proof of Address'];
const DOC_TYPES_HCA = ['DBS Enhanced', 'Right to Work', 'Passport/ID', 'Mandatory Training', 'Practical Training', 'References', 'CV', 'Proof of Address'];

const ACTIVITY_SUBJECTS = {
  call: ['Availability check-in', 'Discussed new vacancy', 'Compliance chase call', 'Post-shift feedback', 'Rates negotiation', 'Registration call', 'Booked onto shifts', 'Welfare check'],
  email: ['Sent registration pack', 'Compliance document request', 'Vacancy details sent', 'Shift confirmation sent', 'Timesheet reminder', 'Contract sent', 'Rate card sent'],
  meeting: ['Client site visit', 'Candidate registration interview', 'Quarterly review meeting', 'CQC discussion', 'Service review'],
  note: ['Updated availability', 'Notes from phone call', 'Profile reviewed', 'Document received', 'Reference feedback'],
  sms: ['Shift offer SMS', 'Timesheet reminder SMS', 'Interview reminder'],
  status_change: ['Moved to screening', 'Compliance check started', 'Offer made', 'Marked compliant', 'Moved to shortlist'],
};

const TASK_TITLES = [
  'Chase DBS renewal', 'Verify NMC PIN', 'Request references', 'Send rate card to client',
  'Follow up on timesheet', 'Book registration interview', 'Confirm weekend shifts',
  'Update candidate availability', 'Chase outstanding invoice', 'Arrange client site visit',
  'Review expiring documents', 'Send interview feedback', 'Upload training certificates',
  'Call client re: new vacancy', 'Approve submitted timesheets',
];

const randPhone = () => `07${randInt(100, 999)} ${randInt(100, 999)} ${randInt(100, 999)}`;

// ---------- seed ----------
async function main() {
  console.log('Clearing existing data...');
  await query(`TRUNCATE tasks, activities, shifts, placements, vacancies, client_contacts, clients, compliance_documents, candidates, users RESTART IDENTITY CASCADE`);

  // Users
  const users = [
    ['Jill Wilkinson', 'jill@sanitasmedicalrecruitment.co.uk', 'Director', 'JW', '#0c56a4'],
    ['James Oduya', 'james@sanitasmedicalrecruitment.co.uk', 'Senior Recruiter', 'JO', '#1863dc'],
    ['Priya Kaur', 'priya@sanitasmedicalrecruitment.co.uk', 'Recruiter', 'PK', '#01aef0'],
    ['Tom Reeves', 'tom@sanitasmedicalrecruitment.co.uk', 'Recruiter', 'TR', '#7bdcb5'],
    ['Amelia Foster', 'amelia@sanitasmedicalrecruitment.co.uk', 'Compliance Officer', 'AF', '#fcb900'],
  ];
  const userIds = [];
  for (const [name, email, role, initials, color] of users) {
    const r = await query(
      `INSERT INTO users (name, email, role, initials, color) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, email, role, initials, color]
    );
    userIds.push(r.rows[0].id);
  }
  console.log(`  ${userIds.length} users`);

  // Candidates
  const candidateIds = [];
  const candidateRoles = [];
  const usedNames = new Set();
  const N_CANDIDATES = 46;
  for (let i = 0; i < N_CANDIDATES; i++) {
    let fn, ln, key;
    do {
      fn = pick(FIRST_NAMES); ln = pick(LAST_NAMES); key = fn + ln;
    } while (usedNames.has(key));
    usedNames.add(key);

    const role = pick(ROLES);
    const isNurse = role.includes('Nurse');
    const [town, pc] = pick(TOWNS);
    const status = pick(['compliant', 'compliant', 'compliant', 'on_assignment', 'on_assignment', 'in_progress', 'in_progress', 'dormant']);
    const payBase = isNurse ? [23, 34] : [12.5, 18];
    const regDaysAgo = randInt(10, 540);
    const lastWorked = status === 'on_assignment' ? randInt(0, 7) : status === 'compliant' ? randInt(3, 60) : null;

    const r = await query(
      `INSERT INTO candidates (first_name, last_name, email, phone, role, nmc_pin, address, town, postcode,
        status, pay_min, pay_max, preferred_shift, employment_pref, travel_miles, has_transport,
        source, rating, tags, owner_id, registered_at, last_worked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
      [
        fn, ln,
        `${fn.toLowerCase()}.${ln.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@${pick(['gmail.com', 'outlook.com', 'yahoo.co.uk', 'hotmail.com'])}`,
        randPhone(), role,
        isNurse ? `${randInt(10, 99)}${String.fromCharCode(65 + randInt(0, 25))}${randInt(1000, 9999)}${pick(['E', 'W', 'S'])}` : null,
        `${randInt(1, 200)} ${pick(['High Street', 'Station Road', 'Church Lane', 'Victoria Road', 'London Road', 'Green Lane', 'Park Avenue', 'Queens Road'])}`,
        town, `${pc} ${randInt(1, 9)}${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}`,
        status,
        +(payBase[0] + rand() * 4).toFixed(2), +(payBase[1] + rand() * 4).toFixed(2),
        pick(SHIFT_PREFS), pick(['temporary', 'temporary', 'permanent', 'both']),
        randInt(5, 30), chance(0.55), pick(CANDIDATE_SOURCES),
        +(3.2 + rand() * 1.8).toFixed(1),
        pick([[], [], ['dementia_experience'], ['peg_feeding'], ['tracheostomy'], ['dementia_experience', 'palliative'], ['wound_care'], ['palliative']]),
        pick(userIds.slice(1, 4)), iso(daysAgo(regDaysAgo)),
        lastWorked !== null ? iso(daysAgo(lastWorked)) : null,
      ]
    );
    candidateIds.push(r.rows[0].id);
    candidateRoles.push(role);
  }
  console.log(`  ${candidateIds.length} candidates`);

  // Compliance documents
  let docCount = 0;
  for (let i = 0; i < candidateIds.length; i++) {
    const cid = candidateIds[i];
    const isNurse = candidateRoles[i].includes('Nurse');
    const types = isNurse ? DOC_TYPES_NURSE : DOC_TYPES_HCA;
    let validCount = 0, totalCount = 0;
    for (const type of types) {
      totalCount++;
      const roll = rand();
      // 72% valid, 10% expiring, 7% expired, 6% pending, 5% missing
      let status, issue = null, expiry = null, ref = null;
      if (roll < 0.72) {
        status = 'valid';
        issue = daysAgo(randInt(70, 400));
        expiry = type === 'Right to Work' || type === 'Passport/ID' ? null : daysAhead(randInt(61, 700));
        ref = `${type.slice(0, 3).toUpperCase()}-${randInt(100000, 999999)}`;
        validCount++;
      } else if (roll < 0.82) {
        status = 'expiring';
        issue = daysAgo(randInt(300, 700));
        expiry = daysAhead(randInt(2, 58));
        ref = `${type.slice(0, 3).toUpperCase()}-${randInt(100000, 999999)}`;
      } else if (roll < 0.89) {
        status = 'expired';
        issue = daysAgo(randInt(400, 900));
        expiry = daysAgo(randInt(3, 120));
        ref = `${type.slice(0, 3).toUpperCase()}-${randInt(100000, 999999)}`;
      } else if (roll < 0.95) {
        status = 'pending';
        issue = daysAgo(randInt(1, 14));
      } else {
        status = 'missing';
      }
      await query(
        `INSERT INTO compliance_documents (candidate_id, type, reference_no, status, issue_date, expiry_date, verified_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [cid, type, ref, status, dateOnly(issue ?? new Date()), expiry ? dateOnly(expiry) : null,
         status === 'valid' ? pick(userIds) : null]
      );
      docCount++;
    }
    await query(`UPDATE candidates SET compliance_score = $1 WHERE id = $2`,
      [Math.round((validCount / totalCount) * 100), cid]);
  }
  console.log(`  ${docCount} compliance documents`);

  // Clients + contacts
  const clientIds = [];
  for (const [name, group, type, beds, cqc] of CLIENT_NAMES) {
    const [town, pc] = pick(TOWNS);
    const r = await query(
      `INSERT INTO clients (name, group_name, type, address, town, postcode, phone, email, website, beds, cqc_rating, status, payment_terms, account_manager_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [name, group, type, `${randInt(1, 150)} ${pick(['Main Road', 'Park Road', 'Manor Way', 'The Avenue', 'Hall Lane', 'Rectory Road'])}`,
       town, `${pc} ${randInt(1, 9)}${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}`,
       `0${randInt(1200, 1299)} ${randInt(100000, 999999)}`,
       `info@${name.toLowerCase().replace(/[^a-z]+/g, '')}.co.uk`,
       `www.${name.toLowerCase().replace(/[^a-z]+/g, '')}.co.uk`,
       beds, cqc, pick(['active', 'active', 'active', 'active', 'prospect', 'inactive']),
       pick([14, 30, 30, 30]), pick(userIds)]
    );
    const cid = r.rows[0].id;
    clientIds.push(cid);
    const nContacts = randInt(1, 3);
    for (let j = 0; j < nContacts; j++) {
      const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
      await query(
        `INSERT INTO client_contacts (client_id, name, role, email, phone, is_primary) VALUES ($1,$2,$3,$4,$5,$6)`,
        [cid, `${fn} ${ln}`, j === 0 ? pick(['Home Manager', 'Registered Manager']) : pick(['Deputy Manager', 'Roster Coordinator', 'Admin']),
         `${fn.toLowerCase()}.${ln.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@${name.toLowerCase().replace(/[^a-z]+/g, '')}.co.uk`,
         randPhone(), j === 0]
      );
    }
  }
  console.log(`  ${clientIds.length} clients`);

  // Vacancies
  const vacancyIds = [];
  const vacancyClients = [];
  for (let i = 0; i < 30; i++) {
    const clientId = pick(clientIds);
    const t = pick(VACANCY_TEMPLATES);
    const stage = pick(['open', 'open', 'sourcing', 'sourcing', 'shortlisted', 'interview', 'offer', 'filled', 'filled', 'on_hold', 'lost']);
    const postedDaysAgo = randInt(2, 90);
    const filled = stage === 'filled';
    const r = await query(
      `INSERT INTO vacancies (client_id, title, role, employment_type, shift_pattern, hours_per_week, pay_rate, charge_rate,
        stage, priority, openings, start_date, posted_at, closes_at, filled_at, description, requirements, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [clientId, t.title, t.role, pick(['temporary', 'temporary', 'temporary', 'permanent', 'temp_to_perm']),
       t.shift, pick([24, 36, 40, 44, 48]),
       +(t.pay[0] + rand() * (t.pay[1] - t.pay[0])).toFixed(2),
       +(t.charge[0] + rand() * (t.charge[1] - t.charge[0])).toFixed(2),
       stage, pick(['low', 'medium', 'medium', 'high', 'urgent']),
       pick([1, 1, 1, 2, 2, 3]),
       dateOnly(daysAhead(randInt(3, 42))), iso(daysAgo(postedDaysAgo)),
       dateOnly(daysAhead(randInt(7, 60))), filled ? iso(daysAgo(randInt(1, 20))) : null,
       `${t.title} required for ongoing ${t.shift} cover. Previous care home experience preferred.`,
       pick([['6+ months UK experience'], ['DBS on update service', 'Own transport'], ['Dementia experience'], ['NMC registered', 'Medication trained'], []]),
       pick(userIds.slice(1, 4))]
    );
    vacancyIds.push(r.rows[0].id);
    vacancyClients.push(clientId);
  }
  console.log(`  ${vacancyIds.length} vacancies`);

  // Placements
  const placementIds = [];
  const activePlacements = [];
  for (let i = 0; i < 55; i++) {
    const vi = randInt(0, vacancyIds.length - 1);
    const vacancyId = vacancyIds[vi];
    const clientId = vacancyClients[vi];
    const ci = randInt(0, candidateIds.length - 1);
    const candidateId = candidateIds[ci];
    const stage = pick(['submitted', 'screening', 'compliance_check', 'interview', 'offer', 'placed', 'active', 'active', 'active', 'ended', 'rejected']);
    const pay = +(14 + rand() * 16).toFixed(2);
    const charge = +(pay * (1.25 + rand() * 0.2)).toFixed(2);
    const submittedDaysAgo = randInt(2, 120);
    const isPlaced = ['placed', 'active', 'ended'].includes(stage);
    const r = await query(
      `INSERT INTO placements (vacancy_id, candidate_id, client_id, stage, pay_rate, charge_rate, submitted_at, placed_at, start_date, end_date, end_reason, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [vacancyId, candidateId, clientId, stage, pay, charge, iso(daysAgo(submittedDaysAgo)),
       isPlaced ? iso(daysAgo(Math.max(1, submittedDaysAgo - randInt(3, 14)))) : null,
       isPlaced ? dateOnly(daysAgo(randInt(5, 100))) : null,
       stage === 'ended' ? dateOnly(daysAgo(randInt(1, 30))) : null,
       stage === 'ended' ? pick(['Contract ended', 'Candidate left', 'Client cancellation', 'Moved to permanent']) : null,
       pick(userIds.slice(1, 4))]
    );
    placementIds.push(r.rows[0].id);
    if (stage === 'active' || stage === 'placed') {
      activePlacements.push({ id: r.rows[0].id, candidateId, clientId, pay, charge });
    }
  }
  console.log(`  ${placementIds.length} placements`);

  // Shifts — past 6 weeks + next 4 weeks for active placements
  let shiftCount = 0;
  const SHIFT_TIMES = {
    day: ['07:30', '20:00', 12], night: ['20:00', '07:30', 12],
    early: ['07:00', '14:30', 7.5], late: ['14:00', '21:30', 7.5], long_day: ['07:30', '21:30', 13.5],
  };
  for (const p of activePlacements) {
    const nShifts = randInt(4, 18);
    for (let j = 0; j < nShifts; j++) {
      const offset = randInt(-42, 28); // past 6 weeks → next 4 weeks
      const d = daysAgo(-offset);
      const type = pick(['day', 'day', 'day', 'night', 'night', 'early', 'late', 'long_day']);
      const [start, end, hours] = SHIFT_TIMES[type];
      const past = offset < 0;
      const status = past ? (chance(0.93) ? 'completed' : pick(['cancelled', 'no_show'])) : (chance(0.9) ? 'booked' : 'cancelled');
      const ts = status === 'completed' ? pick(['paid', 'paid', 'approved', 'submitted', 'not_submitted']) : 'not_submitted';
      await query(
        `INSERT INTO shifts (placement_id, candidate_id, client_id, shift_date, start_time, end_time, hours, shift_type, pay_rate, charge_rate, status, timesheet_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [p.id, p.candidateId, p.clientId, dateOnly(d), start, end, hours, type, p.pay, p.charge, status, ts]
      );
      shiftCount++;
    }
  }
  console.log(`  ${shiftCount} shifts`);

  // Activities
  const entities = [
    ...candidateIds.map((id) => ['candidate', id]),
    ...clientIds.map((id) => ['client', id]),
    ...vacancyIds.map((id) => ['vacancy', id]),
    ...placementIds.map((id) => ['placement', id]),
  ];
  let actCount = 0;
  for (let i = 0; i < 340; i++) {
    const [et, eid] = pick(entities);
    const type = pick(['call', 'call', 'call', 'email', 'email', 'meeting', 'note', 'note', 'sms', 'status_change']);
    const subject = pick(ACTIVITY_SUBJECTS[type]);
    await query(
      `INSERT INTO activities (entity_type, entity_id, type, subject, body, direction, user_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [et, eid, type, subject,
       `${subject} — logged by recruiter. ${pick(['Follow-up scheduled.', 'No answer, will retry.', 'Positive conversation.', 'Actioned.', 'Awaiting response.'])}`,
       ['call', 'email', 'sms'].includes(type) ? pick(['outbound', 'outbound', 'inbound']) : null,
       pick(userIds), iso(daysAgo(randInt(0, 45)))]
    );
    actCount++;
  }
  console.log(`  ${actCount} activities`);

  // Tasks
  let taskCount = 0;
  for (let i = 0; i < 42; i++) {
    const [et, eid] = pick(entities);
    const due = randInt(-20, 21);
    const status = due < -2 ? pick(['done', 'done', 'open']) : pick(['open', 'open', 'in_progress', 'done']);
    await query(
      `INSERT INTO tasks (user_id, title, description, due_date, priority, status, entity_type, entity_id, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [pick(userIds), pick(TASK_TITLES), null, iso(daysAgo(-due)),
       pick(['low', 'medium', 'medium', 'high']), status, et, eid,
       status === 'done' ? iso(daysAgo(randInt(0, 20))) : null]
    );
    taskCount++;
  }
  console.log(`  ${taskCount} tasks`);
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exitCode = 1; })
  .finally(() => pool.end());
