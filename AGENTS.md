# Sanitas CRM

Full-stack recruitment CRM for Sanitas Medical Recruitment (nurses & HCAs into private care homes, Essex/London).

## Stack
- **Frontend**: `client/` — React 18 + TypeScript + Vite + Tailwind CSS v4 + react-router-dom + recharts + lucide-react + dnd-kit + date-fns
- **Backend**: `server/` — Node + Express + pg (ESM)
- **Database**: Neon PostgreSQL (connection string in root `.env`, gitignored)

## Commands
- `npm run dev` — run API (:4000) + Vite (:5173) together (uses `concurrently`)
- `npm run dev:server` / `npm run dev:client` — run individually
- `npm run db:migrate` — apply `server/schema.sql`
- `npm run db:seed` — reseed with demo data (TRUNCATEs all tables)
- `npm run build` — client production build; `cd client && npx tsc --noEmit` typechecks

## Structure
- `server/routes/` — REST endpoints: candidates, clients, vacancies, placements, shifts, compliance, activities, tasks, dashboard, reports, users
- `client/src/pages/` — Dashboard, Candidates(+Detail), Clients(+Detail), Vacancies kanban(+Detail), Placements, ShiftsCalendar, Timesheets, Compliance, Inbox, Reports
- `client/src/components/ui.tsx` — shared primitives (Badge/Card/Modal/PageHeader + STATUS_STYLES color map)
- Vite proxies `/api` → `localhost:4000`

## Deployment (Vercel)
- `vercel.json` at root: installs `client/` + `server/` deps, builds `client/` → `client/dist`
- `api/index.js` + `api/[...all].js` expose the Express app (`server/app.js`) as Vercel serverless functions at `/api/*`
- Required Vercel env var: `DATABASE_URL` (Neon connection string)
- `server/index.js` = local dev listener only; `server/app.js` = shared Express app (no listen)

## AI CV Screening
- Vacancy detail → "AI CV Screening" card. Upload PDF/DOCX/TXT or paste text → `POST /api/vacancies/:id/match-cv` (multer memory storage, 5MB)
- `server/lib/matcher.js`: `extractCvText` (pdf-parse/mammoth) + `matchCv` — uses Anthropic Claude when `ANTHROPIC_API_KEY` env var is set (model via `ANTHROPIC_MODEL`, default `claude-sonnet-4-5`), else falls back to a heuristic skills/requirements matcher
- Results persist in `cv_matches` table; listed via `GET /api/vacancies/:id/cv-matches`

## Conventions
- Postgres returns numerics/counts as strings — coerce with `+`/`Number()` in UI
- Badge colors driven by `STATUS_STYLES` map in ui.tsx (add new statuses there)
- Brand palette: brand-500 `#1863dc`, brand-700 `#0c56a4`, accent-500 `#01aef0`; headings use `font-display` (Laila)
