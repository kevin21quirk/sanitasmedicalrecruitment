import { Router } from 'express';
import { query } from '../db.js';
import { streamFile, deleteFile } from '../lib/files.js';
import { canSeeOH } from '../lib/auth.js';
import { audit } from '../lib/audit.js';

const r = Router();

// Profile photos / logos — inline, any signed-in account (staff or portal).
r.get('/:id/view', async (req, res, next) => {
  try {
    if (!req.account) return res.status(401).end();
    const { rows } = await query(`SELECT * FROM files WHERE id = $1 AND owner_type = 'photo'`, [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    await streamFile(rows[0], res, { inline: true });
  } catch (e) { next(e); }
});

// 8.4 — files are fetched through this proxy after authorisation so the
// underlying blob URL is never handed out.
r.get('/:id/download', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM files WHERE id = $1`, [req.params.id]);
    const file = rows[0];
    if (!file) return res.status(404).json({ error: 'Not found' });

    const acc = req.account;
    const isStaff = acc?.kind === 'staff';
    const isOwnerWorker = acc?.kind === 'worker' && file.owner_type === 'candidate' && file.owner_id === acc.candidateId;
    if (file.owner_type === 'oh' && !(isStaff && canSeeOH(acc)) && !isOwnerWorker) {
      return res.status(403).json({ error: 'Restricted record' });
    }
    if (!isStaff && !isOwnerWorker) return res.status(403).json({ error: 'Not authorised' });

    await audit(req, 'file.downloaded', 'file', file.id, { filename: file.filename });
    await streamFile(file, res);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    if (req.account?.kind !== 'staff') return res.status(403).json({ error: 'Not authorised' });
    await deleteFile(+req.params.id);
    await audit(req, 'file.deleted', 'file', +req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
