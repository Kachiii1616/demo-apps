// 1人ぶんの介護記録のカード群（基本情報・VS経過表・病態・ADL・食事摂取量・水分バランス・体重管理・申し送り）。
// 「介護記録」「1day介護記録」「利用者別介護記録 › 介護記録タブ」で同じものを使う。
import { RECORD_TAGS, MEAL_KINDS, LEVELS, todayStr, addDays } from './data.js';
import * as store from './store.js';
import { esc, jpDate, md, nowHM, toast, openModal, closeModal, confirmDialog, ui, deco, ageOf, daysBetween } from './ui.js';
import { member, staffName, drinksOf, excrOf, lastStool, serviceLabel, vsOut } from './model.js';

const SECTIONS = [
  ['basic', '基本情報'], ['vs', 'VS経過表'], ['adl', '病態・ADL'], ['meal', '食事摂取量'],
  ['water', '水分バランス'], ['weight', '体重管理'], ['ho', '申し送り'],
];
export const VS_SERIES = [
  { key: 'temp', label: '体温', color: '#e5718f', axis: 'L', metric: 'temp' },
  { key: 'bpHi', label: '収縮期', color: '#6f8bd0', axis: 'R', metric: 'bp' },
  { key: 'bpLo', label: '拡張期', color: '#a3bdee', axis: 'R', metric: 'bp' },
  { key: 'pulse', label: '脈拍', color: '#a888b4', axis: 'R', metric: 'pulse' },
  { key: 'spo2', label: 'SpO2', color: '#73a98a', axis: 'R', metric: 'spo2' },
];

let cur = { uid: null };
export function setCurrent(uid) { cur.uid = uid; }

const wari = (v) => (v == null || v === '' ? '—' : `${v} 割`);
const rowBtns = (kind, id) => `<span class="p-acts no-print"><button type="button" class="p-edit" data-p-edit="${kind}" data-id="${id}">編集</button><button type="button" class="p-x" data-p-del="${kind}" data-id="${id}" aria-label="取り消す">×</button></span>`;
const secHead = (label, buttons = '') => `<div class="p-sec-head"><span class="box-label">${label}</span><span class="sp"></span>${buttons}</div>`;
const addBtn = (kind, label) => `<button type="button" class="btn sm ghost-pink no-print" data-p-add="${kind}">＋ ${label}</button>`;
const pageLink = (href, label) => `<a href="${href}" class="p-link">${label}</a>`;
export function windowDays(end, n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i)); return out; }
export const noteTags = (n) => n.tags || ['記録'];

// ---------- データの寄せ集め ----------
export function vsRows(uid, days) {
  const set = new Set(days);
  const rows = [];
  days.forEach((d) => {
    const e = store.getDay(d, uid);
    if (e.temp || e.bpHi || e.pulse || e.spo2) rows.push({ kind: 'vsd', id: d, date: d, time: e.vsTime || e.arrive || '', temp: e.temp, bpHi: e.bpHi, bpLo: e.bpLo, pulse: e.pulse, spo2: e.spo2, memo: e.vsMemo || '', staff: e.vsStaff });
  });
  store.list('vsLog').filter((v) => v.uid === uid && set.has(v.date)).forEach((v) => rows.push({ kind: 'vsl', ...v }));
  return rows.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
export function mealRows(uid, days) {
  const set = new Set(days);
  const order = (k) => MEAL_KINDS.indexOf(k);
  return store.list('meals').filter((m) => m.uid === uid && set.has(m.date)).sort((a, b) => b.date.localeCompare(a.date) || order(a.kind) - order(b.kind));
}

// ---------- グラフ（素の SVG） ----------
export function vsChart(rows, metric = ui.pMetric) {
  const byDate = new Map();
  rows.slice().reverse().forEach((r) => { if (!byDate.has(r.date)) byDate.set(r.date, r); });
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return '<p class="empty">この期間のVSの記録はありません。</p>';
  const W = 720, H = 300, padL = 46, padR = 46, padT = 14, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const L = [35.5, 38], R = [50, 175];
  const t0 = dates[0], span = Math.max(1, daysBetween(t0, dates[dates.length - 1]));
  const x = (d) => padL + (dates.length === 1 ? iw / 2 : (iw * daysBetween(t0, d)) / span);
  const yL = (v) => padT + ih - ((Math.min(L[1], Math.max(L[0], v)) - L[0]) / (L[1] - L[0])) * ih;
  const yR = (v) => padT + ih - ((Math.min(R[1], Math.max(R[0], v)) - R[0]) / (R[1] - R[0])) * ih;
  let g = '';
  for (let k = 0; k <= 5; k++) {
    const y = padT + (ih * k) / 5;
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="#f3e6cf"/>
      <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#a39383">${+(L[1] - ((L[1] - L[0]) * k) / 5).toFixed(1)}</text>
      <text x="${W - padR + 10}" y="${y + 4}" font-size="12" fill="#a39383">${Math.round(R[1] - ((R[1] - R[0]) * k) / 5)}</text>`;
  }
  const every = Math.ceil(dates.length / 7);
  dates.forEach((d, i) => { if (i % every === 0 || i === dates.length - 1) g += `<text x="${x(d)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#a39383">${md(d)}</text>`; });
  VS_SERIES.filter((s) => metric === 'all' || s.metric === metric).forEach((s) => {
    const pts = dates.map((d) => { const v = byDate.get(d)[s.key]; return v ? [x(d), (s.axis === 'L' ? yL : yR)(v), v] : null; }).filter(Boolean);
    if (!pts.length) return;
    g += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    g += pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="${s.color}"><title>${s.label} ${p[2]}</title></circle>`).join('');
  });
  return `<div class="chart-box">
    <div class="chart-head"><span><strong>VS経過グラフ</strong>　<span class="unit">左軸 ℃ ／ 右軸 mmHg / 回/分 / %</span></span>
      <span class="legend">${VS_SERIES.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="VS経過グラフ">${g}</svg></div>`;
}

export function weightChart(list, tall = false) {
  if (!list.length) return '<p class="empty">この期間の体重の記録はありません。</p>';
  const W = 720, H = tall ? 340 : 270, padL = 52, padR = 22, padT = 18, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const vals = list.map((w) => w.kg);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const t0 = list[0].date, span = Math.max(1, daysBetween(t0, list[list.length - 1].date));
  const x = (d) => padL + (list.length === 1 ? iw / 2 : (iw * daysBetween(t0, d)) / span);
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const steps = Math.min(5, hi - lo);
  let g = `<text x="${padL - 40}" y="${padT + 4}" font-size="13" fill="#a39383">kg</text>`;
  for (let k = 0; k <= steps; k++) {
    const v = lo + ((hi - lo) * k) / steps;
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#f3e6cf"/><text x="${padL - 10}" y="${y(v) + 4}" text-anchor="end" font-size="13" fill="#a39383">${+v.toFixed(1)}</text>`;
  }
  g += `<line x1="${padL}" x2="${padL}" y1="${padT}" y2="${padT + ih}" stroke="#a89c90"/><line x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}" stroke="#a89c90"/>`;
  const every = Math.ceil(list.length / 4);
  list.forEach((w, i) => { if (i % every === 0 || i === list.length - 1) g += `<text x="${x(w.date)}" y="${H - 14}" text-anchor="middle" font-size="13" fill="#a39383">${md(w.date)}</text>`; });
  g += `<path d="${list.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ')}" fill="none" stroke="#e5718f" stroke-width="2.4" stroke-linejoin="round"/>`;
  g += list.map((w) => `<circle cx="${x(w.date)}" cy="${y(w.kg)}" r="4.5" fill="#fff" stroke="#e5718f" stroke-width="2"><title>${md(w.date)} ${w.kg}kg</title></circle>`).join('');
  return `<svg class="chart p-wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重の推移グラフ">${g}</svg>`;
}

// ---------- 各カード ----------
function basicCard(uid) {
  const p = store.getProfile(uid);
  const m = member(uid);
  const rows = [
    ['ケアプラン', p.plan || '未入力'], ['看護目標', p.nurseGoal || '未入力'], ['介護目標', p.careGoal || '未入力'],
    ['疾患', p.disease || '未入力'], ['薬剤', p.meds || '未入力'], ['介護度', p.level || '未入力'],
    ['自立度', p.phys ? `障害 ${p.phys}／認知 ${p.cog}` : '未入力'], ['サービス利用状況', serviceLabel(m)],
  ];
  return `<section class="card p-card" id="p-basic">${deco}
    ${secHead('基本情報', '<button type="button" class="btn sm ghost-pink no-print" data-p-add="basic">編集</button>')}
    <dl class="p-info">${rows.map(([k, v]) => `<dt>${k}</dt><dd class="${v === '未入力' ? 'muted' : ''}">${esc(v)}</dd>`).join('')}</dl>
    <p class="p-foot">目標・薬剤・自立度などは ${pageLink(`#/facesheet?u=${uid}`, 'フェイスシートの画面')} の内容を表示しています。編集もフェイスシートの画面から行えます。</p>
  </section>`;
}

function vsCard(uid, days) {
  const rows = vsRows(uid, days);
  const metrics = [['all', '全て'], ['temp', '体温'], ['bp', '血圧'], ['pulse', '脈拍'], ['spo2', 'SpO2']];
  return `<section class="card p-card" id="p-vs">${deco}
    ${secHead('VS経過表', addBtn('vs', 'VS'))}
    <div class="chips p-metrics no-print">${metrics.map(([k, l]) => `<button type="button" class="chip ${ui.pMetric === k ? 'on' : ''}" data-p-metric="${k}">${l}</button>`).join('')}</div>
    ${vsChart(rows)}
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th>日付</th><th>時刻</th><th>体温</th><th>血圧</th><th>脈拍</th><th>SpO2</th><th>出所</th><th class="no-print"></th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${jpDate(r.date, false)}</td><td>${r.time || '—'}</td>
        <td class="${r.temp && vsOut.temp(r.temp) ? 'vs-out' : ''}">${r.temp ? `${r.temp} ℃` : '—'}</td>
        <td class="${r.bpHi && vsOut.bp(r.bpHi, r.bpLo) ? 'vs-out' : ''}">${r.bpHi ? `${r.bpHi}/${r.bpLo ?? '-'}` : '—'}</td>
        <td>${r.pulse ?? '—'}</td><td class="${r.spo2 && vsOut.spo2(r.spo2) ? 'vs-out' : ''}">${r.spo2 ? `${r.spo2} %` : '—'}</td>
        <td><span class="p-src">${r.memo ? esc(r.memo) : ''}</span></td>
        <td class="no-print">${rowBtns(r.kind, r.id)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">記録なし</td></tr>'}</tbody>
    </table></div>
    <p class="p-foot">くわしい経過は ${pageLink(`#/day/vitals?u=${uid}`, 'VS経過表の画面')} で確認できます</p>
  </section>`;
}

export function recLine(n) {
  const tags = noteTags(n);
  const front = tags.filter((t) => t !== '記録' && t !== '申し送り');
  return `<div class="p-rec">
    <span class="p-time">${n.time}</span>
    ${front.map((t) => `<span class="p-pill t-${t}">${t}</span>`).join('')}
    <span class="p-text">${esc(n.text)}</span>
    ${tags.includes('記録') ? '<span class="p-mini">記録</span>' : ''}${tags.includes('申し送り') ? '<span class="p-mini">申し送り</span>' : ''}
    <span class="p-by">記録: ${esc(staffName(n.staff))}</span><span class="p-mini">記録アプリ</span>
    ${rowBtns('note', n.id)}
  </div>`;
}

function adlCard(uid, days, date) {
  const set = new Set(days);
  const notes = store.list('notes').filter((n) => n.uid === uid && set.has(n.date) && noteTags(n).includes('記録'));
  const dates = [...new Set(notes.map((n) => n.date))].sort().reverse();
  return `<section class="card p-card" id="p-adl">${deco}
    ${secHead('病態・ADL', addBtn('note', '記録'))}
    <div class="p-adl-list">
      ${dates.map((d) => `<div class="p-day">${jpDate(d, false)}${d === date ? '（この日）' : ''}</div>
        <div class="p-day-box">${notes.filter((n) => n.date === d).sort((a, b) => a.time.localeCompare(b.time)).map(recLine).join('')}</div>`).join('')
        || '<p class="empty">この期間の記録はありません。「＋ 記録」から追加できます。</p>'}
    </div>
  </section>`;
}

function mealCard(uid, days) {
  const rows = mealRows(uid, days);
  return `<section class="card p-card" id="p-meal">${deco}
    ${secHead('食事摂取量', addBtn('meal', '食事'))}
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th>日付</th><th>食事</th><th>主食</th><th>副食</th><th class="no-print"></th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${jpDate(r.date, false)}</td><td>${r.kind}</td><td>${wari(r.main)}</td><td>${wari(r.side)}${r.memo ? `<span class="unit"> ${esc(r.memo)}</span>` : ''}</td>
        <td class="no-print">${rowBtns('meal', r.id)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">記録なし</td></tr>'}</tbody>
    </table></div>
    <p class="p-foot">くわしい経過は ${pageLink(`#/day/meals?view=indiv&u=${uid}`, '食事摂取量の画面')} で確認できます</p>
  </section>`;
}

function waterCard(uid, date) {
  const ds = drinksOf(uid, date);
  const us = excrOf(uid, date, '尿');
  const ss = excrOf(uid, date, '便');
  const ls = lastStool(uid, date);
  const mini = (items, fmt, kind) => (items.length ? `<span class="p-mini-list">（${items.map((x) => `${fmt(x)}<button type="button" class="p-x sm no-print" data-p-del="${kind}" data-id="${x.id}" aria-label="取り消す">×</button>`).join('　')}）</span>` : '');
  return `<section class="card p-card" id="p-water">${deco}
    ${secHead('水分バランス', addBtn('drink', '飲水') + addBtn('excr', '尿・便'))}
    <dl class="p-balance">
      <dt>飲水量</dt><dd><b>${ds.reduce((s, d) => s + d.ml, 0)}</b> ml ${mini(ds, (d) => `${d.time} ${d.ml}ml・${esc(d.what || '')}`, 'drink')}</dd>
      <dt>排尿</dt><dd><b>${us.length}</b> 回/日 ${mini(us, (x) => x.time, 'excr')}</dd>
      <dt>排便</dt><dd><b>${ss.length}</b> 回/日 ${mini(ss, (x) => x.time, 'excr')}</dd>
      <dt>最終排便</dt><dd>${ls ? `${jpDate(ls, false)}　[${daysBetween(ls, date) === 0 ? '当日' : `${daysBetween(ls, date)}日経過`}]` : '記録なし'}</dd>
    </dl>
    <p class="p-foot">くわしい経過は ${pageLink(`#/day/water?view=indiv&u=${uid}`, '水分バランスの画面')} で確認できます</p>
  </section>`;
}

function weightCard(uid) {
  const all = store.list('weights').filter((w) => w.uid === uid).sort((a, b) => a.date.localeCompare(b.date));
  const range = ui.pWeightRange;
  const from = range === 'all' ? '0000' : addDays(todayStr(), -Number(range) * 31);
  const list = all.filter((w) => w.date >= from);
  const last = all[all.length - 1];
  const ranges = [['3', '3ヶ月'], ['6', '6ヶ月'], ['12', '1年'], ['all', '全期間']];
  return `<section class="card p-card" id="p-weight">${deco}
    ${secHead('体重管理', `<select class="input p-range no-print" data-p-range aria-label="表示する期間">${ranges.map(([k, l]) => `<option value="${k}" ${range === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${addBtn('weight', '体重')}`)}
    <div class="p-wnow">体重 ${last ? `<b>${last.kg.toFixed(1)}</b> kg <span class="unit">（${jpDate(last.date, false)} 測定）</span> <button type="button" class="p-edit no-print" data-p-edit="weight" data-id="${last.id}">編集</button>` : '<span class="unit">未測定</span>'}</div>
    ${weightChart(list)}
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th>日付</th><th>体重</th><th class="no-print"></th></tr></thead>
      <tbody>${list.slice().reverse().map((w) => `<tr><td>${jpDate(w.date, false)}</td><td>${w.kg.toFixed(1)} kg</td><td class="no-print">${rowBtns('weight', w.id)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">記録なし</td></tr>'}</tbody>
    </table></div>
    <p class="p-foot">全期間の一覧は ${pageLink(`#/day/weight?u=${uid}`, '体重管理の画面')} で確認できます</p>
  </section>`;
}

function hoCard(uid, days) {
  const set = new Set(days);
  const rows = store.list('notes').filter((n) => n.uid === uid && set.has(n.date) && noteTags(n).includes('申し送り') && !noteTags(n).includes('記録'))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const dates = [...new Set(rows.map((h) => h.date))];
  return `<section class="card p-card" id="p-ho">${deco}
    ${secHead('申し送り', addBtn('ho', '申し送り'))}
    ${dates.map((d) => `<div class="p-day">${jpDate(d, false)}</div>
      <ul class="p-ho">${rows.filter((h) => h.date === d).map((h) => `<li>
        <span class="p-time">${h.time}</span><span class="p-text">${esc(h.text)}</span>
        <span class="p-mini">申し送り</span><span class="p-stars" title="重要度">${'★'.repeat(h.level || 1)}</span>
        <span class="p-by">記録: ${esc(staffName(h.staff))}</span><span class="p-mini">記録アプリ</span>
        ${rowBtns('note', h.id)}</li>`).join('')}</ul>`).join('') || '<p class="empty">この期間の申し送りはありません。</p>'}
  </section>`;
}

// ---------- まとめ ----------
export function nameRow(uid) {
  const m = member(uid);
  const p = store.getProfile(uid);
  return `<div class="p-name-row"><span class="person-name">${esc(m.name)}</span><span class="unit">${ageOf(p.birth)}才 / ${p.sex}</span></div>`;
}
export function menuBtn() {
  return `<div class="p-menu no-print"><button type="button" class="btn sm p-menu-btn" data-p-menu aria-haspopup="true" aria-label="カードへ移動">☰</button>
    <div class="p-menu-list" hidden>${SECTIONS.map(([k, l]) => `<button type="button" data-p-jump="${k}">${l}</button>`).join('')}</div></div>`;
}
export function dateBar(date, { withName = true } = {}) {
  const today = todayStr();
  return `<section class="card p-card p-datebar">${deco}
    <div class="p-dates">
      <button type="button" class="btn sm no-print" data-date-step="-1">◀ 前日</button>
      <span class="p-date-label">${jpDate(date)}</span>
      <button type="button" class="btn sm no-print" data-date-step="1" ${date >= today ? 'disabled' : ''}>翌日 ▶</button>
      <input class="input p-date-input no-print" type="date" data-date-pick value="${date}" max="${today}" aria-label="日付を選ぶ">
      ${withName ? '<button type="button" class="btn sm no-print" data-p-cal aria-label="カレンダーから選ぶ">📅</button><span class="sp"></span><button type="button" class="btn sm no-print" data-p-print>🖨 印刷</button>' + menuBtn() : ''}
    </div>
    ${withName ? nameRow(cur.uid) : ''}
  </section>`;
}
export function cardsFor(uid, date) {
  cur.uid = uid;
  const week = windowDays(date, 7);
  return basicCard(uid) + vsCard(uid, week) + adlCard(uid, week, date) + mealCard(uid, week) + waterCard(uid, date) + weightCard(uid) + hoCard(uid, week);
}

// =====================================================================
//  入力フォーム（モーダル）
// =====================================================================
function modalShell(date, inner, submitLabel = '記録する') {
  return `<form class="modal p-modal" novalidate>
    <div class="modal-head"><div class="d">${jpDate(date)}</div><div class="n">${esc(member(cur.uid).name)}</div></div>
    ${inner}
    <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button type="submit" class="btn grad">${submitLabel}</button></div>
  </form>`;
}
const numField = (label, name, unit, val, ph, step = '1') => `<label class="field"><span>${label}</span><div class="p-num"><input class="input big" type="number" inputmode="decimal" step="${step}" name="${name}" value="${val ?? ''}" placeholder="${ph}"><span class="unit">${unit}</span></div></label>`;
const pickChips = (name, options, selected, multi = false) => `<div class="chips p-pick" data-name="${name}" ${multi ? 'data-multi' : ''}>${options.map((o) => `<button type="button" class="chip ${(multi ? selected.includes(o) : selected === o) ? 'on' : ''}" data-v="${o}">${o}</button>`).join('')}</div>`;
function wirePicks(form) {
  form.addEventListener('click', (e) => {
    const c = e.target.closest('.p-pick .chip');
    if (!c) return;
    const box = c.parentElement;
    if (box.hasAttribute('data-multi')) c.classList.toggle('on');
    else box.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
  });
}
const picked = (form, name) => [...form.querySelectorAll(`.p-pick[data-name="${name}"] .chip.on`)].map((c) => c.dataset.v);
const num = (v) => (String(v).trim() === '' ? '' : Number(v));
function done(msg) { closeModal(); toast(msg); rerender(); }

// ---- 記録・申し送り（同じフォーム） ----
export function openRecordForm({ noteId, preset, uid } = {}) {
  if (uid) cur.uid = uid;
  const n = noteId && store.find('notes', noteId);
  if (n) cur.uid = n.uid;
  const date = n ? n.date : ui.date;
  const tags = n ? noteTags(n) : preset || ['記録'];
  openModal(modalShell(date, `
    <label class="field"><span>日付</span><input class="input" type="date" name="date" value="${date}" max="${todayStr()}"></label>
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${n ? n.time : nowHM()}"></label>
    <label class="field"><span>内容</span><textarea class="input" name="text" rows="4" data-autofocus placeholder="例: 昼食後に右膝の痛みの訴えあり。座位で休んでいただき軽減。">${esc(n ? n.text : '')}</textarea></label>
    <div class="field"><span>種類（任意）</span>${pickChips('tags', RECORD_TAGS, tags, true)}</div>
    <div class="field"><span>重要度</span>${pickChips('level', ['★', '★★', '★★★'], '★'.repeat(n?.level || 1))}</div>
    <p class="p-note">「申し送り」を付けた記録は申し送りページにも出ます。「記録」が付いていると病態・ADL 欄に、「記録」なしなら申し送り欄に表示されます。</p>`,
  n ? '保存する' : '記録する'), (form) => {
    wirePicks(form);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const text = form.text.value.trim();
      if (!text) { form.text.focus(); toast('内容を入力してください'); return; }
      const tg = picked(form, 'tags');
      if (!tg.includes('記録') && !tg.includes('申し送り')) tg.unshift('記録');
      const patch = { date: form.date.value || ui.date, time: form.time.value || nowHM(), text, tags: tg, level: (picked(form, 'level')[0] || '★').length };
      if (n) store.update('notes', n.id, patch);
      else store.add('notes', { uid: cur.uid, staff: store.getMe(), ...patch });
      done(n ? '保存しました' : '記録しました');
    });
  });
}

// ---- VS ----
export function openVsForm(kind, id, uid) {
  if (uid) cur.uid = uid;
  const e = kind === 'vsd' ? store.getDay(id, cur.uid) : null;
  const editing = kind === 'vsd' ? { date: id, temp: e.temp, bpHi: e.bpHi, bpLo: e.bpLo, pulse: e.pulse, spo2: e.spo2, time: e.vsTime || e.arrive, memo: e.vsMemo }
    : kind === 'vsl' ? store.find('vsLog', id) : null;
  const date = editing ? editing.date : ui.date;
  const v = editing || {};
  openModal(modalShell(date, `
    <label class="field"><span>日付</span><input class="input" type="date" name="date" value="${date}" max="${todayStr()}" ${editing ? 'disabled' : ''}></label>
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${v.time || nowHM()}"></label>
    ${numField('体温', 'temp', '℃', v.temp, '36.5', '0.1')}
    <div class="field"><span>血圧（上 / 下）</span><div class="p-num"><input class="input big" type="number" inputmode="numeric" name="bpHi" value="${v.bpHi ?? ''}" placeholder="120" aria-label="上の血圧"><span class="unit">/</span><input class="input big" type="number" inputmode="numeric" name="bpLo" value="${v.bpLo ?? ''}" placeholder="70" aria-label="下の血圧"><span class="unit">mmHg</span></div></div>
    ${numField('脈拍', 'pulse', '回/分', v.pulse, '70')}
    ${numField('SpO2', 'spo2', '%', v.spo2, '98')}
    <label class="field"><span>メモ（任意）</span><input class="input" name="memo" value="${esc(v.memo || '')}" placeholder="例: 入浴前、体操前"></label>`,
  editing ? '保存する' : '記録する'), (form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const val = { temp: num(form.temp.value), bpHi: num(form.bpHi.value), bpLo: num(form.bpLo.value), pulse: num(form.pulse.value), spo2: num(form.spo2.value) };
      if (Object.values(val).every((x) => x === '')) { toast('どれか1つは入力してください'); return; }
      const time = form.time.value || nowHM();
      const memo = form.memo.value.trim();
      const d = editing ? date : form.date.value || ui.date;
      if (kind === 'vsd') store.setDay(d, cur.uid, { ...val, vsTime: time, vsMemo: memo });
      else if (kind === 'vsl') store.update('vsLog', id, { ...val, time, memo });
      else {
        const e2 = store.getDay(d, cur.uid);
        // その日の通所の表にバイタルがまだ無ければ、表のほうに入れる
        if (!e2.temp && !e2.bpHi && !e2.pulse && !e2.spo2) store.setDay(d, cur.uid, { ...val, vsTime: time, vsMemo: memo, vsStaff: store.getMe(), arrive: e2.arrive || time, absent: '' });
        else store.add('vsLog', { uid: cur.uid, date: d, time, ...val, memo, staff: store.getMe() });
      }
      done('VSを記録しました');
    });
  });
}

// ---- 食事 ----
export function openMealForm(id, uid, preset = {}) {
  if (uid) cur.uid = uid;
  const v = id ? store.find('meals', id) : null;
  if (v) cur.uid = v.uid;
  const date = v ? v.date : preset.date || ui.date;
  openModal(modalShell(date, `
    <div class="field"><span>食事</span>${pickChips('kind', MEAL_KINDS, v ? v.kind : preset.kind || '昼食')}</div>
    ${numField('主食', 'main', '割（0〜10）', v?.main, '10')}
    ${numField('副食', 'side', '割（0〜10）', v?.side, '10')}
    <label class="field"><span>メモ（任意）</span><input class="input" name="memo" value="${esc(v?.memo || '')}" placeholder="例: 好きなおかずから食べられた"></label>`,
  v ? '保存する' : '記録する'), (form) => {
    wirePicks(form);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const kind = picked(form, 'kind')[0] || '昼食';
      const clamp = (x) => (x === '' ? null : Math.max(0, Math.min(10, Math.round(x))));
      const main = clamp(num(form.main.value));
      const side = clamp(num(form.side.value));
      if (main == null && side == null) { toast('主食か副食を入力してください'); return; }
      const memo = form.memo.value.trim();
      const same = store.list('meals').find((x) => x.uid === cur.uid && x.date === date && x.kind === kind && x.id !== v?.id);
      if (same) store.remove('meals', same.id);
      if (v) store.update('meals', v.id, { kind, main, side, memo });
      else store.add('meals', { uid: cur.uid, date, kind, main, side, memo, time: nowHM(), staff: store.getMe() });
      done('食事を記録しました');
    });
  });
}

// ---- 飲水・尿便 ----
export function openDrinkForm(uid, date = ui.date) {
  if (uid) cur.uid = uid;
  openModal(modalShell(date, `
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${nowHM()}"></label>
    ${numField('飲水量', 'ml', 'ml', '', '150', '10')}
    <div class="chips" style="margin:-4px 0 12px">${[100, 150, 200].map((x) => `<button type="button" class="chip" data-p-ml="${x}">＋${x}ml</button>`).join('')}</div>
    <label class="field"><span>内容（任意）</span><input class="input" name="what" placeholder="例: お茶、ポカリ"></label>`), (form) => {
    form.addEventListener('click', (e) => { const b = e.target.closest('[data-p-ml]'); if (b) form.ml.value = (Number(form.ml.value) || 0) + Number(b.dataset.pMl); });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const ml = num(form.ml.value);
      if (!ml || ml < 0) { toast('飲水量を入力してください'); return; }
      store.add('drinks', { uid: cur.uid, date, time: form.time.value || nowHM(), ml, what: form.what.value.trim() || 'お茶', staff: store.getMe() });
      done(`${ml}ml を記録しました`);
    });
  });
}
export function openExcrForm(uid, date = ui.date, x = null, preset = {}) {
  if (uid) cur.uid = uid;
  openModal(modalShell(date, `
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${x ? x.time : preset.time || nowHM()}"></label>
    <div class="field"><span>種別</span>${pickChips('type', ['尿', '便'], x ? x.type : preset.type || '尿')}</div>`, x ? '保存する' : '記録する'), (form) => {
    wirePicks(form);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const patch = { time: form.time.value || nowHM(), type: picked(form, 'type')[0] || '尿' };
      if (x) store.update('excr', x.id, patch);
      else store.add('excr', { uid: cur.uid, date, staff: store.getMe(), ...patch });
      done(`${patch.type}を記録しました`);
    });
  });
}

// ---- 体重 ----
export function openWeightForm(id, uid) {
  if (uid) cur.uid = uid;
  const w = id && store.find('weights', id);
  if (w) cur.uid = w.uid;
  const date = w ? w.date : ui.date;
  openModal(modalShell(date, `<label class="field"><span>日付</span><input class="input" type="date" name="date" value="${date}" max="${todayStr()}"></label>${numField('体重', 'kg', 'kg', w?.kg, '45.0', '0.1')}`, w ? '保存する' : '記録する'), (form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const kg = num(form.kg.value);
      if (!kg || kg < 20 || kg > 200) { toast('体重を入力してください'); return; }
      const v = Math.round(kg * 10) / 10;
      const d = form.date.value || date;
      if (w) store.update('weights', w.id, { kg: v, date: d });
      else {
        const same = store.list('weights').find((x) => x.uid === cur.uid && x.date === d);
        if (same) store.update('weights', same.id, { kg: v });
        else store.add('weights', { uid: cur.uid, date: d, kg: v, staff: store.getMe() });
      }
      done('体重を記録しました');
    });
  });
}

// ---- 基本情報 ----
export function openBasicForm(uid) {
  if (uid) cur.uid = uid;
  const p = store.getProfile(cur.uid);
  openModal(`<form class="modal p-modal" novalidate>
    <div class="modal-head"><div class="n">${esc(member(cur.uid).name)}</div><div class="s">基本情報・フェイスシート</div></div>
    <label class="field"><span>生年月日</span><input class="input" type="date" name="birth" value="${p.birth || ''}"></label>
    <div class="field"><span>性別</span>${pickChips('sex', ['女', '男'], p.sex)}</div>
    <label class="field"><span>介護度</span><select class="input" name="level">${LEVELS.map((l) => `<option ${l === p.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span>疾患</span><input class="input" name="disease" value="${esc(p.disease)}"></label>
    <label class="field"><span>薬剤</span><input class="input" name="meds" value="${esc(p.meds)}"></label>
    <label class="field"><span>ケアプラン（要点）</span><textarea class="input" name="plan" rows="2">${esc(p.plan)}</textarea></label>
    <label class="field"><span>看護目標</span><textarea class="input" name="nurseGoal" rows="2">${esc(p.nurseGoal)}</textarea></label>
    <label class="field"><span>介護目標</span><textarea class="input" name="careGoal" rows="2">${esc(p.careGoal)}</textarea></label>
    <label class="field"><span>ADL</span><input class="input" name="adl" value="${esc(p.adl)}"></label>
    <label class="field"><span>キーパーソン</span><input class="input" name="keyPerson" value="${esc(p.keyPerson)}"></label>
    <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button type="submit" class="btn grad">保存する</button></div>
  </form>`, (form) => {
    wirePicks(form);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const patch = { birth: form.birth.value, sex: picked(form, 'sex')[0] || p.sex, level: form.level.value };
      ['disease', 'meds', 'plan', 'nurseGoal', 'careGoal', 'adl', 'keyPerson'].forEach((k) => { patch[k] = form[k].value.trim(); });
      store.setProfile(cur.uid, patch);
      done('基本情報を保存しました');
    });
  });
}

// ---- 取り消し ----
export async function removeRow(kind, id) {
  const uid = cur.uid;
  const short = (s) => (s.length > 24 ? s.slice(0, 24) + '…' : s);
  const map = {
    note: () => { const n = store.find('notes', id); return [`${n.time} の記録「${short(n.text)}」`, () => store.remove('notes', id)]; },
    vsd: () => [`${jpDate(id, false)} のVS`, () => store.setDay(id, uid, { temp: '', bpHi: '', bpLo: '', pulse: '', spo2: '', vsTime: '', vsMemo: '' })],
    vsl: () => { const v = store.find('vsLog', id); return [`${jpDate(v.date, false)} ${v.time} のVS`, () => store.remove('vsLog', id)]; },
    meal: () => { const m = store.find('meals', id); return [`${jpDate(m.date, false)} の${m.kind}`, () => store.remove('meals', id)]; },
    weight: () => { const w = store.find('weights', id); return [`${jpDate(w.date, false)} の体重 ${w.kg}kg`, () => store.remove('weights', id)]; },
    drink: () => { const d = store.find('drinks', id); return [`${d.time} の飲水 ${d.ml}ml`, () => store.remove('drinks', id)]; },
    excr: () => { const x = store.find('excr', id); return [`${x.time} の${x.type}`, () => store.remove('excr', id)]; },
  };
  if (!map[kind]) return;
  const [label, run] = map[kind]();
  if (await confirmDialog(`${label}を取り消しますか？`)) { run(); toast('取り消しました'); rerender(); }
}

// =====================================================================
//  イベント（カードの中のボタン）
// =====================================================================
let rerender = () => {};
export function initPerson(view, render) {
  rerender = render;
  view.addEventListener('click', (ev) => {
    const t = ev.target;
    const menuBtn = t.closest('[data-p-menu]');
    const menuList = view.querySelector('.p-menu-list');
    if (menuBtn) { menuList.hidden = !menuList.hidden; return; }
    if (menuList && !menuList.hidden && !t.closest('.p-menu-list')) menuList.hidden = true;
    const jump = t.closest('[data-p-jump]');
    if (jump) { menuList.hidden = true; document.getElementById(`p-${jump.dataset.pJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const metric = t.closest('[data-p-metric]');
    if (metric) { ui.pMetric = metric.dataset.pMetric; render(); return; }
    if (t.closest('[data-p-cal]')) { const inp = view.querySelector('[data-date-pick]'); try { inp.showPicker(); } catch { inp.focus(); } return; }
    if (t.closest('[data-p-print]')) { window.print(); return; }
    const add = t.closest('[data-p-add]');
    if (add) {
      const k = add.dataset.pAdd;
      const uid = add.dataset.uid;
      if (uid) cur.uid = uid;
      if (k === 'note') openRecordForm({ preset: ['記録', '通所'] });
      else if (k === 'ho') openRecordForm({ preset: ['申し送り'] });
      else if (k === 'vs') openVsForm();
      else if (k === 'meal') openMealForm();
      else if (k === 'drink') openDrinkForm();
      else if (k === 'excr') openExcrForm();
      else if (k === 'weight') openWeightForm();
      else if (k === 'basic') openBasicForm();
      return;
    }
    const edit = t.closest('[data-p-edit]');
    if (edit) {
      const k = edit.dataset.pEdit;
      const id = edit.dataset.id;
      if (k === 'note') openRecordForm({ noteId: id });
      else if (k === 'vsd' || k === 'vsl') openVsForm(k, id);
      else if (k === 'meal') openMealForm(id);
      else if (k === 'weight') openWeightForm(id);
      else if (k === 'excr') { const x = store.find('excr', id); cur.uid = x.uid; openExcrForm(null, x.date, x); }
      return;
    }
    const del = t.closest('[data-p-del]');
    if (del) removeRow(del.dataset.pDel, del.dataset.id);
  });
  view.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-p-range]')) { ui.pWeightRange = ev.target.value; render(); }
  });
}
