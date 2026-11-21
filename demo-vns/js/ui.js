// 画面共通の小道具
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let toastTimer = null;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function openModal(html, onMount) {
  const wrap = $('#modal');
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  wrap.hidden = false;
  wrap.onclick = (e) => { if (e.target === wrap) closeModal(); };
  if (onMount) onMount(wrap.firstElementChild);
  const first = wrap.querySelector('input, select, textarea');
  if (first) first.focus();
}
export function closeModal() {
  const wrap = $('#modal');
  wrap.hidden = true;
  wrap.innerHTML = '';
}

// 右上のボタン（印刷など）
export function setTopActions(items) {
  const box = $('#top-actions');
  box.innerHTML = items.map((it, i) => `<button type="button" class="pill-sm ${it.mint ? 'mint' : ''}" data-i="${i}">${esc(it.label)}</button>`).join('');
  $$('button', box).forEach((b) => { b.onclick = () => items[Number(b.dataset.i)].onClick(); });
}
export const printAction = (label = 'この画面を印刷') => ({ label, onClick: () => window.print() });

export function downloadCsv(name, rows) {
  const text = rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export const yen = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;
export const opt = (value, label, sel) => `<option value="${esc(value)}" ${String(value) === String(sel) ? 'selected' : ''}>${esc(label ?? value)}</option>`;
