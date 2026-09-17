import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/candidates', candidates);
app.use('/api/clients', clients);
app.use('/api/vacancies', vacancies);
app.use('/api', cvmatch);
app.use('/api/placements', placements);
app.use('/api/shifts', shifts);
app.use('/api/compliance', compliance);
app.use('/api/activities', activities);
app.use('/api/tasks', tasks);
app.use('/api/dashboard', dashboard);
app.use('/api/reports', reports);
app.use('/api/users', users);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

export default app;
