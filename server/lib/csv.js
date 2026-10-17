// Shared CSV/date helpers for spreadsheet imports (training records, Neuven feed).

export function parseCsv(text) {
  // RFC4180-ish: handles quoted cells with commas/newlines and "" escapes.
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); // UK d/m/y
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isNaN(Date.parse(d)) ? undefined : d;
  }
  return undefined; // unparseable
}
