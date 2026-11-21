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
