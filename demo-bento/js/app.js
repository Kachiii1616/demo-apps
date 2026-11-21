import {
  db, WEEK, FORMS, DRINKS, ADDS, ymd, weekIdx, today, addDays, mondayOf, md, mealsOn, snackOn, newUser,
} from './data.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => n.toLocaleString('ja-JP');
const dayCls = d => (weekIdx(d) === 5 ? 'sat' : weekIdx(d) === 6 ? 'sun' : '');

const state = {
  month: (() => { const t = today(); return new Date(t.getFullYear(), t.getMonth(), 1); })(),
  week: mondayOf(today()),
  openUser: null,
  userSort: 'reg',
  countSel: null,
};

const ROUTES = {
  staff: { title: 'スタッフ弁当チェック', render: renderStaff },
  check: { title: '利用者チェック表', render: renderCheck },
  count: { title: '食事数表', render: renderCount },
  snack: { title: 'おやつ表', render: renderSnack },
  money: { title: '集金集計', render: renderMoney },
  users: { title: '利用者情報', render: renderUsers },
};

// ---------- 共通 ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

function monthNav() {
  const m = state.month;
  return `<div class="period">
    <button class="round-btn" data-act="mprev" aria-label="前の月">◀</button>
    <span class="period-label">${m.getFullYear()}年${m.getMonth() + 1}月</span>
    <button class="round-btn" data-act="mnext" aria-label="次の月">▶</button>
  </div>`;
}
function weekNav() {
  const s = state.week, e = addDays(s, 6);
  const isThis = +s === +mondayOf(today());
  return `<div class="period">
    <button class="round-btn" data-act="wprev" aria-label="前の週">◀</button>
    <span class="period-label">${md(s)}〜${md(e)}</span>
    ${isThis ? '' : '<button class="chip-btn" data-act="wthis">今週</button>'}
    <button class="round-btn" data-act="wnext" aria-label="次の週">▶</button>
  </div>`;
}
function weekDates() { return Array.from({ length: 7 }, (_, i) => addDays(state.week, i)); }
function monthDates() {
  const y = state.month.getFullYear(), m = state.month.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => new Date(y, m, i + 1));
}
function dLabel(d) { return `${d.getDate()}(${WEEK[weekIdx(d)]})`; }

// ---------- スタッフ弁当チェック ----------
const MARK = { o: '✓', r: '○', x: '×' };
const NEXT = { '': 'o', o: 'r', r: 'x', x: '' };
const counted = v => v === 'o' || v === 'r';

function renderStaff() {
  const dates = monthDates();
  const t = ymd(today());
  const staff = db.staff;
  const colSum = Object.fromEntries(staff.map(s => [s.id, 0]));
  let total = 0;
  const rows = dates.map(d => {
    const key = ymd(d);
    const w = weekIdx(d);
    const cls = [w > 4 ? 'weekend' : '', key === t ? 'today' : ''].join(' ');
    if (w > 4) {
      return `<tr class="${cls}"><th class="day ${dayCls(d)}">${dLabel(d)}</th>${staff.map(() => '<td></td>').join('')}<td class="sum"></td></tr>`;
    }
    const row = db.orders[key] || {};
    let n = 0;
    const cells = staff.map(s => {
      const v = row[s.id] || '';
      if (counted(v)) { n++; colSum[s.id]++; }
      return `<td><button class="cell ${v}" data-cell="${key}|${s.id}" aria-label="${dLabel(d)} ${esc(s.name)}">${MARK[v] || ''}</button></td>`;
    }).join('');
    total += n;
    return `<tr class="${cls}"><th class="day ${dayCls(d)}">${dLabel(d)}</th>${cells}<td class="sum">${n}</td></tr>`;
  }).join('');

  return `
    ${monthNav()}
    <div class="legend">
      <span>マスをタップで切り替え：</span>
      <span class="o">✓ 注文</span><span class="r">○ 受け取り済み</span><span class="x">× 休み（数えない）</span>
    </div>
    <div class="toolbar">
      <button class="btn" data-act="bulk">✓ 一括チェック（空いている平日に注文）</button>
    </div>
    <div class="staff-wrap scroll-x">
      <table class="staff">
        <thead><tr><th class="day">日</th>${staff.map(s => `<th>${esc(s.name.split(' ')[0])}</th>`).join('')}<th>計</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th class="day">月の計</th>${staff.map(s => `<td>${colSum[s.id]}</td>`).join('')}<td>${total}</td></tr></tfoot>
      </table>
    </div>`;
}

function onStaffClick(e) {
  const b = e.target.closest('[data-cell]');
  if (!b) return false;
  const [key, sid] = b.dataset.cell.split('|');
  const row = db.orders[key] || (db.orders[key] = {});
  const next = NEXT[row[sid] || ''];
  if (next) row[sid] = next; else delete row[sid];
  db.save('orders');
  const y = window.scrollY;
  const wrap = $('.staff-wrap');
  const sx = wrap ? wrap.scrollLeft : 0;
  render();
  window.scrollTo(0, y);
  const w2 = $('.staff-wrap'); if (w2) w2.scrollLeft = sx;
  const again = document.querySelector(`[data-cell="${key}|${sid}"]`);
  if (again) again.focus({ preventScroll: true });
  return true;
}

function bulkCheck() {
  let n = 0;
  monthDates().forEach(d => {
    if (weekIdx(d) > 4) return;
    const key = ymd(d);
    const row = db.orders[key] || (db.orders[key] = {});
    db.staff.forEach(s => { if (!row[s.id]) { row[s.id] = 'o'; n++; } });
  });
  db.save('orders');
  render();
  toast(n ? `${n}マスに ✓注文 を入れました` : '空いているマスはありません');
}

// ---------- 利用者チェック表 ----------
function cellText(form, note) {
  if (!form) return '';
  return `${esc(form)}${note ? `<span class="note">（${esc(note)}）</span>` : ''}`;
}

function renderCheck() {
  const cards = weekDates().map(d => {
    const list = db.users
      .map(u => ({ u, m: mealsOn(u, d) }))
      .filter(x => x.m.lunch || x.m.dinner);
    const body = list.length
      ? list.map(({ u, m }) => `<tr><td class="name">${esc(u.name)}</td><td class="lunch">${cellText(m.lunch, u.note)}</td><td class="dinner">${cellText(m.dinner, u.note)}</td></tr>`).join('')
      : '<tr class="empty-row"><td colspan="3">この日のお弁当はありません</td></tr>';
    const lunchN = list.filter(x => x.m.lunch).length, dinnerN = list.filter(x => x.m.dinner).length;
    return `<section class="paper day-card" data-date="${ymd(d)}">
      <button class="print-one" data-act="print-one" aria-label="${md(d)}だけ印刷">🖨</button>
      <h2 class="paper-title">さくらほーむ お弁当チェック表</h2>
      <p class="paper-sub">${md(d)}（${WEEK[weekIdx(d)]}）　昼 ${lunchN}食・夜 ${dinnerN}食</p>
      <table class="grid"><thead><tr><th>利用者名</th><th>昼</th><th>夜</th></tr></thead><tbody>${body}</tbody></table>
    </section>`;
  }).join('');
  return `${weekNav()}
    <div class="toolbar"><button class="btn red" data-act="print">🖨 1週間分を印刷</button></div>
    <p class="hint">利用者情報の「利用曜日」「昼・夜」から作ります。1日1枚で印刷されます</p>
    <div class="cards">${cards}</div>`;
}

function printOne(card) {
  card.classList.add('printing');
  document.body.classList.add('print-single');
  const done = () => {
    card.classList.remove('printing');
    document.body.classList.remove('print-single');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1500);
}

// ---------- 食事数表 ----------
function renderCount() {
  const dates = weekDates();
  const data = dates.map(d => {
    const lunch = {}, dinner = {};
    FORMS.forEach(f => { lunch[f] = []; dinner[f] = []; });
    db.users.forEach(u => {
      const m = mealsOn(u, d);
      if (m.lunch) (lunch[m.lunch] || (lunch[m.lunch] = [])).push(u.name);
      if (m.dinner) (dinner[m.dinner] || (dinner[m.dinner] = [])).push(u.name);
    });
    return { d, lunch, dinner };
  });
  const n = (arr, i, meal, f) => {
    const c = arr.length;
    const id = `${i}|${meal}|${f}`;
    return `<td class="n ${c ? '' : 'zero'} ${state.countSel === id ? 'sel' : ''}" data-count="${id}">${c}</td>`;
  };
  const rows = FORMS.map(f => `<tr><th class="form">${f}</th>${data.map((x, i) => n(x.lunch[f], i, 'lunch', f) + n(x.dinner[f], i, 'dinner', f)).join('')}</tr>`).join('');
  const sum = obj => Object.values(obj).reduce((a, b) => a + b.length, 0);
  const totals = `<tr class="total"><th class="form">合計</th>${data.map(x => `<td>${sum(x.lunch)}</td><td>${sum(x.dinner)}</td>`).join('')}</tr>`;
  const weekL = data.reduce((a, x) => a + sum(x.lunch), 0), weekD = data.reduce((a, x) => a + sum(x.dinner), 0);

  let panel = '数字をタップすると、その食事の利用者名が出ます';
  if (state.countSel) {
    const [i, meal, f] = state.countSel.split('|');
    const x = data[+i];
    const names = x[meal][f] || [];
    panel = `<b>${md(x.d)}（${WEEK[weekIdx(x.d)]}） ${meal === 'lunch' ? '昼' : '夜'}・${esc(f)}</b>` +
      (names.length ? names.map(nm => `<span class="tag">${esc(nm)}</span>`).join('') : '該当なし');
  }

  return `${weekNav()}
    <div class="toolbar"><button class="btn red" data-act="print-landscape">🖨 印刷（A4横）</button></div>
    <p class="hint">利用者情報の「利用曜日」「昼・夜」「食事形態」から数えます</p>
    <section class="paper">
      <h2 class="paper-title">さくらほーむ　食事数</h2>
      <p class="paper-sub">今週の合計　昼 ${weekL}食・夜 ${weekD}食</p>
      <div class="scroll-x">
        <table class="grid count">
          <thead>
            <tr><th rowspan="2">形態</th>${data.map(x => `<th colspan="2" class="${dayCls(x.d)}">${md(x.d)}（${WEEK[weekIdx(x.d)]}）</th>`).join('')}</tr>
            <tr>${data.map(() => '<th class="lunch-h">昼</th><th class="dinner-h">夜</th>').join('')}</tr>
          </thead>
          <tbody>${rows}${totals}</tbody>
        </table>
      </div>
      <div class="names-panel">${panel}</div>
    </section>`;
}

// ---------- おやつ表 ----------
function renderSnack() {
  const days = weekDates().map(d => {
    const list = db.users.filter(u => snackOn(u, d));
    const tally = {};
    list.forEach(u => {
      if (!u.drink) return;
      const k = u.drink + (u.add && u.add !== 'なし' ? `（${u.add}）` : '');
      tally[k] = (tally[k] || 0) + 1;
    });
    const body = list.length
      ? list.map((u, i) => `<tr><td>${i + 1}</td><td class="name">${esc(u.name)}</td><td>${esc(u.snack) || '—'}</td><td>${esc(u.drink) || '—'}${u.add && u.add !== 'なし' ? `<span class="note">${esc(u.add)}</span>` : ''}</td></tr>`).join('')
      : '<tr class="empty-row"><td colspan="4">おやつの人はいません</td></tr>';
    return `<section class="paper snack-day">
      <h3 class="${dayCls(d)}">${md(d)}（${WEEK[weekIdx(d)]}）</h3>
      <table class="grid"><thead><tr><th></th><th>名前</th><th>おやつ</th><th>飲み物</th></tr></thead><tbody>${body}</tbody></table>
      <div class="snack-sum">おやつ <b>${list.length}</b> 人${Object.entries(tally).map(([k, v]) => `<span>${esc(k)} ${v}</span>`).join('')}</div>
    </section>`;
  }).join('');
  return `${weekNav()}
    <div class="toolbar"><button class="btn red" data-act="print-landscape">🖨 印刷（A4横）</button></div>
    <p class="hint">利用者情報の「おやつの曜日」から作ります。おやつ欄が空の人は通常のおやつです</p>
    <div class="snack-grid">${days}</div>`;
}

// ---------- 集金集計 ----------
function renderMoney() {
  const dates = monthDates().map(ymd);
  const rows = db.staff.map(s => {
    const cnt = dates.reduce((a, k) => a + (counted((db.orders[k] || {})[s.id]) ? 1 : 0), 0);
    return { s, cnt, amount: cnt * db.price };
  });
  const totalCnt = rows.reduce((a, r) => a + r.cnt, 0);
  const totalAmt = rows.reduce((a, r) => a + r.amount, 0);
  const m = state.month;
  return `${monthNav()}
    <div class="toolbar"><button class="btn red" data-act="print">🖨 印刷</button></div>
    <p class="hint">弁当チェックの <b>✓注文</b> と <b>○受け取り済み</b> を数えます（×休みは含みません）</p>
    <div class="price-row"><label for="price">1食の単価</label><input id="price" type="number" min="0" step="10" value="${db.price}"> 円</div>
    <section class="paper money">
      <h2 class="paper-title">スタッフ弁当 集金表</h2>
      <p class="paper-sub">${m.getFullYear()}年${m.getMonth() + 1}月分</p>
      <div class="scroll-x">
      <table class="grid">
        <thead><tr><th>氏名</th><th>所属</th><th>個数</th><th>単価</th><th>金額</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td class="name">${esc(r.s.name)}</td><td class="dept">${esc(r.s.dept)}</td><td class="num">${r.cnt}</td><td class="num">${yen(db.price)}</td><td class="num">${yen(r.amount)}円</td></tr>`).join('')}</tbody>
        <tfoot><tr><th colspan="2">合計</th><td class="num">${totalCnt}</td><td></td><td class="num">${yen(totalAmt)}円</td></tr></tfoot>
      </table>
      </div>
    </section>`;
}

// ---------- 利用者情報 ----------
function dayChecks(name, sel) {
  return `<div class="days">${WEEK.map((w, i) => `<label><input type="checkbox" name="${name}" value="${i}" ${sel.includes(i) ? 'checked' : ''}>${w}</label>`).join('')}</div>`;
}
function options(list, cur, blank = '—') {
  return list.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${v ? esc(v) : blank}</option>`).join('');
}
function daysText(days) {
  if (days.length === 7) return '毎日';
  if (!days.length) return '曜日なし';
  return days.slice().sort().map(i => WEEK[i]).join('・');
}

function renderUsers() {
  let list = db.users.slice();
  if (state.userSort === 'kana') list.sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
  const cards = list.map(u => {
    const open = state.openUser === u.id;
    return `<article class="user-card ${open ? 'open' : ''}" data-user="${u.id}">
      <button class="user-head" data-act="toggle-user" aria-expanded="${open}">
        <span class="uname">${esc(u.name) || '（名前未入力）'}</span>
        <span class="pill">${daysText(u.days)}</span>
        ${u.lunch ? `<span class="pill">昼 ${esc(u.form)}</span>` : ''}
        ${u.dinner ? `<span class="pill night">夜 ${esc(u.nightForm || u.form)}</span>` : ''}
        ${u.note ? `<span class="pill warn">${esc(u.note)}</span>` : ''}
        <span class="chev">▾</span>
      </button>
      <form class="user-body" data-form="${u.id}">
        <div class="sec-title">基本情報</div>
        <div class="form-grid">
          <div class="field"><label>利用者名</label><input type="text" name="name" value="${esc(u.name)}" required></div>
          <div class="field"><label>ふりがな（あいうえお順の並びに使う）</label><input type="text" name="kana" value="${esc(u.kana)}"></div>
        </div>
        <div class="sec-title">お弁当（チェック表・食事数表）</div>
        <div class="form-grid">
          <div class="field full"><label>利用曜日</label>${dayChecks('days', u.days)}</div>
          <div class="field"><label>食事</label><div class="toggles">
            <label><input type="checkbox" name="lunch" ${u.lunch ? 'checked' : ''}>昼</label>
            <label><input type="checkbox" name="dinner" ${u.dinner ? 'checked' : ''}>夜</label>
          </div></div>
          <div class="field"><label>基本の食事形態</label><select name="form">${options(FORMS, u.form)}</select></div>
          <div class="field"><label>夜の形態（空欄＝基本と同じ）</label><select name="nightForm">${options(['', ...FORMS], u.nightForm, '基本と同じ')}</select></div>
          <div class="field full"><label>個別配慮・注記（チェック表に小さく出ます）</label><input type="text" name="note" value="${esc(u.note)}" placeholder="例: 汁物とろみ"></div>
        </div>
        <div class="sec-title">おやつ・飲み物</div>
        <div class="form-grid">
          <div class="field full"><label>おやつの曜日</label>${dayChecks('snackDays', u.snackDays)}</div>
          <div class="field"><label>おやつの内容（空欄＝通常）</label><input type="text" name="snack" value="${esc(u.snack)}" placeholder="例: ゼリー"></div>
          <div class="field"><label>飲み物</label><select name="drink">${options(DRINKS, u.drink)}</select></div>
          <div class="field"><label>飲み物に入れるもの</label><select name="add">${options(ADDS, u.add)}</select></div>
        </div>
        <div class="user-actions">
          <button type="button" class="btn ghost small" data-act="delete-user">削除</button>
          <button type="submit" class="btn small">保存</button>
        </div>
      </form>
    </article>`;
  }).join('');
  return `<div class="users-tools">
      <button class="btn" data-act="add-user">＋ 利用者を追加</button>
      <select id="userSort" aria-label="並び順">
        <option value="reg" ${state.userSort === 'reg' ? 'selected' : ''}>並び: 登録順</option>
        <option value="kana" ${state.userSort === 'kana' ? 'selected' : ''}>並び: あいうえお順</option>
      </select>
    </div>
    <p class="hint">保存するとチェック表・食事数表・おやつ表にすぐ反映されます（${db.users.length}名）</p>
    <div class="user-list">${cards}</div>`;
}

function saveUser(form) {
  const u = db.users.find(x => x.id === form.dataset.form);
  if (!u) return;
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  if (!name) { toast('利用者名を入れてください'); return; }
  Object.assign(u, {
    name,
    kana: String(fd.get('kana') || '').trim(),
    days: fd.getAll('days').map(Number),
    lunch: fd.get('lunch') !== null,
    dinner: fd.get('dinner') !== null,
    form: fd.get('form'),
    nightForm: fd.get('nightForm') || '',
    note: String(fd.get('note') || '').trim(),
    snackDays: fd.getAll('snackDays').map(Number),
    snack: String(fd.get('snack') || '').trim(),
    drink: fd.get('drink') || '',
    add: fd.get('add') || '',
  });
  db.save('users');
  state.openUser = null;
  render();
  toast(`${name} さんを保存しました`);
}

// ---------- 描画とイベント ----------
function route() { const r = (location.hash.match(/^#\/(\w+)/) || [])[1]; return ROUTES[r] ? r : 'staff'; }

function render() {
  const r = route();
  $('#pageTitle').textContent = ROUTES[r].title;
  document.title = `${ROUTES[r].title}｜お弁当チェック（デモ）`;
  document.querySelectorAll('.drawer a').forEach(a => a.classList.toggle('active', a.dataset.route === r));
  $('#view').innerHTML = ROUTES[r].render();
}

function openDrawer(open) {
  $('#drawer').classList.toggle('open', open);
  $('#drawerMask').hidden = !open;
}

function printLandscape() {
  const st = document.createElement('style');
  st.textContent = '@page { size: A4 landscape; margin: 8mm; }';
  document.head.appendChild(st);
  const done = () => { st.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

document.addEventListener('click', e => {
  if (route() === 'staff' && onStaffClick(e)) return;
  const cnt = e.target.closest('[data-count]');
  if (cnt) { state.countSel = state.countSel === cnt.dataset.count ? null : cnt.dataset.count; render(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const shiftM = n => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + n, 1); render(); };
  const shiftW = n => { state.week = addDays(state.week, 7 * n); state.countSel = null; render(); };
  switch (act) {
    case 'mprev': shiftM(-1); break;
    case 'mnext': shiftM(1); break;
    case 'wprev': shiftW(-1); break;
    case 'wnext': shiftW(1); break;
    case 'wthis': state.week = mondayOf(today()); state.countSel = null; render(); break;
    case 'bulk':
      if (confirm('この月の空いている平日のマスに、すべて「✓ 注文」を入れます。よろしいですか？')) bulkCheck();
      break;
    case 'print': window.print(); break;
    case 'print-landscape': printLandscape(); break;
    case 'print-one': printOne(el.closest('.day-card')); break;
    case 'toggle-user': {
      const id = el.closest('[data-user]').dataset.user;
      state.openUser = state.openUser === id ? null : id;
      render();
      break;
    }
    case 'add-user': {
      const u = newUser();
      db.users.push(u); db.save('users');
      state.openUser = u.id; state.userSort = 'reg';
      render();
      const card = document.querySelector(`[data-user="${u.id}"]`);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.querySelector('input[name=name]').focus({ preventScroll: true });
      break;
    }
    case 'delete-user': {
      const id = el.closest('[data-user]').dataset.user;
      const u = db.users.find(x => x.id === id);
      if (u && confirm(`${u.name || 'この利用者'} を削除します。よろしいですか？`)) {
        db.users = db.users.filter(x => x.id !== id); db.save('users');
        state.openUser = null; render(); toast('削除しました');
      }
      break;
    }
    default: break;
  }
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]');
  if (f) { e.preventDefault(); saveUser(f); }
});

document.addEventListener('change', e => {
  if (e.target.id === 'userSort') { state.userSort = e.target.value; render(); }
  if (e.target.id === 'price') {
    const v = Math.max(0, Math.round(Number(e.target.value) || 0));
    db.price = v; db.save('price'); render(); toast(`単価を ${yen(v)}円 にしました`);
  }
});

$('#menuBtn').addEventListener('click', () => openDrawer(true));
$('#drawerMask').addEventListener('click', () => openDrawer(false));
$('#drawer').addEventListener('click', e => { if (e.target.closest('a')) openDrawer(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') openDrawer(false); });
$('#demoReset').addEventListener('click', () => {
  if (!confirm('デモデータを初期状態に戻します。よろしいですか？')) return;
  db.reset();
  state.openUser = null; state.countSel = null;
  render();
  toast('初期状態に戻しました');
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

db.load();
render();
