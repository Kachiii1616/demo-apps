import { load, reset } from './store.js';
import { toast, closePopover, ask } from './ui.js';
import { renderMonth, hasUnsaved, clearWork } from './screens/month.js';
import { renderDaily, hasUnsavedDaily, clearDailyWork } from './screens/daily.js';
import { renderRequests } from './screens/requests.js';
import { renderCalendar } from './screens/calendar.js';
import { renderSettings } from './screens/settings.js';
import { renderPrint } from './screens/print.js';

const routes = {
  month: renderMonth,
  daily: renderDaily,
  requests: renderRequests,
  calendar: renderCalendar,
  settings: renderSettings,
  print: renderPrint,
};

// 着せ替え（テーマ）。標準は data-theme なし
const THEME_KEY = 'showcase-shift:theme';
const THEMES = ['standard', 'greige', 'simple'];
function applyTheme(t) {
  if (!THEMES.includes(t)) t = 'standard';
  if (t === 'standard') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.getElementById('themeSelect').value = t;
  if (t !== 'simple' && window.showcaseLoadFonts) window.showcaseLoadFonts();
}
applyTheme(document.documentElement.dataset.theme || 'standard');
document.getElementById('themeSelect').addEventListener('change', (e) => {
  applyTheme(e.target.value);
  try { localStorage.setItem(THEME_KEY, e.target.value); } catch (err) { /* 保存できない環境では今回だけ */ }
});

// グレージュのときだけ見える見出し帯の文言
const HERO = {
  month: ['No. 1', 'MONTHLY SHIFT', 'Plan the month'],
  daily: ['No. 2', 'DAILY ASSIGNMENT', 'Share the day'],
  requests: ['No. 3', 'DAY-OFF REQUESTS', 'Rest well'],
  calendar: ['No. 4', 'CALENDAR', 'Days at a glance'],
  settings: ['No. 5', 'STAFF & SHIFT TYPES', 'Set things up'],
  print: ['No. 1', 'PRINT PREVIEW', 'Ready for paper'],
};

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'month', args: parts.slice(1), query: new URLSearchParams(query) };
}

function render(keepScroll = false) {
  closePopover();
  const sx = window.scrollX, sy = window.scrollY;
  const wraps = [...document.querySelectorAll('.shift-wrap, .daily-wrap')].map((el) => el.scrollLeft);
  const data = load();
  document.getElementById('facilityName').textContent = data.facility;
  document.getElementById('headUser').textContent = '管理者：山田 太郎';
  const { name, args, query } = parseHash();
  const fn = routes[name] || renderMonth;
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.route === (name === 'print' ? 'month' : name)));
  const hero = HERO[routes[name] ? name : 'month'];
  document.getElementById('heroNo').textContent = hero[0];
  document.getElementById('heroEn').textContent = hero[1];
  document.getElementById('heroScript').textContent = hero[2];
  const view = document.getElementById('view');
  view.innerHTML = '';
  fn(view, { args, query, rerender: () => render(true) });
  if (keepScroll) {
    window.scrollTo(sx, sy);
    document.querySelectorAll('.shift-wrap, .daily-wrap').forEach((el, i) => { el.scrollLeft = wraps[i] || 0; });
  } else window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render());
window.addEventListener('beforeunload', (e) => {
  if (hasUnsaved() || hasUnsavedDaily()) { e.preventDefault(); e.returnValue = ''; }
});
document.getElementById('resetDemo').addEventListener('click', () => {
  ask('デモデータを初期状態に戻します。よろしいですか？', '初期状態に戻す', () => {
    clearWork();
    clearDailyWork();
    reset();
    render();
    toast('デモデータを初期状態に戻しました');
  });
});

render();
