import { Router } from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { extractCvText, matchCv } from '../lib/matcher.js';

const r = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|docx|txt)$/i.test(file.originalname) ||
      ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PDF, DOCX or TXT files are supported'), ok);
  },
});

// Screen a CV against a vacancy — multipart upload (field 'cv') or JSON { cv_text, candidate_name }
r.post('/vacancies/:id/match-cv', upload.single('cv'), async (req, res, next) => {
  try {
    const { rows: vrows } = await query(
      `SELECT v.*, c.name AS client_name, c.type AS client_type FROM vacancies v
       JOIN clients c ON c.id = v.client_id WHERE v.id = $1`, [req.params.id]);
    if (!vrows.length) return res.status(404).json({ error: 'Vacancy not found' });
    const vacancy = vrows[0];

    let cvText = req.body?.cv_text;
    let filename = null;
    if (req.file) {
      filename = req.file.originalname;
      cvText = await extractCvText(req.file.buffer, req.file.originalname, req.file.mimetype);
    }
    if (!cvText || !cvText.trim()) {
      return res.status(400).json({ error: 'No CV content — upload a PDF/DOCX/TXT file or paste CV text' });
    }

    const result = await matchCv(cvText, vacancy);
    const { rows } = await query(
      `INSERT INTO cv_matches (vacancy_id, filename, candidate_name, cv_text, score, verdict, matched, missing, summary, engine)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.id, filename, req.body?.candidate_name || null, cvText,
       result.score, result.verdict, JSON.stringify(result.matched), JSON.stringify(result.missing),
       result.summary, result.engine]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Past screenings for a vacancy (without full cv_text)
r.get('/vacancies/:id/cv-matches', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, vacancy_id, filename, candidate_name, score, verdict, matched, missing, summary, engine, created_at
       FROM cv_matches WHERE vacancy_id = $1 ORDER BY created_at DESC`, [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

r.delete('/cv-matches/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM cv_matches WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
