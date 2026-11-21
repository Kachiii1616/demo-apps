import {
  load, persist, today, dateKey, DOW, dowOf, isClosed, workingOn, autoAssignDay,
  SLOTS, inShift, TASKS, TASK_CATS, taskById, monthKey, pad,
} from '../store.js';
import { esc, toast, popover, icons, ask } from '../ui.js';

const work = {}; // date -> { assign, dirty, auto }
const clone = (o) => JSON.parse(JSON.stringify(o));

export function renderDaily(view, { query, rerender }) {
  const data = load();
  const t = today();
  const date = query.get('date') || dateKey(t.y, t.m, t.d);
  const [y, m, d] = date.split('-').map(Number);
  const wd = dowOf(y, m, d);
  const people = workingOn(data, y, m, d);
  const mon = data.months[monthKey(y, m)];

  const empty = isClosed(data, y, m, d) || !people.length;
  if (!work[date] && !empty) {
    const saved = data.daily[date];
    work[date] = saved ? { assign: clone(saved.assign), dirty: false, auto: false } : { assign: autoAssignDay(data, y, m, d), dirty: true, auto: true };
  }
  const w = work[date] || { assign: {}, dirty: false, auto: false };

  const shift = (diff) => {
    const nd = new Date(y, m - 1, d + diff);
    location.hash = `#/daily?date=${dateKey(nd.getFullYear(), nd.getMonth() + 1, nd.getDate())}`;
  };

  const header = `
    <p class="lead">その日の出勤者（保存済みの月シフトから）に、時間ごとの業務を割り振ります。マスをタップすると業務を選べます。「自動で割り振る」は決まった型に当てはめるだけの簡単な処理です。</p>
    <div class="row no-print">
      <button class="btn small" id="prev" aria-label="前の日">${icons.left}</button>
      <input type="date" class="input" id="pickDate" value="${date}" aria-label="日付">
      <button class="btn small" id="next" aria-label="次の日">${icons.right}</button>
      <button class="btn small" id="todayBtn">今日</button>
      <b style="font-size:16px">${m}月${d}日（<span style="color:${wd === 0 ? 'var(--sun)' : wd === 6 ? 'var(--sat)' : 'inherit'}">${DOW[wd]}</span>）</b>
      ${empty ? '' : w.auto ? '<span class="badge draft">自動作成（未保存）</span>' : w.dirty ? '<span class="badge dirty">未保存の変更があります</span>' : data.daily[date] ? '<span class="badge saved">保存済み</span>' : ''}
    </div>`;

  if (empty) {
    view.innerHTML = header + `<div class="card" style="margin-top:14px;text-align:center;padding:40px 16px">
      <p style="margin:0 0 6px;font-size:15px">${isClosed(data, y, m, d) ? 'この日は休業日です。' : !mon ? 'この月の勤務表がまだありません。' : 'この日の出勤者がいません。'}</p>
      <p class="muted small" style="margin:0">${isClosed(data, y, m, d) ? '' : '月シフトで勤務を入れて保存すると、ここに出勤者が並びます。'}</p></div>`;
    bindNav();
    return;
  }

  const slotCount = (slot, cat) => people.filter((p) => taskById(w.assign[p.staff.id]?.[slot])?.cat === cat).length;
  const rows = SLOTS.map((slot) => {
    const tds = people.map((p) => {
      if (!inShift(p.type, slot)) return '<td class="slot off"></td>';
      const id = w.assign[p.staff.id]?.[slot];
      const task = taskById(id);
      const idx = SLOTS.indexOf(slot);
      const prev = idx > 0 && inShift(p.type, SLOTS[idx - 1]) ? w.assign[p.staff.id]?.[SLOTS[idx - 1]] : null;
      const cont = task && prev === id;
      const color = task ? TASK_CATS[task.cat].color : '#fff';
      return `<td class="slot ${cont ? 'cont' : ''}" style="--c:${color}" data-s="${p.staff.id}" data-t="${slot}" title="${esc(p.staff.name)} ${slot} ${task ? esc(task.label) : '未設定'}">${task ? esc(task.label) : '<span class="muted">＋</span>'}</td>`;
    }).join('');
    const floor = slotCount(slot, 'floor') + slotCount(slot, 'bath');
    const staffed = people.filter((p) => inShift(p.type, slot)).length;
    const hour = Number(slot.slice(0, 2));
    const low = hour >= 9 && hour < 16 && staffed > 0 && floor < 2;
    return `<tr><th class="time">${slot}</th>${tds}<td class="count ${low ? 'low' : ''}">${staffed ? `${floor}名` : ''}</td></tr>`;
  }).join('');

  const legend = Object.values(TASK_CATS).map((c) => `<span class="chip"><span class="swatch" style="background:${c.color}"></span>${c.label}</span>`).join('');
  const breaks = people.filter((p) => !Object.values(w.assign[p.staff.id] || {}).includes('t-rest') && p.code !== '短');

  view.innerHTML = header + `
    <div class="row no-print">
      <button class="btn outline" id="auto">${icons.wand}自動で割り振る</button>
      <button class="btn save" id="save" ${w.dirty ? '' : 'disabled'}>${icons.save}保存</button>
      <button class="btn blue" id="print">${icons.print}印刷</button>
    </div>
    <div class="card" style="margin-top:12px;padding:10px 14px">
      <div class="small"><b>${y}年${m}月${d}日（${DOW[wd]}）</b> ${esc(data.facility)} ・ 出勤 ${people.length}名：
      ${people.map((p) => `<span class="code" style="--c:${p.type.color};width:18px;height:18px;vertical-align:-3px">${esc(p.code)}</span> ${esc(p.staff.name)}`).join('　')}</div>
    </div>
    ${breaks.length ? `<div class="notice warn">休憩が入っていない人がいます：${breaks.map((p) => esc(p.staff.name)).join('、')}</div>` : ''}
    <div class="legend">${legend}<span class="chip">右端＝フロア・入浴の人数（9〜16時に2名未満で赤）</span></div>
    <div class="daily-wrap">
      <table class="daily">
        <thead><tr><th class="time">時刻</th>${people.map((p) => `<th>${esc(p.staff.name)}<small>${esc(p.type.name)} ${p.type.start}〜${p.type.end}</small><small>${esc(p.staff.role)}${p.staff.driver ? '・送迎可' : ''}</small></th>`).join('')}<th>フロア<small>人数</small></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  bindNav();

  view.querySelector('tbody').addEventListener('click', (e) => {
    const td = e.target.closest('td.slot:not(.off)');
    if (!td) return;
    const sid = td.dataset.s, slot = td.dataset.t;
    const p = people.find((x) => x.staff.id === sid);
    const cur = w.assign[sid]?.[slot];
    const list = TASKS.map((tk) => `<button type="button" class="opt ${tk.id === cur ? 'cur' : ''}" style="--c:${TASK_CATS[tk.cat].color}" data-val="${tk.id}">${esc(tk.label)}</button>`).join('');
    popover(td, `<h4>${esc(p.staff.name)} ・ ${slot}〜${nextSlot(slot)}</h4><div class="list">${list}<button type="button" class="opt clear" data-val="">空欄にする</button></div>`, (val) => {
      w.assign[sid] ||= {};
      if (val) w.assign[sid][slot] = val; else delete w.assign[sid][slot];
      w.dirty = true;
      rerender();
    });
  });
  view.querySelector('#auto').addEventListener('click', () => {
    const run = () => {
      w.assign = autoAssignDay(data, y, m, d);
      w.dirty = true;
      w.auto = true;
      rerender();
      toast('自動で割り振りました（未保存）');
    };
    if (w.auto) run(); else ask('いまの割り振りを消して、自動で割り振り直しますか？', '割り振り直す', run);
  });
  view.querySelector('#save').addEventListener('click', () => {
    data.daily[date] = { assign: clone(w.assign), savedAt: Date.now() };
    persist();
    w.dirty = false;
    w.auto = false;
    rerender();
    toast('保存しました');
  });
  view.querySelector('#print').addEventListener('click', () => window.print());

  function bindNav() {
    view.querySelector('#prev').addEventListener('click', () => shift(-1));
    view.querySelector('#next').addEventListener('click', () => shift(1));
    view.querySelector('#todayBtn').addEventListener('click', () => { location.hash = '#/daily'; });
    view.querySelector('#pickDate').addEventListener('change', (e) => { if (e.target.value) location.hash = `#/daily?date=${e.target.value}`; });
  }
}

function nextSlot(slot) {
  const [h, mm] = slot.split(':').map(Number);
  const t = h * 60 + mm + 30;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export const hasUnsavedDaily = () => Object.values(work).some((w) => w.dirty && !w.auto);
export const clearDailyWork = () => Object.keys(work).forEach((k) => delete work[k]);
