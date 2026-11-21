// 訪問スケジュール（職員ごとの列 × 30分刻み）
import { db, save, todayStr, addDays, parseYmd, ymd, longDate, md, toMin, hhmm, uid, staffById, patientById, kindOfStaff, actualOf, WD } from './store.js';
import { $, $$, esc, toast, openModal, closeModal, setTopActions, opt } from './ui.js';

const sv = { date: null, mode: 'day', show: { '看護': true, 'リハビリ': true }, staffFilter: '' };
const SLOT_H = 45; // 30分の高さ
const PX = SLOT_H / 30;

const roleTag = (s) => (s.role === 'リハビリ職' ? 'リハビリ職' : '看護師');
const shortTag = (kind) => (kind === 'リハビリ' ? 'リハ' : '看護');

function weekStart(d) {
  const dt = parseYmd(d);
  const wd = (dt.getDay() + 6) % 7; // 月曜はじまり
  dt.setDate(dt.getDate() - wd);
  return ymd(dt);
}

export function renderSchedule(view) {
  if (!sv.date) sv.date = todayStr();
  const s = db().settings;
  const day = sv.mode === 'day';
  setTopActions([{ label: '訪問スケジュール表として印刷', onClick: () => window.print() }]);

  const visibleStaff = db().staff.filter((st) => sv.show[kindOfStaff(st.id)] && (day || !sv.staffFilter || sv.staffFilter === st.id));
  const days = day ? [sv.date] : Array.from({ length: 7 }, (_, i) => addDays(weekStart(sv.date), i));
  const plans = db().plans.filter((v) => days.includes(v.date) && sv.show[v.kind] && visibleStaff.some((st) => st.id === v.staffId));
  const recs = db().records.filter((r) => days.includes(r.date) && sv.show[r.kind] && visibleStaff.some((st) => st.id === r.staffId));
  const done = plans.filter((v) => actualOf(v)).length;
  const range = day ? longDate(sv.date) : `${longDate(days[0])}〜${md(days[6])}`;

  view.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">SCHEDULE</div><h1>訪問スケジュール</h1></div>
      <div class="head-tools no-print">
        <button type="button" class="pill mint" id="add-visit">＋ 訪問を登録</button>
        <button type="button" class="pill" id="prev">← ${day ? '前日' : '前週'}</button>
        <button type="button" class="pill" id="today">${day ? '今日' : '今週'}</button>
        <button type="button" class="pill" id="next">${day ? '翌日' : '翌週'} →</button>
        <input type="date" id="pick" value="${sv.date}" aria-label="日付">
      </div>
    </div>
    <div class="sched-tools no-print">
      <div class="chips">
        <button type="button" class="chip ${day ? 'on' : ''}" data-mode="day">1日</button>
        <button type="button" class="chip ${day ? '' : 'on'}" data-mode="week">週間</button>
      </div>
      <div class="chips"><span class="small muted">表示</span>
        ${['看護', 'リハビリ'].map((k) => `<button type="button" class="chip ${sv.show[k] ? 'on' : ''}" data-kind="${k}">${sv.show[k] ? '✓ ' : ''}${k}</button>`).join('')}
      </div>
    </div>
    <hr class="soft">
    <div class="sched-sum">${range}　予定 ${plans.length}件 ／ 実績 ${day ? recs.length : recs.length}件 ／ 未実施 ${plans.length - done}件
      ${day ? '' : `<span class="no-print">　スタッフ <select id="staff-filter">${opt('', '全員', sv.staffFilter)}${db().staff.map((st) => opt(st.id, `${st.name}（${st.role}）`, sv.staffFilter)).join('')}</select></span>`}
    </div>
    <p class="help no-print">空いている欄をタップすると、その日時で訪問を登録できます。看護／リハビリの表示は、設定で登録したスタッフの職種で切り替わります。実績は訪問看護記録の滞在時間から自動で入ります。${day ? '' : '日付をタップすると、その日の表示に移ります。'}</p>
    ${visibleStaff.length ? gridHtml(days, visibleStaff, plans, recs, s, day) : '<div class="panel">表示するスタッフがいません。「看護」「リハビリ」の表示を確かめてください。</div>'}
  `;

  // 操作
  $('#add-visit').onclick = () => visitModal({ date: sv.date });
  $('#prev').onclick = () => { sv.date = addDays(sv.date, day ? -1 : -7); renderSchedule(view); };
  $('#next').onclick = () => { sv.date = addDays(sv.date, day ? 1 : 7); renderSchedule(view); };
  $('#today').onclick = () => { sv.date = todayStr(); renderSchedule(view); };
  $('#pick').onchange = (e) => { if (e.target.value) { sv.date = e.target.value; renderSchedule(view); } };
  $$('[data-mode]', view).forEach((b) => { b.onclick = () => { sv.mode = b.dataset.mode; renderSchedule(view); }; });
  $$('[data-kind]', view).forEach((b) => { b.onclick = () => { sv.show[b.dataset.kind] = !sv.show[b.dataset.kind]; renderSchedule(view); }; });
  const sf = $('#staff-filter'); if (sf) sf.onchange = () => { sv.staffFilter = sf.value; renderSchedule(view); };
  $$('.daylink', view).forEach((h) => { h.onclick = () => { sv.date = h.dataset.date; sv.mode = 'day'; renderSchedule(view); }; });
  $$('.slot:not(.ro)', view).forEach((c) => {
    c.onclick = () => visitModal({ date: c.dataset.date, staffId: c.dataset.staff, start: c.dataset.start });
  });
  $$('.vname', view).forEach((a) => { a.onclick = (e) => { e.stopPropagation(); location.hash = `#/patient/${a.dataset.pid}/record`; }; });
  $$('.vx', view).forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const v = db().plans.find((x) => x.id === b.dataset.id);
      if (!v) return;
      if (!confirm(`${md(v.date)} ${v.start}〜 ${patientById(v.patientId)?.name || ''} 様の予定を削除しますか？`)) return;
      db().plans = db().plans.filter((x) => x.id !== v.id);
      save(); toast('予定を削除しました'); renderSchedule(view);
    };
  });

  // 最初は朝の時間帯が見えるように
  const wrap = $('.sched-wrap', view);
  if (wrap) {
    wrap.scrollTop = 0;
    const th = $('.hcell.today.daylink', wrap);
    wrap.scrollLeft = th ? Math.max(0, th.offsetLeft - 64) : 0;
  }

  function visitModal(pre) {
    const st = pre.staffId || db().staff[0]?.id;
    const start = pre.start || '10:00';
    const end = hhmm(toMin(start) + 30);
    openModal(`
      <h2>訪問を登録</h2>
      <form id="vf">
        <label class="fld">利用者<select name="pid" required>${db().patients.filter((p) => p.name).map((p) => opt(p.id, p.name)).join('')}</select></label>
        <label class="fld">訪問日<input type="date" name="date" value="${pre.date}" required></label>
        <label class="fld">訪問者<select name="staff">${db().staff.map((x) => opt(x.id, `${x.name}（${x.role}）`, st)).join('')}</select></label>
        <div class="row2">
          <label class="fld">開始<input type="time" name="start" value="${start}" step="300" required></label>
          <label class="fld">終了<input type="time" name="end" value="${end}" step="300" required></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="pill" id="vf-cancel">閉じる</button>
          <button type="submit" class="pill mint">登録する</button>
        </div>
      </form>`, (m) => {
      $('#vf-cancel', m).onclick = closeModal;
      $('#vf', m).onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const a = String(f.get('start')), b = String(f.get('end'));
        if (toMin(b) <= toMin(a)) { toast('終了は開始より後にしてください'); return; }
        const staffId = String(f.get('staff'));
        db().plans.push({ id: uid('v'), date: String(f.get('date')), staffId, patientId: String(f.get('pid')), start: hhmm(toMin(a)), end: hhmm(toMin(b)), kind: kindOfStaff(staffId) });
        save(); closeModal(); toast('訪問を登録しました');
        sv.date = String(f.get('date'));
        renderSchedule(view);
      };
    });
  }
}

function gridHtml(days, staff, plans, recs, s, day) {
  const startM = s.startHour * 60;
  const endM = s.endHour * 60;
  const nSlots = Math.max(1, (endM - startM) / 30);
  const T = todayStr();
  const colW = day ? 112 : 96;
  const colsPerStaff = day ? 2 : 1;
  const totalCols = days.length * staff.length * colsPerStaff;
  const tpl = day ? `64px repeat(${totalCols}, minmax(${colW}px, 1fr))` : `64px repeat(${totalCols}, ${colW}px)`;
  const minW = 64 + totalCols * colW;
  const topOf = (t) => (toMin(t) - startM) * PX;
  const hOf = (a, b) => Math.max((toMin(b) - toMin(a)) * PX - 3, 38);

  let head1 = `<div class="hcell corner" style="grid-row: span ${day ? 1 : 1}"></div>`;
  let head2 = `<div class="hcell sub corner">時刻</div>`;
  if (day) {
    staff.forEach((st) => {
      head1 += `<div class="hcell" style="grid-column: span 2">${esc(st.name)} <span class="tag-box">${roleTag(st)}</span></div>`;
      head2 += `<div class="hcell sub">予定</div><div class="hcell sub">実績</div>`;
    });
  } else {
    days.forEach((d) => {
      const n = plans.filter((v) => v.date === d).length;
      head1 += `<div class="hcell daylink ${d === T ? 'today' : ''}" data-date="${d}" style="grid-column: span ${staff.length}" title="この日の表示へ">${md(d)} <span class="small muted">${n}件</span></div>`;
      staff.forEach((st) => { head2 += `<div class="hcell sub ${d === T ? 'today' : ''}">${esc(st.name)}${st.role === 'リハビリ職' ? ' <span class="tag-box">リハ</span>' : ''}</div>`; });
    });
  }

  let tcol = '<div class="tcol">';
  for (let h = s.startHour; h < s.endHour; h++) tcol += `<div class="tlabel">${h}:00</div>`;
  tcol += '</div>';

  const slotsHtml = (d, st, ro) => {
    let out = '';
    for (let i = 0; i < nSlots; i++) {
      const t = hhmm(startM + i * 30);
      out += `<div class="slot ${ro ? 'ro' : ''}" data-date="${d}" data-staff="${st.id}" data-start="${t}">${ro ? '' : '＋'}</div>`;
    }
    return out;
  };

  const planCard = (v) => {
    const p = patientById(v.patientId);
    const a = actualOf(v);
    const name = p ? p.name : '（削除された利用者）';
    if (day) {
      return `<div class="vcard ${v.kind === 'リハビリ' ? 'rehab' : ''}" style="top:${topOf(v.start)}px;height:${hOf(v.start, v.end)}px">
        <div class="vtop"><span>${v.start.replace(/^0/, '')}–${v.end.replace(/^0/, '')}</span><span class="tag-box">${shortTag(v.kind)}</span><button type="button" class="vx" data-id="${v.id}" aria-label="予定を削除">×</button></div>
        <div><span class="vname" data-pid="${v.patientId}">${esc(name)}</span>${a ? '<span class="done">済</span>' : ''}</div>
      </div>`;
    }
    return `<div class="vcard ${v.kind === 'リハビリ' ? 'rehab' : ''}" style="top:${topOf(v.start)}px;height:${hOf(v.start, v.end)}px">
      <div class="vtop">${a ? '<span class="done-box">済</span>' : ''}<span class="vname" data-pid="${v.patientId}">${esc(name.split(' ')[0])}</span><button type="button" class="vx" data-id="${v.id}" aria-label="予定を削除">×</button></div>
      <div>${v.start.replace(/^0/, '')}–${v.end.replace(/^0/, '')}</div>
    </div>`;
  };

  const actualCard = (r, plan) => {
    const p = patientById(r.patientId);
    const diff = plan ? toMin(r.start) - toMin(plan.start) : 0;
    const name = p ? p.name : '';
    if (day) {
      return `<div class="vcard actual" style="top:${topOf(r.start)}px;height:${hOf(r.start, r.end)}px">
        <div class="vtop"><span>${r.start.replace(/^0/, '')}–${r.end.replace(/^0/, '')}</span><span class="tag-box">${shortTag(r.kind)}</span></div>
        <div><span class="vname" data-pid="${r.patientId}">${esc(name)}</span>${diff ? `<span class="late">${diff > 0 ? '+' : ''}${diff}分</span>` : ''}</div>
      </div>`;
    }
    return `<div class="vcard actual" style="top:${topOf(r.start)}px;height:${hOf(r.start, r.end)}px">
      <div class="vtop"><span class="vname" data-pid="${r.patientId}">${esc(name)}</span></div>
      <div>${r.start.replace(/^0/, '')}–${r.end.replace(/^0/, '')} 実績</div>
    </div>`;
  };

  let body = '';
  days.forEach((d, di) => {
    staff.forEach((st, si) => {
      const myPlans = plans.filter((v) => v.date === d && v.staffId === st.id);
      const myRecs = recs.filter((r) => r.date === d && r.staffId === st.id);
      const lastOfDay = !day && si === staff.length - 1;
      if (day) {
        body += `<div class="col">${slotsHtml(d, st, false)}${myPlans.map(planCard).join('')}</div>`;
        body += `<div class="col staff-end">${slotsHtml(d, st, true)}${myRecs.map((r) => actualCard(r, myPlans.find((v) => v.patientId === r.patientId))).join('')}</div>`;
      } else {
        const orphan = myRecs.filter((r) => !myPlans.some((v) => v.patientId === r.patientId));
        body += `<div class="col ${lastOfDay ? 'staff-end' : ''}">${slotsHtml(d, st, false)}${myPlans.map(planCard).join('')}${orphan.map((r) => actualCard(r, null)).join('')}</div>`;
      }
      void di;
    });
  });

  return `<div class="sched-wrap"><div class="sched" style="grid-template-columns:${tpl};min-width:${minW}px">${head1}${head2}${tcol}${body}</div></div>`;
}

// 他の画面から「週間」で開く
export function showScheduleWeek(date) {
  sv.date = date;
  sv.mode = 'week';
  sv.staffFilter = '';
  location.hash = '#/schedule';
}

export { WD };
