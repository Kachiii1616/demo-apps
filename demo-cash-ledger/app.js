// お金管理（見せる用・別実装デモ）
// すべてブラウザ内で完結。データは localStorage（キー接頭辞 showcase-cash:）に保存する。
import { buildSeed, ymd, pad } from './seed.js';

const KEY = 'showcase-cash:data';
const TODAY = new Date();
const TODAY_STR = ymd(TODAY);
const THIS_YM = TODAY_STR.slice(0, 7);
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const ICON = {
  person: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="5.5" r="2.6"/><path d="M3 14c.6-2.8 2.6-4.2 5-4.2s4.4 1.4 5 4.2"/></svg>',
  calendar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.8h11M5.5 2v3M10.5 2v3"/></svg>',
};
const MEMO_CHOICES = ['預り金（ご家族より）', '理美容代', '日用品購入', 'おやつ代', '病院受診（立替分）', '薬代（立替分）', '小遣い', '買い物代行'];

/* ---------------- store ---------------- */
let db = load();

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const d = JSON.parse(s);
      if (d && d.version === 1 && Array.isArray(d.users) && Array.isArray(d.entries)) return d;
    }
  } catch (_) { /* 読めなければ初期データ */ }
  return buildSeed(TODAY);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) { /* 保存できない環境でも画面は動かす */ }
}
function resetData() {
  try { localStorage.removeItem(KEY); } catch (_) {}
  db = buildSeed(TODAY);
  save();
}

/* ---------------- helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const yen = (n) => (n || n === 0 ? Number(n).toLocaleString('ja-JP') : '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const userById = (id) => db.users.find((u) => u.id === id);
const userName = (id) => userById(id)?.name || '（削除された利用者）';
const sortedUsers = () => [...db.users].sort((a, b) => (a.active === b.active ? a.order - b.order : a.active ? -1 : 1));
const cmpEntry = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
const sortedEntries = (list = db.entries) => [...list].sort(cmpEntry);

function shiftYm(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function ymLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年<b>${m}月</b>`;
}
function ymText(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}
const validYm = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');

function balanceOf(userId, untilDate = '9999-12-31') {
  let b = 0;
  for (const e of db.entries) if (e.userId === userId && e.date <= untilDate) b += e.inAmt - e.outAmt;
  return b;
}

// 各利用者の残高を日付順にたどり、マイナスになる最初の地点を返す（なければ null）
function findNegative(entries) {
  const run = {};
  for (const e of sortedEntries(entries)) {
    run[e.userId] = (run[e.userId] || 0) + e.inAmt - e.outAmt;
    if (run[e.userId] < 0) return { userId: e.userId, date: e.date, balance: run[e.userId] };
  }
  return null;
}
function negativeMessage(neg) {
  const [, m, d] = neg.date.split('-').map(Number);
  return `${userName(neg.userId)} 様の預り残高が ${m}月${d}日 の時点で ${yen(neg.balance)} 円になってしまいます。金額か日付を見直してください。`;
}

/* ---------------- toast / modal ---------------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

let lastFocus = null;
function openModal(html, mount) {
  const back = $('#modalBack');
  const box = $('#modal');
  lastFocus = document.activeElement;
  box.innerHTML = html;
  back.hidden = false;
  box.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  mount?.(box);
  const first = box.querySelector('input, select, textarea, button.primary');
  first?.focus();
}
function closeModal() {
  $('#modalBack').hidden = true;
  $('#modal').innerHTML = '';
  lastFocus?.focus?.();
}
$('#modalBack').addEventListener('click', (e) => { if (e.target.id === 'modalBack') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modalBack').hidden && $('#confirmBack').hidden) closeModal(); });

// 画面内の確認ダイアログ（ブラウザ標準の confirm は埋め込み表示で動かないことがあるため使わない）
function ask(message, { ok = 'OK', cancel = 'やめる', danger = false } = {}) {
  return new Promise((resolve) => {
    const back = $('#confirmBack');
    const box = back.querySelector('.modal');
    const prev = document.activeElement;
    $('#confirmMsg').textContent = message;
    $('#confirmOk').textContent = ok;
    const cancelBtn = $('#confirmCancel');
    cancelBtn.textContent = cancel || '';
    cancelBtn.hidden = !cancel;
    box.classList.toggle('danger', danger);
    back.hidden = false;
    $('#confirmOk').focus();
    const done = (v) => {
      back.hidden = true;
      $('#confirmOk').onclick = cancelBtn.onclick = back.onclick = document.onkeydown = null;
      prev?.focus?.();
      resolve(v);
    };
    $('#confirmOk').onclick = () => done(true);
    cancelBtn.onclick = () => done(false);
    back.onclick = (e) => { if (e.target === back) done(false); };
    document.onkeydown = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); done(false); } };
  });
}
const tell = (message) => ask(message, { ok: '閉じる', cancel: null });

function modalHead(title, sub) {
  return `<div class="modal-head"><div><h2 id="modalTitle">${esc(title)}</h2><div class="sub">${esc(sub)}</div></div>
    <button type="button" class="modal-x" data-close aria-label="閉じる">×</button></div>`;
}

/* ---------------- entry form ---------------- */
function openEntryForm({ entry = null, defaultDate, fixedUserId = null }) {
  const isNew = !entry;
  const e = entry || { date: defaultDate, userId: fixedUserId || '', memo: '', inAmt: 0, outAmt: 0, sign: '' };
  const options = sortedUsers()
    .filter((u) => u.active || u.id === e.userId)
    .map((u) => `<option value="${u.id}" ${u.id === e.userId ? 'selected' : ''}>${esc(u.name)}${u.active ? '' : '（利用終了）'}</option>`)
    .join('');

  openModal(`
    ${modalHead(isNew ? '記録を追加' : '記録を編集', 'LEDGER ENTRY')}
    <form id="entryForm" novalidate>
      <div class="err" id="formErr" hidden></div>
      <div class="field"><label for="fDate">日付</label><input type="date" id="fDate" required value="${esc(e.date)}"></div>
      <div class="field"><label for="fUser">利用者</label>
        <select id="fUser" required><option value="">選択</option>${options}</select>
        <div class="hint" id="fUserBal"></div></div>
      <div class="field"><label for="fMemo">摘要</label><input id="fMemo" maxlength="40" placeholder="例: 理美容代" value="${esc(e.memo)}">
        <div class="memo-chips">${MEMO_CHOICES.map((m) => `<button type="button" data-memo="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>
      <div class="grid2">
        <div class="field"><label for="fIn">入金</label><input id="fIn" class="num" inputmode="numeric" placeholder="0" value="${e.inAmt || ''}"></div>
        <div class="field"><label for="fOut">出金</label><input id="fOut" class="num" inputmode="numeric" placeholder="0" value="${e.outAmt || ''}"></div>
      </div>
      <div class="grid2"><div class="field"><label for="fSign">サイン</label><input id="fSign" maxlength="8" value="${esc(e.sign)}"></div></div>
      <div class="modal-actions">
        <button type="submit" class="btn primary lg">${isNew ? '追加' : '更新'}</button>
        <button type="button" class="btn lg" data-close>閉じる</button>
        ${isNew ? '' : '<button type="button" class="btn lg danger" id="fDelete">削除</button>'}
      </div>
    </form>`, (box) => {
    const showBal = () => {
      const uid = $('#fUser', box).value;
      $('#fUserBal', box).textContent = uid ? `現在の預り残高 ${yen(balanceOf(uid))} 円` : '';
    };
    $('#fUser', box).addEventListener('change', showBal);
    showBal();
    box.querySelectorAll('[data-memo]').forEach((b) => b.addEventListener('click', () => {
      $('#fMemo', box).value = b.dataset.memo;
      if (b.dataset.memo.startsWith('預り金')) $('#fIn', box).focus(); else $('#fOut', box).focus();
    }));
    const err = (msg) => { const el = $('#formErr', box); el.textContent = msg; el.hidden = false; el.scrollIntoView({ block: 'nearest' }); };
    const toNum = (v) => {
      const s = String(v).replace(/[,，\s円]/g, '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
      if (s === '') return 0;
      return /^\d+$/.test(s) ? Number(s) : NaN;
    };

    $('#entryForm', box).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const date = $('#fDate', box).value;
      const userId = $('#fUser', box).value;
      const memo = $('#fMemo', box).value.trim();
      const inAmt = toNum($('#fIn', box).value);
      const outAmt = toNum($('#fOut', box).value);
      const sign = $('#fSign', box).value.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('日付を入れてください。');
      if (!userId) return err('利用者を選んでください。');
      if (!memo) return err('摘要を入れてください。');
      if (Number.isNaN(inAmt) || Number.isNaN(outAmt)) return err('金額は数字で入れてください。');
      if (inAmt > 0 && outAmt > 0) return err('入金と出金は、どちらか一方だけ入れてください。');
      if (inAmt === 0 && outAmt === 0) return err('入金か出金の金額を入れてください。');
      if (inAmt > 10000000 || outAmt > 10000000) return err('金額が大きすぎます。');

      const next = isNew
        ? { id: 'e' + db.nextSeq, seq: db.nextSeq, date, userId, memo, inAmt, outAmt, sign }
        : { ...entry, date, userId, memo, inAmt, outAmt, sign };
      const trial = isNew ? [...db.entries, next] : db.entries.map((x) => (x.id === entry.id ? next : x));
      const neg = findNegative(trial);
      if (neg) return err(negativeMessage(neg));
      db.entries = trial;
      if (isNew) db.nextSeq += 1;
      save();
      closeModal();
      toast(isNew ? '記録を追加しました' : '記録を更新しました');
      render();
    });

    $('#fDelete', box)?.addEventListener('click', async () => {
      const trial = db.entries.filter((x) => x.id !== entry.id);
      const neg = findNegative(trial);
      if (neg) return err('この記録を消すと、' + negativeMessage(neg));
      if (!(await ask(`「${entry.memo}」（${yen(entry.inAmt || entry.outAmt)} 円）を削除します。よろしいですか？`, { ok: '削除する', danger: true }))) return;
      db.entries = trial;
      save();
      closeModal();
      toast('記録を削除しました');
      render();
    });
  });
}

/* ---------------- user form ---------------- */
function openUserForm(user = null) {
  const isNew = !user;
  const u = user || { name: '', kana: '', order: db.users.length + 1, active: true, note: '' };
  openModal(`
    ${modalHead(isNew ? '利用者を追加' : '利用者を編集', 'REGISTER')}
    <form id="userForm" novalidate>
      <div class="err" id="formErr" hidden></div>
      <div class="field"><label for="uName">氏名</label><input id="uName" maxlength="20" placeholder="例: 山田 太郎" value="${esc(u.name)}"></div>
      <div class="field"><label for="uKana">フリガナ</label><input id="uKana" maxlength="30" placeholder="例: ヤマダ タロウ" value="${esc(u.kana)}"></div>
      <div class="grid2">
        <div class="field"><label for="uOrder">表示順</label><input id="uOrder" inputmode="numeric" value="${esc(u.order)}"></div>
        <div class="field"><label for="uActive">状態</label>
          <select id="uActive"><option value="1" ${u.active ? 'selected' : ''}>利用中</option><option value="0" ${u.active ? '' : 'selected'}>利用終了</option></select></div>
      </div>
      <div class="field"><label for="uNote">備考</label><input id="uNote" maxlength="40" value="${esc(u.note)}"></div>
      <div class="modal-actions">
        <button type="submit" class="btn primary lg">${isNew ? '登録' : '更新'}</button>
        <button type="button" class="btn lg" data-close>閉じる</button>
        ${isNew ? '' : '<button type="button" class="btn lg danger" id="uDelete">削除</button>'}
      </div>
    </form>`, (box) => {
    const err = (msg) => { const el = $('#formErr', box); el.textContent = msg; el.hidden = false; };
    $('#userForm', box).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = $('#uName', box).value.trim().replace(/\s+/g, ' ');
      const kana = $('#uKana', box).value.trim().replace(/\s+/g, ' ');
      const order = Number($('#uOrder', box).value) || db.users.length + 1;
      const active = $('#uActive', box).value === '1';
      const note = $('#uNote', box).value.trim();
      if (!name) return err('氏名を入れてください。');
      if (db.users.some((x) => x.name === name && x.id !== user?.id)) return err('同じ氏名の利用者がすでに登録されています。');
      if (!isNew && user.active && !active) {
        const b = balanceOf(user.id);
        if (b !== 0 && !(await ask(`預り残高が ${yen(b)} 円残っています。このまま利用終了にしますか？\n（返金した場合は、先に出金の記録を入れておくと残高が 0 になります）`, { ok: '利用終了にする' }))) return;
      }
      if (isNew) {
        db.users.push({ id: 'u' + db.nextUser, name, kana, order, active, note });
        db.nextUser += 1;
      } else {
        Object.assign(userById(user.id), { name, kana, order, active, note });
      }
      save();
      closeModal();
      toast(isNew ? '利用者を登録しました' : '利用者を更新しました');
      render();
    });
    $('#uDelete', box)?.addEventListener('click', async () => {
      const count = db.entries.filter((e) => e.userId === user.id).length;
      if (count > 0) return err(`この方には出納の記録が ${count} 件あるため削除できません。利用をやめた方は「状態」を「利用終了」にしてください。`);
      if (!(await ask(`${user.name} 様の登録を削除します。よろしいですか？`, { ok: '削除する', danger: true }))) return;
      db.users = db.users.filter((x) => x.id !== user.id);
      save();
      closeModal();
      toast('登録を削除しました');
      render();
    });
  });
}

/* ---------------- shared pieces ---------------- */
function tabs(active) {
  const t = [['month', '月別一覧', '#/month'], ['users', '利用者一覧', '#/users'], ['register', '利用者登録', '#/register']];
  return `<nav class="tabs" aria-label="画面の切り替え">${t.map(([k, label, href]) => `<a href="${href}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
}
function monthNav(ym, hrefFor) {
  return `<div class="month-nav">
    <button type="button" aria-label="前の月" data-go="${hrefFor(shiftYm(ym, -1))}">‹</button>
    <div class="month-label" aria-live="polite">${ymLabel(ym)}</div>
    <button type="button" aria-label="次の月" data-go="${hrefFor(shiftYm(ym, 1))}">›</button>
  </div>`;
}
function bindGo(root) {
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
}
function summary({ carry, inSum, outSum, end, extra = '' }) {
  return `<div class="summary">
    <span>前月繰越<b>${yen(carry)}</b></span>
    <span class="in">入金合計<b>${yen(inSum)}</b></span>
    <span class="out">出金合計<b>${yen(outSum)}</b></span>
    <span>月末残高<b>${yen(end)}</b></span>${extra}</div>`;
}

// 出納表（月別・個人共通）
function ledgerTable({ rows, carry, showUser, carryLabel = '前月繰越' }) {
  let bal = carry;
  let inSum = 0, outSum = 0;
  const body = rows.map((e) => {
    bal += e.inAmt - e.outAmt; inSum += e.inAmt; outSum += e.outAmt;
    const [, m, d] = e.date.split('-').map(Number);
    return `<tr class="row" data-id="${e.id}" tabindex="0" aria-label="${m}月${d}日 ${esc(userName(e.userId))} ${esc(e.memo)} を編集">
      <td class="c">${m}</td><td class="c">${d}</td>
      ${showUser ? `<td class="user"><a href="#/user/${e.userId}/${e.date.slice(0, 7)}" data-stop>${esc(userName(e.userId))}</a></td>` : ''}
      <td class="memo">${esc(e.memo)}</td>
      <td class="num in">${e.inAmt ? yen(e.inAmt) : ''}</td>
      <td class="num out">${e.outAmt ? yen(e.outAmt) : ''}</td>
      <td class="num">${yen(bal)}</td>
      <td class="sign">${esc(e.sign)}</td></tr>`;
  }).join('');
  const cols = showUser ? 8 : 7;
  const blankRow = `<tr class="blank">${'<td></td>'.repeat(cols)}</tr>`;
  const html = `<div class="table-scroll"><table class="ledger">
    <thead><tr><th colspan="2">日付</th>${showUser ? '<th rowspan="2">利用者</th>' : ''}<th rowspan="2">摘要</th>
      <th rowspan="2" class="col-in">入金</th><th rowspan="2" class="col-out">出金</th><th rowspan="2" class="col-bal">残高</th><th rowspan="2">サイン</th></tr>
      <tr><th>月</th><th>日</th></tr></thead>
    <tbody>
      <tr class="carry"><td></td><td></td>${showUser ? '<td></td>' : ''}<td class="memo">${carryLabel}</td><td></td><td></td><td class="num">${yen(carry)}</td><td></td></tr>
      ${body}
      <tr class="add" tabindex="0" role="button"><td></td><td></td>${showUser ? '<td></td>' : ''}<td colspan="5">＋ タップして記入</td></tr>
      ${blankRow}${blankRow}
      <tr class="total"><td></td><td></td>${showUser ? '<td></td>' : ''}<td class="memo">合計</td>
        <td class="num">${yen(inSum)}</td><td class="num">${yen(outSum)}</td><td class="num">${yen(bal)}</td><td></td></tr>
    </tbody></table></div>`;
  return { html, inSum, outSum, end: bal };
}
function bindLedger(root, { defaultDate, fixedUserId }) {
  root.querySelectorAll('tr.row').forEach((tr) => {
    const open = () => openEntryForm({ entry: db.entries.find((x) => x.id === tr.dataset.id) });
    tr.addEventListener('click', (ev) => { if (!ev.target.closest('[data-stop]')) open(); });
    tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target === tr) open(); });
  });
  root.querySelectorAll('tr.add').forEach((tr) => {
    const open = () => openEntryForm({ defaultDate, fixedUserId });
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
  });
}
const defaultDateFor = (ym) => (ym === THIS_YM ? TODAY_STR : `${ym}-01`);

/* ---------------- views ---------------- */
function viewMonth(app, ym) {
  const start = `${ym}-01`;
  const rows = sortedEntries(db.entries.filter((e) => e.date.startsWith(ym)));
  const carry = db.entries.filter((e) => e.date < start).reduce((s, e) => s + e.inAmt - e.outAmt, 0);
  const t = ledgerTable({ rows, carry, showUser: true });
  app.innerHTML = `${tabs('month')}
    ${monthNav(ym, (m) => `#/month/${m}`)}
    <section class="card">
      <h2 class="card-title" data-en="Monthly ledger"><span class="badge-icon" aria-hidden="true">${ICON.calendar}</span>月別出納表</h2>
      ${summary({ carry, inSum: t.inSum, outSum: t.outSum, end: t.end, extra: `<span>件数<b>${rows.length}</b></span>` })}
      <div class="toolbar">
        <button type="button" class="btn danger" id="delMonth" ${rows.length ? '' : 'disabled'}>この月を削除</button>
        <a class="btn" href="#/print/${ym}">印刷</a>
      </div>
      ${t.html}
    </section>`;
  bindGo(app);
  bindLedger(app, { defaultDate: defaultDateFor(ym) });
  $('#delMonth', app)?.addEventListener('click', async () => {
    const trial = db.entries.filter((e) => !e.date.startsWith(ym));
    const neg = findNegative(trial);
    if (neg) return tell('この月の記録を消すと、' + negativeMessage(neg));
    if (!(await ask(`${ymText(ym)} の記録 ${rows.length} 件をすべて削除します。元に戻せません（デモでは「初期状態に戻す」で復元できます）。よろしいですか？`, { ok: '削除する', danger: true }))) return;
    db.entries = trial;
    save();
    toast(`${ymText(ym)} の記録を削除しました`);
    render();
  });
}

function viewUsers(app) {
  app.innerHTML = `${tabs('users')}
    <section class="card">
      <h2 class="card-title" data-en="Residents"><span class="badge-icon" aria-hidden="true">${ICON.person}</span>利用者一覧</h2>
      <input type="search" class="search" id="q" placeholder="名前で探す（氏名・フリガナ）" aria-label="名前で探す">
      <ul class="user-list" id="list"></ul>
      <p class="empty-note" id="none" hidden>該当する利用者がいません。</p>
    </section>`;
  const draw = (q) => {
    const norm = (s) => s.replace(/\s/g, '');
    const nq = norm(q);
    const list = sortedUsers().filter((u) => !nq || norm(u.name).includes(nq) || norm(u.kana).includes(nq));
    $('#list', app).innerHTML = list.map((u) => `<li class="${u.active ? '' : 'ended'}"><a href="#/user/${u.id}/${THIS_YM}">
      <div><div class="nm">${esc(u.name)} 様</div><div class="kn">${esc(u.kana)}${u.active ? '' : '（利用終了）'}</div></div>
      <div class="bal">${yen(balanceOf(u.id))}<small>預り残高</small></div><span class="chev" aria-hidden="true">›</span></a></li>`).join('');
    $('#none', app).hidden = list.length > 0;
  };
  $('#q', app).addEventListener('input', (e) => draw(e.target.value));
  draw('');
}

function viewUser(app, userId, mode) {
  const u = userById(userId);
  if (!u) { location.hash = '#/users'; return; }
  const all = mode === 'all';
  const ym = all ? THIS_YM : mode;
  const mine = db.entries.filter((e) => e.userId === userId);
  let rows, carry;
  if (all) {
    rows = sortedEntries(mine);
    carry = 0;
  } else {
    rows = sortedEntries(mine.filter((e) => e.date.startsWith(ym)));
    carry = mine.filter((e) => e.date < `${ym}-01`).reduce((s, e) => s + e.inAmt - e.outAmt, 0);
  }
  const t = ledgerTable({ rows, carry, showUser: false, carryLabel: all ? '開始残高' : '前月繰越' });
  const now = balanceOf(userId);
  app.innerHTML = `${tabs('users')}
    <p class="crumb"><a href="#/users">‹ 利用者一覧</a> ／ 個別ページ</p>
    ${all ? '' : monthNav(ym, (m) => `#/user/${userId}/${m}`)}
    <section class="card">
      <h2 class="card-title" data-en="Personal ledger"><span class="badge-icon" aria-hidden="true">¥</span>${esc(u.name)} 様${u.active ? '' : ' <span class="status off">利用終了</span>'}</h2>
      ${all
        ? `<div class="summary"><span class="in">入金合計<b>${yen(t.inSum)}</b></span><span class="out">出金合計<b>${yen(t.outSum)}</b></span><span>現在の預り残高<b>${yen(now)}</b></span><span>件数<b>${rows.length}</b></span></div>`
        : summary({ carry, inSum: t.inSum, outSum: t.outSum, end: t.end, extra: `<span>現在の預り残高<b>${yen(now)}</b></span>` })}
      <div class="toolbar">
        <div class="seg" role="group" aria-label="表示する期間">
          <button type="button" class="${all ? '' : 'on'}" data-go="#/user/${userId}/${ym}">この月</button>
          <button type="button" class="${all ? 'on' : ''}" data-go="#/user/${userId}/all">全期間</button>
        </div>
        <span class="spacer"></span>
        ${all ? '' : `<a class="btn" href="#/print/${ym}/${userId}">印刷</a>`}
      </div>
      ${t.html}
    </section>`;
  bindGo(app);
  bindLedger(app, { defaultDate: defaultDateFor(ym), fixedUserId: u.active ? userId : null });
}

function viewRegister(app) {
  const list = sortedUsers();
  app.innerHTML = `${tabs('register')}
    <section class="card">
      <h2 class="card-title" data-en="Register"><span class="badge-icon" aria-hidden="true">${ICON.person}</span>利用者登録</h2>
      <div class="toolbar">
        <p class="help">利用終了にすると入力の選択肢から外れます（過去の記録は残ります）。記録のない登録は「編集」→「削除」で取り消せます。</p>
        <button type="button" class="btn primary lg" id="addUser">＋ 利用者を追加</button>
      </div>
      <div class="table-scroll"><table class="plain">
        <thead><tr><th>表示順</th><th>氏名</th><th>フリガナ</th><th>状態</th><th>預り残高</th><th>備考</th><th></th></tr></thead>
        <tbody>${list.map((u) => `<tr class="${u.active ? '' : 'ended'}">
          <td>${esc(u.order)}</td><td>${esc(u.name)}</td><td>${esc(u.kana)}</td>
          <td><span class="status ${u.active ? '' : 'off'}">${u.active ? '利用中' : '利用終了'}</span></td>
          <td class="num">${yen(balanceOf(u.id))}</td><td>${esc(u.note)}</td>
          <td class="act"><button type="button" class="btn" data-edit="${u.id}">編集</button></td></tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  $('#addUser', app).addEventListener('click', () => openUserForm());
  app.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openUserForm(userById(b.dataset.edit))));
}

function viewPrint(app, ym, userId) {
  const u = userId ? userById(userId) : null;
  const pool = u ? db.entries.filter((e) => e.userId === u.id) : db.entries;
  const rows = sortedEntries(pool.filter((e) => e.date.startsWith(ym)));
  const carry = pool.filter((e) => e.date < `${ym}-01`).reduce((s, e) => s + e.inAmt - e.outAmt, 0);
  let bal = carry, inSum = 0, outSum = 0;
  const showUser = !u;
  const body = rows.map((e) => {
    bal += e.inAmt - e.outAmt; inSum += e.inAmt; outSum += e.outAmt;
    const [, m, d] = e.date.split('-').map(Number);
    return `<tr><td class="c">${m}</td><td class="c">${d}</td>${showUser ? `<td>${esc(userName(e.userId))}</td>` : ''}
      <td>${esc(e.memo)}</td><td class="num">${e.inAmt ? yen(e.inAmt) : ''}</td><td class="num">${e.outAmt ? yen(e.outAmt) : ''}</td>
      <td class="num">${yen(bal)}</td><td class="c">${esc(e.sign)}</td></tr>`;
  }).join('');
  const cols = showUser ? 8 : 7;
  const fill = Math.max(0, 30 - rows.length);
  const blanks = `<tr>${'<td></td>'.repeat(cols)}</tr>`.repeat(fill);
  const back = u ? `#/user/${u.id}/${ym}` : `#/month/${ym}`;
  const printed = `${TODAY.getFullYear()}年${TODAY.getMonth() + 1}月${TODAY.getDate()}日`;

  app.innerHTML = `
    <div class="print-tools">
      <a class="btn lg" href="${back}">‹ 戻る</a>
      <span class="note">A4縦の出納表です。「印刷する」でブラウザの印刷画面が開きます（PDF保存も可）。</span>
      <button type="button" class="btn lg" data-go="#/print/${shiftYm(ym, -1)}${u ? '/' + u.id : ''}" aria-label="前の月">‹ 前月</button>
      <button type="button" class="btn lg" data-go="#/print/${shiftYm(ym, 1)}${u ? '/' + u.id : ''}" aria-label="次の月">翌月 ›</button>
      <button type="button" class="btn primary lg" id="doPrint">印刷する</button>
    </div>
    <div class="sheet-holder"><article class="sheet" aria-label="印刷用の出納表">
      <div class="sheet-head">
        <div>
          <h1 class="sheet-title">預り金出納表</h1>
          <div class="sheet-sub">${ymText(ym)}分　${esc(db.facility)}${u ? `　利用者：${esc(u.name)} 様` : '　（全利用者）'}</div>
        </div>
        <div class="stamps"><div><span>施設長</span><i></i></div><div><span>確認</span><i></i></div><div><span>担当</span><i></i></div></div>
      </div>
      <div class="sheet-sum">
        <div>前月繰越<b>${yen(carry)}</b></div><div>入金合計<b>${yen(inSum)}</b></div>
        <div>出金合計<b>${yen(outSum)}</b></div><div>月末残高<b>${yen(bal)}</b></div>
      </div>
      <table class="sheet-table">
        <colgroup><col style="width:7mm"><col style="width:7mm">${showUser ? '<col style="width:26mm">' : ''}<col><col style="width:20mm"><col style="width:20mm"><col style="width:22mm"><col style="width:14mm"></colgroup>
        <thead><tr><th>月</th><th>日</th>${showUser ? '<th>利用者</th>' : ''}<th>摘要</th><th>入金</th><th>出金</th><th>残高</th><th>サイン</th></tr></thead>
        <tbody>
          <tr class="carry"><td></td><td></td>${showUser ? '<td></td>' : ''}<td class="c">前月繰越</td><td></td><td></td><td class="num">${yen(carry)}</td><td></td></tr>
          ${body}${blanks}
          <tr class="total"><td></td><td></td>${showUser ? '<td></td>' : ''}<td class="c">合計</td><td class="num">${yen(inSum)}</td><td class="num">${yen(outSum)}</td><td class="num">${yen(bal)}</td><td></td></tr>
        </tbody>
      </table>
      <div class="sheet-foot"><span>件数 ${rows.length} 件</span><span>出力日 ${printed}（デモ版・架空データ）</span></div>
    </article></div>`;
  bindGo(app);
  $('#doPrint', app).addEventListener('click', () => window.print());
}

/* ---------------- router ---------------- */
function render() {
  const app = $('#app');
  const parts = (location.hash.replace(/^#\/?/, '') || 'month').split('/');
  const [page, a, b] = parts;
  document.body.classList.toggle('is-print', page === 'print');
  if (page === 'month') viewMonth(app, validYm(a) ? a : THIS_YM);
  else if (page === 'users') viewUsers(app);
  else if (page === 'user') viewUser(app, a, b === 'all' ? 'all' : validYm(b) ? b : THIS_YM);
  else if (page === 'register') viewRegister(app);
  else if (page === 'print') viewPrint(app, validYm(a) ? a : THIS_YM, b);
  else { location.hash = '#/month'; return; }
}

/* ---------------- 着せ替え ---------------- */
const THEME_KEY = 'showcase-cash:theme';
const THEMES = { standard: '標準', wamodern: '和モダン' };
function bindTheme() {
  const sel = $('#themeSel');
  const cur = document.documentElement.dataset.theme;
  sel.value = THEMES[cur] ? cur : 'standard';
  sel.addEventListener('change', () => {
    const t = THEMES[sel.value] ? sel.value : 'standard';
    if (t === 'wamodern') window.__cashThemeFonts?.();
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch (_) { /* 保存できなくても切替はする */ }
    toast(`着せ替え：${THEMES[t]}`);
  });
}

function init() {
  $('#facilityName').textContent = db.facility;
  $('#todayLabel').textContent = `今日 ${TODAY.getFullYear()}年${TODAY.getMonth() + 1}月${TODAY.getDate()}日(${WEEK[TODAY.getDay()]})`;
  $('#demoReset').addEventListener('click', async () => {
    if (!(await ask('デモデータを初期状態に戻します。追加・変更した内容は消えます。よろしいですか？', { ok: '初期状態に戻す' }))) return;
    resetData();
    toast('初期状態に戻しました');
    render();
  });
  bindTheme();
  save();
  window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
  render();
}
init();
