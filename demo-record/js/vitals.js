// バイタル系の画面：VS経過表・体重管理・水分バランス・食事摂取量・運動（通所ページの上部タブ）。
import { MEMBERS, MEAL_KINDS, EXERCISES, EX_MINUTES, todayStr, addDays, weekdayOf } from './data.js';
import * as store from './store.js';
import { esc, jpDate, toast, confirmDialog, ui, deco, scriptTitle, plainTitle, subtabs, DAY_TABS, weekdayButtons, memberCards } from './ui.js';
import { member, staffName, membersOnWeekday, byKana, rosterFor, drinksOf, excrOf, lastStoolLabel, vsOut } from './model.js';
import { vsRows, vsChart, weightChart, setCurrent, openVsForm, openWeightForm, openExcrForm, openMealForm, windowDays, removeRow } from './person.js';

const backLink = (href) => `<a href="${href}" class="back-link no-print">← 利用者一覧へ</a>`;
const flowerCard = (inner, cls = '') => `<section class="card p-card ${cls}">${deco}${inner}</section>`;
const listPicker = (title, href, note) => {
  const q = ui.search.trim();
  const list = q ? MEMBERS.filter((m) => m.name.includes(q) || m.kana.includes(q)).sort(byKana) : membersOnWeekday(ui.weekday);
  return flowerCard(`<p class="hint-top">${note}</p>
    ${weekdayButtons(ui.weekday)}
    <input class="search" type="search" data-search placeholder="🔍 お名前で検索（${title}）" value="${esc(ui.search)}">
    ${memberCards(list, href)}`);
};
const indivSelect = (base, uid) => `<label class="f-inline">利用者</label><select class="input round w-sel2" data-jump-member="${base}" aria-label="利用者を選ぶ"><option value="">選んでください</option>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}" ${m.id === uid ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`;
const seg = (base, view) => `<div class="seg"><a class="${view === 'week' ? 'on' : ''}" href="${base}">曜日入力</a><a class="${view === 'indiv' ? 'on' : ''}" href="${base}?view=indiv">個別経過表</a></div>`;
const rowActs = (kind, id) => `<button type="button" class="btn xs" data-v-edit="${kind}" data-id="${id}">編集</button><button type="button" class="btn xs red-t" data-v-del="${kind}" data-id="${id}">取消</button>`;

// =====================================================================
//  VS経過表
// =====================================================================
export function vsDetail(uid) {
  setCurrent(uid);
  const months = Number(ui.vsRange || 1);
  const rows = vsRows(uid, windowDays(todayStr(), months * 31));
  const metrics = [['all', '全て'], ['temp', '体温'], ['bp', '血圧'], ['pulse', '脈拍'], ['spo2', 'SpO2']];
  return flowerCard(`
    <div class="d-head"><h2 class="d-name">${esc(member(uid).name)}</h2><span class="sp"></span>
      <select class="input round w-sel" data-vs-range aria-label="期間">${[['1', '1ヶ月'], ['3', '3ヶ月'], ['6', '6ヶ月']].map(([v, l]) => `<option value="${v}" ${String(months) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="btn sm" data-print>🖨 印刷</button></div>
    <div class="chips mb10 no-print">${metrics.map(([k, l]) => `<button type="button" class="chip ${ui.pMetric === k ? 'on' : ''}" data-p-metric="${k}">${l}</button>`).join('')}</div>
    ${vsChart(rows)}
    <div class="grid-table-wrap"><table class="grid-table">
      <thead><tr><th>日付</th><th>時刻</th><th>体温<small>℃</small></th><th>血圧<small>mmHg</small></th><th>脈拍<small>回/分</small></th><th>SpO2<small>%</small></th><th>メモ</th><th class="no-print"></th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td><b>${jpDate(r.date, false)}</b></td><td><b>${r.time || '—'}</b></td>
        <td class="${r.temp && vsOut.temp(r.temp) ? 'vs-out' : ''}"><b>${r.temp ?? '—'}</b></td><td class="${r.bpHi && vsOut.bp(r.bpHi, r.bpLo) ? 'vs-out' : ''}"><b>${r.bpHi ? `${r.bpHi}/${r.bpLo ?? '-'}` : '—'}</b></td>
        <td><b>${r.pulse ?? '—'}</b></td><td class="${r.spo2 && vsOut.spo2(r.spo2) ? 'vs-out' : ''}"><b>${r.spo2 ?? '—'}</b></td>
        <td class="memo">${r.memo ? esc(r.memo) + ' ' : ''}<span class="muted">入力: ${esc(staffName(r.staff) || '—')}</span></td>
        <td class="acts no-print">${rowActs(r.kind, r.id)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">この期間の記録はありません</td></tr>'}</tbody>
    </table></div>
    <button type="button" class="btn big-grad no-print" data-v-new="vs" data-uid="${uid}">＋ 新規登録</button>`);
}
export function renderVitals(q) {
  const uid = q.get('u');
  const head = `${subtabs(DAY_TABS, '#/day/vitals')}${scriptTitle('Vital Signs', 'VS経過表', '利用者さんの体温・血圧・脈拍・SpO2 を記録して、経過表で確認できます')}`;
  if (uid && member(uid)) return `${head}${backLink('#/day/vitals')}${vsDetail(uid)}`;
  return head + listPicker('通所の全利用者から', (m) => `#/day/vitals?u=${m.id}`, '曜日ごとの通所の利用者さんです（五十音順）。名前を押すと<b>経過表</b>が開きます。 リストにない方はお名前で検索してください。');
}

// =====================================================================
//  体重管理
// =====================================================================
export function weightDetail(uid) {
  setCurrent(uid);
  const range = ui.pWeightRange;
  const all = store.list('weights').filter((w) => w.uid === uid).sort((a, b) => a.date.localeCompare(b.date));
  const from = range === 'all' ? '0000' : addDays(todayStr(), -Number(range) * 31);
  const list = all.filter((w) => w.date >= from);
  return flowerCard(`
    <div class="d-head"><h2 class="d-name">${esc(member(uid).name)}</h2><span class="sp"></span>
      <select class="input round w-sel" data-p-range aria-label="期間">${[['3', '3ヶ月'], ['6', '6ヶ月'], ['12', '1年'], ['all', '全期間']].map(([v, l]) => `<option value="${v}" ${range === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="btn sm" data-print>🖨 印刷</button></div>
    ${weightChart(list, true)}
    <button type="button" class="btn big-grad no-print" data-v-new="weight" data-uid="${uid}">＋ 新規登録</button>`)
  + flowerCard(`<h3 class="h3">記録一覧（新しい順）</h3>
    <div class="rec-list">${all.slice().reverse().map((w) => `<div class="rec-row"><span class="muted">${jpDate(w.date)}</span><b class="big">${w.kg.toFixed(1)} kg</b><span class="sp"></span><span class="muted small">入力: ${esc(staffName(w.staff) || '—')}</span>${rowActs('weight', w.id)}</div>`).join('') || '<p class="empty">記録はありません</p>'}</div>`);
}
export function renderWeight(q) {
  const uid = q.get('u');
  const head = `${subtabs(DAY_TABS, '#/day/weight')}${scriptTitle('Weight', '体重管理', '利用者さんの体重を記録して、グラフで確認できます')}`;
  if (uid && member(uid)) return `${head}${backLink('#/day/weight')}${weightDetail(uid)}`;
  return head + listPicker('全利用者から', (m) => `#/day/weight?u=${m.id}`, '曜日ごとの通所利用者さんです（五十音順）。名前を押すと<b>記録表</b>が開きます。 リストにない方はお名前で検索してください。');
}

// =====================================================================
//  水分バランス
// =====================================================================
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
export function waterIndiv(uid) {
  if (!uid) return flowerCard(`<div class="row">${indivSelect('#/day/water?view=indiv&u=', uid)}</div><p class="empty">利用者を選ぶと、2週間の経過が表示されます。</p>`);
  setCurrent(uid);
  const days = windowDays(todayStr(), 14).reverse();
  return flowerCard(`<div class="d-head"><h2 class="d-name">${esc(member(uid).name)}</h2><span class="sp"></span>${location.hash.startsWith('#/person') ? '' : indivSelect('#/day/water?view=indiv&u=', uid)}<button type="button" class="btn sm" data-print>🖨 印刷</button></div>
    <div class="grid-table-wrap"><table class="grid-table left">
      <thead><tr><th>日付</th><th>飲水量</th><th>尿</th><th>便</th><th>最終排便</th></tr></thead>
      <tbody>${days.map((d) => { const ls = lastStoolLabel(uid, d); const w = drinksOf(uid, d).reduce((s, x) => s + x.ml, 0); return `<tr><td>${jpDate(d, false)}</td><td>${w ? `${w} ml` : '—'}</td><td>${excrOf(uid, d, '尿').length || '—'}</td><td>${excrOf(uid, d, '便').length || '—'}</td><td class="${ls.warn ? 'vs-out' : ''}">${ls.text}</td></tr>`; }).join('')}</tbody>
    </table></div>`);
}
export function renderWater(q) {
  const view = q.get('view') === 'indiv' ? 'indiv' : 'week';
  const head = `${subtabs(DAY_TABS, '#/day/water')}${scriptTitle('Hydration', '水分バランス', '利用者さんの尿・便を記録して、経過を確認できます')}${seg('#/day/water', view)}`;
  if (view === 'indiv') return head + waterIndiv(q.get('u'));
  const date = ui.date;
  const rows = rosterFor(date);
  const events = store.list('excr').filter((x) => x.date === date).sort((a, b) => b.time.localeCompare(a.time));
  return `${head}${flowerCard(`
    <p class="hint-top"><b class="ink">${jpDate(date)}</b> の記録です。表のマスを押すと、その時間帯の尿・便を登録できます。 登録済みの記録を押すと取り消せます。</p>
    ${weekdayButtons(weekdayOf(date))}
    <div class="row mt10"><input type="date" class="input round w-date big" data-date-pick value="${date}" max="${todayStr()}" aria-label="日付">
      ${['尿', '便'].map((t) => `<button type="button" class="round-pill ${ui.excrType === t ? 'on' : ''}" data-excr-type="${t}">${t}</button>`).join('')}
      <span class="sp"></span><button type="button" class="btn sm" data-print>🖨 印刷</button></div>
    <div class="grid-table-wrap mt10"><table class="hour-table">
      <thead><tr><th>利用者名</th>${HOURS.map((h) => `<th>${h}:00</th>`).join('')}<th>合計</th><th>最終排便</th><th>業務日誌</th></tr></thead>
      <tbody>${rows.map((m) => {
        const xs = excrOf(m.id, date);
        const ls = lastStoolLabel(m.id, date);
        return `<tr><th>${esc(m.name)}</th>${HOURS.map((h) => {
          const inH = xs.filter((x) => Number(x.time.slice(0, 2)) === h || (h === 9 && Number(x.time.slice(0, 2)) < 9) || (h === 19 && Number(x.time.slice(0, 2)) > 19));
          return `<td class="hcell" data-hour="${h}" data-uid="${m.id}">${inH.map((x) => `<button type="button" class="ev-pill ${x.type === '便' ? 'stool' : ''}" data-ev-del="${x.id}" title="押すと取り消せます">${x.time} ${x.type}</button>`).join('')}</td>`;
        }).join('')}<td class="sum"><b>尿 ${excrOf(m.id, date, '尿').length}回</b><br><b>便 ${excrOf(m.id, date, '便').length}回</b></td><td class="${ls.warn ? 'vs-out b' : 'muted'}">${ls.text}</td><td class="muted">—</td></tr>`;
      }).join('') || `<tr><td colspan="${HOURS.length + 4}" class="empty">この日の利用者はいません</td></tr>`}</tbody>
    </table></div>`)}
    ${flowerCard(`<h3 class="h3">記録一覧（新しい順）</h3><div class="rec-list">${events.map((x) => `<div class="rec-row"><span class="muted">${x.time}</span><span class="type-pill ${x.type === '便' ? 'stool' : ''}">${x.type}</span><b>${esc(member(x.uid)?.name || '')}</b><span class="sp"></span><span class="muted small">入力: ${esc(staffName(x.staff))}</span>${rowActs('excr', x.id)}</div>`).join('') || '<p class="empty center">この日の記録はまだありません</p>'}</div>`)}`;
}

// =====================================================================
//  食事摂取量
// =====================================================================
const mealPill = (m) => (m ? `<button type="button" class="ev-pill meal" data-meal-del="${m.id}" title="押すと取り消せます">${m.kind === 'おやつ' ? `${m.main ?? '—'} 割` : `主 ${m.main ?? '—'} / 副 ${m.side ?? '—'}`}</button>` : '');
export function mealIndiv(uid) {
  if (!uid) return flowerCard(`<div class="row">${indivSelect('#/day/meals?view=indiv&u=', uid)}</div><p class="empty">利用者を選ぶと、2週間の経過が表示されます。</p>`);
  setCurrent(uid);
  const days = windowDays(todayStr(), 14).reverse();
  const cell = (d, k) => { const m = store.list('meals').find((x) => x.uid === uid && x.date === d && x.kind === k); return m ? (k === 'おやつ' ? `${m.main ?? '—'} 割` : `${m.main ?? '—'} 割 / ${m.side ?? '—'} 割`) : '—'; };
  return flowerCard(`<div class="d-head"><h2 class="d-name">${esc(member(uid).name)}</h2><span class="sp"></span>${location.hash.startsWith('#/person') ? '' : indivSelect('#/day/meals?view=indiv&u=', uid)}<button type="button" class="btn sm" data-print>🖨 印刷</button></div>
    <div class="grid-table-wrap"><table class="grid-table left"><thead><tr><th>日付</th><th>昼食（主食・副食）</th><th>おやつ</th><th>夕食（主食・副食）</th></tr></thead>
    <tbody>${days.map((d) => `<tr><td>${jpDate(d, false)}</td><td>${cell(d, '昼食')}</td><td>${cell(d, 'おやつ')}</td><td>${cell(d, '夕食')}</td></tr>`).join('')}</tbody></table></div>`);
}
export function renderMeals(q) {
  const view = q.get('view') === 'indiv' ? 'indiv' : 'week';
  const head = `${subtabs(DAY_TABS, '#/day/meals')}${scriptTitle('Meals', '食事摂取量', '通所利用者さんの昼食・おやつ・夕食の摂取量（割）を記録して、経過を確認できます')}${seg('#/day/meals', view)}`;
  if (view === 'indiv') return head + mealIndiv(q.get('u'));
  const date = ui.date;
  const rows = rosterFor(date);
  const todays = store.list('meals').filter((m) => m.date === date).sort((a, b) => MEAL_KINDS.indexOf(a.kind) - MEAL_KINDS.indexOf(b.kind) || a.uid.localeCompare(b.uid));
  return `${head}${flowerCard(`
    <p class="hint-top"><b class="ink">${jpDate(date)}</b> の記録です。表のマスを押すと、その食事の摂取量（割）を登録できます。 登録済みの記録を押すと取り消せます。書き直しは表の下の記録一覧の「編集」からできます。</p>
    ${weekdayButtons(weekdayOf(date))}
    <div class="row mt10"><input type="date" class="input round w-date big" data-date-pick value="${date}" max="${todayStr()}" aria-label="日付"><span class="sp"></span><button type="button" class="btn sm" data-print>🖨 印刷</button></div>
    <div class="grid-table-wrap mt10"><table class="hour-table meal-table">
      <thead><tr><th>利用者名</th><th>昼食（主食・副食）</th><th>おやつ</th><th>夕食（主食・副食）</th></tr></thead>
      <tbody>${rows.map((m) => `<tr><th>${esc(m.name)}</th>${MEAL_KINDS.map((k) => { const r = store.list('meals').find((x) => x.uid === m.id && x.date === date && x.kind === k); return `<td class="mcell" data-meal-kind="${k}" data-uid="${m.id}">${mealPill(r)}</td>`; }).join('')}</tr>`).join('')}</tbody>
    </table></div>`)}
    ${flowerCard(`<h3 class="h3">記録一覧</h3><div class="rec-list">${todays.map((m) => `<div class="rec-row"><span class="type-pill meal">${m.kind}</span><b>${esc(member(m.uid)?.name || '')}</b><span>${m.kind === 'おやつ' ? `${m.main ?? '—'} 割` : `主食 ${m.main ?? '—'} 割・副食 ${m.side ?? '—'} 割`}</span><span class="sp"></span><span class="muted small">入力: ${esc(staffName(m.staff))}</span>${rowActs('meal', m.id)}</div>`).join('') || '<p class="empty center">この日の記録はまだありません</p>'}</div>`)}`;
}

// =====================================================================
//  運動
// =====================================================================
export function exerciseIndiv(uid) {
  if (!uid) return flowerCard(`<div class="row">${indivSelect('#/day/exercise?view=indiv&u=', uid)}</div><p class="empty">利用者を選ぶと、1か月の運動の記録が表示されます。</p>`);
  const days = windowDays(todayStr(), 31).reverse().filter((d) => store.getDay(d, uid).exercise);
  return flowerCard(`<div class="d-head"><h2 class="d-name">${esc(member(uid).name)}</h2><span class="sp"></span>${location.hash.startsWith('#/person') ? '' : indivSelect('#/day/exercise?view=indiv&u=', uid)}</div>
    <div class="grid-table-wrap"><table class="grid-table left"><thead><tr><th>日付</th><th>運動の内容</th><th>実施時間</th></tr></thead>
    <tbody>${days.map((d) => { const e = store.getDay(d, uid); return `<tr><td>${jpDate(d, false)}</td><td>${esc(e.exercise)}</td><td>${esc(e.exMin || '—')}</td></tr>`; }).join('') || '<tr><td colspan="3" class="empty">この1か月の記録はありません</td></tr>'}</tbody></table></div>`);
}
export function renderExercise(q) {
  const view = q.get('view') === 'indiv' ? 'indiv' : 'week';
  const head = `${subtabs(DAY_TABS, '#/day/exercise')}${plainTitle('運動')}<div class="seg2"><a class="btn ${view === 'week' ? 'pink' : ''}" href="#/day/exercise">曜日別入力</a><a class="btn ${view === 'indiv' ? 'pink' : ''}" href="#/day/exercise?view=indiv">個別経過表</a></div>`;
  if (view === 'indiv') return head + exerciseIndiv(q.get('u'));
  const date = ui.date;
  const rows = rosterFor(date);
  const sel = (name, opts, v) => `<select class="input round" name="${name}"><option value="">—</option>${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  return `${head}<p class="lead">日にちごとに利用者ごとの運動の内容と実施時間を記録します。保存した内容は通所の表の運動マスと同じで、 どちらで入れても両方に出ます。</p>
    ${weekdayButtons(weekdayOf(date), { small: true, withDate: true })}
    <div class="row mt10 mb12"><button type="button" class="btn" data-date-step="-1">◀ 前日</button><input type="date" class="input round w-date big" data-date-pick value="${date}" max="${todayStr()}" aria-label="日付"><button type="button" class="btn" data-date-step="1" ${date >= todayStr() ? 'disabled' : ''}>翌日 ▶</button><span class="muted">${jpDate(date)}</span><button type="button" class="btn pink" data-ex-save>保存する</button></div>
    <section class="card"><form data-ex-form><div class="grid-table-wrap"><table class="grid-table left ex-table"><thead><tr><th>利用者</th><th>運動の内容</th><th>実施時間</th></tr></thead>
    <tbody>${rows.map((m) => { const e = store.getDay(date, m.id); return `<tr><td>${esc(m.name)}</td><td>${sel(`ex_${m.id}`, EXERCISES, e.exercise)}</td><td>${sel(`min_${m.id}`, EX_MINUTES, e.exMin)}</td></tr>`; }).join('') || '<tr><td colspan="3" class="empty">この日の利用者はいません</td></tr>'}</tbody></table></div></form>
    <p class="muted-p small-p mt8">内容が入っている人だけ「運動 集団体操（30分）」の記録になります。</p></section>`;
}

// =====================================================================
//  イベント
// =====================================================================
let rerender = () => {};
export function initVitals(view, render) {
  rerender = render;
  view.addEventListener('click', async (ev) => {
    const t = ev.target;
    const nw = t.closest('[data-v-new]');
    if (nw) { if (nw.dataset.vNew === 'vs') openVsForm(null, null, nw.dataset.uid); else openWeightForm(null, nw.dataset.uid); return; }
    const ed = t.closest('[data-v-edit]');
    if (ed) {
      const { vEdit: k, id } = ed.dataset;
      if (k === 'vsd' || k === 'vsl') openVsForm(k, id);
      else if (k === 'weight') openWeightForm(id);
      else if (k === 'meal') openMealForm(id);
      else if (k === 'excr') { const x = store.find('excr', id); setCurrent(x.uid); openExcrForm(null, x.date, x); }
      return;
    }
    const dl = t.closest('[data-v-del]');
    if (dl) {
      const { vDel: k, id } = dl.dataset;
      if (k === 'excr') { const x = store.find('excr', id); setCurrent(x.uid); }
      removeRow(k, id);
      return;
    }
    const xt = t.closest('[data-excr-type]');
    if (xt) { ui.excrType = xt.dataset.excrType; render(); return; }
    const evd = t.closest('[data-ev-del]');
    if (evd) {
      const x = store.find('excr', evd.dataset.evDel);
      if (await confirmDialog(`${member(x.uid).name} さんの ${x.time} の${x.type}を取り消しますか？`)) { store.remove('excr', x.id); toast('取り消しました'); render(); }
      return;
    }
    const hc = t.closest('[data-hour]');
    if (hc) {
      const h = Number(hc.dataset.hour);
      const mm = String(new Date().getMinutes()).padStart(2, '0');
      store.add('excr', { uid: hc.dataset.uid, date: ui.date, time: `${String(h).padStart(2, '0')}:${mm}`, type: ui.excrType, staff: store.getMe() });
      toast(`${member(hc.dataset.uid).name} さんの${ui.excrType}を登録しました`);
      render();
      return;
    }
    const md2 = t.closest('[data-meal-del]');
    if (md2) {
      const m = store.find('meals', md2.dataset.mealDel);
      if (await confirmDialog(`${member(m.uid).name} さんの${m.kind}の記録を取り消しますか？`)) { store.remove('meals', m.id); toast('取り消しました'); render(); }
      return;
    }
    const mc = t.closest('[data-meal-kind]');
    if (mc) { openMealForm(null, mc.dataset.uid, { kind: mc.dataset.mealKind, date: ui.date }); return; }
    if (t.closest('[data-ex-save]')) {
      const form = view.querySelector('[data-ex-form]');
      if (!form) return;
      rosterFor(ui.date).forEach((m) => {
        const ex = form.elements[`ex_${m.id}`]?.value || '';
        const min = form.elements[`min_${m.id}`]?.value || '';
        store.setDay(ui.date, m.id, { exercise: ex, exMin: ex ? min : '' });
      });
      toast('運動を保存しました');
      render();
    }
  });
  view.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-vs-range]')) { ui.vsRange = t.value; render(); return; }
  });
}
