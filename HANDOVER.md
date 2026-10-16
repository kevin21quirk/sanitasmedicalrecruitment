# Sanitas Medical Recruitment — Handover

## Architecture

| Layer | Technology | Where |
|---|---|---|
| Frontend | React 18 + TS + Vite + Tailwind v4 | `client/` → built to `client/dist` |
| API | Node + Express (ESM) | `server/app.js` — shared by local dev (`server/index.js`, :4000) and Vercel functions (`api/index.js`, `api/[...all].js`) |
| Database | Neon PostgreSQL (eu-west-2, London) | `DATABASE_URL` env var |
| Files | Vercel Blob, **private** store `store_DuHhCVC9qzepwuOa` (LHR1, London) | `server/lib/files.js` — uploads `access: 'private'`; reads proxied through auth-gated `/api/files/:id/view`. Local dev falls back to `server/.uploads/` (gitignored) |
| Email | Provider-pluggable (`server/lib/mailer.js`): Resend via HTTPS when `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`; otherwise messages stay `queued` and staff send via `mailto:` links | `server/routes/messages.js` |
| WhatsApp | Click-to-send `wa.me` links only — no Business API (out of scope) | `server/lib/notify.js` |

## Commands

```
npm run dev          # API :4000 + Vite :5173
npm run db:migrate   # apply server/schema.sql (idempotent, additive only)
npm run db:seed      # DESTRUCTIVE — truncates and reseeds; demo/dev only
npm test             # node --test (money unit tests + DB-backed API suite)
npm run typecheck    # client tsc
npm run build        # client production build
```

Tests use seeded logins (`jill@… sanitas123` admin, `sam@…` finance, `amelia@…` compliance, `james@…` office; portal fixtures `portal123` created/removed by the suite). They create and clean up `TEST-*` rows; audit_log is append-only (trigger) so audit rows persist.

## Environment variables (Vercel)

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `BLOB_READ_WRITE_TOKEN` | yes | injected automatically when the Blob store is connected to the project |
| `EMAIL_PROVIDER` | no | `resend` to enable API send; default `none` → mailto fallback |
| `RESEND_API_KEY`, `EMAIL_FROM` | with resend | sender defaults to `no-reply@sanitasmedicalrecruitment.co.uk` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | no | optional CV screening aid (`server/lib/matcher.js`); heuristic fallback without it. **Not used for allocation decisions** |

## Deployment

- `vercel.json`: `regions: ["lhr1"]` pins serverless functions to London; installs both workspaces, builds client, rewrites `/api/*` → `api/index.js`.
- Vercel project root must be the repo root (not `client/`).
- After first deploy: `npm run db:migrate` with `DATABASE_URL` pointing at the production database. Do **not** run `db:seed` on production.

## Schema changes in this phase (all additive)

- `register_checks`: `source` (always `manual_staff` — no automated verification), `review_due`
- `shifts`: `uplift_rule`, `uplift_multiplier`, `paid_hours`, `pay_amount_pence`, `charge_amount_pence`, `employer_ni_pence`, `bureau_fee_pence`, `engagement_type_at_approval`, `financial_snapshot`, `payroll_export_id`
- `payroll_exports` table — one row per bureau run; shifts reference it so a shift cannot be exported twice
- `import_batches` table — training spreadsheet imports (preview → validate → commit)
- `messages`: `attempts`, `last_error`, `last_attempt_at`, `provider_id`, `read_at`, `to_account_id`, `from_account_id`
- `audit_log`: append-only trigger (`audit_log_no_update`); FK to `accounts` dropped because `ON DELETE SET NULL` would rewrite audit history — `actor_name` is stored instead

## Design decisions

- **Compliance is per worker × per client.** Baseline docs (DBS Enhanced, Right to Work, Passport/ID, Mandatory Training; + NMC PIN for nurses) plus `client_requirements` additions/removals. `workerComplianceFor(candidateId, clientId)` returns `ok` + explanatory `gaps`. Booking and re-assignment are hard-blocked (HTTP 422) on gaps; there is deliberately **no override path** — staff must fix the document.
- **Manual DBS/NMC provenance.** Register checks are always `source='manual_staff'`, stamped with the recorder and date; UI and printable file say "staff-recorded — not system-verified". No DBS Update Service / NMC API integration (out of scope).
- **Financial snapshots.** Approving a timesheet freezes pay/charge/NI/fee/uplift inputs (`snapshotShift`); invoices, payroll and margin read the snapshot, so later rate or settings changes never rewrite history. All money is integer pence (`server/lib/money.js`).
- **Uplifts.** night 1.15× / weekend 1.25× / bank-holiday 1.5× (bank_holidays table); when several apply, **highest wins** (configurable to `stack` via `uplift_precedence`). DECISION PENDING — confirm with the project owner.
- **Payroll.** Two bureaus (PAYE / Ltd). Preview is free; `POST /payroll/export` stamps shifts and records a `payroll_exports` run with rejections. Provisional CSV format `provisional-v1`: `payroll_ref, worker, engagement, client, date, shift_type, hours, uplift_rule, uplift_multiplier, amount`. DECISION PENDING — confirm bureau column layouts.
- **Margin.** charge − pay − employer NI (PAYE only, 15% flat) − bureau fee (£3.50 PAYE / £2.00 Ltd per shift). Each line is labelled `actual` (frozen snapshot), `estimated` (current settings, unapproved shift) or `unavailable` (missing inputs). NI threshold is not applied per-shift — weekly-payroll aggregation would be needed for exact NI.
- **Messaging.** In-app inbox (worker portal), email via provider or mailto, WhatsApp via wa.me. Delivery attempts recorded (`attempts`, `last_error`, `provider_id`), max 5 retries, failure is visible not silent.
- **Access control.** `requireAccess(roles)` server-side: finance-only users are excluded from compliance document/register mutation and restricted file downloads; portal accounts (worker/client/supervisor) never reach staff routes (`requireAuth`). Rate/margin/payroll data is staff+finance only; portal payloads exclude rates.
- **No automated matching.** Allocation lists eligible workers with context (compliance, availability, continuity, blocks); ordering is alphabetical unless `auto_ranking` is enabled in settings (off by default, and even then it's ordering only — a human books).

## Open business decisions (confirm before production)

1. **Payroll export format** — `provisional-v1` columns above are provisional; confirm each bureau's required layout.
2. **Enhancement precedence** — `highest` vs `stack` for overlapping night/weekend/bank-holiday uplifts; confirm multipliers.
3. **Compliance override policy** — currently none exists by design. If an authorised override is wanted, define who may override, expiry, and required evidence — needs implementing.
4. **Margin assumptions** — employer NI % (15) and whether the secondary threshold should apply per-shift (it can't be exact without weekly aggregation); bureau fees £3.50/£2.00 per shift.
5. **Email provider** — Resend wired but unconfigured; confirm provider + verified sender domain.
6. **Data residency** — Neon eu-west-2 (London) and Vercel functions lhr1 + Blob LHR1 satisfy UK residency for compute/DB/files. **Unverified:** Neon backup/log region, Vercel log/observability pipeline region, email provider region, Anthropic API (US) — disable `ANTHROPIC_API_KEY` or confirm DPA if CV screening sends personal data.
7. **Retention** — `retention_never_worked_months` (24) drives the admin purge preview; confirm the agency's retention schedule.

## Security notes

- Sessions: HttpOnly, SameSite=Lax, 30-day cookie; `Secure` flag under `NODE_ENV=production`. Login throttled per IP+email (6 fails → 10 min).
- Uploaded files are private Blob objects proxied through `/api/files/:id/view` with per-owner authorisation — never exposed as public URLs.
- `audit_log` is append-only (DB trigger blocks UPDATE/DELETE); sensitive actions record actor, action, entity and before/after detail without credentials.
- The Neon owner password was shared in chat during setup — **rotate it** and update `DATABASE_URL` in Vercel + `.env`.
- Change seeded passwords (`sanitas123` staff, `portal123` portals) before real use.

## Deliberately omitted (Phase 3 / separately quoted)

- DBS Update Service API, automated NMC verification, WhatsApp Business integration, AI allocation/matching.
- Existing optional AI CV screening (`/api/vacancies/:id/match-cv`) retained as a recruitment aid only — it does not feed allocation.
