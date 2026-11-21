// 記録アプリ（見せる用・別実装）。画面は文字列で組み立て、操作はイベント委譲で受ける。
import { FACILITY, MEMBERS, STAFF, CATEGORIES, BATH_OPTIONS, todayStr, addDays, scheduledIds } from './data.js';
import * as store from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const modalEl = $('#modal');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const member = (id) => MEMBERS.find((m) => m.id === id);
const staffName = (id) => STAFF.find((s) => s.id === id)?.name || '';
const WD = ['日', '月', '火', '水', '木', '金', '土'];
function jpDate(ds, withYear = true) {
  const [y, m, d] = ds.split('-').map(Number);
  const w = WD[new Date(y, m - 1, d).getDay()];
  return withYear ? `${y}年${m}月${d}日（${w}）` : `${m}/${d}（${w}）`;
}
function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- 画面状態 ----------
const ui = {
  date: todayStr(), // 業務日誌・申し送り・連絡帳で共有する日付
  person: null,
  personCat: '様子',
  homeCat: '様子',
  homeUid: '',
  vitalsUid: null,
  vitalsMetric: 'all',
  contactUid: null,
  search: '',
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { route: path || 'home', q: new URLSearchParams(qs || '') };
}

// ---------- 日ごとの判定 ----------
function dayStatus(date, uid) {
  const e = store.getDay(date, uid);
  if (e.absent) return 'off';
  if (e.arrive || e.temp) return 'in';
  return 'wait';
}
function rosterFor(date) {
  // 予定の人 ＋ 予定外でも記録がある人
  const ids = new Set(scheduledIds(date));
  MEMBERS.forEach((m) => { if (Object.keys(store.getDay(date, m.id)).length) ids.add(m.id); });
  return MEMBERS.filter((m) => ids.has(m.id));
}
function missingItems(date, uid) {
  const e = store.getDay(date, uid);
  const u = member(uid);
  const miss = [];
  if (!e.arrive) miss.push('到着');
  if (!e.temp) miss.push('バイタル');
  if (e.mealMain == null) miss.push('食事');
  if (!e.water || e.water < 500) miss.push('水分');
  if (e.urine == null) miss.push('排泄');
  if (u.bath && !e.bath) miss.push('入浴');
  return miss;
}
const vsAlert = {
  temp: (v) => v >= 37.5 || v < 35.5 ? 1 : v >= 37.0 ? 0.5 : 0,
  bpHi: (v) => v >= 160 || v < 95,
  pulse: (v) => v >= 100 || v < 50,
  spo2: (v) => v < 93,
};

// =====================================================================
//  ホーム
// =====================================================================
function renderHome() {
  const date = todayStr();
  const roster = rosterFor(date);
  const st = { in: 0, wait: 0, off: 0 };
  roster.forEach((m) => { st[dayStatus(date, m.id)]++; });
  const present = roster.filter((m) => dayStatus(date, m.id) !== 'off');
  const todos = present.map((m) => ({ m, miss: missingItems(date, m.id), s: dayStatus(date, m.id) }));
  const todoCount = todos.filter((t) => t.miss.length).length;
  const db = store.db();
  const hos = db.handovers.filter((h) => h.date === date || (!h.done && h.date >= addDays(date, -1)));
  const openHo = hos.filter((h) => !h.done);
  const me = STAFF.find((s) => s.id === store.getMe());
  const recent = db.notes.filter((n) => n.date === date).slice(-4).reverse();

  return `
  <p class="hello">${jpDate(date)}　${esc(me.name)} さん、おつかれさまです。</p>
  <div class="page-head"><h1 class="page-title"><span class="script">Today</span>今日の状況</h1></div>
  <p class="page-lead">${esc(FACILITY.name)}（${FACILITY.kind}）の今日の利用状況と、まだ入力していない項目です。</p>

  <div class="stats">
    <a class="stat" href="#/diary"><div class="k">本日の利用予定</div><div class="v">${roster.length - st.off}<small>名</small></div></a>
    <a class="stat" href="#/diary"><div class="k">通所中</div><div class="v">${st.in}<small>名</small></div></a>
    <a class="stat warn" href="#/diary"><div class="k">未到着・未入力</div><div class="v">${st.wait}<small>名</small></div></a>
    <a class="stat pink" href="#/handover"><div class="k">未確認の申し送り</div><div class="v">${openHo.length}<small>件</small></div></a>
  </div>

  <div class="grid-2">
    <section class="card">
      <h2 class="section-title"><span class="script">To do</span>入力が残っている方（${todoCount}名）</h2>
      <ul class="todo-list">
        ${todos.map(({ m, miss, s }) => `
          <li>
            <div>
              <a class="todo-name" href="#/person?u=${m.id}">${esc(m.name)}</a>
              <span class="state ${s}">${s === 'in' ? '通所中' : '未到着'}</span><br>
              ${miss.length ? miss.map((x) => `<span class="miss">${x}</span>`).join('') : '<span class="ok-badge">入力済み</span>'}
            </div>
            <a class="btn sm" href="#/diary">日誌で入力</a>
          </li>`).join('')}
        ${roster.filter((m) => dayStatus(date, m.id) === 'off').map((m) => `
          <li><div><span class="todo-name">${esc(m.name)}</span> <span class="state off">欠席</span><br><span class="unit">${esc(store.getDay(date, m.id).note || '')}</span></div></li>`).join('')}
      </ul>
    </section>

    <div>
      <section class="card">
        <h2 class="section-title"><span class="script">Quick</span>すぐ入力</h2>
        <form id="quick-form">
          <label class="field"><span>利用者</span>
            <select class="input" name="uid" required>
              <option value="">選んでください</option>
              ${present.map((m) => `<option value="${m.id}" ${ui.homeUid === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
          </label>
          <div class="field"><span>種類</span>
            <div class="chips" data-chipset="homeCat">
              ${CATEGORIES.map((c) => `<button type="button" class="chip ${ui.homeCat === c ? 'on' : ''}" data-chip="${c}">${c}</button>`).join('')}
            </div>
          </div>
          <label class="field"><span>内容</span>
            <textarea class="input" name="text" required placeholder="（例）昼食は全量摂取。食後にお茶 150ml。"></textarea>
          </label>
          <button class="btn green" style="width:100%;padding:12px" type="submit">記録を保存</button>
        </form>
      </section>

      <section class="card">
        <div class="row" style="justify-content:space-between"><h2 class="section-title">申し送り</h2><a class="btn sm" href="#/handover">すべて見る</a></div>
        ${openHo.length ? `<ul class="todo-list">${openHo.slice(0, 4).map((h) => `
          <li><div><strong>${h.uid ? esc(member(h.uid).name) + ' 様' : '全体'}</strong><br>${esc(h.text)}</div></li>`).join('')}</ul>`
          : '<p class="empty">未確認の申し送りはありません。</p>'}
      </section>

      <section class="card">
        <h2 class="section-title">今日の記録（新しい順）</h2>
        ${recent.length ? `<ul class="todo-list">${recent.map((n) => `
          <li><div><span class="cat c-${n.cat}">${n.cat}</span> <strong>${esc(member(n.uid).name)}</strong> <span class="unit">${n.time}</span><br>${esc(n.text)}</div></li>`).join('')}</ul>`
          : '<p class="empty">まだ記録はありません。</p>'}
      </section>
    </div>
  </div>`;
}

// =====================================================================
//  業務日誌（通所）
// =====================================================================
const COLS = [
  { key: 'arrive', label: '到着', group: 'arrive' },
  { key: 'temp', label: '体温', group: 'vs', parent: 'バイタル' },
  { key: 'pulse', label: '脈拍', group: 'vs', parent: 'バイタル' },
  { key: 'bp', label: '血圧', group: 'vs', parent: 'バイタル' },
  { key: 'spo2', label: 'SpO2', group: 'vs', parent: 'バイタル' },
  { key: 'mealMain', label: '主食', group: 'meal', parent: '食事', bulk: true },
  { key: 'mealSide', label: '副食', group: 'meal', parent: '食事', bulk: true },
  { key: 'water', label: '水分', group: 'water', bulk: true },
  { key: 'toilet', label: '排泄', group: 'toilet' },
  { key: 'bath', label: '入浴', group: 'bath' },
  { key: 'note', label: '備考', group: 'note' },
];

function cellText(col, e) {
  switch (col.key) {
    case 'arrive': return e.arrive || '';
    case 'temp': return e.temp ? `<span class="${vsAlert.temp(e.temp) ? 'alert-val' : ''}">${e.temp.toFixed(1)}℃</span>` : '';
    case 'pulse': return e.pulse ? `<span class="${vsAlert.pulse(e.pulse) ? 'alert-val' : ''}">${e.pulse}</span>` : '';
    case 'bp': return e.bpHi ? `<span class="${vsAlert.bpHi(e.bpHi) ? 'alert-val' : ''}">${e.bpHi}/${e.bpLo ?? '-'}</span>` : '';
    case 'spo2': return e.spo2 ? `<span class="${vsAlert.spo2(e.spo2) ? 'alert-val' : ''}">${e.spo2}</span>` : '';
    case 'mealMain': return e.mealMain != null ? `${e.mealMain}割` : '';
    case 'mealSide': return e.mealSide != null ? `${e.mealSide}割` : '';
    case 'water': return e.water ? `${e.water}<span class="unit">ml</span>` : '';
    case 'toilet': return e.urine != null ? `尿${e.urine}${e.stool ? ` 便${e.stool}` : ''}` : '';
    case 'bath': return e.bath ? (e.bath === 'なし' ? '×' : esc(e.bath)) : '';
    case 'note': return esc(e.note || '');
    default: return '';
  }
}

function renderDiary() {
  const date = ui.date;
  const roster = rosterFor(date);
  const st = { in: 0, wait: 0, off: 0 };
  roster.forEach((m) => { st[dayStatus(date, m.id)]++; });

  const head1 = [];
  const head2 = [];
  let i = 0;
  while (i < COLS.length) {
    const c = COLS[i];
    if (c.parent) {
      const span = COLS.filter((x) => x.parent === c.parent).length;
      head1.push(`<th class="group" colspan="${span}">${c.parent}</th>`);
      COLS.filter((x) => x.parent === c.parent).forEach((x) => head2.push(thCell(x)));
      i += span;
    } else {
      head1.push(`<th rowspan="2">${thInner(c)}</th>`);
      i++;
    }
  }
  function thInner(c) { return c.bulk ? `<button type="button" class="th-bulk" data-bulk="${c.group}" title="全員まとめて入力">${c.label}</button>` : c.label; }
  function thCell(c) { return `<th>${thInner(c)}</th>`; }

  return `
  <div class="page-head">
    <h1 class="page-title"><span class="script">Day Service</span>通所</h1>
    <a class="btn" href="#/contact">連絡帳を開く</a>
  </div>
  ${dateNav(date)}
  <section class="card">
    <h2 class="section-title"><span class="script">Diary</span>業務日誌</h2>
    <div class="diary-summary">
      <span>通所中: ${st.in}名</span><span class="warn">予定あり・未到着: ${st.wait}名</span><span>欠席: ${st.off}名</span>
    </div>
    <p class="help-text">マスを押すと入力できます。見出しに下線のある項目（主食・副食・水分）は、押すと通所中の全員にまとめて入力できます。バイタルか到着時刻を入れると「通所中」になります。</p>
    <div class="table-scroll">
      <table class="diary">
        <thead>
          <tr><th class="name-col" rowspan="2">名前</th><th rowspan="2">休み</th>${head1.join('')}</tr>
          <tr>${head2.join('')}</tr>
        </thead>
        <tbody>
          ${roster.map((m, idx) => {
            const e = store.getDay(date, m.id);
            const s = dayStatus(date, m.id);
            return `<tr class="${s === 'off' ? 'is-absent' : ''}">
              <td class="name-col">${idx + 1}. <a class="name-link" href="#/person?u=${m.id}">${esc(m.name)}</a><br>
                <span class="state ${s}">${s === 'in' ? '通所中' : s === 'off' ? '欠席' : '未到着'}</span></td>
              <td class="chk"><input type="checkbox" data-absent="${m.id}" ${e.absent ? 'checked' : ''} aria-label="${esc(m.name)} を欠席にする"></td>
              ${COLS.map((c) => {
                const t = cellText(c, e);
                return `<td><button type="button" class="cell ${c.key === 'note' ? 'note' : ''}" data-cell="${c.group}" data-uid="${m.id}" aria-label="${esc(m.name)} の${c.label}">${t || '<span class="plus">＋</span>'}</button></td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function dateNav(date) {
  return `<div class="date-nav">
    <button type="button" class="btn sm" data-date-step="-1">◀ 前日</button>
    <span class="date-label">${jpDate(date)}</span>
    <button type="button" class="btn sm" data-date-step="1" ${date >= todayStr() ? 'disabled' : ''}>翌日 ▶</button>
    <input type="date" data-date-pick value="${date}" max="${todayStr()}" aria-label="日付を選ぶ">
    ${date !== todayStr() ? '<button type="button" class="btn sm ghost-pink" data-date-today>今日へ</button>' : ''}
  </div>`;
}

// ---- マス入力のポップアップ ----
const GROUP_TITLE = { arrive: '到着時刻', vs: 'バイタルの入力', meal: '食事量', water: '水分量', toilet: '排泄', bath: '入浴', note: '備考' };

function cellForm(group, e) {
  switch (group) {
    case 'arrive':
      return `<label class="field"><span>到着時刻</span><div class="inline-inputs"><input class="input" type="time" name="arrive" value="${e.arrive || ''}"><button type="button" class="btn sm" data-fill-now="arrive">いま</button></div></label>`;
    case 'vs':
      return `
        <label class="field"><span>体温</span><div class="inline-inputs"><input class="input" type="number" step="0.1" min="34" max="42" inputmode="decimal" name="temp" value="${e.temp ?? ''}" placeholder="36.5"><span class="unit">℃</span></div></label>
        <label class="field"><span>脈拍</span><div class="inline-inputs"><input class="input" type="number" min="30" max="200" inputmode="numeric" name="pulse" value="${e.pulse ?? ''}" placeholder="72"><span class="unit">回/分</span></div></label>
        <div class="field"><span>血圧</span><div class="inline-inputs"><input class="input" type="number" inputmode="numeric" name="bpHi" value="${e.bpHi ?? ''}" placeholder="120" aria-label="上の血圧"><span>/</span><input class="input" type="number" inputmode="numeric" name="bpLo" value="${e.bpLo ?? ''}" placeholder="80" aria-label="下の血圧"><span class="unit">mmHg</span></div></div>
        <label class="field"><span>SpO2</span><div class="inline-inputs"><input class="input" type="number" min="70" max="100" inputmode="numeric" name="spo2" value="${e.spo2 ?? ''}" placeholder="97"><span class="unit">%</span></div></label>
        <p class="help-text">到着時刻が空なら、いまの時刻を到着として入れます。</p>`;
    case 'meal':
      return ['mealMain', 'mealSide'].map((k) => `
        <div class="field"><span>${k === 'mealMain' ? '主食' : '副食'}</span>
          <div class="chips" data-pick="${k}">${[10, 8, 7, 5, 3, 0].map((v) => `<button type="button" class="chip ${e[k] === v ? 'on' : ''}" data-val="${v}">${v === 10 ? '全量' : v + '割'}</button>`).join('')}</div>
          <input type="hidden" name="${k}" value="${e[k] ?? ''}">
        </div>`).join('');
    case 'water':
      return `<label class="field"><span>1日の合計</span><div class="inline-inputs"><input class="input" type="number" step="50" min="0" name="water" value="${e.water ?? ''}" placeholder="0"><span class="unit">ml</span></div></label>
        <div class="chips">${[100, 150, 200].map((v) => `<button type="button" class="chip" data-add-water="${v}">＋${v}ml</button>`).join('')}</div>`;
    case 'toilet':
      return ['urine', 'stool'].map((k) => `
        <div class="field"><span>${k === 'urine' ? '排尿' : '排便'}（回）</span>
          <div class="chips" data-pick="${k}">${[0, 1, 2, 3, 4, 5].map((v) => `<button type="button" class="chip ${e[k] === v ? 'on' : ''}" data-val="${v}">${v}</button>`).join('')}</div>
          <input type="hidden" name="${k}" value="${e[k] ?? ''}">
        </div>`).join('');
    case 'bath':
      return `<div class="field"><span>入浴</span>
          <div class="chips" data-pick="bath" data-str>${BATH_OPTIONS.map((v) => `<button type="button" class="chip ${e.bath === v ? 'on' : ''}" data-val="${v}">${v}</button>`).join('')}</div>
          <input type="hidden" name="bath" value="${esc(e.bath || '')}">
        </div>`;
    case 'note':
      return `<label class="field"><span>備考</span><textarea class="input" name="note" placeholder="気づいたことを短く">${esc(e.note || '')}</textarea></label>`;
    default: return '';
  }
}
const NUM_FIELDS = ['temp', 'pulse', 'bpHi', 'bpLo', 'spo2', 'mealMain', 'mealSide', 'water', 'urine', 'stool'];
function readForm(form) {
  const out = {};
  new FormData(form).forEach((v, k) => {
    const s = String(v).trim();
    out[k] = s === '' ? '' : NUM_FIELDS.includes(k) ? Number(s) : s;
  });
  return out;
}

function openCellModal(group, uid) {
  const date = ui.date;
  const m = member(uid);
  const e = store.getDay(date, uid);
  openModal(`
    <form class="modal" id="cell-form">
      <div class="modal-head"><div class="d">${jpDate(date)}</div><div class="n">${esc(m.name)}</div><div class="s">${GROUP_TITLE[group]}</div></div>
      ${cellForm(group, e)}
      <div class="modal-foot">
        <button type="button" class="btn" data-close>キャンセル</button>
        <button type="button" class="btn ghost-pink" data-clear>入力を消去</button>
        <button type="submit" class="btn primary">登録する</button>
      </div>
    </form>`, (form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const patch = readForm(form);
      if (group === 'vs' && patch.temp && !e.arrive) patch.arrive = nowHM();
      if (group === 'vs' || group === 'arrive') patch.absent = '';
      store.setDay(date, uid, patch);
      closeModal();
      toast(`${m.name} さんの${GROUP_TITLE[group].replace('の入力', '')}を保存しました`);
      render();
    });
    $('[data-clear]', form).addEventListener('click', () => {
      const keys = [...new FormData(form).keys()];
      store.setDay(date, uid, Object.fromEntries(keys.map((k) => [k, ''])));
      closeModal();
      toast('消去しました');
      render();
    });
  });
}

function openBulkModal(group) {
  const date = ui.date;
  const targets = rosterFor(date).filter((m) => dayStatus(date, m.id) === 'in');
  if (!targets.length) { toast('通所中の方がいません'); return; }
  openModal(`
    <form class="modal" id="bulk-form">
      <div class="modal-head"><div class="d">${jpDate(date)}</div><div class="n">まとめて入力</div><div class="s">${GROUP_TITLE[group]}・通所中の ${targets.length} 名</div></div>
      ${cellForm(group, {})}
      <p class="help-text">${group === 'water' ? '入れた量を各自の合計に<strong>足します</strong>。' : 'すでに入力済みの方はそのままです（個別に直すときはマスを押します）。'}対象: ${targets.map((t) => esc(t.name)).join('、')}</p>
      <div class="modal-foot">
        <button type="button" class="btn" data-close>キャンセル</button>
        <button type="submit" class="btn primary">全員に登録</button>
      </div>
    </form>`, (form) => {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const patch = readForm(form);
      Object.keys(patch).forEach((k) => { if (patch[k] === '') delete patch[k]; });
      if (!Object.keys(patch).length) { toast('値を選んでください'); return; }
      let changed = 0;
      targets.forEach((t) => {
        const cur = store.getDay(date, t.id);
        if (group === 'water') {
          store.setDay(date, t.id, { water: (cur.water || 0) + patch.water });
          changed++;
        } else {
          // すでに入っている値は上書きしない
          const own = Object.fromEntries(Object.entries(patch).filter(([k]) => cur[k] == null));
          if (Object.keys(own).length) { store.setDay(date, t.id, own); changed++; }
        }
      });
      closeModal();
      toast(changed ? `${changed} 名に登録しました` : '全員すでに入力済みです');
      render();
    });
  });
}

// =====================================================================
//  利用者別介護記録
// =====================================================================
function memberPicker(selected, hrefFn) {
  const q = ui.search.trim();
  const list = MEMBERS.filter((m) => !q || m.name.includes(q) || m.kana.includes(q));
  return `
    <input class="search" type="search" data-search placeholder="🔍 お名前・ふりがなで検索" value="${esc(ui.search)}">
    <div class="member-grid">
      ${list.map((m) => `<a class="member-btn ${selected === m.id ? 'on' : ''}" href="${hrefFn(m.id)}">${esc(m.name)}<span class="kana">${esc(m.kana)}</span></a>`).join('') || '<p class="empty">該当する方がいません。</p>'}
    </div>`;
}

function renderPerson(q) {
  const uid = q.get('u') || ui.person;
  const m = uid && member(uid);
  if (!m) {
    return `
    <div class="page-head"><h1 class="page-title"><span class="script">Personal</span>利用者別介護記録</h1></div>
    <p class="page-lead">利用者さんを選ぶと、その方の1週間の介護記録が時系列で見られます。記録の追加もここからできます。</p>
    <section class="card">${memberPicker(null, (id) => `#/person?u=${id}`)}</section>`;
  }
  ui.person = uid;
  const db = store.db();
  const today = todayStr();
  const dates = [];
  for (let off = 0; off >= -6; off--) dates.push(addDays(today, off));
  const notes = db.notes.filter((n) => n.uid === uid);
  const me = store.getMe();
  const recentDays = dates.filter((d) => { const e = store.getDay(d, uid); return e.temp || e.absent; });

  return `
  <div class="page-head"><h1 class="page-title"><span class="script">Personal</span>利用者別介護記録</h1></div>
  <p class="page-lead"><a href="#/person" data-back-list class="name-link">← 利用者一覧へ</a></p>

  <section class="card">
    <div class="person-head">
      <span class="person-name">${esc(m.name)}</span>
      <span class="unit">${esc(m.kana)}　${m.age}歳 / ${m.sex}</span>
      <span style="flex:1"></span>
      <a class="btn sm" href="#/vitals?u=${uid}">バイタル経過</a>
      <a class="btn sm" href="#/contact?u=${uid}">今日の連絡帳</a>
    </div>
    <span class="box-label">基本情報</span>
    <dl class="info-table">
      <dt>介護度</dt><dd>${m.level}</dd>
      <dt>入浴</dt><dd>${m.bath ? '利用あり' : '利用なし'}</dd>
      <dt>この1週間</dt><dd>来所 ${recentDays.filter((d) => !store.getDay(d, uid).absent).length} 日 / 欠席 ${recentDays.filter((d) => store.getDay(d, uid).absent).length} 日</dd>
    </dl>
  </section>

  <div class="grid-2">
    <section class="card">
      <span class="box-label">介護記録（1週間）</span>
      <ul class="timeline">
        ${dates.map((d) => {
          const dn = notes.filter((n) => n.date === d).sort((a, b) => b.time.localeCompare(a.time));
          const e = store.getDay(d, uid);
          if (!dn.length && !Object.keys(e).length) return '';
          const vs = e.absent ? '欠席' : e.temp ? `体温 ${e.temp.toFixed(1)}℃・血圧 ${e.bpHi}/${e.bpLo}・脈 ${e.pulse}・SpO2 ${e.spo2}%` : 'バイタル未入力';
          return `<li class="tl-date"><span>${jpDate(d, false)}${d === today ? '　今日' : ''}</span><span class="vs-line">${vs}</span></li>
            ${dn.map((n) => `<li class="tl-item">
              <span class="tl-time">${n.time}</span>
              <span class="tl-cat"><span class="cat c-${n.cat}">${n.cat}</span></span>
              <div class="tl-main"><span class="tl-text">${esc(n.text)}</span><span class="tl-staff">記録: ${esc(staffName(n.staff))}</span></div>
              <span class="tl-del">${n.staff === me ? `<button type="button" class="link-btn" data-del-note="${n.id}">削除</button>` : ''}</span>
            </li>`).join('')}
            ${!dn.length ? '<li class="empty">記録なし</li>' : ''}`;
        }).join('')}
      </ul>
    </section>

    <section class="card add-first">
      <span class="box-label">記録を追加</span>
      <form id="note-form">
        <div class="row" style="margin-bottom:12px">
          <label class="field" style="margin:0;flex:1"><span>日付</span><input class="input" type="date" name="date" value="${today}" max="${today}" min="${addDays(today, -6)}"></label>
          <label class="field" style="margin:0;flex:1"><span>時刻</span><input class="input" type="time" name="time" value="${nowHM()}"></label>
        </div>
        <div class="field"><span>種類</span>
          <div class="chips" data-chipset="personCat">
            ${CATEGORIES.map((c) => `<button type="button" class="chip ${ui.personCat === c ? 'on' : ''}" data-chip="${c}">${c}</button>`).join('')}
          </div>
        </div>
        <label class="field"><span>内容</span><textarea class="input" name="text" required placeholder="様子・対応・気づいたことなど"></textarea></label>
        <label class="field"><span>記録者</span>
          <select class="input" name="staff">${STAFF.map((s) => `<option value="${s.id}" ${s.id === me ? 'selected' : ''}>${esc(s.name)}（${s.role}）</option>`).join('')}</select>
        </label>
        <button class="btn primary" style="width:100%" type="submit">記録を追加</button>
      </form>
    </section>
  </div>`;
}

// =====================================================================
//  バイタル経過
// =====================================================================
const SERIES = [
  { key: 'temp', label: '体温', color: '#d9798a', axis: 'L', metric: 'temp' },
  { key: 'bpHi', label: '収縮期', color: '#6c82c9', axis: 'R', metric: 'bp' },
  { key: 'bpLo', label: '拡張期', color: '#a5b6e6', axis: 'R', metric: 'bp' },
  { key: 'pulse', label: '脈拍', color: '#a184b0', axis: 'R', metric: 'pulse' },
  { key: 'spo2', label: 'SpO2', color: '#6fa07c', axis: 'R', metric: 'spo2' },
];

function vitalsChart(rows, days) {
  const W = 720, H = 300, padL = 44, padR = 44, padT = 16, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const L = [35.5, 38], R = [50, 175];
  const xd = (date) => padL + (iw * days.indexOf(date)) / (days.length - 1);
  const yL = (v) => padT + ih - ((v - L[0]) / (L[1] - L[0])) * ih;
  const yR = (v) => padT + ih - ((v - R[0]) / (R[1] - R[0])) * ih;
  const grid = [0, 1, 2, 3, 4, 5].map((k) => {
    const y = padT + (ih * k) / 5;
    const lv = (L[1] - ((L[1] - L[0]) * k) / 5).toFixed(1);
    const rv = Math.round(R[1] - ((R[1] - R[0]) * k) / 5);
    return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="#f1e6d4"/>
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#a0907e">${lv}</text>
      <text x="${W - padR + 8}" y="${y + 4}" font-size="11" fill="#a0907e">${rv}</text>`;
  }).join('');
  const has = new Set(rows.map((r) => r.date));
  const xl = days.map((d) => `<text x="${xd(d)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="${has.has(d) ? '#6f6253' : '#c9bba6'}">${jpDate(d, false)}</text>`).join('');
  const shown = SERIES.filter((s) => ui.vitalsMetric === 'all' || s.metric === ui.vitalsMetric);
  const lines = shown.map((s) => {
    const pts = rows.map((r) => (r.e[s.key] ? [xd(r.date), (s.axis === 'L' ? yL : yR)(r.e[s.key]), r.e[s.key]] : null)).filter(Boolean);
    if (!pts.length) return '';
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>
      ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="${s.color}"><title>${s.label} ${p[2]}</title></circle>`).join('')}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="バイタル経過グラフ">${grid}${xl}${lines}</svg>`;
}

function renderVitals(q) {
  const uid = q.get('u') || ui.vitalsUid || MEMBERS[0].id;
  ui.vitalsUid = uid;
  const m = member(uid);
  const today = todayStr();
  const rows = [];
  const days = [];
  for (let off = -6; off <= 0; off++) {
    const d = addDays(today, off);
    days.push(d);
    const e = store.getDay(d, uid);
    if (e.temp) rows.push({ date: d, e });
  }
  const metrics = [['all', '全て'], ['temp', '体温'], ['bp', '血圧'], ['pulse', '脈拍'], ['spo2', 'SpO2']];
  return `
  <div class="page-head"><h1 class="page-title"><span class="script">Vital Signs</span>バイタル経過</h1></div>
  <p class="page-lead">業務日誌で入れたバイタルを、1週間分の表とグラフで見られます。赤字は目安から外れた値です。</p>
  <section class="card">
    <div class="row" style="margin-bottom:12px">
      <label class="field" style="margin:0;min-width:200px"><span>利用者</span>
        <select class="input" data-vitals-user>${MEMBERS.map((x) => `<option value="${x.id}" ${x.id === uid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      </label>
      <span style="flex:1"></span>
      <a class="btn sm" href="#/person?u=${uid}">介護記録を見る</a>
    </div>
    <div class="chips" data-chipset="vitalsMetric" style="margin-bottom:12px">
      ${metrics.map(([k, l]) => `<button type="button" class="chip ${ui.vitalsMetric === k ? 'on' : ''}" data-chip="${k}">${l}</button>`).join('')}
    </div>
    ${rows.length ? `
    <div class="chart-box">
      <div class="chart-head"><strong>${esc(m.name)} さん　VS経過グラフ</strong><span class="unit">左軸 ℃ ／ 右軸 mmHg・回/分・%</span>
        <span class="legend">${SERIES.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</span>
      </div>
      ${vitalsChart(rows, days)}
    </div>` : '<p class="empty">この1週間のバイタル記録がありません。</p>'}
  </section>
  <section class="card">
    <h2 class="section-title">VS経過表</h2>
    <div class="table-scroll" style="border:none">
      <table class="plain">
        <thead><tr><th>日付</th><th>時刻</th><th>体温</th><th>血圧</th><th>脈拍</th><th>SpO2</th></tr></thead>
        <tbody>
          ${rows.slice().reverse().map(({ date, e }) => `<tr>
            <td>${jpDate(date, false)}</td><td>${e.arrive || '-'}</td>
            <td class="${vsAlert.temp(e.temp) ? 'alert-val' : ''}">${e.temp.toFixed(1)}℃</td>
            <td class="${e.bpHi && vsAlert.bpHi(e.bpHi) ? 'alert-val' : ''}">${e.bpHi ?? '-'}/${e.bpLo ?? '-'}</td>
            <td class="${e.pulse && vsAlert.pulse(e.pulse) ? 'alert-val' : ''}">${e.pulse ?? '-'}</td>
            <td class="${e.spo2 && vsAlert.spo2(e.spo2) ? 'alert-val' : ''}">${e.spo2 ?? '-'}%</td>
          </tr>`).join('') || '<tr><td colspan="6" class="empty">記録なし</td></tr>'}
        </tbody>
      </table>
    </div>
  </section>`;
}

// =====================================================================
//  申し送り
// =====================================================================
function renderHandover() {
  const date = ui.date;
  const list = store.db().handovers.filter((h) => h.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const groups = new Map();
  list.forEach((h) => { const k = h.uid || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); });
  const me = store.getMe();
  return `
  <div class="page-head"><h1 class="page-title"><span class="script">Handover</span>申し送り</h1></div>
  <p class="page-lead">職員どうしの申し送りです。読んだら「確認」を押すと、ホームの未確認件数から外れます。</p>
  ${dateNav(date)}
  <section class="card soft">
    <h2 class="section-title">申し送りを追加</h2>
    <form id="ho-form" class="ho-form">
      <select class="input" name="uid" aria-label="対象の利用者">
        <option value="">全体（利用者以外）</option>
        ${MEMBERS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
      </select>
      <textarea class="input" name="text" required placeholder="申し送り内容" style="min-height:60px"></textarea>
      <button class="btn primary" type="submit">追加</button>
    </form>
  </section>
  <section class="card">
    <h2 class="section-title">${jpDate(date)} の申し送り（${list.length}件・未確認 ${list.filter((h) => !h.done).length}件）</h2>
    ${list.length ? [...groups.entries()].map(([k, items]) => `
      <div class="ho-group">
        <h4>${k ? esc(member(k).name) + ' 様' : '全体'}</h4>
        ${items.map((h) => `
          <div class="ho-item ${h.done ? 'done' : ''}">
            <div class="ho-body">
              <div class="ho-text" data-ho-text="${h.id}">${esc(h.text)}</div>
              <div class="ho-meta">${h.time}　${esc(staffName(h.staff))}${h.done ? '　確認済み' : ''}</div>
            </div>
            <div class="ho-actions">
              <button type="button" class="btn sm ${h.done ? '' : 'ghost-pink'}" data-ho-done="${h.id}">${h.done ? '戻す' : '確認'}</button>
              ${h.staff === me ? `<button type="button" class="btn sm" data-ho-edit="${h.id}">編集</button><button type="button" class="btn sm danger" data-ho-del="${h.id}">削除</button>` : ''}
            </div>
          </div>`).join('')}
      </div>`).join('') : '<p class="empty">この日の申し送りはありません。</p>'}
  </section>`;
}

// =====================================================================
//  連絡帳
// =====================================================================
function renderContact(q) {
  const date = ui.date;
  const attendees = rosterFor(date).filter((m) => dayStatus(date, m.id) !== 'off');
  let uid = q.get('u') || ui.contactUid;
  if (!attendees.some((m) => m.id === uid)) uid = attendees[0]?.id;
  ui.contactUid = uid;
  const head = `
  <div class="page-head no-print"><h1 class="page-title"><span class="script">Contact Book</span>連絡帳</h1>
    ${uid ? '<button type="button" class="btn primary" data-print>印刷</button>' : ''}</div>
  <p class="page-lead no-print">ご家族にお渡しする1日のまとめです。業務日誌と介護記録から自動で作られます。「スタッフより」を書いて印刷できます。</p>
  <div class="no-print">${dateNav(date)}</div>`;
  if (!uid) return head + '<section class="card"><p class="empty">この日に通所した方がいません。</p></section>';

  const m = member(uid);
  const e = store.getDay(date, uid);
  const c = store.getContact(date, uid);
  const dn = store.db().notes.filter((n) => n.uid === uid && n.date === date && n.cat !== '健康');
  const bathText = !m.bath ? '利用なし' : e.bath ? (e.bath === 'なし' ? '本日はお休み' : `${e.bath}で入浴されました`) : '未記入';
  return head + `
  <section class="card no-print" style="padding:12px 16px">
    <div class="member-grid">
      ${attendees.map((x) => `<a class="member-btn ${x.id === uid ? 'on' : ''}" href="#/contact?u=${x.id}">${esc(x.name)}<span class="kana">${dayStatus(date, x.id) === 'in' ? '通所中' : '未到着'}</span></a>`).join('')}
    </div>
  </section>

  <article class="sheet">
    <h2 class="sheet-title">連絡帳</h2>
    <div class="sheet-sub">CONTACT BOOK</div>
    <div class="sheet-meta">
      <span class="who">${esc(m.name)} 様</span>
      <span>${jpDate(date)}　${esc(FACILITY.name)}</span>
    </div>

    <h5>バイタルサイン${e.arrive ? `<span class="unit">（${e.arrive} 測定）</span>` : ''}</h5>
    <div class="vbox-row">
      <div class="vbox"><div class="k">体温（℃）</div><div class="v">${e.temp ? e.temp.toFixed(1) : '—'}</div></div>
      <div class="vbox"><div class="k">脈拍（回/分）</div><div class="v">${e.pulse ?? '—'}</div></div>
      <div class="vbox"><div class="k">血圧（mmHg）</div><div class="v">${e.bpHi ? `${e.bpHi}/${e.bpLo}` : '—'}</div></div>
      <div class="vbox"><div class="k">SpO2（%）</div><div class="v">${e.spo2 ?? '—'}</div></div>
    </div>

    <h5>お食事・水分</h5>
    <div class="vbox-row three">
      <div class="vbox"><div class="k">主食</div><div class="v">${e.mealMain != null ? (e.mealMain === 10 ? '全量' : e.mealMain + '割') : '—'}</div></div>
      <div class="vbox"><div class="k">副食</div><div class="v">${e.mealSide != null ? (e.mealSide === 10 ? '全量' : e.mealSide + '割') : '—'}</div></div>
      <div class="vbox"><div class="k">水分</div><div class="v">${e.water ? e.water + 'ml' : '—'}</div></div>
    </div>

    <div class="grid-2" style="grid-template-columns:1fr 1fr;gap:10px">
      <div><h5>入浴</h5><div class="sheet-text" style="min-height:0">${bathText}</div></div>
      <div><h5>排泄</h5><div class="sheet-text" style="min-height:0">${e.urine != null ? `排尿 ${e.urine} 回・排便 ${e.stool || 0} 回` : '未記入'}</div></div>
    </div>

    <h5>本日のご様子</h5>
    <div class="sheet-text">${dn.length ? [...new Set(dn.map((n) => n.text))].map(esc).join('\n') : '（介護記録がまだありません）'}</div>

    <h5>スタッフより</h5>
    <textarea class="input" data-contact="staff" placeholder="ご家族への連絡・本日のご様子など">${esc(c.staff)}</textarea>
    <div class="sheet-text print-only">${esc(c.staff)}</div>

    <h5>ご家族より</h5>
    <textarea class="input" data-contact="family" placeholder="ご家族からの連絡（受け取ったら書き写します）">${esc(c.family)}</textarea>
    <div class="sheet-text print-only">${esc(c.family)}</div>
    <div class="row no-print" style="justify-content:flex-end;margin-top:12px">
      <button type="button" class="btn primary" data-save-contact>連絡帳を保存</button>
    </div>
  </article>`;
}

// =====================================================================
//  モーダル
// =====================================================================
function openModal(html, wire) {
  modalEl.innerHTML = html;
  modalEl.hidden = false;
  const form = modalEl.firstElementChild;
  wire?.(form);
  const first = form.querySelector('input:not([type=hidden]), textarea');
  first?.focus();
}
function closeModal() { modalEl.hidden = true; modalEl.innerHTML = ''; }

modalEl.addEventListener('click', (ev) => {
  if (ev.target === modalEl || ev.target.closest('[data-close]')) { closeModal(); return; }
  const chip = ev.target.closest('[data-pick] .chip');
  if (chip) {
    const box = chip.parentElement;
    const field = box.dataset.pick;
    const hidden = box.parentElement.querySelector(`input[name="${field}"]`);
    const already = chip.classList.contains('on');
    box.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
    if (!already) chip.classList.add('on');
    hidden.value = already ? '' : chip.dataset.val;
    return;
  }
  const now = ev.target.closest('[data-fill-now]');
  if (now) { modalEl.querySelector(`input[name="${now.dataset.fillNow}"]`).value = nowHM(); return; }
  const addW = ev.target.closest('[data-add-water]');
  if (addW) {
    const inp = modalEl.querySelector('input[name="water"]');
    inp.value = (Number(inp.value) || 0) + Number(addW.dataset.addWater);
  }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modalEl.hidden) closeModal(); });

// =====================================================================
//  画面全体のイベント
// =====================================================================
view.addEventListener('click', (ev) => {
  const t = ev.target;
  const chip = t.closest('[data-chipset] [data-chip]');
  if (chip) {
    const set = chip.closest('[data-chipset]').dataset.chipset;
    ui[set] = chip.dataset.chip;
    chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
    if (set === 'vitalsMetric') render();
    return;
  }
  const step = t.closest('[data-date-step]');
  if (step) { ui.date = addDays(ui.date, Number(step.dataset.dateStep)); render(); return; }
  if (t.closest('[data-date-today]')) { ui.date = todayStr(); render(); return; }
  const cell = t.closest('[data-cell]');
  if (cell) { openCellModal(cell.dataset.cell, cell.dataset.uid); return; }
  const bulk = t.closest('[data-bulk]');
  if (bulk) { openBulkModal(bulk.dataset.bulk); return; }
  if (t.closest('[data-back-list]')) { ui.person = null; return; }
  const delNote = t.closest('[data-del-note]');
  if (delNote) {
    if (confirm('この記録を削除しますか？')) { store.removeNote(delNote.dataset.delNote); toast('削除しました'); render(); }
    return;
  }
  const hoDone = t.closest('[data-ho-done]');
  if (hoDone) {
    const h = store.db().handovers.find((x) => x.id === hoDone.dataset.hoDone);
    store.updateHandover(h.id, { done: !h.done });
    render();
    return;
  }
  const hoEdit = t.closest('[data-ho-edit]');
  if (hoEdit) {
    const h = store.db().handovers.find((x) => x.id === hoEdit.dataset.hoEdit);
    openModal(`<form class="modal"><div class="modal-head"><div class="n">申し送りを編集</div></div>
      <label class="field"><span>内容</span><textarea class="input" name="text" required>${esc(h.text)}</textarea></label>
      <div class="modal-foot"><button type="button" class="btn" data-close>キャンセル</button><button class="btn primary" type="submit">保存</button></div></form>`, (form) => {
      form.addEventListener('submit', (e2) => {
        e2.preventDefault();
        store.updateHandover(h.id, { text: form.text.value.trim() });
        closeModal(); toast('保存しました'); render();
      });
    });
    return;
  }
  const hoDel = t.closest('[data-ho-del]');
  if (hoDel) {
    if (confirm('この申し送りを削除しますか？')) { store.removeHandover(hoDel.dataset.hoDel); toast('削除しました'); render(); }
    return;
  }
  if (t.closest('[data-save-contact]')) {
    const patch = {};
    view.querySelectorAll('[data-contact]').forEach((el) => { patch[el.dataset.contact] = el.value; });
    store.setContact(ui.date, ui.contactUid, patch);
    toast('連絡帳を保存しました');
    render();
    return;
  }
  if (t.closest('[data-print]')) {
    const patch = {};
    view.querySelectorAll('[data-contact]').forEach((el) => { patch[el.dataset.contact] = el.value; });
    store.setContact(ui.date, ui.contactUid, patch);
    render();
    setTimeout(() => window.print(), 50);
  }
});

view.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.matches('[data-date-pick]') && t.value) { ui.date = t.value > todayStr() ? todayStr() : t.value; render(); return; }
  if (t.matches('[data-absent]')) {
    const uid = t.dataset.absent;
    store.setDay(ui.date, uid, { absent: t.checked ? true : '' });
    toast(t.checked ? `${member(uid).name} さんを欠席にしました` : '欠席を取り消しました');
    render();
    return;
  }
  if (t.matches('[data-vitals-user]')) { location.hash = `#/vitals?u=${t.value}`; return; }
  if (t.matches('#quick-form select[name=uid]')) ui.homeUid = t.value;
});

view.addEventListener('input', (ev) => {
  if (ev.target.matches('[data-search]')) {
    ui.search = ev.target.value;
    const pos = ev.target.selectionStart;
    render();
    const s = $('[data-search]', view);
    s.focus();
    try { s.setSelectionRange(pos, pos); } catch { /* type=search で失敗する環境あり */ }
  }
});

view.addEventListener('submit', (ev) => {
  const f = ev.target;
  ev.preventDefault();
  if (f.id === 'quick-form') {
    const uid = f.uid.value;
    const text = f.text.value.trim();
    if (!uid || !text) return;
    store.addNote({ uid, date: todayStr(), time: nowHM(), cat: ui.homeCat, text, staff: store.getMe() });
    ui.homeUid = uid;
    toast(`${member(uid).name} さんの記録を保存しました`);
    render();
  } else if (f.id === 'note-form') {
    const text = f.text.value.trim();
    if (!text) return;
    store.addNote({ uid: ui.person, date: f.date.value || todayStr(), time: f.time.value || nowHM(), cat: ui.personCat, text, staff: f.staff.value });
    toast('記録を追加しました');
    render();
  } else if (f.id === 'ho-form') {
    const text = f.text.value.trim();
    if (!text) return;
    store.addHandover({ date: ui.date, uid: f.uid.value || null, text, time: nowHM(), staff: store.getMe() });
    toast('申し送りを追加しました');
    render();
  }
});

// =====================================================================
//  ルーティングと共通部
// =====================================================================
const ROUTES = { home: renderHome, diary: renderDiary, person: renderPerson, vitals: renderVitals, handover: renderHandover, contact: renderContact };

function render() {
  const { route, q } = parseHash();
  const fn = ROUTES[route] || renderHome;
  view.innerHTML = fn(q);
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === (ROUTES[route] ? route : 'home')));
}

function renderMe() {
  const me = store.getMe();
  const sel = $('#me-select');
  sel.innerHTML = STAFF.map((s) => `<option value="${s.id}" ${s.id === me ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  $('#me-avatar').textContent = STAFF.find((s) => s.id === me).name.slice(0, 1);
}

function init() {
  store.load();
  $('#facility-name').textContent = FACILITY.name;
  renderMe();
  $('#me-select').addEventListener('change', (e) => { store.setMe(e.target.value); renderMe(); render(); toast(`${staffName(e.target.value)} さんに切り替えました`); });
  $('#reset-demo').addEventListener('click', () => {
    if (!confirm('デモデータを初期状態に戻します。よろしいですか？')) return;
    store.reset();
    ui.date = todayStr();
    render();
    toast('初期状態に戻しました');
  });
  const closeMenu = () => document.body.classList.remove('menu-open');
  $('#open-menu').addEventListener('click', () => document.body.classList.add('menu-open'));
  $('#close-menu').addEventListener('click', closeMenu);
  $('#backdrop').addEventListener('click', closeMenu);
  window.addEventListener('hashchange', () => { closeMenu(); closeModal(); render(); window.scrollTo(0, 0); });
  if (!location.hash) history.replaceState(null, '', '#/home');
  render();
}

init();
