// 利用者別介護記録（見せる用・別実装）。
// 利用者を選ぶと、日付バーの下に「基本情報・VS経過表・病態・ADL・食事摂取量・水分バランス・体重管理・申し送り」
// のカードが縦に並ぶ。上のタブで、それぞれを広い期間で見る画面に切り替えられる。
import { MEMBERS, STAFF, RECORD_TAGS, MEAL_KINDS, LEVELS, todayStr, addDays } from './data.js';
import * as store from './store.js';
import { esc, jpDate, nowHM, toast, openModal, closeModal, confirmDialog, ui } from './ui.js';

const member = (id) => MEMBERS.find((m) => m.id === id);
const staffName = (id) => STAFF.find((s) => s.id === id)?.name || '';

const TABS = [
  ['sheet', 'フェイスシート'],
  ['record', '介護記録'],
  ['weight', '体重管理'],
  ['water', '水分バランス'],
  ['vs', 'VS経過表'],
  ['meal', '食事摂取量'],
];
const SECTIONS = [
  ['basic', '基本情報'], ['vs', 'VS経過表'], ['adl', '病態・ADL'], ['meal', '食事摂取量'],
  ['water', '水分バランス'], ['weight', '体重管理'], ['ho', '申し送り'],
];
const VS_SERIES = [
  { key: 'temp', label: '体温', color: '#e8728f', axis: 'L', metric: 'temp' },
  { key: 'bpHi', label: '収縮期', color: '#6680cc', axis: 'R', metric: 'bp' },
  { key: 'bpLo', label: '拡張期', color: '#a9bbea', axis: 'R', metric: 'bp' },
  { key: 'pulse', label: '脈拍', color: '#9a7cb0', axis: 'R', metric: 'pulse' },
  { key: 'spo2', label: 'SpO2', color: '#6aa47a', axis: 'R', metric: 'spo2' },
];

let cur = { uid: null, tab: 'record' };

// ---------- 小物 ----------
function ageOf(birth, today) {
  if (!birth) return '';
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
const md = (ds) => { const [, m, d] = ds.split('-').map(Number); return `${m}/${d}`; };
const wari = (v) => (v == null || v === '' ? '—' : `${v} 割`);
const noteTags = (n) => n.tags || (n.cat === '健康' ? ['記録', '通所', '医療'] : ['記録', '通所']);
const deco = '<span class="p-deco" aria-hidden="true">✿</span>';
const rowBtns = (kind, id) => `<span class="p-acts no-print"><button type="button" class="p-edit" data-p-edit="${kind}" data-id="${id}">編集</button><button type="button" class="p-x" data-p-del="${kind}" data-id="${id}" aria-label="取り消す">×</button></span>`;
function secHead(key, label, buttons = '') {
  return `<div class="p-sec-head"><span class="box-label">${label}</span><span class="sp"></span>${buttons}</div>`;
}
const addBtn = (kind, label) => `<button type="button" class="btn sm ghost-pink no-print" data-p-add="${kind}">＋ ${label}</button>`;
const tabLink = (tab, label) => `<a href="#/person?u=${cur.uid}&tab=${tab}" class="p-link">${label}</a>`;
function windowDays(end, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

// ---------- データの寄せ集め ----------
function vsRows(uid, days) {
  const set = new Set(days);
  const rows = [];
  days.forEach((d) => {
    const e = store.getDay(d, uid);
    if (e.temp || e.bpHi || e.pulse || e.spo2) rows.push({ kind: 'vsd', id: d, date: d, time: e.vsTime || e.arrive || '', ...pickVs(e), memo: e.vsMemo || '', src: '業務日誌' });
  });
  store.db().vsLog.filter((v) => v.uid === uid && set.has(v.date)).forEach((v) => rows.push({ kind: 'vsl', ...v, src: '個別' }));
  return rows.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
function pickVs(e) { return { temp: e.temp, bpHi: e.bpHi, bpLo: e.bpLo, pulse: e.pulse, spo2: e.spo2 }; }

function mealRows(uid, days) {
  const set = new Set(days);
  const rows = [];
  days.forEach((d) => {
    const e = store.getDay(d, uid);
    if (e.mealMain != null || e.mealSide != null) rows.push({ kind: 'meald', id: d, date: d, mealKind: '昼食', main: e.mealMain, side: e.mealSide, memo: e.mealMemo || '' });
  });
  store.db().meals.filter((m) => m.uid === uid && set.has(m.date)).forEach((m) => rows.push({ kind: 'meal', ...m, mealKind: m.kind }));
  const order = (k) => MEAL_KINDS.indexOf(k);
  return rows.sort((a, b) => b.date.localeCompare(a.date) || order(a.mealKind) - order(b.mealKind));
}

function lastStool(uid, date) {
  for (let i = 0; i <= 60; i++) {
    const d = addDays(date, -i);
    if (store.getDay(d, uid).stool > 0) return d;
  }
  return null;
}

// 申し送り欄に出すもの：この方の申し送りのうち、「記録」付きの介護記録と結びついていないもの
function handoverRows(uid, days) {
  const set = new Set(days);
  const notes = store.db().notes;
  return store.db().handovers
    .filter((h) => h.uid === uid && set.has(h.date))
    .filter((h) => { const n = h.noteId && notes.find((x) => x.id === h.noteId); return !n; })
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

// ---------- グラフ（素の SVG） ----------
function vsChart(rows) {
  const byDate = new Map();
  rows.slice().reverse().forEach((r) => { if (!byDate.has(r.date)) byDate.set(r.date, r); });
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return '<p class="empty">この期間のVSの記録はありません。</p>';
  const W = 720, H = 280, padL = 46, padR = 46, padT = 14, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const L = [35, 37.5], R = [0, 250];
  const x = (i) => padL + (dates.length === 1 ? iw / 2 : (iw * i) / (dates.length - 1));
  const yL = (v) => padT + ih - ((v - L[0]) / (L[1] - L[0])) * ih;
  const yR = (v) => padT + ih - ((v - R[0]) / (R[1] - R[0])) * ih;
  let g = '';
  for (let k = 0; k <= 5; k++) {
    const y = padT + (ih * k) / 5;
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="#f3e8d6"/>
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#a39383">${+(L[1] - ((L[1] - L[0]) * k) / 5).toFixed(1)}</text>
      <text x="${W - padR + 8}" y="${y + 4}" font-size="11" fill="#a39383">${Math.round(R[1] - ((R[1] - R[0]) * k) / 5)}</text>`;
  }
  dates.forEach((d, i) => { g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#8b7d6e">${md(d)}</text>`; });
  const shown = VS_SERIES.filter((s) => ui.pMetric === 'all' || s.metric === ui.pMetric);
  shown.forEach((s) => {
    const pts = dates.map((d, i) => { const v = byDate.get(d)[s.key]; return v ? [x(i), (s.axis === 'L' ? yL : yR)(Math.max(s.axis === 'L' ? L[0] : R[0], v)), v] : null; }).filter(Boolean);
    if (!pts.length) return;
    g += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
    g += pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.4" fill="${s.color}"><title>${s.label} ${p[2]}</title></circle>`).join('');
  });
  return `<div class="chart-box p-chart">
    <div class="chart-head"><span><strong>VS経過グラフ</strong>　<span class="unit">左軸 ℃ ／ 右軸 mmHg / 回/分 / %</span></span>
      <span class="legend">${VS_SERIES.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="VS経過グラフ">${g}</svg></div>`;
}

function weightChart(list) {
  if (!list.length) return '<p class="empty">この期間の体重の記録はありません。</p>';
  const W = 720, H = 260, padL = 46, padR = 22, padT = 18, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const vals = list.map((w) => w.kg);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const t0 = list[0].date, span = Math.max(1, daysBetween(t0, list[list.length - 1].date));
  const x = (d) => padL + (list.length === 1 ? iw / 2 : (iw * daysBetween(t0, d)) / span);
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const steps = Math.min(5, hi - lo);
  let g = `<text x="${padL - 30}" y="${padT + 2}" font-size="11" fill="#a39383">kg</text>`;
  for (let k = 0; k <= steps; k++) {
    const v = lo + ((hi - lo) * k) / steps;
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#f3e8d6"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#a39383">${+v.toFixed(1)}</text>`;
  }
  const every = Math.ceil(list.length / 7);
  list.forEach((w, i) => { if (i % every === 0 || i === list.length - 1) g += `<text x="${x(w.date)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#8b7d6e">${md(w.date)}</text>`; });
  g += `<path d="${list.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ')}" fill="none" stroke="#e8728f" stroke-width="2.2" stroke-linejoin="round"/>`;
  g += list.map((w) => `<circle cx="${x(w.date)}" cy="${y(w.kg)}" r="4" fill="#fff" stroke="#e8728f" stroke-width="2"><title>${md(w.date)} ${w.kg}kg</title></circle>`).join('');
  return `<svg class="chart p-wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重の推移グラフ">${g}</svg>`;
}

// ---------- 各カード ----------
function basicCard(uid, full) {
  const m = member(uid);
  const p = store.getProfile(uid);
  const rows = [
    ...(full ? [['ふりがな', m.kana], ['生年月日', p.birth ? `${jpDate(p.birth)}（${ageOf(p.birth, todayStr())}才）` : '未入力'], ['性別', p.sex === '女' ? '女性' : '男性']] : []),
    ['ケアプラン', p.plan || '未入力'],
    ['看護目標', p.nurseGoal || '未入力'],
    ['介護目標', p.careGoal || '未入力'],
    ['疾患', p.disease || '未入力'],
    ['薬剤', p.meds || '未入力'],
    ['介護度', p.level || '未入力'],
    ['自立度', p.indep || '未入力'],
    ['サービス利用状況', p.service || '未入力'],
  ];
  return `<section class="card p-card" id="p-basic">${deco}
    ${secHead('basic', full ? 'フェイスシート' : '基本情報', `<button type="button" class="btn sm ghost-pink no-print" data-p-add="${full ? 'sheet' : 'basic'}">編集</button>`)}
    <dl class="p-info">${rows.map(([k, v]) => `<dt>${k}</dt><dd class="${v === '未入力' ? 'muted' : ''}">${esc(v)}</dd>`).join('')}</dl>
    ${full ? '<p class="p-foot">目標・薬剤・自立度もここで編集できます。介護記録タブの「基本情報」にも同じ内容が出ます。</p>'
      : `<p class="p-foot">目標・薬剤・自立度などは ${tabLink('sheet', 'フェイスシート')} の内容を表示しています。編集もフェイスシートのタブから行えます。</p>`}
  </section>`;
}

function vsCard(uid, days, full) {
  const rows = vsRows(uid, days);
  const metrics = [['all', '全て'], ['temp', '体温'], ['bp', '血圧'], ['pulse', '脈拍'], ['spo2', 'SpO2']];
  return `<section class="card p-card" id="p-vs">${deco}
    ${secHead('vs', 'VS経過表', addBtn('vs', 'VS'))}
    <div class="chips p-metrics no-print">${metrics.map(([k, l]) => `<button type="button" class="chip ${ui.pMetric === k ? 'on' : ''}" data-p-metric="${k}">${l}</button>`).join('')}</div>
    ${vsChart(rows)}
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th>日付</th><th>時刻</th><th>体温</th><th>血圧</th><th>脈拍</th><th>SpO2</th><th>出所</th><th class="no-print"></th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${jpDate(r.date, false)}</td><td>${r.time || '—'}</td>
        <td class="${r.temp >= 37.5 ? 'alert-val' : ''}">${r.temp ? `${r.temp.toFixed(1)} ℃` : '—'}</td>
        <td class="${r.bpHi >= 160 ? 'alert-val' : ''}">${r.bpHi ? `${r.bpHi}/${r.bpLo ?? '-'}` : '—'}</td>
        <td>${r.pulse ?? '—'}</td><td class="${r.spo2 && r.spo2 < 93 ? 'alert-val' : ''}">${r.spo2 ? `${r.spo2} %` : '—'}</td>
        <td><span class="p-src">${r.src}</span>${r.memo ? `<span class="unit"> ${esc(r.memo)}</span>` : ''}</td>
        <td class="no-print">${rowBtns(r.kind, r.id)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty">記録なし</td></tr>`}</tbody>
    </table></div>
    ${full ? '<p class="p-foot">業務日誌で入れたバイタルと、ここで追加したバイタルの両方が出ます。</p>'
      : `<p class="p-foot">くわしい経過は ${tabLink('vs', 'VS経過表のタブ')} で確認できます</p>`}
  </section>`;
}

function recLine(n) {
  const tags = noteTags(n);
  const front = tags.filter((t) => t !== '記録' && t !== '申し送り');
  return `<div class="p-rec">
    <span class="p-time">${n.time}</span>
    ${front.map((t) => `<span class="p-pill t-${t}">${t}</span>`).join('')}
    <span class="p-text">${esc(n.text)}</span>
    ${tags.includes('記録') ? '<span class="p-mini">記録</span>' : ''}${tags.includes('申し送り') ? '<span class="p-mini">申し送り</span>' : ''}
    <span class="p-by">記録: ${esc(staffName(n.staff))}</span>
    ${rowBtns('note', n.id)}
  </div>`;
}

function adlCard(uid, days, full) {
  const set = new Set(days);
  const notes = store.db().notes.filter((n) => n.uid === uid && set.has(n.date) && noteTags(n).includes('記録'));
  const dates = [...new Set(notes.map((n) => n.date))].sort().reverse();
  return `<section class="card p-card" id="p-adl">${deco}
    ${secHead('adl', '病態・ADL', addBtn('note', '記録'))}
    <div class="p-adl-list ${full ? 'full' : ''}">
      ${dates.map((d) => `<div class="p-day">${jpDate(d, false)}</div>
        <div class="p-day-box">${notes.filter((n) => n.date === d).sort((a, b) => a.time.localeCompare(b.time)).map(recLine).join('')}</div>`).join('')
        || '<p class="empty">この期間の記録はありません。「＋ 記録」から追加できます。</p>'}
    </div>
  </section>`;
}

function mealCard(uid, days, full) {
  const rows = mealRows(uid, days);
  return `<section class="card p-card" id="p-meal">${deco}
    ${secHead('meal', '食事摂取量', addBtn('meal', '食事'))}
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th>日付</th><th>食事</th><th>主食</th><th>副食</th><th class="no-print"></th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${jpDate(r.date, false)}</td><td>${r.mealKind}</td><td>${wari(r.main)}</td><td>${wari(r.side)}${r.memo ? `<span class="unit"> ${esc(r.memo)}</span>` : ''}</td>
        <td class="no-print">${rowBtns(r.kind, r.id)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">記録なし</td></tr>'}</tbody>
    </table></div>
    ${full ? '<p class="p-foot">昼食は業務日誌の「食事」と同じ記録です。</p>' : `<p class="p-foot">くわしい経過は ${tabLink('meal', '食事摂取量のタブ')} で確認できます</p>`}
  </section>`;
}

function waterCard(uid, date, full) {
  const e = store.getDay(date, uid);
  const ls = lastStool(uid, date);
  let table = '';
  if (full) {
    const days = windowDays(date, 14).reverse();
    table = `<div class="p-table-wrap" style="margin-top:12px"><table class="p-table">
      <thead><tr><th>日付</th><th>飲水量</th><th>排尿</th><th>排便</th></tr></thead>
      <tbody>${days.map((d) => { const x = store.getDay(d, uid); return `<tr class="${d === date ? 'is-sel' : ''}"><td>${jpDate(d, false)}</td><td>${x.water ? `${x.water} ml` : '—'}</td><td>${x.urine != null ? `${x.urine} 回` : '—'}</td><td>${x.stool != null ? `${x.stool} 回` : '—'}</td></tr>`; }).join('')}</tbody>
    </table></div>`;
  }
  return `<section class="card p-card" id="p-water">${deco}
    ${secHead('water', '水分バランス', addBtn('drink', '飲水') + addBtn('excr', '尿・便'))}
    <dl class="p-balance">
      <dt>飲水量</dt><dd><b>${e.water || 0}</b> ml</dd>
      <dt>排尿</dt><dd><b>${e.urine || 0}</b> 回/日</dd>
      <dt>排便</dt><dd><b>${e.stool || 0}</b> 回/日</dd>
      <dt>最終排便</dt><dd>${ls ? `${jpDate(ls, false)}　[${daysBetween(ls, date) === 0 ? '当日' : `${daysBetween(ls, date)}日経過`}]` : '記録なし'}</dd>
    </dl>
    ${table}
    ${full ? '' : `<p class="p-foot">くわしい経過は ${tabLink('water', '水分バランスのタブ')} で確認できます</p>`}
  </section>`;
}

function weightCard(uid, full) {
  const all = store.db().weights.filter((w) => w.uid === uid).sort((a, b) => a.date.localeCompare(b.date));
  const range = full ? 'all' : ui.pWeightRange;
  const from = range === 'all' ? '0000' : addDays(todayStr(), -Number(range) * 31);
  const list = all.filter((w) => w.date >= from);
  const last = all[all.length - 1];
  const ranges = [['3', '3ヶ月'], ['6', '6ヶ月'], ['12', '1年'], ['all', '全期間']];
  return `<section class="card p-card" id="p-weight">${deco}
    ${secHead('weight', '体重管理', `${full ? '' : `<select class="input p-range no-print" data-p-range aria-label="表示する期間">${ranges.map(([k, l]) => `<option value="${k}" ${ui.pWeightRange === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`}${addBtn('weight', '体重')}`)}
    <div class="p-wnow">体重 ${last ? `<b>${last.kg.toFixed(1)}</b> kg <span class="unit">（${jpDate(last.date, false)} 測定）</span> <button type="button" class="p-edit no-print" data-p-edit="weight" data-id="${last.id}">編集</button>` : '<span class="unit">未測定</span>'}</div>
    ${weightChart(list)}
    <div class="p-table-wrap"><table class="p-table">
      <thead><tr><th>日付</th><th>体重</th><th class="no-print"></th></tr></thead>
      <tbody>${list.slice().reverse().map((w) => `<tr><td>${jpDate(w.date, false)}</td><td>${w.kg.toFixed(1)} kg</td><td class="no-print">${rowBtns('weight', w.id)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">記録なし</td></tr>'}</tbody>
    </table></div>
    ${full ? '' : `<p class="p-foot">全期間の一覧は ${tabLink('weight', '体重管理のタブ')} で確認できます</p>`}
  </section>`;
}

function hoCard(uid, days) {
  const rows = handoverRows(uid, days);
  const dates = [...new Set(rows.map((h) => h.date))];
  return `<section class="card p-card" id="p-ho">${deco}
    ${secHead('ho', '申し送り', addBtn('ho', '申し送り'))}
    ${dates.map((d) => `<div class="p-day">${jpDate(d, false)}</div>
      <ul class="p-ho">${rows.filter((h) => h.date === d).map((h) => `<li>
        <span class="p-time">${h.time}</span><span class="p-text">${esc(h.text)}</span>
        <span class="p-mini">申し送り</span><span class="p-stars" title="重要度">${'★'.repeat(h.level || 2)}</span>
        <span class="p-by">記録: ${esc(staffName(h.staff))}</span>${h.done ? '<span class="p-mini ok">確認済み</span>' : ''}
        ${rowBtns('ho', h.id)}</li>`).join('')}</ul>`).join('') || '<p class="empty">この期間の申し送りはありません。</p>'}
  </section>`;
}

// ---------- 画面 ----------
function subnav() {
  const items = [['#/person', '利用者別介護記録', true], ['#/vitals', 'バイタル経過'], ['#/handover', '申し送り'], ['#/contact', '連絡帳']];
  return `<nav class="subnav no-print" aria-label="介護記録のページ">${items.map(([h, l, on]) => `<a href="${h}" class="${on ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
}

function memberList() {
  const q = ui.search.trim();
  const list = MEMBERS.filter((m) => !q || m.name.includes(q) || m.kana.includes(q));
  return `<section class="card p-card">${deco}
    <p class="p-lead2">利用者さんを選ぶと、その方の記録のページが開きます。リストにない方はお名前で検索してください。</p>
    <input class="search" type="search" data-search placeholder="🔍 お名前で検索（ひらがなでも探せます）" value="${esc(ui.search)}">
    <div class="member-grid">
      ${list.map((m) => `<a class="member-btn" href="#/person?u=${m.id}&tab=record">${esc(m.name)}<span class="kana">${esc(m.kana)}</span></a>`).join('') || '<p class="empty">該当する方がいません。</p>'}
    </div>
  </section>`;
}

export function renderPerson(q) {
  const uid = q.get('u');
  const head = `${subnav()}
  <div class="page-head"><h1 class="page-title"><span class="script">Personal</span>利用者別介護記録</h1></div>
  <p class="page-lead">利用者さんを選ぶと、フェイスシート・介護記録・体重管理・水分バランス・VS経過表・食事摂取量をタブで見られます</p>`;
  const m = uid && member(uid);
  if (!m) { cur.uid = null; return head + memberList(); }
  const tab = TABS.some(([k]) => k === q.get('tab')) ? q.get('tab') : 'record';
  cur = { uid, tab };
  ui.person = uid;
  const date = ui.date;
  const today = todayStr();
  const p = store.getProfile(uid);
  const week = windowDays(date, 7);

  let body = '';
  if (tab === 'record') body = basicCard(uid) + vsCard(uid, week) + adlCard(uid, week) + mealCard(uid, week) + waterCard(uid, date) + weightCard(uid) + hoCard(uid, week);
  else if (tab === 'sheet') body = basicCard(uid, true);
  else if (tab === 'weight') body = weightCard(uid, true);
  else if (tab === 'water') body = waterCard(uid, date, true);
  else if (tab === 'vs') body = vsCard(uid, windowDays(date, 31), true) + adlCard(uid, windowDays(date, 31), true);
  else if (tab === 'meal') body = mealCard(uid, windowDays(date, 14), true);

  return head + `
  <div class="p-who"><a href="#/person" class="p-back no-print">← 利用者一覧へ</a><strong>${esc(m.name)}</strong><span class="unit">（${esc(m.kana)}）</span></div>
  <div class="p-tabs no-print" role="tablist">${TABS.map(([k, l]) => `<a role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" href="#/person?u=${uid}&tab=${k}">${l}</a>`).join('')}</div>

  <section class="card p-card p-datebar">${deco}
    <div class="p-dates">
      <button type="button" class="btn sm no-print" data-date-step="-1">◀ 前日</button>
      <span class="p-date-label">${jpDate(date)}</span>
      <button type="button" class="btn sm no-print" data-date-step="1" ${date >= today ? 'disabled' : ''}>翌日 ▶</button>
      <input class="input p-date-input no-print" type="date" data-date-pick value="${date}" max="${today}" aria-label="日付を選ぶ">
      <button type="button" class="btn sm no-print" data-p-cal aria-label="カレンダーから選ぶ">📅</button>
      ${date !== today ? '<button type="button" class="btn sm ghost-pink no-print" data-date-today>今日へ</button>' : ''}
      <span class="sp"></span>
      <button type="button" class="btn sm no-print" data-p-print>🖨 印刷</button>
      ${tab === 'record' ? `<div class="p-menu no-print"><button type="button" class="btn sm p-menu-btn" data-p-menu aria-haspopup="true" aria-label="カードへ移動">☰</button>
        <div class="p-menu-list" hidden>${SECTIONS.map(([k, l]) => `<button type="button" data-p-jump="${k}">${l}</button>`).join('')}</div></div>` : ''}
    </div>
    <div class="p-name-row"><span class="person-name">${esc(m.name)}</span><span class="unit">${ageOf(p.birth, today)}才 / ${p.sex}</span></div>
  </section>
  ${body}`;
}

// =====================================================================
//  入力フォーム（モーダル）
// =====================================================================
function modalShell(date, inner, submitLabel = '記録する') {
  return `<form class="modal p-modal" novalidate>
    <div class="modal-head"><div class="d">${jpDate(date)}</div><div class="n">${esc(member(cur.uid).name)}</div></div>
    ${inner}
    <div class="p-modal-foot"><button type="button" class="btn" data-close>キャンセル</button><button type="submit" class="btn primary">${submitLabel}</button></div>
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
    box.dispatchEvent(new Event('pick', { bubbles: true }));
  });
}
const picked = (form, name) => [...form.querySelectorAll(`.p-pick[data-name="${name}"] .chip.on`)].map((c) => c.dataset.v);
const num = (v) => (String(v).trim() === '' ? '' : Number(v));
function done(msg) { closeModal(); toast(msg); rerender(); }

// ---- 病態・ADL／申し送り（同じフォーム） ----
function openRecordForm({ noteId, hoId, preset } = {}) {
  const n = noteId && store.db().notes.find((x) => x.id === noteId);
  const h = hoId && store.db().handovers.find((x) => x.id === hoId);
  const linkedHo = n && store.db().handovers.find((x) => x.noteId === n.id);
  const base = n || h;
  const date = base ? base.date : ui.date;
  const tags = n ? noteTags(n).concat(linkedHo && !noteTags(n).includes('申し送り') ? ['申し送り'] : []) : h ? ['申し送り'] : preset || ['記録'];
  const isEdit = !!base;
  openModal(modalShell(date, `
    <label class="field"><span>日付</span><input class="input" type="date" name="date" value="${date}" max="${todayStr()}"></label>
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${base ? base.time : nowHM()}"></label>
    ${isEdit ? '<p class="p-note">日付や時刻を変えると、元の記録を取り消して新しい記録として作り直します（記録者は操作した人になります）。</p>' : ''}
    <label class="field"><span>内容</span><textarea class="input" name="text" rows="4" data-autofocus placeholder="例: 昼食後に右膝の痛みの訴えあり。座位で休んでいただき軽減。">${esc(base ? base.text : '')}</textarea></label>
    <div class="field"><span>種類（任意）</span>${pickChips('tags', RECORD_TAGS, tags, true)}</div>
    <p class="p-note" data-ho-help ${tags.includes('申し送り') ? '' : 'hidden'}>「申し送り」を付けた記録は申し送りページにも出ます。この画面では「記録」も付いていると病態・ADL 欄に、「記録」なしなら申し送り欄に表示されます。</p>`,
  isEdit ? '保存する' : '記録する'), (form) => {
    wirePicks(form);
    form.addEventListener('pick', () => { form.querySelector('[data-ho-help]').hidden = !picked(form, 'tags').includes('申し送り'); });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const text = form.text.value.trim();
      if (!text) { form.text.focus(); toast('内容を入力してください'); return; }
      const tg = picked(form, 'tags');
      if (!tg.includes('記録') && !tg.includes('申し送り')) tg.unshift('記録');
      const d = form.date.value || ui.date;
      const t = form.time.value || nowHM();
      const me = store.getMe();
      const moved = base && (base.date !== d || base.time !== t);
      const staff = !base || moved ? me : base.staff;
      const wantRec = tg.includes('記録');
      const wantHo = tg.includes('申し送り');
      const cat = tg.includes('医療') ? '健康' : tg.includes('家族連絡') ? '家族連絡' : (n?.cat && n.cat !== '健康' && n.cat !== '家族連絡' ? n.cat : '様子');
      // 介護記録（「記録」付き）
      let note = n;
      if (wantRec) {
        if (note) store.updateNote(note.id, { date: d, time: t, text, tags: tg, cat, staff });
        else note = store.addNote({ uid: cur.uid, date: d, time: t, text, tags: tg, cat, staff });
      } else if (note) {
        store.removeNote(note.id);
        note = null;
      }
      // 申し送り
      const ho = linkedHo || h;
      if (wantHo) {
        const patch = { date: d, time: t, text, staff, noteId: note ? note.id : null };
        if (ho) store.updateHandover(ho.id, patch);
        else store.addHandover({ uid: cur.uid, level: 2, ...patch });
      } else if (ho) {
        store.removeHandover(ho.id);
      }
      done(isEdit ? '保存しました' : '記録しました');
    });
  });
}

// ---- VS ----
function openVsForm(kind, id) {
  const editing = kind === 'vsd' ? { date: id, ...pickVs(store.getDay(id, cur.uid)), time: store.getDay(id, cur.uid).vsTime || store.getDay(id, cur.uid).arrive, memo: store.getDay(id, cur.uid).vsMemo }
    : kind === 'vsl' ? store.db().vsLog.find((v) => v.id === id) : null;
  const date = editing ? editing.date : ui.date;
  const v = editing || {};
  openModal(modalShell(date, `
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${v.time || nowHM()}"></label>
    ${numField('体温', 'temp', '℃', v.temp, '36.5', '0.1')}
    <div class="field"><span>血圧（上 / 下）</span><div class="p-num"><input class="input big" type="number" inputmode="numeric" name="bpHi" value="${v.bpHi ?? ''}" placeholder="120" aria-label="上の血圧"><span class="unit">/</span><input class="input big" type="number" inputmode="numeric" name="bpLo" value="${v.bpLo ?? ''}" placeholder="70" aria-label="下の血圧"><span class="unit">mmHg</span></div></div>
    ${numField('脈拍', 'pulse', '回/分', v.pulse, '70')}
    ${numField('SpO2', 'spo2', '%', v.spo2, '98')}
    <label class="field"><span>メモ（任意）</span><input class="input" name="memo" value="${esc(v.memo || '')}" placeholder="例: 入浴前、様子観察"></label>`,
  editing ? '保存する' : '記録する'), (form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const val = { temp: num(form.temp.value), bpHi: num(form.bpHi.value), bpLo: num(form.bpLo.value), pulse: num(form.pulse.value), spo2: num(form.spo2.value) };
      if (Object.values(val).every((x) => x === '')) { toast('どれか1つは入力してください'); return; }
      const time = form.time.value || nowHM();
      const memo = form.memo.value.trim();
      if (kind === 'vsd') store.setDay(date, cur.uid, { ...val, vsTime: time, vsMemo: memo });
      else if (kind === 'vsl') store.updateItem('vsLog', id, { ...val, time, memo });
      else {
        const e = store.getDay(date, cur.uid);
        // その日の業務日誌にバイタルがまだ無ければ、業務日誌側に入れる（通所の表にも反映される）
        if (!e.temp && !e.bpHi && !e.pulse && !e.spo2) store.setDay(date, cur.uid, { ...val, vsTime: time, vsMemo: memo, arrive: e.arrive || time, absent: '' });
        else store.addItem('vsLog', { uid: cur.uid, date, time, ...val, memo });
      }
      done('VSを記録しました');
    });
  });
}

// ---- 食事 ----
function openMealForm(kind, id) {
  let v = null;
  if (kind === 'meald') { const e = store.getDay(id, cur.uid); v = { date: id, kind: '昼食', main: e.mealMain, side: e.mealSide, memo: e.mealMemo }; }
  else if (kind === 'meal') v = store.db().meals.find((x) => x.id === id);
  const date = v ? v.date : ui.date;
  openModal(modalShell(date, `
    <div class="field"><span>食事</span>${pickChips('kind', MEAL_KINDS, v ? v.kind : '昼食')}</div>
    ${numField('主食', 'main', '割（0〜10）', v?.main, '10')}
    ${numField('副食', 'side', '割（0〜10）', v?.side, '10')}
    <label class="field"><span>メモ（任意）</span><input class="input" name="memo" value="${esc(v?.memo || '')}" placeholder="例: 好きなおかずから食べられた"></label>`,
  v ? '保存する' : '記録する'), (form) => {
    wirePicks(form);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const mk = picked(form, 'kind')[0] || '昼食';
      const clamp = (x) => (x === '' ? '' : Math.max(0, Math.min(10, Math.round(x))));
      const main = clamp(num(form.main.value));
      const side = clamp(num(form.side.value));
      const memo = form.memo.value.trim();
      if (main === '' && side === '') { toast('主食か副食を入力してください'); return; }
      if (kind === 'meald') store.setDay(date, cur.uid, { mealMain: '', mealSide: '', mealMemo: '' });
      if (kind === 'meal') store.removeItem('meals', id);
      // 昼食は業務日誌の「食事」と同じ場所に保存する
      if (mk === '昼食') store.setDay(date, cur.uid, { mealMain: main, mealSide: side, mealMemo: memo });
      else store.addItem('meals', { uid: cur.uid, date, kind: mk, main: main === '' ? null : main, side: side === '' ? null : side, memo });
      done('食事を記録しました');
    });
  });
}

// ---- 飲水・尿便（業務日誌の水分・排泄に足す） ----
function openDrinkForm() {
  openModal(modalShell(ui.date, `
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${nowHM()}"></label>
    ${numField('飲水量', 'ml', 'ml', '', '150', '10')}
    <div class="chips" style="margin:-4px 0 12px">${[100, 150, 200].map((x) => `<button type="button" class="chip" data-p-ml="${x}">＋${x}ml</button>`).join('')}</div>
    <label class="field"><span>内容（任意）</span><input class="input" name="memo" placeholder="例: お茶、ポカリ"></label>`), (form) => {
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p-ml]');
      if (b) form.ml.value = (Number(form.ml.value) || 0) + Number(b.dataset.pMl);
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const ml = num(form.ml.value);
      if (!ml || ml < 0) { toast('飲水量を入力してください'); return; }
      const e = store.getDay(ui.date, cur.uid);
      store.setDay(ui.date, cur.uid, { water: (e.water || 0) + ml });
      done(`${ml}ml を記録しました`);
    });
  });
}
function openExcrForm() {
  openModal(modalShell(ui.date, `
    <label class="field"><span>時刻</span><input class="input" type="time" name="time" value="${nowHM()}"></label>
    <div class="field"><span>種別</span>${pickChips('type', ['尿', '便'], '尿')}</div>
    <label class="field"><span>メモ（任意）</span><input class="input" name="memo" placeholder="例: 普通便、量多め"></label>`), (form) => {
    wirePicks(form);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const t = picked(form, 'type')[0] || '尿';
      const e = store.getDay(ui.date, cur.uid);
      const k = t === '尿' ? 'urine' : 'stool';
      store.setDay(ui.date, cur.uid, { [k]: (e[k] || 0) + 1 });
      done(`${t}を記録しました`);
    });
  });
}

// ---- 体重 ----
function openWeightForm(id) {
  const w = id && store.db().weights.find((x) => x.id === id);
  const date = w ? w.date : ui.date;
  openModal(modalShell(date, numField('体重', 'kg', 'kg', w?.kg, '45.0', '0.1'), w ? '保存する' : '記録する'), (form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const kg = num(form.kg.value);
      if (!kg || kg < 20 || kg > 200) { toast('体重を入力してください'); return; }
      const v = Math.round(kg * 10) / 10;
      if (w) store.updateItem('weights', w.id, { kg: v });
      else {
        const same = store.db().weights.find((x) => x.uid === cur.uid && x.date === date);
        if (same) store.updateItem('weights', same.id, { kg: v });
        else store.addItem('weights', { uid: cur.uid, date, kg: v });
      }
      done('体重を記録しました');
    });
  });
}

// ---- 基本情報 ----
function openBasicForm(full) {
  const p = store.getProfile(cur.uid);
  const extra = full ? `
    <label class="field"><span>看護目標</span><textarea class="input" name="nurseGoal" rows="2">${esc(p.nurseGoal)}</textarea></label>
    <label class="field"><span>介護目標</span><textarea class="input" name="careGoal" rows="2">${esc(p.careGoal)}</textarea></label>
    <label class="field"><span>薬剤</span><input class="input" name="meds" value="${esc(p.meds)}"></label>
    <label class="field"><span>自立度</span><input class="input" name="indep" value="${esc(p.indep)}"></label>
    <label class="field"><span>サービス利用状況</span><input class="input" name="service" value="${esc(p.service)}"></label>` : '';
  openModal(`<form class="modal p-modal" novalidate>
    <div class="modal-head"><div class="n">${esc(member(cur.uid).name)}</div></div>
    <label class="field"><span>生年月日（年齢の表示に使います）</span><input class="input" type="date" name="birth" value="${p.birth || ''}"></label>
    <div class="field"><span>性別</span>${pickChips('sex', ['女性', '男性'], p.sex === '女' ? '女性' : '男性')}</div>
    <label class="field"><span>介護度</span><select class="input" name="level">${LEVELS.map((l) => `<option ${l === p.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span>疾患</span><input class="input" name="disease" value="${esc(p.disease)}"></label>
    <label class="field"><span>ケアプラン（要点）</span><textarea class="input" name="plan" rows="2">${esc(p.plan)}</textarea></label>
    ${extra}
    <div class="p-modal-foot"><button type="button" class="btn" data-close>キャンセル</button><button type="submit" class="btn primary">保存する</button></div>
  </form>`, (form) => {
    wirePicks(form);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const patch = { birth: form.birth.value, sex: picked(form, 'sex')[0] === '女性' ? '女' : '男', level: form.level.value, disease: form.disease.value.trim(), plan: form.plan.value.trim() };
      if (full) ['nurseGoal', 'careGoal', 'meds', 'indep', 'service'].forEach((k) => { patch[k] = form[k].value.trim(); });
      store.setProfile(cur.uid, patch);
      done('基本情報を保存しました');
    });
  });
}

// ---- 取り消し ----
async function removeRow(kind, id) {
  const uid = cur.uid;
  let label = '';
  let run = null;
  if (kind === 'note') {
    const n = store.db().notes.find((x) => x.id === id);
    label = `${n.time} の記録「${n.text.length > 24 ? n.text.slice(0, 24) + '…' : n.text}」`;
    run = () => { store.removeNote(id); store.db().handovers.filter((h) => h.noteId === id).forEach((h) => store.removeHandover(h.id)); };
  } else if (kind === 'ho') {
    const h = store.db().handovers.find((x) => x.id === id);
    label = `${h.time} の申し送り「${h.text.length > 24 ? h.text.slice(0, 24) + '…' : h.text}」`;
    run = () => store.removeHandover(id);
  } else if (kind === 'vsd') {
    label = `${jpDate(id, false)} のVS（業務日誌）`;
    run = () => store.setDay(id, uid, { temp: '', bpHi: '', bpLo: '', pulse: '', spo2: '', vsTime: '', vsMemo: '' });
  } else if (kind === 'vsl') {
    const v = store.db().vsLog.find((x) => x.id === id);
    label = `${jpDate(v.date, false)} ${v.time} のVS`;
    run = () => store.removeItem('vsLog', id);
  } else if (kind === 'meald') {
    label = `${jpDate(id, false)} の昼食`;
    run = () => store.setDay(id, uid, { mealMain: '', mealSide: '', mealMemo: '' });
  } else if (kind === 'meal') {
    const m = store.db().meals.find((x) => x.id === id);
    label = `${jpDate(m.date, false)} の${m.kind}`;
    run = () => store.removeItem('meals', id);
  } else if (kind === 'weight') {
    const w = store.db().weights.find((x) => x.id === id);
    label = `${jpDate(w.date, false)} の体重 ${w.kg}kg`;
    run = () => store.removeItem('weights', id);
  }
  if (!run) return;
  if (await confirmDialog(`${label}を取り消しますか？`)) { run(); toast('取り消しました'); rerender(); }
}

// =====================================================================
//  イベント
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
    if (jump) {
      menuList.hidden = true;
      document.getElementById(`p-${jump.dataset.pJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const metric = t.closest('[data-p-metric]');
    if (metric) { ui.pMetric = metric.dataset.pMetric; render(); return; }
    if (t.closest('[data-p-cal]')) {
      const inp = view.querySelector('[data-date-pick]');
      try { inp.showPicker(); } catch { inp.focus(); }
      return;
    }
    if (t.closest('[data-p-print]')) { window.print(); return; }
    const add = t.closest('[data-p-add]');
    if (add) {
      const k = add.dataset.pAdd;
      if (k === 'note') openRecordForm({ preset: ['記録', '通所'] });
      else if (k === 'ho') openRecordForm({ preset: ['申し送り'] });
      else if (k === 'vs') openVsForm();
      else if (k === 'meal') openMealForm();
      else if (k === 'drink') openDrinkForm();
      else if (k === 'excr') openExcrForm();
      else if (k === 'weight') openWeightForm();
      else if (k === 'basic') openBasicForm(false);
      else if (k === 'sheet') openBasicForm(true);
      return;
    }
    const edit = t.closest('[data-p-edit]');
    if (edit) {
      const { pEdit: k } = edit.dataset;
      const id = edit.dataset.id;
      if (k === 'note') openRecordForm({ noteId: id });
      else if (k === 'ho') openRecordForm({ hoId: id });
      else if (k === 'vsd' || k === 'vsl') openVsForm(k, id);
      else if (k === 'meald' || k === 'meal') openMealForm(k, id);
      else if (k === 'weight') openWeightForm(id);
      return;
    }
    const del = t.closest('[data-p-del]');
    if (del) removeRow(del.dataset.pDel, del.dataset.id);
  });
  view.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-p-range]')) { ui.pWeightRange = ev.target.value; render(); }
  });
}
