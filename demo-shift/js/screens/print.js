import { load, today, monthKey, parseMonthKey, daysIn, dowOf, DOW, activeStaff, typeOf, isClosed, dayCounts } from '../store.js';
import { savedOrWorkCells } from './month.js';
import { esc, icons } from '../ui.js';

export function renderPrint(view, { args }) {
  const data = load();
  const t = today();
  const key = args[0] || monthKey(t.y, t.m);
  const [y, m] = parseMonthKey(key);
  const n = daysIn(y, m);
  const cells = savedOrWorkCells(data, key);
  const staff = activeStaff(data);
  const counts = dayCounts(data, y, m, cells);
  const mon = data.months[key];
  const wcls = (d) => { const w = dowOf(y, m, d); return w === 0 ? 'sun' : w === 6 ? 'sat' : ''; };

  const head1 = Array.from({ length: n }, (_, i) => `<th class="${wcls(i + 1)}">${i + 1}</th>`).join('');
  const head2 = Array.from({ length: n }, (_, i) => `<th class="${wcls(i + 1)}">${DOW[dowOf(y, m, i + 1)]}</th>`).join('');
  const body = staff.map((s) => {
    let w = 0, o = 0;
    const tds = Array.from({ length: n }, (_, i) => {
      const code = cells[s.id]?.[i + 1];
      const tp = code ? typeOf(data, code) : null;
      if (tp?.work) w++; else if (code) o++;
      return `<td class="c ${tp ? '' : wcls(i + 1)}" style="${tp && tp.work ? `background:${tp.color}` : ''}">${code ? esc(code) : ''}</td>`;
    }).join('');
    return `<tr><td class="nm">${esc(s.name)}</td>${tds}<td>${w}</td><td>${o}</td></tr>`;
  }).join('');
  const countRow = `<tr><th class="nm">出勤者数</th>${Array.from({ length: n }, (_, i) => `<td>${isClosed(data, y, m, i + 1) ? '' : counts[i + 1].total}</td>`).join('')}<td></td><td></td></tr>`;
  const legend = data.shiftTypes.map((tp) => `<span class="chip"><span class="code" style="--c:${tp.color};width:14px;height:14px;font-size:8px">${esc(tp.code)}</span>${esc(tp.name)}${tp.start ? ` ${tp.start}-${tp.end}` : ''}</span>`).join('');

  view.innerHTML = `
    <div class="row no-print" style="margin-bottom:12px">
      <a class="btn small" href="#/month?ym=${key}">${icons.left}月シフトへ戻る</a>
      <button class="btn primary" id="doPrint">${icons.print}印刷する</button>
      <span class="muted small">A4横・1枚に収まるように表示しています。${mon?.status === 'published' ? '' : '（まだ公開されていない勤務表です）'}</span>
    </div>
    <div class="print-page">
      <div class="print-head">
        <div><h1>${y}年${m}月 勤務表</h1><div class="small">${esc(data.facility)}</div></div>
        <div class="stamp"><div>管理者<span></span></div><div>作成者<span></span></div></div>
      </div>
      <table class="print-tbl">
        <colgroup><col class="nm">${'<col>'.repeat(n)}<col class="sm"><col class="sm"></colgroup>
        <thead><tr><th class="nm" rowspan="2">氏名</th>${head1}<th rowspan="2">出</th><th rowspan="2">休</th></tr><tr>${head2}</tr></thead>
        <tbody>${body}${countRow}</tbody>
      </table>
      <div class="print-foot">
        <div class="legend">${legend}</div>
        <div>印刷日 ${t.y}/${t.m}/${t.d}</div>
      </div>
    </div>`;
  view.querySelector('#doPrint').addEventListener('click', () => window.print());
}
