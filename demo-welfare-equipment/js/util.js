export function pad2(n) { return String(n).padStart(2, '0'); }

export function toYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmd(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export function addMonths(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
}

export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

export function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); } // m は 1〜12

export function todayYmd() { return toYmd(new Date()); }

export function jpDate(s) {
  const d = parseYmd(s);
  return d ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : '';
}

export function age(birth, at = new Date()) {
  const b = parseYmd(birth);
  if (!b) return '';
  let a = at.getFullYear() - b.getFullYear();
  if (at.getMonth() < b.getMonth() || (at.getMonth() === b.getMonth() && at.getDate() < b.getDate())) a--;
  return a;
}

export function yen(n) { return Number(n || 0).toLocaleString('ja-JP'); }

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]); }

// カタカナ・ひらがな・全角半角の違いを吸収して検索する
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
