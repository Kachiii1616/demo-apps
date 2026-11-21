// 枠つき入力表をつくる小道具（入力はその場で保存）
import { esc } from './ui.js';
import { save } from './store.js';

// def: { k, label, type, opts, w, ph }
export function fieldHtml(def, obj) {
  const v = obj[def.k];
  const w = def.w ? `w${def.w}` : '';
  let inner = '';
  switch (def.type) {
    case 'textarea':
      inner = `<textarea data-k="${def.k}" rows="${def.rows || 3}" placeholder="${esc(def.ph || '')}">${esc(v || '')}</textarea>`; break;
    case 'date':
      inner = `<input type="date" data-k="${def.k}" value="${esc(v || '')}">`; break;
    case 'radio':
      inner = def.opts.map((o) => `<label class="ck"><input type="radio" name="r-${def.k}" data-k="${def.k}" value="${esc(o)}" ${v === o ? 'checked' : ''}> ${esc(o)}</label>`).join(''); break;
    case 'checks': {
      const arr = Array.isArray(v) ? v : [];
      inner = def.opts.map((o) => `<label class="ck"><input type="checkbox" data-k="${def.k}" data-multi="1" value="${esc(o)}" ${arr.includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join(''); break;
    }
    case 'select':
      inner = `<select data-k="${def.k}"><option value=""></option>${def.opts.map((o) => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
    case 'static':
      inner = `<div>${esc(v || '')}</div>`; break;
    default:
      inner = `<input type="text" data-k="${def.k}" value="${esc(v || '')}" placeholder="${esc(def.ph || '')}">`;
  }
  return `<div class="fcell ${w}"><div class="fl">${esc(def.label)}</div><div class="fv">${inner}</div></div>`;
}

export function gridHtml(defs, obj) {
  return `<div class="fgrid">${defs.map((d) => (d.band ? `<div class="fband">${esc(d.band)}</div>` : fieldHtml(d, obj))).join('')}</div>`;
}

// root 内の data-k 入力を obj に結びつける
export function bindFields(root, obj, onChange) {
  root.querySelectorAll('[data-k]').forEach((el) => {
    const k = el.dataset.k;
    const handler = () => {
      if (el.dataset.multi) {
        obj[k] = Array.from(root.querySelectorAll(`[data-k="${k}"][data-multi]`)).filter((x) => x.checked).map((x) => x.value);
      } else if (el.type === 'radio') {
        if (el.checked) obj[k] = el.value;
      } else {
        obj[k] = el.value;
      }
      save();
      if (onChange) onChange(k);
    };
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox' || el.type === 'date' ? 'change' : 'input', handler);
  });
}
