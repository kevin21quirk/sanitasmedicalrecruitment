import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { attachAccount, requireAuth } from './lib/auth.js';

import auth from './routes/auth.js';
import accounts from './routes/accounts.js';
import candidates from './routes/candidates.js';
import clients from './routes/clients.js';
import vacancies from './routes/vacancies.js';
import cvmatch from './routes/cvmatch.js';
import placements from './routes/placements.js';
import shifts from './routes/shifts.js';
import compliance from './routes/compliance.js';
import activities from './routes/activities.js';
import tasks from './routes/tasks.js';
import dashboard from './routes/dashboard.js';
import reports from './routes/reports.js';
import users from './routes/users.js';
import messages from './routes/messages.js';
import files from './routes/files.js';
import publicRoutes from './routes/public.js';
import portal from './routes/portal.js';
import requests from './routes/requests.js';
import invoices from './routes/invoices.js';
import admin from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(attachAccount);

// Public endpoints (registration, phone-signing links) — no auth.
app.use('/api/public', publicRoutes);
// Portal endpoints (worker / client / supervisor) — auth enforced per-route.
app.use('/api/portal', portal);
// Staff auth endpoints.
app.use('/api/auth', auth);

// Everything else requires a signed-in staff account.
app.use('/api/accounts', accounts);
app.use('/api/candidates', requireAuth, candidates);
app.use('/api/clients', requireAuth, clients);
app.use('/api/vacancies', requireAuth, vacancies);
app.use('/api', requireAuth, cvmatch);
app.use('/api/placements', requireAuth, placements);
app.use('/api/shifts', requireAuth, shifts);
app.use('/api', requireAuth, requests); // requests/availability/offers/allocation
app.use('/api', requireAuth, invoices); // timesheets workflow, invoices, payroll, margin
app.use('/api/admin', requireAuth, admin); // audit, settings, retention, exports, digest
app.use('/api/compliance', requireAuth, compliance);
app.use('/api/activities', requireAuth, activities);
app.use('/api/tasks', requireAuth, tasks);
app.use('/api/dashboard', requireAuth, dashboard);
app.use('/api/reports', requireAuth, reports);
app.use('/api/users', requireAuth, users);
app.use('/api/messages', requireAuth, messages);
app.use('/api/files', files); // per-file authorisation inside the route

app.use((err, req, res, _next) => {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  // err.status marks a deliberate, client-safe message; anything else stays generic
  res.status(status).json({ error: err?.status ? err.message : 'Internal server error' });
});

export default app;
