import { query } from '../db.js';

export const DEFAULTS = {
  // 1.4 acknowledgement wording
  registration_ack_subject: 'Thank you for registering with Sanitas Medical Recruitment',
  registration_ack_body:
    'Hi {name},\n\nThank you for completing your registration. Our team will review your details and documents and be in touch shortly.\n\nSanitas Medical Recruitment\n0800 999 8222',
  // 3.8 — algorithmic matching/ranking off by default; eligible lists only
  auto_ranking: false,
  // 6.7 uplift configuration (multipliers applied at booking/invoice time)
  night_uplift: 1.15,
  weekend_uplift: 1.25,
  bank_holiday_uplift: 1.5,
  // 6.7 precedence when several uplifts apply. 'highest' = only the largest
  // multiplier is used (bank holiday > weekend > night). 'stack' would multiply
  // them together. DECISION PENDING with project owner — see HANDOVER.md.
  uplift_precedence: 'highest',
  // 6.12 margin model — PROVISIONAL assumptions, documented in HANDOVER.md
  employers_ni_pct: 15,              // employer NI on PAYE pay above threshold
  employers_ni_threshold_weekly: 96, // £/week secondary threshold (not yet applied per-shift — see HANDOVER)
  bureau_fee_paye_per_shift: 3.5,    // £ per shift, PAYE bureau
  bureau_fee_ltd_per_shift: 2.0,     // £ per shift, Ltd-company bureau
  payroll_fee_per_worker_week: 3.5,  // legacy key kept for compatibility
  // 2.2 reminder windows (days before expiry) + monthly digest toggle
  reminder_days: [60, 30, 14, 7],
  monthly_digest: true,
  // 8.5 retention: months after which never-placed candidates are auto-deleted
  retention_never_worked_months: 24,
  // 1.2 custom registration fields
  registration_fields: [
    { key: 'uniform_size', label: 'Uniform size', type: 'text' },
    { key: 'driving', label: 'Do you drive / car share?', type: 'select', options: ['drives', 'car_share', 'neither'] },
  ],
};

const cache = new Map();

export async function getSetting(key) {
  if (cache.has(key)) return cache.get(key);
  const { rows } = await query(`SELECT value FROM settings WHERE key = $1`, [key]);
  const val = rows.length ? rows[0].value : (key in DEFAULTS ? DEFAULTS[key] : null);
  cache.set(key, val);
  return val;
}

export async function setSetting(key, value) {
  await query(
    `INSERT INTO settings (key, value) VALUES ($1,$2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]);
  cache.set(key, value);
}

export async function allSettings() {
  const { rows } = await query(`SELECT key, value FROM settings`);
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
