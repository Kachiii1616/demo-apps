import { load, persist, today, monthKey, parseMonthKey, addMonth, daysIn, dowOf, dateKey, DOW, isClosed, workingOn, activeStaff, typeOf } from '../store.js';
import { esc, toast, modal, icons } from '../ui.js';

const KIND = { event: '行事', meeting: '会議', training: '研修' };
const show = { shift: true, event: true };

export function renderCalendar(view, { query, rerender }) {
  const data = load();
  const t = today();
  const key = query.get('ym') || monthKey(t.y, t.m);
  const [y, m] = parseMonthKey(key);
  const [py, pm] = addMonth(y, m, -1);
  const [ny, nm] = addMonth(y, m, 1);
  const mon = data.months[key];
  const first = dowOf(y, m, 1);
  const n = daysIn(y, m);
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const evOf = (d) => data.events.filter((e) => e.date === dateKey(y, m, d)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const dayHtml = (d) => {
    if (!d) return '<div class="day other"></div>';
    const wd = dowOf(y, m, d);
    const cls = ['day', wd === 0 ? 'sun' : '', wd === 6 ? 'sat' : '', y === t.y && m === t.m && d === t.d ? 'today' : ''].join(' ');
    let inner = '';
    if (show.event) inner += evOf(d).map((e) => `<div class="ev ${e.kind}" title="${esc(e.time)} ${esc(e.title)}">★<span class="ev-text"> ${e.time ? esc(e.time) + ' ' : ''}${esc(e.title)}</span></div>`).join('');
    if (show.shift) {
      if (isClosed(data, y, m, d)) inner += '<div class="closed-label">休業日</div>';
      else {
        const ppl = workingOn(data, y, m, d);
        const max = 4;
        inner += ppl.slice(0, max).map((p) => `<div class="sh"><span class="code" style="--c:${p.type.color}">${esc(p.code)}</span><span class="nm">${esc(p.staff.name.split(' ')[0])}</span></div>`).join('');
        if (ppl.length > max) inner += `<div class="more"><span class="more-long">他${ppl.length - max}名（計${ppl.length}名）</span><span class="more-short">+${ppl.length - max}</span></div>`;
      }
    }
    return `<div class="${cls}" data-d="${d}" role="button" tabindex="0" aria-label="${m}月${d}日"><span class="num">${d}</span>${inner}</div>`;
  };

  view.innerHTML = `
    <p class="lead">月シフト（保存済み）と行事・会議・研修を1つのカレンダーに重ねて表示します。日付をタップすると、その日の出勤者の一覧と予定の追加ができます。</p>
    <div class="row">
      <button class="btn small" data-nav="${monthKey(py, pm)}" aria-label="前の月">${icons.left}</button>
      <button class="btn small" data-nav="${monthKey(t.y, t.m)}">今月</button>
      <button class="btn small" data-nav="${monthKey(ny, nm)}" aria-label="次の月">${icons.right}</button>
      <b style="font-size:17px">${y}年${m}月</b>
      ${mon ? `<span class="badge ${mon.status}">${{ draft: '勤務表 作成中', saved: '勤務表 保存済み', published: '勤務表 公開済み' }[mon.status]}</span>` : '<span class="badge draft">勤務表 未作成</span>'}
      <span class="spacer"></span>
      <label class="small"><input type="checkbox" id="tShift" ${show.shift ? 'checked' : ''}> シフト</label>
      <label class="small"><input type="checkbox" id="tEvent" ${show.event ? 'checked' : ''}> 行事・予定</label>
      <button class="btn outline small" id="addEv">${icons.plus}予定を追加</button>
    </div>
    <div class="legend">
      ${data.shiftTypes.filter((tp) => tp.work).map((tp) => `<span class="chip"><span class="code" style="--c:${tp.color}">${esc(tp.code)}</span>${esc(tp.name)}</span>`).join('')}
      <span class="chip"><span class="swatch" style="background:var(--coral-soft);margin-left:4px"></span>行事</span>
      <span class="chip"><span class="swatch" style="background:var(--blue-soft);margin-left:4px"></span>会議</span>
      <span class="chip"><span class="swatch" style="background:var(--mint-soft);margin-left:4px"></span>研修</span>
    </div>
    <div class="card" style="padding:10px">
      <div class="cal">
        ${DOW.map((w, i) => `<div class="dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</div>`).join('')}
        ${cells.map(dayHtml).join('')}
      </div>
    </div>`;

  view.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/calendar?ym=${b.dataset.nav}`; }));
  view.querySelector('#tShift').addEventListener('change', (e) => { show.shift = e.target.checked; rerender(); });
  view.querySelector('#tEvent').addEventListener('change', (e) => { show.event = e.target.checked; rerender(); });
  view.querySelector('#addEv').addEventListener('click', () => openEventForm(dateKey(y, m, Math.min(t.d, n))));
  const open = (el) => { if (el?.dataset.d) openDay(Number(el.dataset.d)); };
  view.querySelector('.cal').addEventListener('click', (e) => open(e.target.closest('.day[data-d]')));
  view.querySelector('.cal').addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e.target.closest('.day[data-d]')); });

  function openEventForm(date) {
    modal('予定を追加', `
      <div class="form-grid">
        <div><label class="field" for="eDate">日付</label><input type="date" class="input" id="eDate" value="${date}" required></div>
        <div><label class="field" for="eTime">時刻</label><input type="time" class="input" id="eTime" value="14:00"></div>
        <div class="full"><label class="field" for="eTitle">内容</label><input class="input" id="eTitle" placeholder="例：お花見ドライブ" required></div>
        <div class="full"><label class="field">種類</label><div class="chips">${Object.entries(KIND).map(([k, v], i) => `<label class="chip-btn"><input type="radio" name="eKind" value="${k}" ${i === 0 ? 'checked' : ''}> ${v}</label>`).join('')}</div></div>
      </div>`, {
      okLabel: '追加',
      onSubmit: (f) => {
        const title = f.querySelector('#eTitle').value.trim();
        const dt = f.querySelector('#eDate').value;
        if (!title || !dt) { toast('日付と内容を入れてください'); return false; }
        data.events.push({ id: 'ev-' + Math.random().toString(36).slice(2, 9), date: dt, time: f.querySelector('#eTime').value, title, kind: f.querySelector('input[name=eKind]:checked').value });
        persist();
        toast('予定を追加しました');
        if (dt.slice(0, 7) !== key) location.hash = `#/calendar?ym=${dt.slice(0, 7)}`; else rerender();
      },
    });
  }

  function openDay(d) {
    const wd = dowOf(y, m, d);
    const ppl = workingOn(data, y, m, d);
    const offs = activeStaff(data).filter((s) => !ppl.some((p) => p.staff.id === s.id)).map((s) => ({ s, code: mon?.cells[s.id]?.[d] }));
    const evs = evOf(d);
    const md = modal(`${m}月${d}日（${DOW[wd]}）`, `
      <h4 style="margin:8px 0 4px;font-size:13px">出勤者（${ppl.length}名）</h4>
      ${isClosed(data, y, m, d) ? '<p class="muted small">休業日です。</p>' : ppl.length ? `<table class="tbl"><tbody>${ppl.map((p) => `<tr><td style="width:30px"><span class="code" style="--c:${p.type.color}">${esc(p.code)}</span></td><td>${esc(p.staff.name)}<span class="muted small">　${esc(p.staff.role)}</span></td><td class="small" style="white-space:nowrap">${p.type.start}〜${p.type.end}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">勤務表がまだありません。</p>'}
      ${offs.length && ppl.length ? `<p class="small muted" style="margin:6px 0 0">お休み：${offs.map(({ s, code }) => `${esc(s.name)}${code && typeOf(data, code) ? `（${esc(typeOf(data, code).name)}）` : ''}`).join('、')}</p>` : ''}
      <h4 style="margin:14px 0 4px;font-size:13px">行事・予定</h4>
      ${evs.length ? evs.map((e) => `<div class="row" style="margin:4px 0"><span class="badge ${e.kind === 'meeting' ? 'saved' : e.kind === 'training' ? 'published' : 'dirty'}">${KIND[e.kind]}</span><span class="small">${esc(e.time)}</span><span>${esc(e.title)}</span><span class="spacer"></span><button type="button" class="btn small danger" data-del="${e.id}">削除</button></div>`).join('') : '<p class="muted small">予定はありません。</p>'}
      ${ppl.length ? `<p style="margin-top:12px"><a href="#/daily?date=${dateKey(y, m, d)}" data-close>この日の業務分担表をひらく →</a></p>` : ''}`,
    { extraButtons: '<button type="button" class="btn outline" data-add>予定を追加</button>' });
    md.el.querySelector('[data-add]').addEventListener('click', () => { md.close(); openEventForm(dateKey(y, m, d)); });
    md.el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      data.events = data.events.filter((e) => e.id !== b.dataset.del);
      persist();
      md.close();
      rerender();
      toast('予定を削除しました');
    }));
  }
}
