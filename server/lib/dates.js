// pg returns DATE columns as JS Date objects; String(date) gives
// "Sat Oct 17 2026 ..." not ISO. Normalise to YYYY-MM-DD for SQL params and display.
export function isoDate(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    // pg parses DATE as local midnight; toISOString() would shift the day when
    // the server runs ahead of UTC (BST). Local components preserve the date.
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toISOString().slice(0, 10);
}
