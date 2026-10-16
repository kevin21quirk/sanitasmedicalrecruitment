import { Router } from 'express';
import { query } from '../db.js';
import { audit } from '../lib/audit.js';
import { upload, replacePhoto } from '../lib/files.js';

const r = Router();

r.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM users WHERE is_active ORDER BY name`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Staff profile photo — own photo, or any user's for admins.
r.post('/:id/photo', upload.single('file'), async (req, res, next) => {
  try {
    const id = +req.params.id;
    if (req.account.userId !== id && req.account.accessRole !== 'admin') {
      return res.status(403).json({ error: 'You can only change your own photo' });
    }
    const stored = await replacePhoto({ table: 'users', column: 'photo_file_id', id, file: req.file, uploadedBy: req.account.id });
    await audit(req, 'user.photo_updated', 'user', id);
    res.status(201).json({ photo_file_id: stored.id });
  } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
});

export default r;
