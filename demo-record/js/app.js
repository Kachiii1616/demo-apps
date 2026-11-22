// 記録アプリ（見せる用・別実装）。画面は文字列で組み立て、操作はイベント委譲で受ける。
import { FACILITY, STAFF, todayStr, addDays, weekdayOf } from './data.js';
import * as store from './store.js';
import { $, esc, toast, closeModal, confirmDialog, ui, icon, dateOfWeekday } from './ui.js';
import { initPerson } from './person.js';
import { renderDay, initDay } from './day.js';
import { renderCare, renderOneDay, renderPerson, renderPast, renderHandover, renderKeika, initCare } from './care.js';
import { renderVitals, renderWeight, renderWater, renderMeals, renderExercise, initVitals } from './vitals.js';
import { renderDocs, renderFaceSheet, renderProc, renderRec, initDocs } from './docs.js';
import * as misc from './misc.js';

const view = $('#view');
const modalEl = $('#modal');

// ---------- メニュー ----------
const MENU = [
  { items: [['ホーム', '#/home', 'home', 'ホーム']] },
  { label: '入力ページ', items: [['通所', '#/day', 'clip', '通所'], ['1day介護記録', '#/oneday', 'clip', '通所'], ['経過記録', '#/keika', 'file', '経過記録']] },
  { label: '介護記録', items: [
    ['利用者別介護記録', '#/person', 'history'], ['介護記録', '#/care', 'history'], ['過去記録', '#/past', 'history', '過去記録'], ['申し送り', '#/handover', 'swap', '申し送り'],
    ['ドキュメント', '#/docs', 'folder', 'ドキュメント'], ['フェイスシート', '#/facesheet', 'users'], ['入浴手順書', '#/proc/bath', 'history'], ['送迎手順書', '#/proc/transport', 'history'],
    ['訪問手順書', '#/proc/visit', 'history'], ['受診付き添い手順書', '#/proc/medical', 'history'], ['通所手順書', '#/proc/day', 'history'], ['レクリエーションカレンダー', '#/rec', 'history']] },
  { label: '利用者情報', items: [['新規相談受付', '#/consult', 'phone', '新規相談受付'], ['新規受付', '#/intake', 'clip', '新規受付'], ['利用者一覧', '#/members', 'users', '利用者']] },
  { label: '予定', items: [['施設カレンダー', '#/cal', 'cal', '施設カレンダー'], ['週間予定', '#/weekly', 'calgrid', '週間予定']] },
  { label: 'その他', items: [['メモ箱', '#/memo', 'inbox', 'メモ箱'], ['確認待ち', '#/review', 'clock', '確認待ち'], ['LIFE', '#/life', 'chart', 'LIFE'], ['業務日誌', '#/bdiary', 'book', '業務日誌']] },
  { gap: true, items: [['ヘルプ', '#/help', 'help'], ['設定', '#/settings', 'gear']] },
];
function renderNav() {
  const hidden = new Set(store.db().settings?.hidden || []);
  $('#nav').innerHTML = MENU.map((g) => {
    const items = g.items.filter((it) => !it[3] || !hidden.has(it[3]));
    if (!items.length) return '';
    return `${g.label ? `<div class="nav-label">${g.label}</div>` : ''}${g.gap ? '<div class="nav-gap"></div>' : ''}${items.map(([l, h, ic]) => `<a href="${h}" data-href="${h}" title="${l}">${icon(ic)}<span>${l}</span></a>`).join('')}`;
  }).join('');
  markActive();
}
function markActive() {
  const path = (location.hash || '#/home').split('?')[0];
  let best = null;
  document.querySelectorAll('#nav a').forEach((a) => {
    const h = a.dataset.href;
    if ((path === h || path.startsWith(h + '/')) && (!best || h.length > best.dataset.href.length)) best = a;
  });
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a === best));
}

// ---------- ルーティング ----------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { route: path || 'home', q: new URLSearchParams(qs || '') };
}
const ROUTES = {
  home: misc.renderHome, day: renderDay, 'day/water': renderWater, 'day/jihi': misc.renderJihi, 'day/weight': renderWeight, 'day/vitals': renderVitals,
  'day/meals': renderMeals, 'day/exercise': renderExercise, oneday: renderOneDay, 'day/contact': misc.renderContact, 'day/remarks': misc.renderRemarks,
  'day/changes': misc.renderChanges, 'day/items': misc.renderItems, keika: renderKeika, person: renderPerson, care: renderCare, past: renderPast,
  handover: renderHandover, docs: renderDocs, facesheet: renderFaceSheet, rec: renderRec, consult: misc.renderConsult, intake: misc.renderIntake,
  members: (q) => misc.renderMembers(q), 'members/names': (q) => misc.renderMembers(q, true), cal: misc.renderCalendar, weekly: misc.renderWeekly,
  memo: misc.renderMemo, review: misc.renderReview, life: misc.renderLife, bdiary: misc.renderBDiary, help: misc.renderHelp, settings: misc.renderSettings,
};
function render() {
  const { route, q } = parseHash();
  let html;
  if (route.startsWith('proc/')) html = renderProc(route.slice(5), q);
  else html = (ROUTES[route] || misc.renderHome)(q);
  const y = window.scrollY;
  view.innerHTML = html || misc.renderHome(q);
  window.scrollTo(0, y);
  markActive();
}

// ---------- どの画面でも使う操作 ----------
view.addEventListener('click', (ev) => {
  const t = ev.target;
  const step = t.closest('[data-date-step]');
  if (step) { const d = addDays(ui.date, Number(step.dataset.dateStep)); ui.date = d > todayStr() ? todayStr() : d; render(); return; }
  const wd = t.closest('[data-weekday]');
  if (wd) {
    const w = Number(wd.dataset.weekday);
    if (/^#\/day\/(water|meals|exercise)/.test(location.hash) && !location.hash.includes('view=indiv')) {
      let d = dateOfWeekday(w);
      if (d > todayStr()) d = addDays(d, -7);
      ui.date = d;
    } else { ui.weekday = w; ui.search = ''; }
    render();
    return;
  }
  if (t.closest('[data-print]')) { window.print(); return; }
  const tt = t.closest('[data-toast]');
  if (tt) { if (tt.type === 'checkbox') tt.checked = false; toast(tt.dataset.toast); }
});
view.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.matches('[data-date-pick]') && t.value) { ui.date = t.value > todayStr() ? todayStr() : t.value; render(); }
});
view.addEventListener('input', (ev) => {
  if (!ev.target.matches('[data-search]')) return;
  ui.search = ev.target.value;
  const pos = ev.target.selectionStart;
  render();
  const s = view.querySelector('[data-search]');
  s.focus();
  try { s.setSelectionRange(pos, pos); } catch { /* type=search で失敗する環境あり */ }
});

modalEl.addEventListener('click', (ev) => { if (ev.target === modalEl || ev.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modalEl.hidden) closeModal(); });

// ---------- 共通部 ----------
function renderMe() {
  const me = store.getMe();
  const sel = $('#me-select');
  sel.innerHTML = STAFF.map((s) => `<option value="${s.id}" ${s.id === me ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  $('#me-avatar').textContent = STAFF.find((s) => s.id === me).name.slice(0, 1);
}
// 着せ替え。ボタンを押すたびにこの順で切り替わる
const THEMES = [['standard', 'スタンダード'], ['mint', 'ミント'], ['watercolor', '水彩']];
function currentTheme() {
  const th = store.getPref('theme', 'standard');
  return THEMES.some(([k]) => k === th) ? th : 'standard';
}
function applyTheme() {
  const th = currentTheme();
  document.body.dataset.theme = th;
  $('#design-btn').textContent = `デザイン: ${THEMES.find(([k]) => k === th)[1]}`;
}

function init() {
  store.load();
  initPerson(view, render);
  initDay(view, render);
  initCare(view, render);
  initVitals(view, render);
  initDocs(view, render);
  misc.initMisc(view, render);
  $('#facility-name').textContent = FACILITY.name;
  $('#collapse').innerHTML = icon('chevL');
  $('#logout').innerHTML = icon('logout');
  $('#open-menu').innerHTML = icon('menu');
  renderNav();
  renderMe();
  applyTheme();
  document.addEventListener('menu-changed', renderNav);
  $('#me-select').addEventListener('change', (e) => { store.setMe(e.target.value); renderMe(); render(); toast(`${STAFF.find((s) => s.id === e.target.value).name} さんに切り替えました`); });
  $('#facility-change').addEventListener('click', () => toast('デモ版の事業所は 1 つだけです'));
  $('#logout').addEventListener('click', () => toast('デモ版ではログアウトできません'));
  $('#design-btn').addEventListener('click', () => { const i = THEMES.findIndex(([k]) => k === currentTheme()); store.setPref('theme', THEMES[(i + 1) % THEMES.length][0]); applyTheme(); });
  $('#collapse').addEventListener('click', () => {
    if (window.matchMedia('(max-width: 860px)').matches) { document.body.classList.remove('menu-open'); return; }
    document.body.classList.toggle('side-mini');
    store.setPref('mini', document.body.classList.contains('side-mini'));
  });
  if (store.getPref('mini', false)) document.body.classList.add('side-mini');
  $('#reset-demo').addEventListener('click', async () => {
    if (!(await confirmDialog('デモデータを初期状態に戻します。よろしいですか？', '戻す'))) return;
    store.reset();
    ui.date = todayStr();
    ui.weekday = weekdayOf(todayStr());
    renderNav();
    render();
    toast('初期状態に戻しました');
  });
  const closeMenu = () => document.body.classList.remove('menu-open');
  $('#open-menu').addEventListener('click', () => document.body.classList.add('menu-open'));
  $('#backdrop').addEventListener('click', closeMenu);
  window.addEventListener('hashchange', () => { closeMenu(); closeModal(); ui.search = ''; render(); window.scrollTo(0, 0); });
  if (!location.hash) history.replaceState(null, '', '#/home');
  render();
}

init();
