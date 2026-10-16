import multer from 'multer';
import { put, del, getDownloadUrl } from '@vercel/blob';
import { query } from '../db.js';

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
  }
  const { rows } = await query(
    `INSERT INTO files (owner_type, owner_id, filename, mime, size, blob_url, label, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [ownerType, ownerId, filename, mime || null, buffer?.length ?? null, blobUrl, label || null, uploadedBy ?? null]);
  return rows[0];
}

export async function deleteFile(id) {
  const { rows } = await query(`DELETE FROM files WHERE id = $1 RETURNING blob_url`, [id]);
  if (rows[0]?.blob_url && hasBlob()) {
    try { await del(rows[0].blob_url, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch { /* best effort */ }
  }
}

// 8.4 — blob URLs are never exposed to the client; downloads stream through
// this proxy after the route's own authorisation check.
export async function streamFile(file, res) {
  if (!file.blob_url) return res.status(404).json({ error: 'File content not stored (no blob token configured)' });
  // Private store: mint a short-lived signed URL server-side, then stream it
  // through the proxy — storage URLs are never handed to the browser (8.4).
  const url = getDownloadUrl(file.blob_url); // reads BLOB_READ_WRITE_TOKEN from env
  const upstream = await fetch(url);
  if (!upstream.ok) return res.status(502).json({ error: 'File fetch failed' });
  res.setHeader('Content-Type', file.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${(file.filename || 'file').replace(/"/g, '')}"`);
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
