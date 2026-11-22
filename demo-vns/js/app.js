// 画面の切り替え（ハッシュ方式）とメニュー
import { load, reset, db, save, getTheme, uid, todayStr } from './store.js';
import { $, $$, esc, toast, closeModal } from './ui.js';
import { renderSchedule } from './schedule.js';
import { renderPatients, renderPatient } from './patients.js';
import { renderBilling } from './billing.js';
import { renderSettings } from './settings.js';

const MENU = [
  { route: 'schedule', label: '訪問スケジュール', en: 'SCHEDULE' },
  { route: 'patients', label: '利用者一覧', en: 'PATIENTS' },
  { route: 'new', label: '新規登録', en: 'NEW' },
  { route: 'billing', label: '請求', en: 'BILLING' },
  { route: 'settings', label: '設定', en: 'SETTINGS' },
];

function applyTheme() {
  const t = getTheme();
  document.documentElement.dataset.theme = t;
  if (t !== 'simple' && window.showcaseLoadFonts) window.showcaseLoadFonts();
}

function openMenu() { $('#drawer').hidden = false; $('#drawer-backdrop').hidden = false; }
function closeMenu() { $('#drawer').hidden = true; $('#drawer-backdrop').hidden = true; }

function renderMenu(active) {
  $('#drawer-items').innerHTML = MENU.map((m) => `
    <a class="drawer-item ${m.route === active ? 'on' : ''}" href="#/${m.route}">
      <b>${esc(m.label)}</b><small>${m.en}</small>
    </a>`).join('');
  $$('.drawer-item').forEach((a) => a.addEventListener('click', closeMenu));
}

export function setCrumb(text) { $('#crumb').textContent = text; }

function route() {
  closeModal();
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  const name = parts[0] || 'schedule';
  const view = $('#view');
  $('#brand-name').textContent = db().settings.office || '訪問看護ステーション';
  renderMenu(name === 'patient' ? 'patients' : name);
  window.scrollTo(0, 0);

  if (name === 'new') {
    // 空の利用者をつくって基本情報へ
    const p = {
      id: uid('p'), name: '', kana: '', sex: '', birth: '', disease: '', care: '', burden: '1割', insurance: '介護保険',
      address: '', tel: '', kp: '', kpTel: '', kpRel: '', hospital: '', doctor: '', cm: '', cmTel: '',
      orderStart: '', orderEnd: '', nextClinic: '', nextHomeVisit: '', caution: '', history: '', course: '',
      tasks: ['内服確認', '皮膚チェック'], week: {}, isNew: true, created: todayStr(),
    };
    db().patients.push(p);
    save();
    location.replace(`#/patient/${p.id}/info`);
    return;
  }
  if (name === 'patients') { setCrumb('利用者一覧'); renderPatients(view); return; }
  if (name === 'patient') { setCrumb('利用者一覧'); renderPatient(view, parts[1], parts[2] || 'record', parts[3]); return; }
  if (name === 'billing') { setCrumb('請求'); renderBilling(view); return; }
  if (name === 'settings') { setCrumb('設定'); renderSettings(view, applyTheme); return; }
  setCrumb('訪問スケジュール');
  renderSchedule(view);
}

load();
applyTheme();
$('#open-menu').addEventListener('click', openMenu);
$('#close-menu').addEventListener('click', closeMenu);
$('#drawer-backdrop').addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeModal(); } });
$('#reset-demo').addEventListener('click', () => {
  if (!confirm('デモデータを初期状態に戻します。よろしいですか？')) return;
  reset();
  toast('初期状態に戻しました');
  route();
});
window.addEventListener('hashchange', route);
export const rerender = route;
route();
