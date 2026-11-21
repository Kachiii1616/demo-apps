// 画面どうしで共有する小さな道具（表示用の整形・アイコン・見出し・タブ・トースト・モーダル・確認ダイアログ・画面状態）。
import { todayStr, WD, WEEK_ORDER, weekdayOf, addDays, mondayOf } from './data.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function jpDate(ds, withYear = true) {
  const [y, m, d] = ds.split('-').map(Number);
  const w = WD[new Date(y, m - 1, d).getDay()];
  return withYear ? `${y}年${m}月${d}日（${w}）` : `${m}/${d}（${w}）`;
}
export const md = (ds) => { const [, m, d] = ds.split('-').map(Number); return `${m}/${d}`; };
export function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export function ageOf(birth, today = todayStr()) {
  if (!birth) return '';
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}
export const notInDemo = (what = 'この操作') => toast(`${what}はデモ版では動きません`);

// ---------- 画面状態（ページをまたいで覚えておくもの） ----------
export const ui = {
  date: todayStr(),
  weekday: weekdayOf(todayStr()),
  search: '',
  pMetric: 'all',
  pWeightRange: '6',
  vsRange: '1',
  daySort: 'kana',
  pastRange: 'today',
  pastTag: 'all',
  pastQ: '',
  pastUser: '',
  excrType: '尿',
  calView: 'month',
  calMonth: todayStr().slice(0, 7),
  recMonth: todayStr().slice(0, 7),
  weeklyStart: mondayOf(todayStr()),
};

// 曜日ボタンで選んだ曜日の「今週の日付」
export function dateOfWeekday(w) {
  const mon = mondayOf(todayStr());
  return addDays(mon, w === 0 ? 6 : w - 1);
}

// ---------- アイコン（線画の SVG） ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h4"/>',
  file: '<path d="M6 2.5h8l4.5 4.5v14.5H6z"/><path d="M14 2.5V7h4.5"/><path d="M9 12h6M9 16h6"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 3.5V8h4.5"/><path d="M12 7.5V12l3 2"/>',
  swap: '<path d="M4 8h15l-3.5-3.5"/><path d="M20 16H5l3.5 3.5"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14.8c2 .7 3.5 2.5 4 5.2"/>',
  phone: '<path d="M5 3.5h3.5l1.8 4.6-2.3 1.4a11 11 0 0 0 6.5 6.5l1.4-2.3 4.6 1.8V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  calgrid: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 10v10.5M14.5 10v10.5M3.5 15h17"/>',
  inbox: '<path d="M3 13.5 5.5 5h13l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  chart: '<path d="M3.5 3.5v17h17"/><path d="m7 15 4-4.5 3 3L20 7"/>',
  book: '<path d="M5 3.5h13.5V18H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21h12v-3"/><path d="M9 8h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><path d="M12 17.2v.1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.6 2.4 2.8-.6.9 2.7 2.7.9-.6 2.8 2.4 1.6-2.4 1.6.6 2.8-2.7.9-.9 2.7-2.8-.6L12 21.2l-1.6-2.4-2.8.6-.9-2.7-2.7-.9.6-2.8L2.2 12l2.4-1.6-.6-2.8 2.7-.9.9-2.7 2.8.6z"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  logout: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M4 12h11M11.5 8.5 15 12l-3.5 3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="1.5"/><path d="M7 14h10v6.5H7z"/>',
};
export const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

// カード右上の花の飾り
export const deco = `<svg class="deco" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3">${[0, 60, 120, 180, 240, 300].map((r) => `<ellipse cx="12" cy="6.6" rx="2.6" ry="4.6" transform="rotate(${r} 12 12)"/>`).join('')}<circle cx="12" cy="12" r="1.8"/></svg>`;

// ---------- 見出し ----------
export function scriptTitle(script, ja, sub = '', extra = '') {
  return `<div class="ttl-row"><h1 class="ttl"><span class="script">${script}</span><span class="ja">${ja}</span></h1>${extra}</div>${sub ? `<p class="ttl-sub">${sub}</p>` : ''}`;
}
export function plainTitle(ja, lead = '', extra = '') {
  return `<div class="ttl-row"><h1 class="ttl plain">${ja}</h1>${extra}</div>${lead ? `<p class="lead">${lead}</p>` : ''}`;
}

// ---------- 上部タブ ----------
export const DAY_TABS = [
  ['#/day', '通所 (業務日誌)'], ['#/day/water', '水分バランス'], ['#/day/jihi', '自費サービス記録'], ['#/day/weight', '体重管理'],
  ['#/day/vitals', 'VS経過表'], ['#/day/meals', '食事摂取量'], ['#/day/exercise', '運動'], ['#/oneday', '1day介護記録'],
  ['#/day/contact', '連絡帳'], ['#/day/remarks', '利用者備考入力'], ['#/day/changes', '利用者変更連絡'], ['#/day/items', '業務日誌必要項目'],
];
export const CARE_TABS = [
  ['#/person', '利用者別介護記録'], ['#/care', '介護記録'], ['#/past', '過去記録'], ['#/facesheet', 'フェイスシート'],
  ['#/proc/bath', '入浴手順書'], ['#/proc/transport', '送迎手順書'], ['#/proc/visit', '訪問手順書'], ['#/proc/medical', '受診付き添い手順書'],
  ['#/proc/day', '通所手順書'], ['#/rec', 'レクリエーションカレンダー'],
];
export const MEMBER_TABS = [['#/members', '利用者一覧'], ['#/members/names', '名前の整理']];
export function subtabs(tabs, active) {
  return `<nav class="subtabs no-print" aria-label="ページ内のタブ">${tabs.map(([h, l]) => `<a href="${h}" class="${h === active ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
}

// ---------- 日付バー ----------
export function dateNav(date, { future = false, cls = '' } = {}) {
  const today = todayStr();
  return `<div class="date-nav ${cls}">
    <button type="button" class="btn sm" data-date-step="-1">◀ 前日</button>
    <span class="date-label">${jpDate(date)}</span>
    <button type="button" class="btn sm" data-date-step="1" ${!future && date >= today ? 'disabled' : ''}>翌日 ▶</button>
    <input type="date" class="date-input" data-date-pick value="${date}" ${future ? '' : `max="${today}"`} aria-label="日付を選ぶ">
  </div>`;
}

// ---------- 曜日ボタン ----------
export function weekdayButtons(selected, { small = false, withDate = false } = {}) {
  const tw = weekdayOf(todayStr());
  return `<div class="wd-btns ${small ? 'small' : ''}" role="tablist">${WEEK_ORDER.map((w) => {
    const d = dateOfWeekday(w);
    const label = withDate ? `${WD[w]} ${md(d)}${w === tw ? ' (今日)' : ''}` : WD[w];
    return `<button type="button" role="tab" class="wd ${w === selected ? 'on' : ''}" data-weekday="${w}" aria-selected="${w === selected}">${label}${!withDate && w === tw ? '<small>今日</small>' : ''}</button>`;
  }).join('')}</div>`;
}

// ---------- 利用者カード（2列） ----------
export function memberCards(list, href) {
  if (!list.length) return '<p class="empty center">この曜日の利用者は登録されていません</p>';
  return `<div class="m-cards">${list.map((m) => `<a class="m-card" href="${href(m)}"><b>${esc(m.name)}</b><small>${esc(m.kana)}</small></a>`).join('')}</div>`;
}

// ---------- モーダル ----------
export function openModal(html, wire) {
  const modalEl = $('#modal');
  modalEl.innerHTML = html;
  modalEl.hidden = false;
  const form = modalEl.firstElementChild;
  wire?.(form);
  const first = form.querySelector('[data-autofocus]');
  first?.focus();
}
export function closeModal() {
  const modalEl = $('#modal');
  modalEl.hidden = true;
  modalEl.innerHTML = '';
}

// ---------- 確認ダイアログ（ブラウザ標準の confirm の代わり） ----------
export function confirmDialog(message, okLabel = 'OK') {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'confirm-wrap';
    wrap.innerHTML = `<div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-t">
      <div class="confirm-head" id="confirm-t">確認</div>
      <div class="confirm-body">${esc(message)}</div>
      <div class="confirm-foot"><button type="button" class="btn" data-no>キャンセル</button><button type="button" class="btn primary" data-yes>${esc(okLabel)}</button></div>
    </div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-no]')) done(false);
      else if (e.target.closest('[data-yes]')) done(true);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-yes]').focus();
  });
}
