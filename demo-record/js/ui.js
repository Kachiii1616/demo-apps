// 画面どうしで共有する小さな道具（表示用の整形・トースト・モーダル・確認ダイアログ・画面状態）。
import { todayStr } from './data.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function jpDate(ds, withYear = true) {
  const [y, m, d] = ds.split('-').map(Number);
  const w = WD[new Date(y, m - 1, d).getDay()];
  return withYear ? `${y}年${m}月${d}日（${w}）` : `${m}/${d}（${w}）`;
}
export function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- 画面状態（ページをまたいで覚えておくもの） ----------
export const ui = {
  date: todayStr(), // 業務日誌・申し送り・連絡帳・利用者別介護記録で共有する日付
  person: null,
  homeCat: '様子',
  homeUid: '',
  vitalsUid: null,
  vitalsMetric: 'all',
  pMetric: 'all',
  pWeightRange: '6',
  contactUid: null,
  search: '',
};

// ---------- モーダル ----------
export function openModal(html, wire) {
  const modalEl = $('#modal');
  modalEl.innerHTML = html;
  modalEl.hidden = false;
  const form = modalEl.firstElementChild;
  wire?.(form);
  const first = form.querySelector('[data-autofocus]') || form.querySelector('input:not([type=hidden]):not([type=date]):not([type=time]), textarea');
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
