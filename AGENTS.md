# Sanitas CRM / Ops System

Full-stack staffing-operations system for Sanitas Medical Recruitment (nurses, HCAs and support workers into private care homes, Essex/London). Built to satisfy `Client_Build_Spec_Requirements.xlsx` — single-agency, human-led allocation, full portals, compliance engine, timesheets/invoicing/payroll, data rights.

## Stack
- **Frontend**: `client/` — React 18 + TypeScript + Vite + Tailwind CSS v4 + react-router-dom + recharts + lucide-react + dnd-kit + date-fns
- **Backend**: `server/` — Node + Express + pg (ESM)
- **Database**: Neon PostgreSQL (connection string in root `.env`, gitignored)
- **Files**: Vercel Blob (`server/lib/files.js`); `BLOB_READ_WRITE_TOKEN` required in production. Local dev stores the `files` row without blob content.
- **Messaging**: no API integrations — `wa.me` deep links + `mailto:` links generated into a `messages` outbox; staff click-to-send. Logged + auditable.

## Commands
- `npm run dev` — API (:4000) + Vite (:5173) together
- `npm run db:migrate` — apply `server/schema.sql` (idempotent; ALTERs use `IF NOT EXISTS`, constraint adds wrapped in `DO $$` blocks)
- `npm run db:seed` — demo data; staff password `sanitas123`, portal password `portal123`
- `npm run build` — client production build; `cd client && npx tsc --noEmit` typechecks
- `npm test` — `node --test` in `server/`: `test/money.test.js` (pure pence arithmetic) + `test/api.test.js` (boots the app, DB-backed acceptance scenarios using seeded logins; creates/removes TEST-* rows)
- See `HANDOVER.md` for deployment env vars, open business decisions, residency notes and the schema-change log

## Access model
- `accounts` table = unified login: `staff` | `worker` | `client` | `supervisor`. Sessions in `sessions` (cookie `sanitas_session`, 30d); deactivation deletes sessions = instant revoke (5.3).
- `attachAccount` middleware loads `req.account` (`{id, kind, userId, candidateId, clientId, contactId, email, accessRole, name}`).
- Guards: `requireAuth` (staff only), `requireAccess('admin'|'office'|'compliance'|'finance')` (8.4 role restriction — admin passes everything), `requirePortal('worker'|'client'|'supervisor')`.
- Route namespaces: `/api/public/*` (registration, /sign/:token), `/api/portal/*` (worker/client/supervisor), `/api/auth`, everything else behind `requireAuth`. `/api/admin/*` is staff-only with extra `requireAccess` on sensitive routes.
- Staff access roles: `admin`, `office`, `compliance`, `finance`. OH records → compliance/admin + own worker only. Payroll/margin/aged debtors → finance/admin.

## Route map (server/routes/)
- `auth.js` login/logout/me · `accounts.js` account CRUD + access roles · `public.js` registration (draft→submit, resume token, doc upload, auto-ack) + phone-signing tokens
- `portal.js` worker (docs, OH, availability, offers, confirm/ack/sign, export) + client (requests, rota, timesheets sign, shared profiles) + supervisor (rota)
- `requests.js` `/api/requests`, `/api/availability` — request log, availability board, `/requests/:id/eligible` allocation context, `/requests/:id/offer|allocate`, `/shifts/:id/reoffer`, `/candidates/:id/first-choice`
- `invoices.js` — sign-links, paper entry, query/resolve, approve gate (writes the financial snapshot), invoices CRUD, aged debtors, payroll export (PAYE/Ltd, run-tracked + rejection report, `/payroll/runs`), margin (actual/estimated/unavailable)
- `lib/money.js` integer-pence maths + `snapshotShift`/`marginForShift` · `lib/dates.js` `isoDate` (pg DATE → YYYY-MM-DD without TZ drift) · `lib/mailer.js` pluggable email (Resend/none) with attempt tracking
- `admin.js` `/api/admin/*` — audit log, settings get/put, retention purge (dry-run first), SAR export/erase, `/export-all` (full JSON), operational reports (7.x), `/digest`
- `candidates.js`, `clients.js`, `compliance.js`, `shifts.js`, `messages.js`, `files.js` + legacy CRM routes (vacancies, placements, activities, tasks, dashboard, reports, users, cvmatch)

## Key business rules (spec refs)
- **Human allocation (3.8)**: `/requests/:id/eligible` returns availability/compliance/travel/continuity/block/first-choice context; no auto-assignment. `auto_ranking` setting off by default.
- **Booking blocks (2.4, 3.6, 3.11)**: `workerComplianceFor(candidate, client)` in `lib/compliance.js` gates shift create; double-booking guard (overridable `force`); `candidate_blocks` = do-not-offer.
- **Timesheets (6.x)**: never expose rates to worker/client views; dual signatures (`worker_sig_*`, `client_sig_*` + `sign_tokens` for phone links); `timesheet_locked` when both signed; query flow via `timesheet_queries`; `approved` status = invoice gate (6.10c); uplifts (night/weekend/bank-holiday, `highest`-wins precedence) resolved in `lib/money.js`; approve freezes the financial snapshot — reports read it, never live rates.
- **Compliance mutations (2.x)**: `requireAccess('office','compliance')` on document/register edits and uploads — finance excluded by design; restricted files refused to finance in `files.js`.
- **Data rights**: worker self-export `/portal/export`; staff SAR `/admin/candidates/:id/export`; erase anonymises (blocked with upcoming shifts); retention purge dry-run→apply; `/admin/export-all` full JSON dump.
- **Comms**: `notify()` in `lib/notify.js` queues to `messages`; wa.me/mailto links generated in response + on GET /messages. Every mutation should `await audit(req, 'noun.verb', entity_type, entity_id, detail)` (8.9).

## Frontend structure
- `App.tsx` `Gate`: `/register*` + `/sign/*` public; unauth → `Login`; `account.kind !== 'staff'` → `Portal` dispatcher (WorkerPortal/ClientPortal/SupervisorPortal); `/candidates/:id/file` → printable `ComplianceFile`.
- New pages: `Requests` (requests + allocation drawer + availability board), `Invoices` (invoices/aged debtors/payroll/margin), `Settings` (accounts/settings/audit/data tabs), `Register`, `SignPage`, `ComplianceFile`; `Inbox` gained an Outbox tab; `Timesheets` gained signatures/query/paper actions; `Reports` gained Operations tab.

## Conventions
- Postgres numerics/counts arrive as strings — coerce with `+`/`Number()`.
- Badge colors via `STATUS_STYLES` in `ui.tsx`. Brand: brand-500 `#1863dc`, brand-700 `#0c56a4`, accent-500 `#01aef0`; headings `font-display`.
- `api.get/post/patch/put/del/upload` from `client/src/lib/api.ts`; never hard-code user IDs — use `useAuth().account`.
- Postgres can't `ADD CONSTRAINT IF NOT EXISTS` inline — wrap in `DO $$ ... pg_constraint ... $$`.

## Deployment (Vercel)
- `vercel.json`: builds `client/` → `client/dist`; `api/index.js` + `api/[...all].js` expose `server/app.js` as serverless functions at `/api/*`.
- Env vars: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, optionally `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (CV matching only; heuristic fallback). No cron — digest via `POST /api/admin/digest` (ping from an external scheduler if wanted).
