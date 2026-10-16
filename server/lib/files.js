import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { put, del, getDownloadUrl } from '@vercel/blob';
import { query } from '../db.js';

// Local-dev fallback store (gitignored). Production always uses Vercel Blob.
const LOCAL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.uploads');

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per document
});

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Store a buffer in Vercel Blob and record it in files.
// Without BLOB_READ_WRITE_TOKEN (local dev) falls back to a data-less record
// marked pending so the flow is still exercisable.
export async function storeFile({ buffer, filename, mime, ownerType, ownerId, label, uploadedBy }) {
  let blobUrl = null;
  if (hasBlob() && buffer) {
    const blob = await put(`sanitas/${ownerType}/${ownerId}/${Date.now()}-${filename}`, buffer, {
      // private store — reads require the token (set BLOB_ACCESS=public to override)
      access: process.env.BLOB_ACCESS === 'public' ? 'public' : 'private',
      contentType: mime || 'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    blobUrl = blob.url;
  } else if (buffer && !process.env.VERCEL) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    const name = `${Date.now()}-${filename.replace(/[^\w.-]/g, '_')}`;
    fs.writeFileSync(path.join(LOCAL_DIR, name), buffer);
    blobUrl = `local:${name}`;
  }
  const { rows } = await query(
    `INSERT INTO files (owner_type, owner_id, filename, mime, size, blob_url, label, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [ownerType, ownerId, filename, mime || null, buffer?.length ?? null, blobUrl, label || null, uploadedBy ?? null]);
  return rows[0];
}

export async function deleteFile(id) {
  const { rows } = await query(`DELETE FROM files WHERE id = $1 RETURNING blob_url`, [id]);
  const url = rows[0]?.blob_url;
  if (!url) return;
  if (url.startsWith('local:')) { try { fs.unlinkSync(path.join(LOCAL_DIR, url.slice(6))); } catch { /* gone */ } }
  else if (hasBlob()) { try { await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch { /* best effort */ } }
}

// 8.4 — blob URLs are never exposed to the client; downloads stream through
// this proxy after the route's own authorisation check.
export async function streamFile(file, res, { inline = false } = {}) {
  if (!file.blob_url) return res.status(404).json({ error: 'File content not stored (no blob token configured)' });
  let buf;
  if (file.blob_url.startsWith('local:')) {
    try { buf = fs.readFileSync(path.join(LOCAL_DIR, file.blob_url.slice(6))); }
    catch { return res.status(404).json({ error: 'Local file missing' }); }
  } else {
    // Private store: mint a short-lived signed URL server-side, then stream it
    // through the proxy — storage URLs are never handed to the browser (8.4).
    const url = getDownloadUrl(file.blob_url); // reads BLOB_READ_WRITE_TOKEN from env
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(502).json({ error: 'File fetch failed' });
    buf = Buffer.from(await upstream.arrayBuffer());
  }
  res.setHeader('Content-Type', file.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${(file.filename || 'file').replace(/"/g, '')}"`);
  if (inline) res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(buf);
}

// Replace a profile image / logo on an entity: stores the new blob, points the
// column at it and removes the previous file. Only image mimes are accepted.
export async function replacePhoto({ table, column, id, file, uploadedBy }) {
  if (!file?.mimetype?.startsWith('image/')) throw Object.assign(new Error('Image files only'), { status: 400 });
  if (file.size > 3 * 1024 * 1024) throw Object.assign(new Error('Image must be under 3MB'), { status: 400 });
  const { rows: prev } = await query(`SELECT ${column} AS fid FROM ${table} WHERE id = $1`, [id]);
  if (!prev[0]) throw Object.assign(new Error('Not found'), { status: 404 });
  const stored = await storeFile({
    buffer: file.buffer, filename: file.originalname, mime: file.mimetype,
    ownerType: 'photo', ownerId: id, label: `${table}:${column}`, uploadedBy,
  });
  await query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [stored.id, id]);
  if (prev[0].fid) await deleteFile(prev[0].fid).catch(() => {});
  return stored;
}
