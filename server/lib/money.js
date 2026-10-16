// Decimal-safe money helpers. All arithmetic is done on integer pence; rates
// and hours are parsed from Postgres NUMERIC strings without going through
// binary floating point multiplication.
import { query } from '../db.js';
import { getSetting } from './settings.js';
import { isoDate } from './dates.js';

// "12.50" -> 1250 pence. Accepts number|string|null.
export function toPence(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^(-?)(\d+)(?:\.(\d{0,}))?$/);
  if (!m) throw new Error(`Invalid money value: ${v}`);
  const [, sign, whole, frac = ''] = m;
  const pence = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
  // round half-up on the third decimal if present
  const extra = frac.length > 2 ? +frac[2] : 0;
  const n = pence + (extra >= 5 ? 1n : 0n);
  return Number(sign === '-' ? -n : n);
}

export const fromPence = (p) => (p == null ? null : (p / 100).toFixed(2));

// hours "13.5" -> hundredths (1350) so hours × pence stays integral.
export function toHundredths(v) {
  if (v == null || v === '') return null;
  const m = String(v).trim().match(/^(\d+)(?:\.(\d{0,}))?$/);
  if (!m) throw new Error(`Invalid hours value: ${v}`);
  return Number(BigInt(m[1]) * 100n + BigInt(((m[2] ?? '') + '00').slice(0, 2)));
}

// multiplier "1.25" -> thousandths (1250).
export function toThousandths(v) {
  const m = String(v ?? 1).trim().match(/^(\d+)(?:\.(\d{0,}))?$/);
  if (!m) throw new Error(`Invalid multiplier: ${v}`);
  return Number(BigInt(m[1]) * 1000n + BigInt(((m[2] ?? '') + '000').slice(0, 3)));
}

// pence × hours(hundredths) × multiplier(thousandths), rounded half-up to pence.
export function lineAmountPence(ratePence, hoursHundredths, multThousandths = 1000) {
  const num = BigInt(ratePence) * BigInt(hoursHundredths) * BigInt(multThousandths);
  const den = 100n * 1000n;
  const q = num / den, r = num % den;
  return Number(r * 2n >= den ? q + 1n : q);
}

export function pctOfPence(pence, pct) {
  // pct like 15 or "13.8" → thousandths of a percent to keep integers
  const m = String(pct).match(/^(\d+)(?:\.(\d{0,}))?$/);
  if (!m) throw new Error(`Invalid percentage: ${pct}`);
  const pctThousandths = BigInt(m[1]) * 1000n + BigInt(((m[2] ?? '') + '000').slice(0, 3));
  const num = BigInt(pence) * pctThousandths;
  const den = 100n * 1000n;
  const q = num / den, r = num % den;
  return Number(r * 2n >= den ? q + 1n : q);
}

// ── 6.7 uplift resolution ───────────────────────────────────────────────────
// Returns { rule, multiplier } for a shift. Precedence is configurable:
//   'highest' (default): bank holiday > weekend > night, only one applies.
//   'stack': all applicable multipliers are multiplied together.
export async function resolveUplift(shift) {
  const [night, weekend, bankHol, precedence] = await Promise.all([
    getSetting('night_uplift'), getSetting('weekend_uplift'),
    getSetting('bank_holiday_uplift'), getSetting('uplift_precedence'),
  ]);
  const dateStr = isoDate(shift.shift_date);
  const { rows } = await query(`SELECT 1 FROM bank_holidays WHERE date = $1`, [dateStr]);
  const isBH = rows.length > 0;
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const isWeekend = dow === 0 || dow === 6;
  const isNight = ['night', 'sleep_in'].includes(shift.shift_type);

  const applicable = [];
  if (isBH) applicable.push(['bank_holiday', bankHol]);
  if (isWeekend) applicable.push(['weekend', weekend]);
  if (isNight) applicable.push(['night', night]);
  if (!applicable.length) return { rule: 'none', multiplier: '1.000', multThousandths: 1000, applicable: [] };

  if (precedence === 'stack') {
    let mult = 1000n;
    for (const [, m] of applicable) mult = (mult * BigInt(toThousandths(m))) / 1000n;
    return { rule: applicable.map((a) => a[0]).join('+'), multiplier: (Number(mult) / 1000).toFixed(3),
      multThousandths: Number(mult), applicable };
  }
  // highest wins — order above already encodes BH > weekend > night when equal
  const best = applicable.reduce((a, b) => (toThousandths(b[1]) > toThousandths(a[1]) ? b : a));
  return { rule: best[0], multiplier: Number(best[1]).toFixed(3), multThousandths: toThousandths(best[1]), applicable };
}

// ── Financial snapshot (6.5 / D) ────────────────────────────────────────────
// Computes and freezes pay/charge/NI/fee for a shift using the inputs in force
// *now*. Called at timesheet approval; afterwards reports read the snapshot.
export async function computeFinancials(shift, candidate) {
  const problems = [];
  if (shift.pay_rate == null) problems.push('pay_rate missing');
  if (shift.charge_rate == null) problems.push('charge_rate missing');
  const hours = shift.actual_hours ?? shift.hours;
  if (hours == null) problems.push('hours missing');
  const engagement = candidate?.engagement_type || 'paye';
  if (!['paye', 'ltd'].includes(engagement)) problems.push(`unknown engagement_type ${engagement}`);

  const uplift = await resolveUplift(shift);
  const [niPct, feePaye, feeLtd] = await Promise.all([
    getSetting('employers_ni_pct'), getSetting('bureau_fee_paye_per_shift'), getSetting('bureau_fee_ltd_per_shift'),
  ]);

  const hoursH = hours == null ? null : toHundredths(hours);
  const payPence = shift.pay_rate == null || hoursH == null ? null : lineAmountPence(toPence(shift.pay_rate), hoursH, uplift.multThousandths);
  const chargePence = shift.charge_rate == null || hoursH == null ? null : lineAmountPence(toPence(shift.charge_rate), hoursH, uplift.multThousandths);
  const niPence = payPence == null ? null : engagement === 'paye' ? pctOfPence(payPence, niPct) : 0;
  const feePence = toPence(engagement === 'paye' ? feePaye : feeLtd);

  return {
    complete: problems.length === 0,
    problems,
    uplift_rule: uplift.rule,
    uplift_multiplier: uplift.multiplier,
    paid_hours: hours == null ? null : Number(hours).toFixed(2),
    pay_amount_pence: payPence,
    charge_amount_pence: chargePence,
    employer_ni_pence: niPence,
    bureau_fee_pence: feePence,
    engagement_type_at_approval: engagement,
    financial_snapshot: {
      pay_rate: shift.pay_rate, charge_rate: shift.charge_rate, hours,
      uplift: { rule: uplift.rule, multiplier: uplift.multiplier, applicable: uplift.applicable },
      employers_ni_pct: engagement === 'paye' ? niPct : 0,
      bureau_fee: engagement === 'paye' ? feePaye : feeLtd,
      computed_at: new Date().toISOString(),
    },
  };
}

export async function snapshotShift(shiftId) {
  const { rows } = await query(
    `SELECT s.*, c.engagement_type FROM shifts s JOIN candidates c ON c.id = s.candidate_id WHERE s.id = $1`, [shiftId]);
  const shift = rows[0];
  if (!shift) throw new Error('Shift not found');
  const fin = await computeFinancials(shift, { engagement_type: shift.engagement_type });
  await query(
    `UPDATE shifts SET uplift_rule = $1, uplift_multiplier = $2, paid_hours = $3, pay_amount_pence = $4,
       charge_amount_pence = $5, employer_ni_pence = $6, bureau_fee_pence = $7,
       engagement_type_at_approval = $8, financial_snapshot = $9, updated_at = now()
     WHERE id = $10`,
    [fin.uplift_rule, fin.uplift_multiplier, fin.paid_hours, fin.pay_amount_pence, fin.charge_amount_pence,
     fin.employer_ni_pence, fin.bureau_fee_pence, fin.engagement_type_at_approval,
     JSON.stringify(fin.financial_snapshot), shiftId]);
  return fin;
}

// Margin for a shift: uses the frozen snapshot when present ('actual'),
// otherwise computes an estimate from current inputs ('estimated').
export async function marginForShift(shift, candidate) {
  const hasSnapshot = shift.pay_amount_pence != null && shift.charge_amount_pence != null;
  const fin = hasSnapshot
    ? { pay_amount_pence: +shift.pay_amount_pence, charge_amount_pence: +shift.charge_amount_pence,
        employer_ni_pence: +(shift.employer_ni_pence ?? 0), bureau_fee_pence: +(shift.bureau_fee_pence ?? 0),
        uplift_rule: shift.uplift_rule, uplift_multiplier: shift.uplift_multiplier, problems: [], complete: true }
    : await computeFinancials(shift, candidate);
  const basis = hasSnapshot ? 'actual' : fin.complete ? 'estimated' : 'unavailable';
  const margin = fin.complete || hasSnapshot
    ? fin.charge_amount_pence - fin.pay_amount_pence - (fin.employer_ni_pence ?? 0) - (fin.bureau_fee_pence ?? 0)
    : null;
  return { ...fin, basis, margin_pence: margin };
}
