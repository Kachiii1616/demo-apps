// 画面共通の小さな部品
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// 要素の近くに小さな選択パネルを出す（スマホでは画面下に）
export function popover(anchor, html, onClick) {
  closePopover();
  const back = document.createElement('div');
  back.className = 'pop-backdrop';
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.innerHTML = html;
  document.body.append(back, pop);
  const r = anchor.getBoundingClientRect();
  if (window.innerWidth <= 760) pop.classList.add('sheet');
  else {
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(r.left, window.innerWidth - w - 10);
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 6);
    pop.style.left = Math.max(10, left) + 'px';
    pop.style.top = top + 'px';
  }
  back.addEventListener('click', closePopover);
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-val]');
    if (!b) return;
    onClick(b.dataset.val);
    closePopover();
  });
}
export function closePopover() {
  document.querySelectorAll('.pop, .pop-backdrop').forEach((n) => n.remove());
}

// モーダル。onSubmit が false を返したら閉じない
export function modal(title, bodyHtml, { okLabel = '保存', onSubmit, extraButtons = '' } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<form class="modal" novalidate>
    <h3>${esc(title)}</h3>
    <div class="modal-body">${bodyHtml}</div>
    <div class="actions">${extraButtons}<button type="button" class="btn" data-close>閉じる</button>
    ${onSubmit ? `<button type="submit" class="btn primary">${esc(okLabel)}</button>` : ''}</div>
  </form>`;
  document.body.append(back);
  const form = back.querySelector('form');
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (onSubmit && onSubmit(form) === false) return;
    close();
  });
  const first = form.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return { el: back, form, close };
}

export const icons = {
  wand: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20 15 9"/><path d="m14 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M19 12v2M18 13h2"/></svg>',
  save: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>',
  send: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 10 14"/><path d="M21 3 14 21l-4-7-7-4z"/></svg>',
  print: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  undo: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  left: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 5-7 7 7 7"/></svg>',
  right: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 5 7 7-7 7"/></svg>',
};

// 確認ダイアログ（ブラウザ標準の confirm の代わり）。OK のときだけ onOk を呼ぶ
export function ask(message, okLabel, onOk) {
  modal('確認', `<p style="margin:6px 0 0">${esc(message)}</p>`, { okLabel, onSubmit: () => { setTimeout(onOk, 0); } });
}
