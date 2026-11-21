// 通所（業務日誌の表）。マスを押すとポップアップで入力し、「保存」を押すまでは下書きとして持つ。
import { MEMBERS, WD, WEEK_ORDER, EXERCISES, EX_MINUTES, BATH_KINDS, todayStr, weekdayOf, staffOn } from './data.js';
import * as store from './store.js';
import { esc, jpDate, nowHM, toast, openModal, closeModal, ui, scriptTitle, subtabs, DAY_TABS, dateNav } from './ui.js';
import { member, rosterFor, dayStatus, vsOut, mealOf, waterTotal, excrOf, weightOn, lastStoolLabel, isNeeded, membersOnWeekday, byKana } from './model.js';

// ---------- 列の定義 ----------
const WARI = ['', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'];
const COLS = [
  { key: 'arrive', label: '来所時間', kind: 'time' },
  { key: 'nurse', label: '看護師', kind: 'toggle' },
  { key: 'temp', label: '体温', parent: 'VS', kind: 'vs' },
  { key: 'pulse', label: '脈拍', parent: 'VS', kind: 'vs' },
  { key: 'bp', label: '血圧', parent: 'VS', kind: 'vs' },
  { key: 'spo2', label: 'SpO2', parent: 'VS', kind: 'vs' },
  { key: 'weight', label: '体重', kind: 'num', unit: 'kg', step: '0.1' },
  { key: 'medAm', label: '朝', parent: '服薬', kind: 'toggle' },
  { key: 'medNoonB', label: '昼前', parent: '服薬', kind: 'toggle' },
  { key: 'medNoonA', label: '昼後', parent: '服薬', kind: 'toggle' },
  { key: 'medEve', label: '夕', parent: '服薬', kind: 'toggle' },
  { key: 'mealMain', label: '主食', parent: '食事', kind: 'meal' },
  { key: 'mealSide', label: '副食', parent: '食事', kind: 'meal' },
  { key: 'snack', label: 'おやつ', kind: 'wari' },
  { key: 'water', label: '水分', kind: 'water' },
  { key: 'bath', label: '入浴', kind: 'bath' },
  { key: 'exercise', label: '運動', kind: 'ex' },
  { key: 'urine', label: '排尿', kind: 'count' },
  { key: 'stool', label: '排便', kind: 'count' },
  { key: 'book', label: '帳面', kind: 'toggle' },
  { key: 'note', label: '備考', kind: 'note' },
];
const colOf = (k) => COLS.find((c) => c.key === k);
const DAILY_KEYS = ['absent', 'arrive', 'nurse', 'temp', 'pulse', 'bpHi', 'bpLo', 'spo2', 'medAm', 'medNoonB', 'medNoonA', 'medEve', 'bath', 'exercise', 'exMin', 'book', 'note', 'contactPrint'];

// ---------- 1 行ぶんの値（保存済み＋下書き） ----------
function committed(date, uid) {
  const e = store.getDay(date, uid);
  const lunch = mealOf(uid, date, '昼食');
  const snack = mealOf(uid, date, 'おやつ');
  return {
    ...e,
    weight: weightOn(uid, date)?.kg,
    mealMain: lunch?.main, mealSide: lunch?.side,
    snack: snack?.main,
    water: waterTotal(uid, date) || undefined,
    urine: excrOf(uid, date, '尿').length || undefined,
    stool: excrOf(uid, date, '便').length || undefined,
  };
}
function rowVals(date, uid) {
  const c = committed(date, uid);
  const d = store.getDraft(date, uid);
  if (!d) return c;
  const v = { ...c, ...d };
  if (d.waterAdd) v.water = (c.water || 0) + d.waterAdd;
  return v;
}
const isEmpty = (v) => v === undefined || v === null || v === '' || v === false;

// 下書きを記録にする
export function commitRow(date, uid) {
  const d = store.getDraft(date, uid);
  if (!d) return false;
  const me = store.getMe();
  const patch = {};
  DAILY_KEYS.forEach((k) => { if (k in d) patch[k] = d[k]; });
  const e = store.getDay(date, uid);
  const hasVs = ['temp', 'pulse', 'bpHi', 'spo2'].some((k) => !isEmpty(d[k]));
  if (hasVs) {
    patch.vsTime = d.vsTime || e.vsTime || nowHM();
    patch.vsStaff = me;
    if (!e.arrive && !d.arrive) patch.arrive = patch.vsTime;
    patch.absent = '';
  }
  if (Object.keys(patch).length) store.setDay(date, uid, patch);
  if ('weight' in d) {
    const w = weightOn(uid, date);
    if (isEmpty(d.weight)) { if (w) store.remove('weights', w.id); } else if (w) store.update('weights', w.id, { kg: Number(d.weight) }); else store.add('weights', { uid, date, kg: Number(d.weight), staff: me });
  }
  const upMeal = (kind, main, side) => {
    const m = mealOf(uid, date, kind);
    if (isEmpty(main) && isEmpty(side)) { if (m) store.remove('meals', m.id); return; }
    const val = { main: isEmpty(main) ? null : Number(main), side: isEmpty(side) ? null : Number(side) };
    if (m) store.update('meals', m.id, val); else store.add('meals', { uid, date, kind, time: d.mealTime || nowHM(), staff: me, memo: '', ...val });
  };
  if ('mealMain' in d || 'mealSide' in d) {
    const m = mealOf(uid, date, '昼食');
    upMeal('昼食', 'mealMain' in d ? d.mealMain : m?.main, 'mealSide' in d ? d.mealSide : m?.side);
  }
  if ('snack' in d) upMeal('おやつ', d.snack, null);
  if (d.waterAdd) store.add('drinks', { uid, date, time: nowHM(), ml: d.waterAdd, what: 'お茶', staff: me });
  ['urine', 'stool'].forEach((k) => {
    if (!(k in d)) return;
    const type = k === 'urine' ? '尿' : '便';
    const cur = excrOf(uid, date, type);
    const want = Number(d[k]) || 0;
    for (let i = cur.length; i < want; i++) store.add('excr', { uid, date, time: nowHM(), type, staff: me });
    cur.slice(want).forEach((x) => store.remove('excr', x.id));
  });
  store.dropDraft(date, uid);
  return true;
}

// ---------- マスの表示 ----------
function cellText(col, v, uid, date) {
  const k = col.key;
  const out = (s, warn) => `<span class="${warn ? 'vs-out' : ''}">${s}</span>`;
  switch (k) {
    case 'temp': return isEmpty(v.temp) ? '' : out(`${Number(v.temp)}℃`, vsOut.temp(v.temp));
    case 'pulse': return isEmpty(v.pulse) ? '' : out(v.pulse, vsOut.pulse(v.pulse));
    case 'bp': return isEmpty(v.bpHi) ? '' : out(`${v.bpHi}/${v.bpLo ?? '-'}`, vsOut.bp(v.bpHi, v.bpLo));
    case 'spo2': return isEmpty(v.spo2) ? '' : out(v.spo2, vsOut.spo2(v.spo2));
    case 'urine': case 'stool': return isEmpty(v[k]) ? '' : `${v[k]}回`;
    case 'bath': return isEmpty(v.bath) ? '' : esc(v.bath === '中止' ? '中止' : v.bath.replace('浴', ''));
    case 'exercise': return isEmpty(v.exercise) ? '' : `<span class="small">${esc(v.exercise)}${v.exMin ? `<br>${esc(v.exMin)}` : ''}</span>`;
    case 'note': return '';
    default:
      if (col.kind === 'toggle') return v[k] ? '○' : '';
      return isEmpty(v[k]) ? '' : esc(String(v[k]));
  }
}

function thInner(c) { return `<button type="button" class="th-btn" data-bulk="${c.key}">${c.label}</button>`; }

function tableHtml(date, rows) {
  const h1 = [];
  const h2 = [];
  for (let i = 0; i < COLS.length;) {
    const c = COLS[i];
    if (c.parent) {
      const group = COLS.filter((x) => x.parent === c.parent);
      h1.push(`<th colspan="${group.length}" class="grp">${c.parent}</th>`);
      group.forEach((x) => h2.push(`<th>${thInner(x)}</th>`));
      i += group.length;
    } else { h1.push(`<th rowspan="2">${thInner(c)}</th>`); i++; }
  }
  const body = rows.map((m, idx) => {
    const v = rowVals(date, m.id);
    const st = dayStatus(date, m.id, v);
    const draft = !!store.getDraft(date, m.id);
    const rm = store.getMap('remarks', m.id);
    const ls = lastStoolLabel(m.id, date);
    const tds = COLS.map((c) => {
      if (c.key === 'note') {
        return `<td class="note-td"><div class="note-box">${rm?.text ? `<span>${esc(rm.text)}</span>` : ''}${v.note ? `<span class="day-note">${esc(v.note)}</span>` : ''}<button type="button" class="cell-plus" data-cell="note" data-uid="${m.id}" aria-label="${esc(m.name)} の備考">＋</button></div></td>`;
      }
      const t = cellText(c, v, m.id, date);
      const needKey = c.key === 'mealSide' ? 'mealMain' : c.key;
      const empty = !t;
      const mark = empty ? (isNeeded(m.id, needKey) ? '<span class="plus">＋</span>' : '<span class="cross">×</span>') : t;
      return `<td><button type="button" class="cell" data-cell="${c.key}" data-uid="${m.id}" aria-label="${esc(m.name)} の${c.label}">${mark}</button></td>`;
    }).join('');
    return `<tr class="${st === 'off' ? 'is-off' : ''} ${draft ? 'is-draft' : ''}">
      <td class="name-td"><span class="no">${idx + 1}.</span> <a class="name-link" href="#/oneday?u=${m.id}">${esc(m.name)}</a>${st === 'in' ? '<br><span class="badge-in">通所中</span>' : st === 'off' ? '<br><span class="badge-off">休み</span>' : ''}</td>
      <td class="chk"><input type="checkbox" data-absent="${m.id}" ${v.absent ? 'checked' : ''} aria-label="${esc(m.name)} を休みにする"></td>
      ${tds}
      <td class="ls ${ls.warn ? 'warn' : ''}">${ls.text}</td>
      <td class="chk"><input type="checkbox" data-print-mark="${m.id}" ${v.contactPrint ? 'checked' : ''} aria-label="${esc(m.name)} の連絡帳を印刷対象にする"></td>
      <td class="ops"><a class="btn xs" href="#/oneday?u=${m.id}">入力</a><button type="button" class="btn xs ${draft ? 'pink' : ''}" data-row-save="${m.id}">保存</button></td>
    </tr>`;
  }).join('');
  return `<div class="diary-wrap"><table class="diary">
    <thead><tr><th rowspan="2" class="name-th">名前</th><th rowspan="2">休み</th>${h1.join('')}<th rowspan="2">最終排便</th><th rowspan="2">連絡帳</th><th rowspan="2">操作</th></tr><tr>${h2.join('')}</tr></thead>
    <tbody>${body || `<tr><td colspan="${COLS.length + 5}" class="empty">この日の利用予定はありません</td></tr>`}</tbody>
  </table></div>`;
}

// ---------- 画面 ----------
export function renderDay() {
  const date = ui.date;
  let rows = rosterFor(date);
  const st = { in: 0, wait: 0 };
  rows.forEach((m) => { const s = dayStatus(date, m.id, rowVals(date, m.id)); if (s in st) st[s]++; });
  if (ui.daySort === 'in') rows = rows.slice().sort((a, b) => (dayStatus(date, a.id, rowVals(date, a.id)) === 'in' ? 0 : 1) - (dayStatus(date, b.id, rowVals(date, b.id)) === 'in' ? 0 : 1));
  const drafts = store.draftKeys(date).length;
  const sp = store.getMap('special', date, {}) || {};
  const changes = store.list('changes').filter((c) => c.date === date);
  const tw = weekdayOf(todayStr());

  return `${subtabs(DAY_TABS, '#/day')}
  ${scriptTitle('Day Service', '通所', '', `<a class="btn" href="#/bdiary">業務日誌を開く</a><button type="button" class="btn" data-print>印刷</button><a class="btn" href="#/day/contact">連絡帳を印刷</a>`)}
  ${dateNav(date)}
  <section class="card">
    <div class="diary-head">
      <h2 class="sec-ttl"><span class="script">Diary</span>業務日誌</h2>
      <span class="sum">通所中: ${st.in}名</span><span class="sum warn">予定あり・未到着: ${st.wait}名</span>
      <span class="sp"></span>
      <span class="sort-l">並び順</span>
      <button type="button" class="chip ${ui.daySort === 'kana' ? 'on' : ''}" data-day-sort="kana">あいうえお順</button>
      <button type="button" class="chip ${ui.daySort === 'in' ? 'on' : ''}" data-day-sort="in">通所中を先</button>
    </div>
    <p class="muted-p">紙の業務日誌と同じ並びです。マスを押すとポップアップで入力でき、 見出し (体温・食事・水分など) を押すと全員まとめて入力できます。 VS を入れると通所中になります。</p>
    <div class="save-row"><button type="button" class="btn big-pink" data-save-all ${drafts ? '' : 'disabled'}>変更をまとめて保存 (${drafts} 名)</button><span class="muted-p">触った欄だけが保存されます。行の「保存」で 1 名ずつでも保存できます。</span></div>
    ${tableHtml(date, rows)}
    <p class="muted-p small-p">VS のピンクは「基準を外れた値」です。 デモの基準は 体温 37.5℃以上 / 血圧 160以上・90未満 / 脈拍 100以上・50未満 / SpO2 93%未満。</p>
    <label class="f-label" for="add-row">利用者検索</label>
    <div class="suggest-wrap"><input id="add-row" class="input round" data-add-row-q placeholder="行を追加: 氏名・ふりがなで検索" autocomplete="off"><div class="suggest" data-add-row-list hidden></div></div>
  </section>

  <section class="card">
    <div class="ttl-line"><h2 class="sec-ttl plain">特記・スケジュール・訪問時内服チェック・出勤者</h2><button type="button" class="btn" data-special-save>この欄を保存</button></div>
    <p class="muted-p">保存すると、その日の業務日誌 (文章のほう) の特記事項にも同じ内容が載り、印刷にも出ます。</p>
    <div class="ttl-line"><h3 class="h3">特記</h3><button type="button" class="btn sm" data-special-add>特記を書く</button></div>
    ${(sp.notes || []).length ? `<ul class="sp-notes">${sp.notes.map((n, i) => `<li><span class="tag-s">${esc(n.kind)}</span>${esc(n.text)} <button type="button" class="link-x" data-special-del="${i}" aria-label="削除">×</button></li>`).join('')}</ul>` : '<p class="muted-p">まだ書かれていません。「特記を書く」から毎日・毎週・臨時を選んで書けます。</p>'}
    <h3 class="h3">スケジュール</h3>
    <textarea class="input sq" data-sp="schedule" rows="4">${esc(sp.schedule || '')}</textarea>
    <button type="button" class="btn sm mt8" data-copy-changes>予定から写す (${changes.length} 件)</button>
    <p class="trash"><b>本日のゴミ:</b> ${esc(sp.trash || 'なし')}　<button type="button" class="link-pink" data-trash>ゴミの予定を記入・修正</button></p>
    <h3 class="h3">訪問時内服チェック</h3>
    <p class="muted-p">訪問時の内服を設定した利用者がいません (利用者一覧の「詳細」で内服にチェックした人がこの表に出ます)。</p>
    <h3 class="h3">出勤者</h3>
    <textarea class="input sq" data-sp="staff" rows="3">${esc(sp.staff || '')}</textarea>
    <button type="button" class="btn sm mt8" data-copy-staff>シフトから写す (${staffOn(date).length} 名)</button>
  </section>

  <section class="card">
    <h2 class="sec-ttl"><span class="script">Weekly</span>曜日別利用者一覧</h2>
    <div class="weekly-wrap"><table class="weekly">
      <thead><tr>${WEEK_ORDER.map((w) => `<th class="${w === tw ? 'today' : ''}">${WD[w]}${w === tw ? ' <small>(今日)</small>' : ''} <small>${membersOnWeekday(w).length}名</small></th>`).join('')}</tr></thead>
      <tbody><tr>${WEEK_ORDER.map((w) => `<td class="${w === tw ? 'today' : ''}">${membersOnWeekday(w).map((m) => `<div>${esc(m.name)} <small>${m.level}</small></div>`).join('')}</td>`).join('')}</tr></tbody>
    </table></div>
  </section>`;
}

// ---------- ポップアップ ----------
function ctlHtml(col, v, name = col.key) {
  switch (col.kind) {
    case 'time': return `<input class="input round big" type="time" name="${name}" value="${v[col.key] || ''}">`;
    case 'toggle': return `<label class="check-l"><input type="checkbox" name="${name}" ${v[col.key] ? 'checked' : ''}> 済み</label>`;
    case 'num': return `<input class="input round big" type="number" step="${col.step || '1'}" inputmode="decimal" name="${name}" value="${v[col.key] ?? ''}" placeholder="${col.unit || ''}">`;
    case 'meal': case 'wari': return `<select class="input round big" name="${name}">${WARI.map((x) => `<option value="${x}" ${String(v[col.key] ?? '') === x ? 'selected' : ''}>${x === '' ? '—' : x + ' 割'}</option>`).join('')}</select>`;
    case 'water': return `<select class="input round big" name="${name}"><option value="">—</option>${[50, 100, 150, 200, 250, 300].map((x) => `<option value="${x}">＋${x} ml</option>`).join('')}</select>`;
    case 'bath': return `<select class="input round big" name="${name}"><option value="">—</option>${BATH_KINDS.map((x) => `<option ${v.bath === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
    case 'ex': return `<div class="two"><select class="input round" name="${name}"><option value="">—</option>${EXERCISES.map((x) => `<option ${v.exercise === x ? 'selected' : ''}>${x}</option>`).join('')}</select><select class="input round" name="${name}__min"><option value="">—</option>${EX_MINUTES.map((x) => `<option ${v.exMin === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`;
    case 'count': return `<select class="input round big" name="${name}">${['', '0', '1', '2', '3', '4', '5'].map((x) => `<option value="${x}" ${String(v[col.key] ?? '') === x ? 'selected' : ''}>${x === '' ? '—' : x + ' 回'}</option>`).join('')}</select>`;
    case 'note': return `<textarea class="input sq" name="${name}" rows="3" placeholder="この日だけの備考">${esc(v.note || '')}</textarea>`;
    default: return '';
  }
}
function readCtl(col, form, name = col.key) {
  const el = form.elements[name];
  if (!el) return {};
  switch (col.kind) {
    case 'toggle': return { [col.key]: el.checked };
    case 'water': return el.value ? { waterAdd: Number(el.value) } : {};
    case 'ex': return { exercise: el.value, exMin: form.elements[name + '__min'].value };
    case 'num': case 'meal': case 'wari': case 'count': return { [col.key]: el.value === '' ? '' : Number(el.value) };
    default: return { [col.key]: el.value.trim() };
  }
}
const vsInputs = (v, p = '') => `
  <label class="f-row"><span>体温</span><input class="input round big" type="number" step="0.1" inputmode="decimal" name="${p}temp" value="${v.temp ?? ''}" placeholder="36.5"></label>
  <label class="f-row"><span>脈拍</span><input class="input round big" type="number" inputmode="numeric" name="${p}pulse" value="${v.pulse ?? ''}" placeholder="72"></label>
  <label class="f-row"><span>血圧</span><input class="input round big" name="${p}bp" inputmode="numeric" value="${v.bpHi ? `${v.bpHi}/${v.bpLo ?? ''}` : ''}" placeholder="120/80"></label>
  <label class="f-row"><span>SpO2</span><input class="input round big" type="number" inputmode="numeric" name="${p}spo2" value="${v.spo2 ?? ''}" placeholder="97"></label>`;
function readVs(form, p = '') {
  const n = (k) => { const s = form.elements[p + k].value.trim(); return s === '' ? '' : Number(s); };
  const bp = form.elements[p + 'bp'].value.trim();
  const [hi, lo] = bp ? bp.split(/[\/／\s]+/).map(Number) : ['', ''];
  return { temp: n('temp'), pulse: n('pulse'), bpHi: Number.isFinite(hi) ? hi : '', bpLo: Number.isFinite(lo) ? lo : '', spo2: n('spo2') };
}

function popupShell(date, title, sub, inner, extraBtn = '') {
  return `<form class="modal" novalidate>
    <div class="modal-head"><div class="d">${jpDate(date)}</div><div class="n">${title}</div><div class="s">${sub}</div></div>
    ${inner}
    <div class="modal-foot3"><button type="button" class="btn" data-close>キャンセル</button>${extraBtn}<button type="submit" class="btn grad">登録する</button></div>
  </form>`;
}

function openCell(key, uid) {
  const date = ui.date;
  const m = member(uid);
  const v = rowVals(date, uid);
  const col = colOf(key);
  const isVs = col.kind === 'vs';
  const inner = isVs ? vsInputs(v)
    : col.kind === 'meal' ? `<label class="f-col"><span>食事主食</span>${ctlHtml(colOf('mealMain'), v)}</label><label class="f-col"><span>食事副食</span>${ctlHtml(colOf('mealSide'), v)}</label>`
    : `<label class="f-col"><span>${col.label}${col.unit ? `（${col.unit}）` : ''}</span>${ctlHtml(col, v)}</label>${col.kind === 'water' && v.water ? `<p class="hint">いまの合計: ${v.water} ml</p>` : ''}`;
  const timeRow = `<label class="f-col"><span>記録の時刻</span><input class="input round big" type="time" name="__time" value="${nowHM()}"></label><p class="hint">いまの時刻を最初から入れています。変えなければこのまま記録します</p>`;
  openModal(popupShell(date, esc(m.name), `${isVs ? 'VS' : col.parent === '食事' ? '食事' : col.label}の入力`, inner + (col.kind === 'time' || col.kind === 'note' ? '' : timeRow), '<button type="button" class="btn ghost-pink" data-clear>入力を消去</button>'), (form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      let patch;
      if (isVs) patch = { ...readVs(form), vsTime: form.elements.__time.value || nowHM() };
      else if (col.kind === 'meal') patch = { ...readCtl(colOf('mealMain'), form), ...readCtl(colOf('mealSide'), form), mealTime: form.elements.__time.value };
      else patch = readCtl(col, form);
      if (patch.waterAdd) patch.waterAdd += store.getDraft(date, uid)?.waterAdd || 0;
      store.setDraft(date, uid, patch);
      closeModal();
      toast(`${m.name} さん: 未保存です（行の「保存」か「変更をまとめて保存」で記録になります）`);
      rerender();
    });
    form.querySelector('[data-clear]').addEventListener('click', () => {
      const clear = isVs ? { temp: '', pulse: '', bpHi: '', bpLo: '', spo2: '' } : col.kind === 'meal' ? { mealMain: '', mealSide: '' } : col.kind === 'ex' ? { exercise: '', exMin: '' } : col.kind === 'water' ? { waterAdd: 0 } : { [col.key]: col.kind === 'count' ? 0 : '' };
      store.setDraft(date, uid, clear);
      closeModal(); toast('消去しました（未保存）'); rerender();
    });
  });
}

function openBulk(key) {
  const date = ui.date;
  const col = colOf(key);
  const targets = rosterFor(date).filter((m) => !rowVals(date, m.id).absent);
  if (!targets.length) { toast('対象の方がいません'); return; }
  const isVs = col.kind === 'vs';
  const rows = targets.map((m, i) => {
    const v = rowVals(date, m.id);
    const ctl = isVs ? `<div class="vs-grid">${vsInputs(v, `r${i}_`)}</div>`
      : col.kind === 'meal' ? `<div class="two">${ctlHtml(colOf('mealMain'), v, `r${i}_mealMain`)}${ctlHtml(colOf('mealSide'), v, `r${i}_mealSide`)}</div>`
      : ctlHtml(col, v, `r${i}_${col.key}`);
    return `<div class="bulk-row"><b>${esc(m.name)}</b>${ctl}</div>`;
  }).join('');
  const title = isVs ? 'VS の一括入力' : col.parent === '食事' ? '食事の一括入力' : `${col.label}の一括入力`;
  openModal(`<form class="modal wide" novalidate>
    <div class="modal-head"><div class="d">${jpDate(date)}</div><div class="n">${title}</div><div class="s">休みの人は対象外です。「登録する」までは記録になりません</div></div>
    ${col.kind === 'time' ? '<button type="button" class="btn sm" data-fill-now>空欄を いまの時刻 で埋める</button>' : ''}
    <div class="bulk-list">${rows}</div>
    <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button type="submit" class="btn grad">登録する</button></div>
  </form>`, (form) => {
    form.querySelector('[data-fill-now]')?.addEventListener('click', () => {
      form.querySelectorAll('input[type=time]').forEach((el) => { if (!el.value) el.value = nowHM(); });
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      let n = 0;
      targets.forEach((m, i) => {
        const before = JSON.stringify(rowVals(date, m.id));
        let patch;
        if (isVs) patch = readVs(form, `r${i}_`);
        else if (col.kind === 'meal') patch = { ...readCtl(colOf('mealMain'), form, `r${i}_mealMain`), ...readCtl(colOf('mealSide'), form, `r${i}_mealSide`) };
        else patch = readCtl(col, form, `r${i}_${col.key}`);
        const cur = rowVals(date, m.id);
        const changed = Object.entries(patch).filter(([k, val]) => k === 'waterAdd' ? val > 0 : String(cur[k] ?? '') !== String(val ?? '') && !(isEmpty(cur[k]) && isEmpty(val)));
        if (!changed.length) return;
        const p = Object.fromEntries(changed);
        if (p.waterAdd) p.waterAdd += store.getDraft(date, m.id)?.waterAdd || 0;
        store.setDraft(date, m.id, p);
        if (JSON.stringify(rowVals(date, m.id)) !== before) n++;
      });
      closeModal();
      toast(n ? `${n} 名に入力しました（未保存）` : '変更はありません');
      rerender();
    });
  });
}

function openSpecialNote() {
  openModal(`<form class="modal" novalidate>
    <div class="modal-head"><div class="d">${jpDate(ui.date)}</div><div class="n">特記を書く</div></div>
    <div class="chips" data-kind-pick>${['毎日', '毎週', '臨時'].map((k, i) => `<button type="button" class="chip ${i === 2 ? 'on' : ''}" data-v="${k}">${k}</button>`).join('')}</div>
    <label class="f-col mt8"><span>内容</span><textarea class="input sq" name="text" rows="3" data-autofocus placeholder="例: 14時から避難訓練"></textarea></label>
    <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button type="submit" class="btn grad">追加する</button></div>
  </form>`, (form) => {
    form.addEventListener('click', (e) => { const c = e.target.closest('[data-kind-pick] .chip'); if (c) form.querySelectorAll('[data-kind-pick] .chip').forEach((x) => x.classList.toggle('on', x === c)); });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const text = form.text.value.trim();
      if (!text) { toast('内容を入力してください'); return; }
      const sp = { ...(store.getMap('special', ui.date, {}) || {}) };
      sp.notes = [...(sp.notes || []), { kind: form.querySelector('[data-kind-pick] .chip.on').dataset.v, text }];
      store.setMap('special', ui.date, sp);
      closeModal(); toast('特記を追加しました'); rerender();
    });
  });
}

function patchSpecial(patch) {
  store.setMap('special', ui.date, { ...(store.getMap('special', ui.date, {}) || {}), ...patch });
}
function readSpecialFields(view) {
  const patch = {};
  view.querySelectorAll('[data-sp]').forEach((el) => { patch[el.dataset.sp] = el.value; });
  return patch;
}

// ---------- イベント ----------
let rerender = () => {};
export function initDay(view, render) {
  rerender = render;
  view.addEventListener('click', async (ev) => {
    if (!location.hash.startsWith('#/day') || location.hash.startsWith('#/day/')) return;
    const t = ev.target;
    const cell = t.closest('[data-cell]');
    if (cell) {
      const col = colOf(cell.dataset.cell);
      if (col.kind === 'toggle') {
        const v = rowVals(ui.date, cell.dataset.uid);
        store.setDraft(ui.date, cell.dataset.uid, { [col.key]: !v[col.key] });
        render();
      } else openCell(cell.dataset.cell, cell.dataset.uid);
      return;
    }
    const bulk = t.closest('[data-bulk]');
    if (bulk) {
      const col = colOf(bulk.dataset.bulk);
      if (col.kind === 'toggle') {
        const targets = rosterFor(ui.date).filter((m) => !rowVals(ui.date, m.id).absent);
        const allOn = targets.every((m) => rowVals(ui.date, m.id)[col.key]);
        targets.forEach((m) => store.setDraft(ui.date, m.id, { [col.key]: !allOn }));
        toast(`${col.parent ? col.parent + ' ' : ''}${col.label}: 全員を${allOn ? '外しました' : '○にしました'}（未保存）`);
        render();
      } else openBulk(bulk.dataset.bulk);
      return;
    }
    const sort = t.closest('[data-day-sort]');
    if (sort) { ui.daySort = sort.dataset.daySort; render(); return; }
    const rs = t.closest('[data-row-save]');
    if (rs) {
      const uid = rs.dataset.rowSave;
      toast(commitRow(ui.date, uid) ? `${member(uid).name} さんを保存しました` : '変更はありません');
      render();
      return;
    }
    if (t.closest('[data-save-all]')) {
      const ids = store.draftKeys(ui.date);
      ids.forEach((uid) => commitRow(ui.date, uid));
      toast(`${ids.length} 名を保存しました`);
      render();
      return;
    }
    if (t.closest('[data-special-add]')) { patchSpecial(readSpecialFields(view)); openSpecialNote(); return; }
    const sd = t.closest('[data-special-del]');
    if (sd) {
      const sp = { ...(store.getMap('special', ui.date, {}) || {}) };
      sp.notes = (sp.notes || []).filter((_, i) => i !== Number(sd.dataset.specialDel));
      store.setMap('special', ui.date, sp);
      render();
      return;
    }
    if (t.closest('[data-special-save]')) { patchSpecial(readSpecialFields(view)); toast('特記・スケジュール・出勤者を保存しました'); return; }
    if (t.closest('[data-copy-changes]')) {
      const lines = store.list('changes').filter((c) => c.date === ui.date).map((c) => `${member(c.uid)?.name || ''}／${c.kinds.join('・')}${c.memo ? '／' + c.memo : ''}`);
      const el = view.querySelector('[data-sp="schedule"]');
      el.value = lines.length ? `【休み・臨時】\n${lines.join('\n')}` : el.value;
      toast(lines.length ? '予定から写しました（未保存）' : 'この日の予定はありません');
      return;
    }
    if (t.closest('[data-copy-staff]')) {
      view.querySelector('[data-sp="staff"]').value = staffOn(ui.date).map((s) => s.name).join('、');
      toast('シフトから写しました（未保存）');
      return;
    }
    if (t.closest('[data-trash]')) {
      const cur = (store.getMap('special', ui.date, {}) || {}).trash || '';
      openModal(`<form class="modal" novalidate><div class="modal-head"><div class="n">本日のゴミ</div></div>
        <label class="f-col"><span>ゴミの予定</span><input class="input round" name="trash" value="${esc(cur)}" placeholder="例: 燃えるゴミ" data-autofocus></label>
        <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button type="submit" class="btn grad">保存</button></div></form>`, (form) => {
        form.addEventListener('submit', (e2) => { e2.preventDefault(); patchSpecial({ ...readSpecialFields(view), trash: form.trash.value.trim() }); closeModal(); toast('保存しました'); render(); });
      });
      return;
    }
    const pick = t.closest('[data-add-row-pick]');
    if (pick) {
      const cur = store.getMap('extraRows', ui.date, []) || [];
      store.setMap('extraRows', ui.date, [...new Set([...cur, pick.dataset.addRowPick])]);
      toast(`${member(pick.dataset.addRowPick).name} さんの行を追加しました`);
      render();
    }
  });
  view.addEventListener('change', (ev) => {
    if (!location.hash.startsWith('#/day') || location.hash.startsWith('#/day/')) return;
    const t = ev.target;
    if (t.matches('[data-absent]')) { store.setDraft(ui.date, t.dataset.absent, { absent: t.checked }); render(); return; }
    if (t.matches('[data-print-mark]')) { store.setDraft(ui.date, t.dataset.printMark, { contactPrint: t.checked }); render(); }
  });
  view.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!t.matches('[data-add-row-q]')) return;
    const box = view.querySelector('[data-add-row-list]');
    const q = t.value.trim();
    const on = new Set(rosterFor(ui.date).map((m) => m.id));
    const hits = q ? MEMBERS.filter((m) => !on.has(m.id) && (m.name.includes(q) || m.kana.includes(q))).sort(byKana) : [];
    box.hidden = !q;
    box.innerHTML = hits.length ? hits.map((m) => `<button type="button" data-add-row-pick="${m.id}">${esc(m.name)} <small>${esc(m.kana)}</small></button>`).join('') : '<div class="none">該当する方がいません（表にいる方は出ません）</div>';
  });
}
