import { load, reset, db } from './store.js';
import { OFFICE, CATEGORIES, CARE_LEVELS } from './seed.js';
import { monthlyRows } from './billing.js';
import { esc, yen, norm, uid, todayYmd, jpDate, age, parseYmd, pad2 } from './util.js';

load();

const view = document.getElementById('view');
const STATUSES = ['利用中', '入院中', '終了'];
const END_REASONS = ['終了', '解約', '入院', '逝去'];

// ------------------------------------------------------------ 共通
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function title(en, ja) {
  return `<h1 class="page-title"><span class="en">${en}</span><span class="ja">${ja}</span></h1>`;
}

function options(list, selected, { blank } = {}) {
  const head = blank != null ? `<option value="">${esc(blank)}</option>` : '';
  return head + list.map((o) => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}"${String(v) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

function statusBadge(s) {
  const cls = s === '利用中' ? 'active' : s === '入院中' ? 'hospital' : 'ended';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

function isActive(c, at = todayYmd()) {
  return c.start <= at && (!c.end || c.end >= at);
}

function cmLabel(u) {
  const o = db.careOffice(u.cmOffice);
  return o ? `${o.name}　${u.cmName || ''}` : '';
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = new URLSearchParams(qs || '');
  return { parts, query };
}

// ------------------------------------------------------------ ルーター
function route() {
  document.body.classList.remove('nav-open');
  const { parts, query } = parseHash();
  const top = parts[0] || 'users';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const key = a.dataset.nav;
    a.classList.toggle('is-active', key === top || (key === 'users' && top === 'print'));
  });

  if (top === 'users' && parts[1]) renderDetail(parts[1], query.get('tab') || 'basic');
  else if (top === 'new') renderNew();
  else if (top === 'products') renderProducts();
  else if (top === 'monthly') renderMonthly(query.get('m'));
  else if (top === 'print' && parts[1]) renderPrint(parts[1]);
  else renderUsers();

  window.scrollTo(0, 0);
}

// ------------------------------------------------------------ 利用者一覧
const listState = { q: '', status: '', cm: '' };

function renderUsers() {
  view.innerHTML = `
    ${title('Users', '利用者一覧')}
    <section class="card">
      <div class="search-row">
        <label for="q">検索</label>
        <input id="q" class="input" type="search" placeholder="氏名・フリガナ" value="${esc(listState.q)}">
        <select id="fStatus" class="input" aria-label="状態で絞り込み">${options(STATUSES, listState.status, { blank: '状態：すべて' })}</select>
        <select id="fCm" class="input" aria-label="ケアマネ事業所で絞り込み">${options(db.careOffices.map((c) => [c.id, c.name]), listState.cm, { blank: 'ケアマネ事業所：すべて' })}</select>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>氏名</th><th>フリガナ</th><th>介護度</th><th>状態</th><th>ケアマネ事業所</th><th class="num">貸与中</th><th>更新</th></tr></thead>
        <tbody id="userRows"></tbody>
      </table></div>
      <p class="muted" id="userCount"></p>
    </section>`;

  const draw = () => {
    const q = norm(listState.q);
    const rows = db.users
      .filter((u) => !q || norm(u.name).includes(q) || norm(u.kana).includes(q))
      .filter((u) => !listState.status || u.status === listState.status)
      .filter((u) => !listState.cm || u.cmOffice === listState.cm)
      .sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));
    document.getElementById('userRows').innerHTML = rows.length ? rows.map((u) => {
      const n = db.contractsOf(u.id).filter((c) => isActive(c)).length;
      return `<tr class="clickable${u.status === '終了' ? ' is-ended' : ''}" data-id="${esc(u.id)}" tabindex="0">
        <td class="nowrap">${esc(u.name)}</td><td class="nowrap">${esc(u.kana)}</td><td class="nowrap">${esc(u.careLevel)}</td>
        <td>${statusBadge(u.status)}</td><td>${esc(db.careOffice(u.cmOffice)?.name || '')}</td>
        <td class="num">${n} 点</td><td class="nowrap">${esc(u.updatedAt || '')}</td></tr>`;
    }).join('') : `<tr><td colspan="7" class="empty">該当する利用者がいません</td></tr>`;
    document.getElementById('userCount').textContent = `${rows.length} 名を表示（全 ${db.users.length} 名）`;
  };
  draw();

  document.getElementById('q').addEventListener('input', (e) => { listState.q = e.target.value; draw(); });
  document.getElementById('fStatus').addEventListener('change', (e) => { listState.status = e.target.value; draw(); });
  document.getElementById('fCm').addEventListener('change', (e) => { listState.cm = e.target.value; draw(); });
  const open = (tr) => tr && (location.hash = `#/users/${tr.dataset.id}`);
  const tbody = document.getElementById('userRows');
  tbody.addEventListener('click', (e) => open(e.target.closest('tr[data-id]')));
  tbody.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e.target.closest('tr[data-id]')); });
}

// ------------------------------------------------------------ 利用者フォーム（詳細・新規で共用）
function userFormHtml(u) {
  const cmOffice = u.cmOffice || db.careOffices[0].id;
  const managers = db.careOffice(cmOffice)?.managers || [];
  return `
  <form id="userForm" novalidate>
    <section class="card">
      <h2>基本情報</h2>
      <div class="grid-2">
        <div class="field"><label for="f-name">氏名<span class="req">*</span></label><input id="f-name" name="name" class="input" required value="${esc(u.name)}" placeholder="例：山田 太郎"></div>
        <div class="field"><label for="f-kana">フリガナ<span class="req">*</span></label><input id="f-kana" name="kana" class="input" required value="${esc(u.kana)}" placeholder="例：ヤマダ タロウ"></div>
        <div class="field"><label for="f-gender">性別</label><select id="f-gender" name="gender" class="input">${options(['女性', '男性'], u.gender, { blank: '' })}</select></div>
        <div class="field"><label for="f-birth">生年月日</label><input id="f-birth" name="birth" type="date" class="input" value="${esc(u.birth)}"></div>
        <div class="field"><label for="f-zip">郵便番号</label><input id="f-zip" name="zip" class="input" value="${esc(u.zip)}" placeholder="999-0000"></div>
        <div class="field"><label for="f-phone">電話</label><input id="f-phone" name="phone" class="input" value="${esc(u.phone)}" placeholder="03-0000-0000"></div>
        <div class="field span-2"><label for="f-address">住所</label><input id="f-address" name="address" class="input" value="${esc(u.address)}"></div>
        <div class="field"><label for="f-contactName">連絡先氏名</label><input id="f-contactName" name="contactName" class="input" value="${esc(u.contactName)}"></div>
        <div class="field"><label for="f-contactPhone">連絡先電話</label><input id="f-contactPhone" name="contactPhone" class="input" value="${esc(u.contactPhone)}"></div>
        <div class="field"><label for="f-cmOffice">ケアマネ事業所</label><select id="f-cmOffice" name="cmOffice" class="input">${options(db.careOffices.map((c) => [c.id, c.name]), cmOffice)}</select></div>
        <div class="field"><label for="f-cmName">担当ケアマネ</label><select id="f-cmName" name="cmName" class="input">${options(managers, u.cmName)}</select></div>
        <div class="field"><label for="f-staff">担当者（自社）</label><select id="f-staff" name="staff" class="input">${options(OFFICE.staff, u.staff)}</select></div>
        <div class="field"><label for="f-status">状態</label><select id="f-status" name="status" class="input">${options(STATUSES, u.status || '利用中')}</select></div>
        <div class="field span-2"><label for="f-note">備考</label><textarea id="f-note" name="note" class="input">${esc(u.note)}</textarea></div>
      </div>
    </section>
    <section class="card">
      <h2>被保険者証<small>介護度・認定期間</small></h2>
      <div class="grid-3">
        <div class="field"><label for="f-level">介護度<span class="req">*</span></label><select id="f-level" name="careLevel" class="input" required>${options(CARE_LEVELS, u.careLevel, { blank: '選択してください' })}</select></div>
        <div class="field"><label for="f-certStart">認定開始日</label><input id="f-certStart" name="certStart" type="date" class="input" value="${esc(u.certStart)}"></div>
        <div class="field"><label for="f-certEnd">認定終了日</label><input id="f-certEnd" name="certEnd" type="date" class="input" value="${esc(u.certEnd)}"></div>
        <div class="field"><label for="f-insurerNo">保険者番号</label><input id="f-insurerNo" name="insurerNo" class="input" inputmode="numeric" value="${esc(u.insurerNo)}"></div>
        <div class="field"><label for="f-insuredNo">被保険者番号</label><input id="f-insuredNo" name="insuredNo" class="input" value="${esc(u.insuredNo)}"></div>
      </div>
      <p class="muted" id="certNote"></p>
    </section>
    <section class="card">
      <h2>計画書の目標<small>印刷する計画書に載ります</small></h2>
      <div class="field"><label for="f-goal">利用目標</label><textarea id="f-goal" name="goal" class="input">${esc(u.goal)}</textarea></div>
      <div class="actions"><button type="submit" class="btn primary">保存</button><span class="muted" id="formMsg"></span></div>
    </section>
  </form>`;
}

function bindUserForm(onSave, base) {
  const form = document.getElementById('userForm');
  const cmOffice = form.elements.cmOffice;
  cmOffice.addEventListener('change', () => {
    form.elements.cmName.innerHTML = options(db.careOffice(cmOffice.value)?.managers || [], '');
  });
  const certNote = () => {
    const end = parseYmd(form.elements.certEnd.value);
    const el = document.getElementById('certNote');
    if (!end) { el.textContent = ''; return; }
    const days = Math.round((end - parseYmd(todayYmd())) / 86400000);
    el.textContent = days < 0 ? '認定期間が終わっています。新しい被保険者証の内容を入力してください。'
      : days <= 60 ? `認定終了まで あと ${days} 日です。` : '';
  };
  form.elements.certEnd.addEventListener('change', certNote);
  certNote();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const missing = [];
    if (!data.name.trim()) missing.push('氏名');
    if (!data.kana.trim()) missing.push('フリガナ');
    if (!data.careLevel) missing.push('介護度');
    if (missing.length) {
      document.getElementById('formMsg').textContent = `${missing.join('・')}を入力してください。`;
      return;
    }
    if (data.certStart && data.certEnd && data.certEnd < data.certStart) {
      document.getElementById('formMsg').textContent = '認定終了日が開始日より前になっています。';
      return;
    }
    const u = { ...base, ...data, name: data.name.trim(), kana: data.kana.trim() };
    db.upsertUser(u);
    onSave(u);
  });
}

// ------------------------------------------------------------ 新規利用者登録
function renderNew() {
  const blank = {
    id: uid('u'), name: '', kana: '', gender: '', birth: '', zip: '', address: '', phone: '',
    contactName: '', contactRelation: '', contactPhone: '', status: '利用中', careLevel: '',
    certStart: '', certEnd: '', insurerNo: '', insuredNo: '', cmOffice: db.careOffices[0].id,
    cmName: db.careOffices[0].managers[0], staff: OFFICE.staff[0], goal: '', note: '',
  };
  view.innerHTML = `${title('New', '新規利用者登録')}
    <p class="muted" style="text-align:center;margin-top:-10px">登録すると利用者詳細に移り、貸与する用具を追加できます。</p>
    ${userFormHtml(blank)}`;
  bindUserForm((u) => {
    toast(`${u.name} 様を登録しました`);
    location.hash = `#/users/${u.id}?tab=rental`;
  }, blank);
  document.getElementById('f-name').focus();
}

// ------------------------------------------------------------ 利用者詳細
function renderDetail(id, tab) {
  const u = db.user(id);
  if (!u) {
    view.innerHTML = `${title('Users', '利用者一覧')}<section class="card"><p class="empty">この利用者は見つかりません。</p><a class="btn" href="#/users">← 一覧へ</a></section>`;
    return;
  }
  const tabBtn = (key, label) => `<button type="button" data-tab="${key}" class="${tab === key ? 'is-active' : ''}">${label}</button>`;
  view.innerHTML = `
    <div class="detail-head">
      <a class="btn" href="#/users">← 一覧へ</a>
      <h1>${esc(u.name)} 様</h1>
      <button type="button" class="btn danger small" id="delUser">この利用者を削除</button>
    </div>
    <div class="tabs" role="tablist">
      ${tabBtn('basic', '① 基本情報・被保険者証')}
      ${tabBtn('rental', '② 貸与中の用具')}
      <button type="button" data-print>③ 貸与計画書を印刷</button>
    </div>
    <div id="tabBody"></div>`;

  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    location.hash = `#/users/${id}?tab=${b.dataset.tab}`;
  }));
  view.querySelector('[data-print]').addEventListener('click', () => { location.hash = `#/print/${id}`; });
  document.getElementById('delUser').addEventListener('click', () => {
    if (!confirm(`${u.name} 様と貸与の記録を削除します。よろしいですか？（デモデータです）`)) return;
    db.removeUser(id);
    toast('削除しました');
    location.hash = '#/users';
  });

  const body = document.getElementById('tabBody');
  if (tab === 'rental') renderRentalTab(body, u);
  else {
    body.innerHTML = userFormHtml(u);
    bindUserForm((saved) => {
      toast('保存しました');
      view.querySelector('.detail-head h1').textContent = `${saved.name} 様`;
      document.getElementById('formMsg').textContent = `保存しました（${saved.updatedAt}）`;
    }, u);
  }
}

const rentalState = { showEnded: false };

function renderRentalTab(body, u) {
  const today = todayYmd();
  const all = db.contractsOf(u.id).sort((a, b) => (a.start < b.start ? -1 : 1));
  const active = all.filter((c) => !c.end || c.end >= today);
  const list = rentalState.showEnded ? all : active;
  const monthTotal = active.filter((c) => c.start <= today).reduce((s, c) => s + Number(c.price || 0), 0);

  body.innerHTML = `
    <section class="card">
      <h2>貸与中の用具<small>${active.length} 点・月額合計 ${yen(monthTotal)} 円</small></h2>
      <label class="muted" style="display:inline-flex;gap:6px;align-items:center;margin-bottom:10px">
        <input type="checkbox" id="showEnded" ${rentalState.showEnded ? 'checked' : ''}> 終了した用具も表示（全 ${all.length} 件）
      </label>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>種目</th><th>商品名</th><th>型式</th><th class="num">月額(円)</th><th>開始日</th><th>終了日</th><th>状態</th><th></th></tr></thead>
        <tbody id="rentRows">
          ${list.length ? list.map((c) => {
            const p = db.product(c.productId) || {};
            const ended = c.end && c.end < today;
            const future = c.start > today;
            const st = ended ? `<span class="badge ended">${esc(c.endReason || '終了')}</span>`
              : future ? '<span class="badge half">開始前</span>'
              : c.end === today ? `<span class="badge hospital">本日で${esc(c.endReason || '終了')}</span>`
              : c.end ? `<span class="badge hospital">${esc(c.endReason || '終了')}予定</span>` : '<span class="badge active">貸与中</span>';
            return `<tr class="${ended ? 'is-ended' : ''}" data-id="${esc(c.id)}">
              <td class="nowrap">${esc(p.category)}</td><td>${esc(p.name)}</td><td class="nowrap">${esc(p.model)}</td>
              <td class="num">${yen(c.price)}</td><td class="nowrap">${esc(c.start)}</td><td class="nowrap">${esc(c.end)}</td><td>${st}</td>
              <td class="nowrap action-cell">${ended ? '' : `<button type="button" class="btn small" data-end="${esc(c.id)}">終了</button>`}
                <button type="button" class="btn small danger" data-del="${esc(c.id)}" aria-label="この行を削除">削除</button></td></tr>`;
          }).join('') : `<tr><td colspan="8" class="empty">貸与中の用具はありません。下のフォームから追加できます。</td></tr>`}
        </tbody>
      </table></div>

      <div class="subform" id="addForm">
        <h3>用具を追加</h3>
        <div class="search-row" style="margin-bottom:0">
          <input id="pq" class="input" type="search" placeholder="商品マスタから探す：商品名・型式・種目・製造元">
        </div>
        <div class="picker-results" id="pResults" hidden></div>
        <p class="picked muted" id="picked">商品を選ぶと、月額が入ります。</p>
        <div class="grid-3">
          <div class="field"><label for="a-start">開始日<span class="req">*</span></label><input id="a-start" type="date" class="input" value="${today}"></div>
          <div class="field"><label for="a-price">月額（円）</label><input id="a-price" type="number" min="0" step="10" class="input"></div>
          <div class="field"><label for="a-end">終了日（決まっていれば）</label><input id="a-end" type="date" class="input"></div>
          <div class="field span-all"><label for="a-reason">選定理由（計画書に載ります）</label><textarea id="a-reason" class="input"></textarea></div>
        </div>
        <div class="actions"><button type="button" class="btn primary" id="addBtn">追加</button><span class="muted" id="addMsg"></span></div>
      </div>
    </section>`;

  document.getElementById('showEnded').addEventListener('change', (e) => {
    rentalState.showEnded = e.target.checked;
    renderRentalTab(body, u);
  });

  // 終了・削除
  document.getElementById('rentRows').addEventListener('click', (e) => {
    const endId = e.target.dataset.end;
    const delId = e.target.dataset.del;
    if (endId) {
      const cell = e.target.closest('.action-cell');
      cell.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;min-width:150px">
          <input type="date" class="input" value="${today}" aria-label="終了日">
          <select class="input" aria-label="終了理由">${options(END_REASONS, '終了')}</select>
          <div style="display:flex;gap:6px"><button type="button" class="btn small primary" data-ok="${esc(endId)}">確定</button><button type="button" class="btn small" data-cancel>取消</button></div>
        </div>`;
      return;
    }
    if (e.target.dataset.ok) {
      const cell = e.target.closest('.action-cell');
      const date = cell.querySelector('input').value;
      const c = db.contracts.find((x) => x.id === e.target.dataset.ok);
      if (!date || date < c.start) { toast('終了日は開始日以降の日付にしてください'); return; }
      db.updateContract(c.id, { end: date, endReason: cell.querySelector('select').value });
      toast('貸与の終了を記録しました');
      renderRentalTab(body, u);
      return;
    }
    if (e.target.dataset.cancel !== undefined) { renderRentalTab(body, u); return; }
    if (delId) {
      if (!confirm('この貸与の行を削除します。よろしいですか？')) return;
      db.removeContract(delId);
      toast('削除しました');
      renderRentalTab(body, u);
    }
  });

  // 商品を探して追加
  let picked = null;
  const pq = document.getElementById('pq');
  const results = document.getElementById('pResults');
  pq.addEventListener('input', () => {
    const q = norm(pq.value);
    if (!q) { results.hidden = true; return; }
    const hits = db.products.filter((p) => norm(`${p.name}${p.model}${p.category}${p.maker}${p.code}`).includes(q)).slice(0, 12);
    results.hidden = false;
    results.innerHTML = hits.length ? hits.map((p) => `
      <button type="button" data-pid="${esc(p.id)}"><span>${esc(p.category)}｜${esc(p.name)}（${esc(p.model)}）</span><span>${yen(p.price)} 円</span></button>`).join('')
      : '<p class="empty" style="margin:0">見つかりません</p>';
  });
  results.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pid]');
    if (!b) return;
    picked = db.product(b.dataset.pid);
    document.getElementById('picked').innerHTML = `選択中：<strong>${esc(picked.name)}</strong>（${esc(picked.category)}・${esc(picked.model)}・${esc(picked.maker)}）`;
    document.getElementById('a-price').value = picked.price;
    results.hidden = true;
    pq.value = '';
  });
  document.getElementById('addBtn').addEventListener('click', () => {
    const start = document.getElementById('a-start').value;
    const end = document.getElementById('a-end').value;
    const msg = document.getElementById('addMsg');
    if (!picked) { msg.textContent = '商品を選んでください。'; return; }
    if (!start) { msg.textContent = '開始日を入力してください。'; return; }
    if (end && end < start) { msg.textContent = '終了日が開始日より前になっています。'; return; }
    db.addContract({
      id: uid('c'), userId: u.id, productId: picked.id,
      price: Number(document.getElementById('a-price').value || picked.price),
      start, end, endReason: end ? '終了' : '',
      reason: document.getElementById('a-reason').value.trim(),
    });
    toast(`${picked.name} を追加しました`);
    renderRentalTab(body, u);
  });
}

// ------------------------------------------------------------ 商品マスタ
const productState = { q: '', cat: '' };

function renderProducts() {
  view.innerHTML = `
    ${title('Products', '商品マスタ')}
    <section class="card">
      <div class="search-row">
        <label for="pq2">検索</label>
        <input id="pq2" class="input" type="search" placeholder="商品名・型式・コード・製造元" value="${esc(productState.q)}">
        <select id="pCat" class="input" aria-label="種目で絞り込み">${options(CATEGORIES, productState.cat, { blank: '種目：すべて' })}</select>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>商品コード</th><th>種目</th><th>商品名</th><th>型式</th><th>製造元</th><th class="num">月額(円)</th><th class="num">貸与中</th></tr></thead>
        <tbody id="pRows"></tbody>
      </table></div>
      <p class="muted" id="pCount"></p>

      <details class="subform">
        <summary style="cursor:pointer;color:var(--gold-deep)">商品を追加する</summary>
        <div class="grid-3" style="margin-top:12px">
          <div class="field"><label for="n-cat">種目<span class="req">*</span></label><select id="n-cat" class="input">${options(CATEGORIES, '')}</select></div>
          <div class="field span-2"><label for="n-name">商品名<span class="req">*</span></label><input id="n-name" class="input"></div>
          <div class="field"><label for="n-model">型式</label><input id="n-model" class="input"></div>
          <div class="field"><label for="n-maker">製造元</label><input id="n-maker" class="input"></div>
          <div class="field"><label for="n-price">月額（円）<span class="req">*</span></label><input id="n-price" type="number" min="0" step="10" class="input"></div>
        </div>
        <div class="actions"><button type="button" class="btn primary" id="nAdd">登録</button><span class="muted" id="nMsg"></span></div>
      </details>
    </section>`;

  const today = todayYmd();
  const draw = () => {
    const q = norm(productState.q);
    const rows = db.products
      .filter((p) => !q || norm(`${p.name}${p.model}${p.code}${p.maker}`).includes(q))
      .filter((p) => !productState.cat || p.category === productState.cat);
    document.getElementById('pRows').innerHTML = rows.length ? rows.map((p) => {
      const n = db.contracts.filter((c) => c.productId === p.id && isActive(c, today)).length;
      return `<tr><td class="nowrap">${esc(p.code)}</td><td class="nowrap">${esc(p.category)}</td><td>${esc(p.name)}</td>
        <td class="nowrap">${esc(p.model)}</td><td class="nowrap">${esc(p.maker)}</td><td class="num">${yen(p.price)}</td><td class="num">${n}</td></tr>`;
    }).join('') : `<tr><td colspan="7" class="empty">該当する商品がありません</td></tr>`;
    document.getElementById('pCount').textContent = `${rows.length} 件を表示（全 ${db.products.length} 件）`;
  };
  draw();
  document.getElementById('pq2').addEventListener('input', (e) => { productState.q = e.target.value; draw(); });
  document.getElementById('pCat').addEventListener('change', (e) => { productState.cat = e.target.value; draw(); });
  document.getElementById('nAdd').addEventListener('click', () => {
    const name = document.getElementById('n-name').value.trim();
    const price = document.getElementById('n-price').value;
    if (!name || price === '') { document.getElementById('nMsg').textContent = '商品名と月額を入力してください。'; return; }
    const max = db.products.reduce((m, p) => Math.max(m, Number(p.code.replace(/\D/g, '')) || 0), 1000);
    db.upsertProduct({
      id: uid('p'), code: `DM-${max + 7}`, category: document.getElementById('n-cat').value, name,
      model: document.getElementById('n-model').value.trim(), maker: document.getElementById('n-maker').value.trim(),
      price: Number(price),
    });
    toast(`${name} を登録しました`);
    renderProducts();
  });
}

// ------------------------------------------------------------ 月次実績
const monthlyState = { cm: '' };

function renderMonthly(m) {
  const now = new Date();
  const ym = /^\d{4}-\d{2}$/.test(m || '') ? m : `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const [y, mo] = ym.split('-').map(Number);

  const userOk = (u) => u && (!monthlyState.cm || u.cmOffice === monthlyState.cm);
  const rows = monthlyRows(db.contracts, y, mo)
    .map((r) => ({ ...r, user: db.user(r.contract.userId), product: db.product(r.contract.productId) || {} }))
    .filter((r) => userOk(r.user))
    .sort((a, b) => a.user.kana.localeCompare(b.user.kana, 'ja') || a.from.localeCompare(b.from));

  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user.id)) byUser.set(r.user.id, []);
    byUser.get(r.user.id).push(r);
  }
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const halfCount = rows.filter((r) => !r.full).length;

  let body = '';
  for (const [, list] of byUser) {
    const u = list[0].user;
    const sub = list.reduce((s, r) => s + r.amount, 0);
    list.forEach((r, i) => {
      body += `<tr class="${r.full ? '' : 'is-warn'}">
        ${i === 0 ? `<td rowspan="${list.length + 1}" class="nowrap"><a href="#/users/${esc(u.id)}?tab=rental">${esc(u.name)}</a><br><span class="muted">${esc(u.careLevel)}</span></td>` : ''}
        <td class="nowrap">${esc(r.product.category)}</td><td>${esc(r.product.name)}</td>
        <td class="num">${yen(r.contract.price)}</td>
        <td class="nowrap">${r.from.slice(5).replace('-', '/')}〜${r.to.slice(5).replace('-', '/')}</td>
        <td class="num">${r.days}/${r.dim}</td>
        <td>${r.full ? '<span class="badge active">全額</span>' : '<span class="badge half">半額</span>'}</td>
        <td class="num">${yen(r.amount)}</td></tr>`;
    });
    body += `<tr><td colspan="6" class="num muted">小計（${esc(db.careOffice(u.cmOffice)?.name || '')}）</td><td class="num"><strong>${yen(sub)}</strong></td></tr>`;
  }

  view.innerHTML = `
    ${title('Monthly', '月次実績')}
    <section class="card">
      <div class="search-row">
        <label for="ym">対象月</label>
        <input id="ym" type="month" class="input" value="${ym}" style="flex:0 0 auto;width:auto">
        <button type="button" class="btn small" id="prevM">← 前月</button>
        <button type="button" class="btn small" id="nextM">翌月 →</button>
        <select id="mCm" class="input" aria-label="ケアマネ事業所で絞り込み">${options(db.careOffices.map((c) => [c.id, c.name]), monthlyState.cm, { blank: 'ケアマネ事業所：すべて' })}</select>
      </div>
      <div class="tiles">
        <div class="tile"><div class="k">対象の利用者</div><div class="v">${byUser.size}<small>名</small></div></div>
        <div class="tile"><div class="k">明細</div><div class="v">${rows.length}<small>件</small></div></div>
        <div class="tile"><div class="k">半額の明細</div><div class="v">${halfCount}<small>件</small></div></div>
        <div class="tile"><div class="k">請求合計</div><div class="v">${yen(total)}<small>円</small></div></div>
      </div>
      <p class="muted">黄色の行は、その月の貸与日数が月の半分に満たないため半額にしている明細です。
        （デモ版の簡易計算：貸与日数が月の半分以上なら月額、未満なら月額の半分）</p>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>利用者</th><th>種目</th><th>商品名</th><th class="num">月額</th><th>当月の貸与期間</th><th class="num">日数</th><th>区分</th><th class="num">請求額(円)</th></tr></thead>
        <tbody>${body || '<tr><td colspan="8" class="empty">この月の貸与はありません</td></tr>'}</tbody>
        ${rows.length ? `<tfoot><tr><td colspan="7" class="num">合計</td><td class="num">${yen(total)}</td></tr></tfoot>` : ''}
      </table></div>
    </section>`;

  const go = (val) => { location.hash = `#/monthly?m=${val}`; };
  document.getElementById('ym').addEventListener('change', (e) => e.target.value && go(e.target.value));
  const shift = (n) => { const d = new Date(y, mo - 1 + n, 1); go(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`); };
  document.getElementById('prevM').addEventListener('click', () => shift(-1));
  document.getElementById('nextM').addEventListener('click', () => shift(1));
  document.getElementById('mCm').addEventListener('change', (e) => { monthlyState.cm = e.target.value; renderMonthly(ym); });
}

// ------------------------------------------------------------ 貸与計画書（印刷プレビュー）
function renderPrint(id) {
  const u = db.user(id);
  if (!u) { location.hash = '#/users'; return; }
  const today = todayYmd();
  const items = db.contractsOf(u.id).filter((c) => !c.end || c.end >= today)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const cmo = db.careOffice(u.cmOffice);

  view.innerHTML = `
    ${title('Plan', '貸与計画書')}
    <div class="print-toolbar">
      <a class="btn" href="#/users/${esc(u.id)}?tab=rental">← ${esc(u.name)} 様へ</a>
      <label class="muted" for="madeOn">作成日</label>
      <input id="madeOn" type="date" class="input" value="${today}" style="width:auto">
      <button type="button" class="btn primary" id="doPrint">印刷する</button>
      <span class="muted">A4 縦 1 枚。印刷画面で「PDFに保存」を選ぶと PDF になります。</span>
    </div>
    <div class="sheet-scroller"><article class="sheet" id="sheet"></article></div>`;

  const draw = () => {
    const made = document.getElementById('madeOn').value;
    document.getElementById('sheet').innerHTML = `
      <h1>福祉用具貸与計画書</h1>
      <div class="sheet-meta"><span>作成日：${esc(jpDate(made))}</span><span>${esc(OFFICE.name)}　担当：${esc(u.staff || '')}</span></div>
      <table>
        <tr><th>フリガナ</th><td>${esc(u.kana)}</td><th>性別</th><td>${esc(u.gender)}</td></tr>
        <tr><th>利用者氏名</th><td style="font-size:12pt">${esc(u.name)} 様</td><th>生年月日</th><td>${esc(jpDate(u.birth))}${u.birth ? `（${age(u.birth)}歳）` : ''}</td></tr>
        <tr><th>住所</th><td colspan="3">〒${esc(u.zip)}　${esc(u.address)}</td></tr>
        <tr><th>電話</th><td>${esc(u.phone)}</td><th>介護度</th><td>${esc(u.careLevel)}</td></tr>
        <tr><th>認定期間</th><td colspan="3">${esc(jpDate(u.certStart))} 〜 ${esc(jpDate(u.certEnd))}</td></tr>
        <tr><th>居宅介護支援事業所</th><td>${esc(cmo?.name || '')}</td><th>担当ケアマネ</th><td>${esc(u.cmName || '')}</td></tr>
      </table>
      <div class="sec">利用目標</div>
      <div class="box">${esc(u.goal || '')}</div>
      <div class="sec">貸与する福祉用具と選定理由</div>
      <table>
        <thead><tr><th>No</th><th>種目</th><th>商品名（型式）</th><th>月額(円)</th><th>開始日</th><th style="width:auto">選定理由</th></tr></thead>
        <tbody>${items.length ? items.map((c, i) => {
          const p = db.product(c.productId) || {};
          return `<tr><td class="num">${i + 1}</td><td>${esc(p.category)}</td><td>${esc(p.name)}<br><small>${esc(p.model)}／${esc(p.maker)}</small></td>
            <td class="num">${yen(c.price)}</td><td style="white-space:nowrap">${esc(c.start)}</td><td>${esc(c.reason)}</td></tr>`;
        }).join('') : '<tr><td colspan="6" style="text-align:center">貸与中の用具はありません</td></tr>'}</tbody>
      </table>
      <div class="sec">留意事項</div>
      <div class="box">・使い方で分からないことや、体に合わないと感じたときは、すぐにご連絡ください。
・定期的にお伺いし、用具の状態と使い心地を確認します。
・身体の状態が変わったときは、ケアマネジャーと相談して用具を見直します。</div>
      <p style="font-size:9.5pt;margin:0">上記の計画について説明を受け、同意しました。</p>
      <div class="sign">
        <div>説明日：　　　　年　　月　　日</div>
        <div>利用者（代理人）署名：</div>
      </div>
      <p style="font-size:8.5pt;color:#666;margin-top:8mm">${esc(OFFICE.name)}　${esc(OFFICE.address)}　TEL ${esc(OFFICE.phone)}　／　この書類はデモ版の架空データです。</p>`;
    fitA4(document.getElementById('sheet'));
  };
  draw();
  document.getElementById('madeOn').addEventListener('change', draw);
  document.getElementById('doPrint').addEventListener('click', () => window.print());
}

// 用具が多くて A4 1枚からはみ出すときは、文字を少しずつ小さくして収める
function fitA4(sheet) {
  const limit = Math.round((297 * 96) / 25.4) + 1;
  let pt = 9.5;
  sheet.style.fontSize = '';
  while (sheet.offsetHeight > limit && pt > 7) {
    pt -= 0.25;
    sheet.style.fontSize = pt + 'pt';
  }
}

// ------------------------------------------------------------ 起動
document.getElementById('officeName').textContent = OFFICE.name;
document.getElementById('resetDemo').addEventListener('click', () => {
  if (!confirm('デモデータを初期状態に戻します。追加・変更した内容は消えます。よろしいですか？')) return;
  reset();
  toast('初期状態に戻しました');
  route();
});
document.getElementById('menuToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
document.addEventListener('click', (e) => {
  if (document.body.classList.contains('nav-open') && !e.target.closest('#sidenav, #menuToggle')) {
    document.body.classList.remove('nav-open');
  }
});
window.addEventListener('hashchange', route);
route();
