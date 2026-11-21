import { load, save, reset, db, todayIso, addDays, daysBetween, pad } from './data.js';

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = ['日', '月', '火', '水', '木', '金', '土'];
function dateObj(isoStr) { const [y, m, d] = isoStr.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(isoStr, withWd = true) {
  const d = dateObj(isoStr);
  return `${d.getMonth() + 1}/${d.getDate()}${withWd ? `（${WD[d.getDay()]}）` : ''}`;
}
function fmtFull(isoStr) { const d = dateObj(isoStr); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`; }
function age(birth) {
  const t = dateObj(todayIso()); const b = dateObj(birth);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
function nowHm() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const client = (id) => db().clients.find((c) => c.id === id);
const staff = (id) => db().staff.find((s) => s.id === id);
const insBadge = (ins) => ins === 'med' ? '<span class="badge b-med">医療保険</span>' : '<span class="badge b-ltc">介護保険</span>';
const STATUS = {
  planned: ['未記録', 'b-gray'],
  draft: ['下書き', 'b-amber'],
  done: ['確定済み', 'b-green'],
};
const statusBadge = (v) => {
  if (v.status === 'planned' && (v.date < todayIso() || (v.date === todayIso() && v.end < nowHm()))) return '<span class="badge b-red-soft">記録待ち</span>';
  if (v.status === 'planned' && v.date > todayIso()) return '<span class="badge b-blue">予定</span>';
  const [t, c] = STATUS[v.status]; return `<span class="badge ${c}">${t}</span>`;
};

// 指示書の期限: 今日との日数差だけで判定（14日以内を「間近」とするデモ用の単純な目安）
function orderState(o) {
  const left = daysBetween(todayIso(), o.end);
  if (left < 0) return { key: 'expired', left, badge: `<span class="badge b-red">期限切れ ${-left}日</span>`, row: 'row-alert' };
  if (left <= 14) return { key: 'soon', left, badge: `<span class="badge b-amber">残り${left}日</span>`, row: 'row-warn' };
  return { key: 'ok', left, badge: `<span class="badge b-gray">残り${left}日</span>`, row: '' };
}
function latestOrder(clientId) {
  return db().orders.filter((o) => o.clientId === clientId).sort((a, b) => (a.end < b.end ? 1 : -1))[0];
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => { t.hidden = true; }, 2200);
}
function openModal(html, onMount) {
  const m = $('#modal'); m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false;
  m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); };
  onMount?.(m);
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
const go = (h) => { location.hash = h; };

/* ---------- icons (simple strokes) ---------- */
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  home: I('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  today: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="2"/>'),
  people: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>'),
  week: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17.5h2"/>'),
  doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h4"/>'),
};

/* ---------- layout ---------- */
function renderNav(active) {
  const s = db();
  const alertOrders = s.clients.filter((c) => { const o = latestOrder(c.id); return o && orderState(o).key !== 'ok'; }).length;
  const waiting = s.visits.filter((v) => v.date === todayIso() && v.status !== 'done').length;
  const items = [
    ['', 'ダッシュボード', ICON.home, 0, '日常業務'],
    ['today', '今日の訪問', ICON.today, waiting],
    ['schedule', '訪問予定表', ICON.week, 0],
    ['clients', '利用者', ICON.people, 0, '利用者・書類'],
    ['orders', '指示書の期限', ICON.doc, alertOrders],
  ];
  $('#nav').innerHTML = items.map(([k, label, icon, cnt, group]) => `
    ${group ? `<div class="nav-group">${group}</div>` : ''}
    <a class="nav-link ${active === k ? 'active' : ''}" href="#/${k}">${icon}<span>${label}</span>${cnt ? `<span class="nav-count">${cnt}</span>` : ''}</a>`).join('');
}
function setTitle(t) { $('#pageTitle').textContent = t; document.title = `${t}｜訪問看護記録アプリ（デモ版）`; }

/* ---------- dashboard ---------- */
function notices() {
  const s = db(); const today = todayIso(); const list = [];
  for (const c of s.clients) {
    const o = latestOrder(c.id); if (!o) continue;
    const st = orderState(o);
    if (st.key === 'expired') list.push({ id: `exp-${o.id}`, tone: 'red', title: `指示書の期限が切れています：${c.name} さん`, body: `${fmtFull(o.end)} で期限切れ。主治医（${s.doctors[o.doc].clinic}）へ再発行を依頼してください。`, href: `#/clients/${c.id}` });
    else if (st.key === 'soon') list.push({ id: `soon-${o.id}`, tone: 'amber', title: `指示書の期限が近づいています：${c.name} さん`, body: `${fmtFull(o.end)} まで（残り${st.left}日）。`, href: `#/clients/${c.id}` });
  }
  const drafts = s.visits.filter((v) => v.status === 'draft' && v.date < today);
  for (const v of drafts) list.push({ id: `draft-${v.id}`, tone: 'amber', title: `下書きのままの記録：${client(v.clientId).name} さん`, body: `${fmtDate(v.date)} ${v.start} の訪問（${staff(v.staffId).name}）。内容を見直して確定してください。`, href: `#/visit/${v.id}` });
  const late = s.visits.filter((v) => v.status === 'planned' && v.date === today && v.end < nowHm());
  for (const v of late) list.push({ id: `late-${v.id}-${today}`, tone: 'blue', title: `記録が未入力です：${client(v.clientId).name} さん`, body: `今日 ${v.start}〜${v.end} の訪問（${staff(v.staffId).name}）。`, href: `#/visit/${v.id}` });
  const rank = { red: 0, amber: 1, blue: 2 };
  return list.filter((n) => !s.dismissed.includes(n.id)).sort((a, b) => rank[a.tone] - rank[b.tone]);
}

function viewDashboard() {
  setTitle('ダッシュボード');
  const s = db(); const today = todayIso();
  const todays = s.visits.filter((v) => v.date === today);
  const doneToday = todays.filter((v) => v.status === 'done').length;
  const weekStart = addDays(today, -6);
  const unconfirmed = s.visits.filter((v) => v.date <= today && v.date >= weekStart && v.status !== 'done').length;
  const orderAlerts = s.clients.map((c) => latestOrder(c.id)).filter((o) => o && orderState(o).key !== 'ok');
  const med = s.clients.filter((c) => c.ins === 'med').length;
  const ns = notices();
  const recent = s.visits.filter((v) => v.date <= today && v.status !== 'planned').sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1)).slice(0, 6);

  return `
  <div class="stats">
    <a class="stat green" href="#/today"><div class="label">今日の訪問</div><div class="num">${todays.length}<small>件</small></div><div class="sub">うち記録確定 ${doneToday} 件</div></a>
    <a class="stat blue" href="#/clients"><div class="label">利用者</div><div class="num">${s.clients.length}<small>名</small></div><div class="sub">医療保険 ${med} 名・介護保険 ${s.clients.length - med} 名</div></a>
    <a class="stat amber" href="#/today"><div class="label">未確定の記録（7日間）</div><div class="num">${unconfirmed}<small>件</small></div><div class="sub">下書き・未入力を含む</div></a>
    <a class="stat red" href="#/orders"><div class="label">指示書の期限 要対応</div><div class="num">${orderAlerts.length}<small>件</small></div><div class="sub">期限切れ・14日以内</div></a>
  </div>
  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h2>要対応のお知らせ</h2><span class="badge ${ns.length ? 'b-red' : 'b-gray'}">${ns.length}</span></div>
      ${ns.length ? ns.map((n) => `
        <div class="notice ${n.tone}">
          <div class="n-body"><div class="n-title">${esc(n.title)}</div><div class="small">${esc(n.body)}</div></div>
          <div class="btn-row"><a class="btn sm" href="${n.href}">開く</a><button class="btn sm ghost" data-dismiss="${esc(n.id)}">確認した</button></div>
        </div>`).join('') : '<div class="empty">対応が必要なお知らせはありません</div>'}
    </section>
    <section class="card">
      <div class="card-head"><h2>今日の訪問予定</h2><span class="spacer"></span><a href="#/today" class="small">すべて見る</a></div>
      ${todays.length ? `<div class="table-wrap"><table><tbody>${todays.sort((a, b) => (a.start < b.start ? -1 : 1)).map((v) => `
        <tr class="click" data-href="#/visit/${v.id}"><td class="nowrap"><b>${v.start}</b></td><td>${esc(client(v.clientId).name)}<div class="sub-line">${esc(staff(v.staffId).name)}・${v.kind}</div></td><td class="nowrap" style="text-align:right">${statusBadge(v)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">今日の予定はありません</div>'}
    </section>
  </div>
  <section class="card" style="margin-top:18px">
    <div class="card-head"><h2>最近の訪問記録</h2></div>
    <p class="card-note">「下書き」の記録は開いて内容を確認し、「確定する」を押すと正式な記録になります。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>訪問日</th><th>利用者</th><th class="hide-sm">種別</th><th class="hide-sm">担当</th><th>状態</th><th></th></tr></thead>
      <tbody>${recent.map((v) => `<tr>
        <td class="nowrap">${fmtDate(v.date)}</td><td><a href="#/clients/${v.clientId}">${esc(client(v.clientId).name)}</a></td>
        <td class="hide-sm"><span class="badge">${v.kind}</span></td><td class="hide-sm">${esc(staff(v.staffId).name)}</td>
        <td>${statusBadge(v)}</td><td style="text-align:right"><a class="btn sm" href="#/visit/${v.id}">${v.status === 'done' ? '詳細' : '編集・確定'}</a></td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

/* ---------- today ---------- */
function viewToday(q) {
  setTitle('今日の訪問');
  const s = db();
  const date = q.get('date') || todayIso();
  const who = q.get('staff') || 'all';
  const list = s.visits.filter((v) => v.date === date && (who === 'all' || v.staffId === who));
  const total = list.length; const done = list.filter((v) => v.status === 'done').length;
  const groups = s.staff.map((st) => ({ st, vs: list.filter((v) => v.staffId === st.id).sort((a, b) => (a.start < b.start ? -1 : 1)) })).filter((g) => g.vs.length);

  return `
  <section class="card">
    <div class="filters">
      <label class="field"><span>対象日</span><input type="date" id="tDate" value="${date}"></label>
      <label class="field"><span>担当者</span><select id="tStaff"><option value="all">全員</option>${s.staff.map((st) => `<option value="${st.id}" ${who === st.id ? 'selected' : ''}>${esc(st.name)}（${st.role}）</option>`).join('')}</select></label>
      <div class="btn-row"><button class="btn" id="tPrev">前日</button><button class="btn" id="tToday">今日</button><button class="btn" id="tNext">翌日</button></div>
    </div>
  </section>
  <section class="card">
    <div class="card-head"><h2>${fmtFull(date)}（${WD[dateObj(date).getDay()]}）の訪問予定</h2><span class="muted small">${total} 件・記録確定 ${done} 件</span>
      <span class="spacer"></span><button class="btn primary sm" id="tAdd">＋ 予定外の訪問を追加</button></div>
    ${groups.length ? groups.map(({ st, vs }) => `
      <div class="staff-block">
        <div class="staff-name">${esc(st.name)} <span class="badge">${st.role}</span><span class="muted small">${vs.length} 件</span></div>
        ${vs.map((v) => { const c = client(v.clientId); return `
          <div class="visit-row">
            <div class="time">${v.start}〜${v.end}</div>
            <div class="who"><b>${esc(c.name)}</b> <span class="muted small">${v.kind}</span><div class="sub-line">${esc(c.addr)}</div></div>
            ${insBadge(c.ins)} ${statusBadge(v)}
            <a class="btn sm ${v.status === 'done' ? '' : 'primary'}" href="#/visit/${v.id}">${v.status === 'planned' ? '記録する' : v.status === 'draft' ? '記録を修正' : '記録を見る'}</a>
          </div>`; }).join('')}
      </div>`).join('') : '<div class="empty">この日の訪問予定はありません</div>'}
  </section>`;
}
function bindToday(q) {
  const date = q.get('date') || todayIso();
  const nav = (d, st) => go(`#/today?date=${d}&staff=${st ?? ($('#tStaff').value)}`);
  $('#tDate').onchange = (e) => e.target.value && nav(e.target.value);
  $('#tStaff').onchange = (e) => nav(date, e.target.value);
  $('#tPrev').onclick = () => nav(addDays(date, -1));
  $('#tNext').onclick = () => nav(addDays(date, 1));
  $('#tToday').onclick = () => nav(todayIso());
  $('#tAdd').onclick = () => visitModal({ date, staffId: q.get('staff') && q.get('staff') !== 'all' ? q.get('staff') : db().me, start: nowHm() }, true);
}

/* ---------- visit add modal ---------- */
function visitModal(pre, openAfter = false) {
  const s = db();
  openModal(`
    <div class="modal-h">訪問予定を追加</div>
    <div class="modal-b">
      <label class="field"><span class="req">利用者</span><select id="mClient"><option value="">選択してください</option>${s.clients.map((c) => `<option value="${c.id}" ${pre.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="form-grid two">
        <label class="field"><span class="req">訪問日</span><input type="date" id="mDate" value="${pre.date}"></label>
        <label class="field"><span class="req">担当者</span><select id="mStaff">${s.staff.map((st) => `<option value="${st.id}" ${pre.staffId === st.id ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}</select></label>
        <label class="field"><span class="req">開始</span><input type="time" id="mStart" value="${pre.start || '10:00'}"></label>
        <label class="field"><span class="req">終了</span><input type="time" id="mEnd" value=""></label>
      </div>
      <div class="hint" id="mErr"></div>
    </div>
    <div class="modal-f"><button class="btn" data-close>キャンセル</button><button class="btn primary" id="mSave">${openAfter ? '追加して記録へ' : '追加する'}</button></div>`, (m) => {
    const endFrom = () => {
      const st = staff($('#mStaff', m).value); const [h, mi] = ($('#mStart', m).value || '10:00').split(':').map(Number);
      const t = h * 60 + mi + (st.role === '看護師' ? 60 : 40); $('#mEnd', m).value = `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
    };
    endFrom(); $('#mStart', m).onchange = endFrom; $('#mStaff', m).onchange = endFrom;
    $('#mSave', m).onclick = () => {
      const cid = $('#mClient', m).value; const date = $('#mDate', m).value; const start = $('#mStart', m).value; const end = $('#mEnd', m).value;
      if (!cid || !date || !start || !end) { $('#mErr', m).textContent = '必須項目を入力してください'; $('#mErr', m).className = 'hint warn'; return; }
      if (end <= start) { $('#mErr', m).textContent = '終了は開始より後の時刻にしてください'; $('#mErr', m).className = 'hint warn'; return; }
      const st = staff($('#mStaff', m).value);
      const v = { id: `v${Date.now()}`, clientId: cid, staffId: st.id, date, start, end, kind: st.role === '看護師' ? '看護' : st.role === '理学療法士' ? 'リハ(PT)' : 'リハ(OT)', status: 'planned', record: null, updatedAt: null };
      db().visits.push(v); save(); closeModal(); toast('訪問予定を追加しました');
      if (openAfter) go(`#/visit/${v.id}`); else render();
    };
  });
}

/* ---------- clients ---------- */
function viewClients(q) {
  setTitle('利用者');
  const s = db(); const kw = (q.get('q') || '').trim(); const ins = q.get('ins') || 'all';
  const list = s.clients.filter((c) => (ins === 'all' || c.ins === ins) && (!kw || (c.name + c.kana + c.dx + c.addr).replace(/\s/g, '').includes(kw.replace(/\s/g, ''))));
  return `
  <section class="card">
    <div class="filters">
      <label class="field" style="flex:1;min-width:220px"><span>検索</span><input type="search" id="cQ" placeholder="氏名・カナ・病名・住所" value="${esc(kw)}"></label>
      <div class="seg" id="cIns">${[['all', 'すべて'], ['med', '医療保険'], ['ltc', '介護保険']].map(([k, l]) => `<button data-ins="${k}" class="${ins === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
  </section>
  <section class="card">
    <div class="card-head"><h2>利用者一覧</h2><span class="muted small">${list.length} / ${s.clients.length} 名</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>氏名</th><th>保険</th><th class="hide-sm">要介護度・負担</th><th class="hide-sm">主病名</th><th class="hide-sm">主治医</th><th class="hide-sm">担当</th><th>指示書の期限</th></tr></thead>
      <tbody>${list.map((c) => { const o = latestOrder(c.id); const st = o ? orderState(o) : null; return `
        <tr class="click" data-href="#/clients/${c.id}">
          <td><a href="#/clients/${c.id}"><b>${esc(c.name)}</b></a><div class="sub-line">${esc(c.kana)}・${age(c.birth)}歳</div></td>
          <td>${insBadge(c.ins)}</td>
          <td class="hide-sm">${c.ins === 'ltc' ? esc(c.level) : `負担${esc(c.burden)}`}</td>
          <td class="hide-sm">${esc(c.dx)}</td>
          <td class="hide-sm">${esc(s.doctors[c.doc].name)}<div class="sub-line">${esc(s.doctors[c.doc].clinic)}</div></td>
          <td class="hide-sm nowrap">${esc(staff(c.main).name)}</td>
          <td class="nowrap">${o ? `${fmtFull(o.end)}<br>${st.badge}` : '-'}</td>
        </tr>`; }).join('') || '<tr><td colspan="7" class="empty">該当する利用者がいません</td></tr>'}</tbody>
    </table></div>
  </section>`;
}
function bindClients(q) {
  const upd = (k, v) => { const p = new URLSearchParams(q); if (v && v !== 'all') p.set(k, v); else p.delete(k); go(`#/clients${p.toString() ? `?${p}` : ''}`); };
  let tm; $('#cQ').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { upd('q', e.target.value); }, 350); };
  $('#cIns').onclick = (e) => { const b = e.target.closest('[data-ins]'); if (b) upd('ins', b.dataset.ins); };
  if (q.get('q')) { const el = $('#cQ'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

function viewClient(id) {
  const s = db(); const c = client(id);
  if (!c) return '<div class="card empty">利用者が見つかりません</div>';
  setTitle(c.name);
  const doc = s.doctors[c.doc];
  const orders = s.orders.filter((o) => o.clientId === id).sort((a, b) => (a.end < b.end ? 1 : -1));
  const visits = s.visits.filter((v) => v.clientId === id).sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1));
  const today = todayIso();
  const upcoming = visits.filter((v) => v.date >= today).reverse().slice(0, 5);
  const past = visits.filter((v) => v.date < today || (v.date === today && v.status !== 'planned')).slice(0, 8);
  return `
  <a class="back" href="#/clients">← 利用者一覧へ</a>
  <div class="detail-head">
    <div>
      <div class="muted small">${esc(c.kana)}</div>
      <h2>${esc(c.name)} <span class="muted" style="font-size:14px;font-weight:400">さん</span></h2>
      <div class="status-line" style="margin-top:6px">${insBadge(c.ins)}<span class="badge b-green">${esc(c.status)}</span><span class="muted small">担当：${esc(staff(c.main).name)}</span></div>
    </div>
    <span class="spacer"></span>
    <div class="btn-row"><button class="btn primary" id="dNew">訪問記録を作成</button><button class="btn" id="dPlan">予定を追加</button></div>
  </div>
  <div class="grid-2">
    <div>
      <section class="card">
        <div class="card-head"><h2>基本情報</h2></div>
        <div class="kv">
          <div><div class="k">生年月日</div><div class="v">${fmtFull(c.birth)}（${age(c.birth)}歳）</div></div>
          <div><div class="k">性別</div><div class="v">${esc(c.sex)}</div></div>
          <div><div class="k">電話番号</div><div class="v">${esc(c.phone)}</div></div>
          <div style="grid-column:1/-1"><div class="k">住所</div><div class="v">${esc(c.addr)}</div></div>
          <div style="grid-column:1/-1"><div class="k">主病名</div><div class="v">${esc(c.dx)}</div></div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>保険情報</h2>${insBadge(c.ins)}</div>
        <div class="kv">
          ${c.ins === 'ltc' ? `
            <div><div class="k">保険の種類</div><div class="v">介護保険</div></div>
            <div><div class="k">要介護度</div><div class="v">${esc(c.level)}</div></div>
            <div><div class="k">被保険者番号</div><div class="v">0000000${c.id.slice(1)}（架空）</div></div>` : `
            <div><div class="k">保険の種類</div><div class="v">医療保険</div></div>
            <div><div class="k">負担割合</div><div class="v">${esc(c.burden)}</div></div>
            <div><div class="k">記号・番号</div><div class="v">00-${c.id.slice(1)}（架空）</div></div>`}
          <div><div class="k">利用開始日</div><div class="v">${fmtFull(c.since)}</div></div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>主治医・指示書</h2><span class="spacer"></span><button class="btn sm" id="dRenew">指示書を更新登録</button></div>
        <div class="kv" style="margin-bottom:12px">
          <div><div class="k">主治医</div><div class="v">${esc(doc.name)}</div></div>
          <div style="grid-column:span 2"><div class="k">医療機関</div><div class="v">${esc(doc.clinic)}</div></div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>種類</th><th>有効期間</th><th>期限</th></tr></thead>
          <tbody>${orders.map((o, i) => { const st = orderState(o); return `<tr class="${i === 0 ? st.row : ''}"><td>${esc(o.kind)}${o.note ? `<div class="sub-line">${esc(o.note)}</div>` : ''}</td><td class="nowrap">${fmtFull(o.start)}〜<br>${fmtFull(o.end)}</td><td>${i === 0 ? st.badge : '<span class="badge b-gray">更新済み</span>'}</td></tr>`; }).join('')}</tbody>
        </table></div>
      </section>
    </div>
    <div>
      <section class="card">
        <div class="card-head"><h2>これからの予定</h2></div>
        ${upcoming.length ? `<table><tbody>${upcoming.map((v) => `<tr class="click" data-href="#/visit/${v.id}"><td class="nowrap">${fmtDate(v.date)}</td><td class="nowrap">${v.start}〜${v.end}</td><td>${esc(staff(v.staffId).name)}<div class="sub-line">${v.kind}</div></td><td style="text-align:right">${statusBadge(v)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">予定はありません</div>'}
      </section>
      <section class="card">
        <div class="card-head"><h2>最近の訪問記録</h2></div>
        ${past.length ? past.map((v) => `
          <a class="notice" href="#/visit/${v.id}" style="color:inherit;text-decoration:none">
            <div class="n-body"><div class="n-title">${fmtDate(v.date)} ${v.start}　${esc(staff(v.staffId).name)}　<span class="muted small">${v.kind}</span></div>
            <div class="small muted">${v.record ? esc(`体温 ${v.record.vitals.temp || '-'}℃ / 血圧 ${v.record.vitals.sys || '-'}/${v.record.vitals.dia || '-'} / SpO2 ${v.record.vitals.spo2 || '-'}%`) : '記録なし'}</div>
            ${v.record?.a ? `<div class="small">A：${esc(v.record.a)}</div>` : ''}</div>${statusBadge(v)}</a>`).join('') : '<div class="empty">記録はまだありません</div>'}
      </section>
    </div>
  </div>`;
}
function bindClient(id) {
  if (!client(id)) return;
  const c = client(id);
  $('#dNew').onclick = () => {
    const today = todayIso();
    const open = db().visits.find((v) => v.clientId === id && v.date === today && v.status !== 'done');
    if (open) { go(`#/visit/${open.id}`); return; }
    visitModal({ clientId: id, date: today, staffId: c.main, start: nowHm() }, true);
  };
  $('#dPlan').onclick = () => visitModal({ clientId: id, date: addDays(todayIso(), 1), staffId: c.main, start: '10:00' });
  $('#dRenew').onclick = () => renewModal(id);
}

/* ---------- orders ---------- */
function renewModal(clientId) {
  const s = db(); const c = client(clientId); const prev = latestOrder(clientId);
  const today = todayIso();
  const start = prev && prev.end >= today ? addDays(prev.end, 1) : today;
  const months = c.ins === 'med' ? 1 : 6;
  const d = dateObj(start); const e = new Date(d.getFullYear(), d.getMonth() + months, d.getDate() - 1);
  const end = `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}`;
  openModal(`
    <div class="modal-h">指示書を更新登録：${esc(c.name)} さん</div>
    <div class="modal-b">
      <label class="field"><span>主治医</span><select id="rDoc">${Object.entries(s.doctors).map(([k, dd]) => `<option value="${k}" ${k === c.doc ? 'selected' : ''}>${esc(dd.name)}（${esc(dd.clinic)}）</option>`).join('')}</select></label>
      <div class="form-grid two">
        <label class="field"><span class="req">開始日</span><input type="date" id="rStart" value="${start}"></label>
        <label class="field"><span class="req">終了日</span><input type="date" id="rEnd" value="${end}"></label>
      </div>
      <div class="hint">受け取った指示書の有効期間を入力します（デモ版では書類の取り込みはありません）。</div>
      <div class="hint warn" id="rErr"></div>
    </div>
    <div class="modal-f"><button class="btn" data-close>キャンセル</button><button class="btn primary" id="rSave">登録する</button></div>`, (m) => {
    $('#rSave', m).onclick = () => {
      const st = $('#rStart', m).value; const en = $('#rEnd', m).value;
      if (!st || !en || en < st) { $('#rErr', m).textContent = '有効期間を正しく入力してください'; return; }
      s.orders.push({ id: `o${Date.now()}`, clientId, kind: '訪問看護指示書', doc: $('#rDoc', m).value, start: st, end: en, note: '' });
      save(); closeModal(); toast('指示書を登録しました'); render();
    };
  });
}

function viewOrders(q) {
  setTitle('指示書の期限');
  const s = db(); const f = q.get('f') || 'all'; const showOld = q.get('old') === '1';
  let rows = showOld ? [...s.orders] : s.clients.map((c) => latestOrder(c.id)).filter(Boolean);
  const latestIds = new Set(s.clients.map((c) => latestOrder(c.id)?.id));
  rows = rows.filter((o) => f === 'all' || (latestIds.has(o.id) && orderState(o).key === f)).sort((a, b) => (a.end < b.end ? -1 : 1));
  const counts = { expired: 0, soon: 0, ok: 0 };
  s.clients.forEach((c) => { const o = latestOrder(c.id); if (o) counts[orderState(o).key]++; });
  return `
  <div class="stats" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat red"><div class="label">期限切れ</div><div class="num">${counts.expired}<small>件</small></div></div>
    <div class="stat amber"><div class="label">14日以内に期限</div><div class="num">${counts.soon}<small>件</small></div></div>
    <div class="stat green"><div class="label">有効</div><div class="num">${counts.ok}<small>件</small></div></div>
  </div>
  <section class="card">
    <div class="card-head"><h2>指示書一覧</h2><span class="muted small">${rows.length} 件</span><span class="spacer"></span>
      <div class="seg" id="oF">${[['all', 'すべて'], ['expired', '期限切れ'], ['soon', '14日以内']].map(([k, l]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="small"><input type="checkbox" id="oOld" ${showOld ? 'checked' : ''}> 更新済みの指示書も表示</label></div>
    <p class="card-note">期限の近い順に並びます。期限切れ・14日以内の行は色付きで表示します。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>利用者</th><th>保険</th><th class="hide-sm">主治医・医療機関</th><th>有効期間</th><th>期限</th><th></th></tr></thead>
      <tbody>${rows.map((o) => { const c = client(o.clientId); const latest = latestIds.has(o.id); const st = orderState(o); const dd = s.doctors[o.doc]; return `
        <tr class="${latest ? st.row : ''}">
          <td><a href="#/clients/${c.id}"><b>${esc(c.name)}</b></a><div class="sub-line">${esc(o.kind)}</div></td>
          <td>${insBadge(c.ins)}</td>
          <td class="hide-sm">${esc(dd.name)}<div class="sub-line">${esc(dd.clinic)}</div></td>
          <td class="nowrap">${fmtFull(o.start)}〜<br>${fmtFull(o.end)}</td>
          <td>${latest ? st.badge : '<span class="badge b-gray">更新済み</span>'}</td>
          <td style="text-align:right">${latest ? `<button class="btn sm ${st.key === 'ok' ? '' : 'primary'}" data-renew="${c.id}">更新登録</button>` : ''}</td>
        </tr>`; }).join('') || '<tr><td colspan="6" class="empty">該当する指示書はありません</td></tr>'}</tbody>
    </table></div>
  </section>`;
}
function bindOrders(q) {
  const upd = (k, v) => { const p = new URLSearchParams(q); if (v) p.set(k, v); else p.delete(k); go(`#/orders?${p}`); };
  $('#oF').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) upd('f', b.dataset.f === 'all' ? '' : b.dataset.f); };
  $('#oOld').onchange = (e) => upd('old', e.target.checked ? '1' : '');
  document.querySelectorAll('[data-renew]').forEach((b) => { b.onclick = () => renewModal(b.dataset.renew); });
}

/* ---------- schedule (week grid) ---------- */
function mondayOf(isoStr) { const d = dateObj(isoStr); return addDays(isoStr, -((d.getDay() + 6) % 7)); }
function viewSchedule(q) {
  setTitle('訪問予定表');
  const s = db(); const today = todayIso();
  const start = mondayOf(q.get('w') || today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = s.visits.filter((v) => v.date >= days[0] && v.date <= days[6]);
  const head = days.map((d) => { const wd = dateObj(d).getDay(); return `<div class="h ${d === today ? 'today' : ''} ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}">${fmtDate(d)}</div>`; }).join('');
  const rows = s.staff.map((st) => `
    <div class="who">${esc(st.name)}<div class="sub-line">${st.role}</div></div>
    ${days.map((d) => `<div class="cell ${d === today ? 'today' : ''}" data-cell="${st.id}|${d}" title="空いている所をクリックで予定を追加">${inWeek.filter((v) => v.staffId === st.id && v.date === d).sort((a, b) => (a.start < b.start ? -1 : 1)).map((v) => `
      <button class="v-chip ${v.status} ${v.date < today || (v.date === today && v.end < nowHm()) ? 'past' : ''}" data-visit="${v.id}"><b>${v.start} ${esc(client(v.clientId).name)}</b>${v.kind}</button>`).join('')}</div>`).join('')}`).join('');
  return `
  <section class="card">
    <div class="week-head">
      <button class="btn" id="wPrev">← 前の週</button><button class="btn" id="wThis">今週</button><button class="btn" id="wNext">次の週 →</button>
      <span class="week-title">${fmtFull(days[0])} 〜 ${fmtFull(days[6]).slice(5)}</span>
      <span class="muted small">${inWeek.length} 件</span>
      <span style="flex:1"></span><button class="btn primary" id="wAdd">＋ 予定を追加</button>
    </div>
  </section>
  <section class="card">
    <div class="table-wrap"><div class="sched"><div class="h">担当者</div>${head}${rows}</div></div>
    <div class="legend"><span><i style="background:var(--blue)"></i>予定</span><span><i style="background:var(--amber)"></i>下書き</span><span><i style="background:var(--green)"></i>記録確定</span><span><i style="background:var(--red)"></i>記録待ち</span><span>予定をクリックで記録へ・空いている枠をクリックで予定を追加</span></div>
  </section>`;
}
function bindSchedule(q) {
  const start = mondayOf(q.get('w') || todayIso());
  $('#wPrev').onclick = () => go(`#/schedule?w=${addDays(start, -7)}`);
  $('#wNext').onclick = () => go(`#/schedule?w=${addDays(start, 7)}`);
  $('#wThis').onclick = () => go('#/schedule');
  $('#wAdd').onclick = () => visitModal({ date: todayIso() >= start && todayIso() <= addDays(start, 6) ? todayIso() : start, staffId: db().me, start: '10:00' });
  $('.sched').onclick = (e) => {
    const chip = e.target.closest('[data-visit]'); if (chip) { go(`#/visit/${chip.dataset.visit}`); return; }
    const cell = e.target.closest('[data-cell]'); if (cell) { const [sid, d] = cell.dataset.cell.split('|'); visitModal({ date: d, staffId: sid, start: '10:00' }); }
  };
}

/* ---------- visit record form ---------- */
const OBS = ['表情・意識', '呼吸状態', '食事・水分', '排泄', '睡眠', '皮膚状態', '疼痛', '浮腫', '歩行状態', '服薬状況'];
const CARE = ['服薬確認', '清拭・保清', '褥瘡処置', '吸引', '点滴・注射', '浣腸・摘便', '療養指導', '家族への助言', '関節可動域訓練', '歩行訓練', '日常生活動作訓練'];
const VITALS = [
  ['temp', '体温', '℃', '0.1'], ['sys', '血圧（上）', 'mmHg', '1'], ['dia', '血圧（下）', 'mmHg', '1'],
  ['pulse', '脈拍', '回/分', '1'], ['resp', '呼吸数', '回/分', '1'], ['spo2', 'SpO2', '%', '1'],
];
// 入力欄の目安表示（デモ用の単純な範囲。ここを外れたら赤枠にするだけ）
const RANGE = { temp: [35.5, 37.4], sys: [90, 159], dia: [50, 99], pulse: [50, 110], resp: [10, 24], spo2: [93, 100] };
const outOfRange = (k, val) => val !== '' && val != null && RANGE[k] && (Number(val) < RANGE[k][0] || Number(val) > RANGE[k][1]);

function viewVisit(id) {
  const s = db(); const v = s.visits.find((x) => x.id === id);
  if (!v) return '<div class="card empty">訪問が見つかりません</div>';
  const c = client(v.clientId);
  setTitle('訪問記録の入力');
  const r = v.record || { vitals: {}, obs: [], care: [], s: '', o: '', a: '', p: '' };
  const locked = v.status === 'done';
  const dis = locked ? 'disabled' : '';
  const order = latestOrder(c.id); const ost = order ? orderState(order) : null;
  return `
  <a class="back" href="javascript:history.back()">← 戻る</a>
  <div class="detail-head">
    <div><div class="muted small">${fmtFull(v.date)}（${WD[dateObj(v.date).getDay()]}）${v.start}〜${v.end}</div>
      <h2><a href="#/clients/${c.id}" style="color:inherit">${esc(c.name)}</a> <span class="muted" style="font-size:14px;font-weight:400">さん</span></h2>
      <div class="status-line" style="margin-top:6px">${insBadge(c.ins)}<span class="badge">${v.kind}</span>${statusBadge(v)}${v.updatedAt ? `<span class="muted small">最終保存 ${esc(v.updatedAt)}</span>` : ''}</div></div>
  </div>
  ${ost && ost.key !== 'ok' ? `<div class="notice ${ost.key === 'expired' ? 'red' : 'amber'}"><div class="n-body"><div class="n-title">指示書の期限：${fmtFull(order.end)}</div><div class="small">${ost.key === 'expired' ? '期限が切れています。再発行を確認してください。' : `残り${ost.left}日です。`}</div></div></div>` : ''}
  ${locked ? '<div class="notice blue"><div class="n-body"><div class="n-title">この記録は確定済みです</div><div class="small">直す場合は「修正する」を押すと下書きに戻ります。</div></div></div>' : ''}
  <form id="vf" autocomplete="off">
    <section class="card">
      <div class="card-head"><h2>訪問情報</h2></div>
      <div class="form-grid">
        <label class="field"><span class="req">訪問日</span><input type="date" name="date" value="${v.date}" ${dis}></label>
        <label class="field"><span class="req">開始</span><input type="time" name="start" value="${v.start}" ${dis}></label>
        <label class="field"><span class="req">終了</span><input type="time" name="end" value="${v.end}" ${dis}></label>
        <label class="field"><span class="req">担当者</span><select name="staffId" ${dis}>${s.staff.map((st) => `<option value="${st.id}" ${v.staffId === st.id ? 'selected' : ''}>${esc(st.name)}（${st.role}）</option>`).join('')}</select></label>
        <label class="field"><span>サービス種別</span><select name="kind" ${dis}>${['看護', 'リハ(PT)', 'リハ(OT)'].map((k) => `<option ${v.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="field"><span>主病名</span><input type="text" value="${esc(c.dx)}" disabled></label>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>バイタルサイン</h2><span class="spacer"></span>${locked ? '' : '<button type="button" class="btn sm" id="copyPrev">前回の値を写す</button>'}</div>
      <div class="form-grid">${VITALS.map(([k, l, u, step]) => `
        <label class="field"><span>${l}（${u}）</span><input type="number" step="${step}" inputmode="decimal" name="v_${k}" value="${esc(r.vitals[k] ?? '')}" class="${outOfRange(k, r.vitals[k]) ? 'vital-warn' : ''}" ${dis}></label>`).join('')}</div>
      <div class="hint" style="margin-top:8px">目安の範囲を外れた値は赤枠で表示します（デモ用の簡易表示）。</div>
    </section>
    <section class="card">
      <div class="card-head"><h2>観察項目</h2></div>
      <div class="chips">${OBS.map((o) => `<label class="chip-check"><input type="checkbox" name="obs" value="${o}" ${r.obs.includes(o) ? 'checked' : ''} ${dis}><span>${o}</span></label>`).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><h2>実施したケア</h2></div>
      <div class="chips">${CARE.map((o) => `<label class="chip-check"><input type="checkbox" name="care" value="${o}" ${r.care.includes(o) ? 'checked' : ''} ${dis}><span>${o}</span></label>`).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><h2>記録（SOAP）</h2></div>
      <div class="soap">
        ${[['s', 'S', '主観的情報（本人・家族の言葉）'], ['o', 'O', '客観的情報（観察したこと）'], ['a', 'A', 'アセスメント（評価）'], ['p', 'P', '計画（次回以降の方針）']].map(([k, L, label]) => `
          <div class="letter">${L}</div><label class="field"><span>${label}</span><textarea name="${k}" rows="2" ${dis}>${esc(r[k])}</textarea></label>`).join('')}
      </div>
    </section>
    <div class="sticky-actions">
      <div class="hint warn" id="vErr" style="flex:1;align-self:center;min-width:200px"></div>
      ${locked ? '<button type="button" class="btn" id="unlock">修正する</button>' : `
        <button type="button" class="btn" id="saveDraft">下書き保存</button>
        <button type="button" class="btn primary" id="confirm">確定する</button>`}
    </div>
  </form>`;
}
function collect(form) {
  const fd = new FormData(form); const vitals = {};
  VITALS.forEach(([k]) => { vitals[k] = (fd.get(`v_${k}`) || '').toString(); });
  return {
    meta: { date: fd.get('date'), start: fd.get('start'), end: fd.get('end'), staffId: fd.get('staffId'), kind: fd.get('kind') },
    record: { vitals, obs: fd.getAll('obs'), care: fd.getAll('care'), s: fd.get('s') || '', o: fd.get('o') || '', a: fd.get('a') || '', p: fd.get('p') || '' },
  };
}
function bindVisit(id) {
  const v = db().visits.find((x) => x.id === id); if (!v) return;
  const form = $('#vf');
  form.addEventListener('input', (e) => {
    const n = e.target.name || '';
    if (n.startsWith('v_')) e.target.classList.toggle('vital-warn', outOfRange(n.slice(2), e.target.value));
  });
  const stamp = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const apply = (status) => {
    const { meta, record } = collect(form);
    const err = $('#vErr');
    if (!meta.date || !meta.start || !meta.end) { err.textContent = '訪問日と時刻を入力してください'; return false; }
    if (meta.end <= meta.start) { err.textContent = '終了は開始より後の時刻にしてください'; return false; }
    if (status === 'done') {
      const miss = [];
      if (!record.vitals.temp && !record.vitals.sys && !record.vitals.pulse) miss.push('バイタル（体温・血圧・脈拍のいずれか）');
      if (!record.care.length) miss.push('実施したケア');
      if (!record.s.trim() && !record.o.trim()) miss.push('S または O');
      if (miss.length) { err.textContent = `確定するには入力が必要です：${miss.join('、')}`; return false; }
    }
    Object.assign(v, meta, { record, status, updatedAt: stamp() });
    save(); return true;
  };
  $('#saveDraft')?.addEventListener('click', () => { if (apply('draft')) { toast('下書きを保存しました'); render(); } });
  $('#confirm')?.addEventListener('click', () => { if (apply('done')) { toast('記録を確定しました'); render(); window.scrollTo(0, 0); } });
  $('#unlock')?.addEventListener('click', () => { v.status = 'draft'; save(); toast('下書きに戻しました'); render(); });
  $('#copyPrev')?.addEventListener('click', () => {
    const prev = db().visits.filter((x) => x.clientId === v.clientId && x.id !== v.id && x.record && (x.date + x.start) < (v.date + v.start)).sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1))[0];
    if (!prev) { toast('前回の記録がありません'); return; }
    VITALS.forEach(([k]) => { const el = form.elements[`v_${k}`]; el.value = prev.record.vitals[k] || ''; el.classList.toggle('vital-warn', outOfRange(k, el.value)); });
    toast(`${fmtDate(prev.date)} の値を写しました`);
  });
}

/* ---------- router ---------- */
function render() {
  const { parts, q } = parseHash();
  const [p0, p1] = parts;
  const view = $('#view');
  let html = ''; let bind = null; let navKey = p0 || '';
  if (!p0) html = viewDashboard();
  else if (p0 === 'today') { html = viewToday(q); bind = () => bindToday(q); }
  else if (p0 === 'clients' && p1) { html = viewClient(p1); bind = () => bindClient(p1); }
  else if (p0 === 'clients') { html = viewClients(q); bind = () => bindClients(q); }
  else if (p0 === 'schedule') { html = viewSchedule(q); bind = () => bindSchedule(q); }
  else if (p0 === 'orders') { html = viewOrders(q); bind = () => bindOrders(q); }
  else if (p0 === 'visit' && p1) { html = viewVisit(p1); bind = () => bindVisit(p1); navKey = 'today'; }
  else { html = viewDashboard(); navKey = ''; }
  view.innerHTML = html;
  renderNav(navKey);
  bind?.();
  closeSide();
}

function closeSide() { $('#side').classList.remove('open'); $('#scrim').classList.remove('open'); }

function init() {
  load();
  $('#stationName').textContent = db().station.name;
  $('#sideUser').textContent = `${staff(db().me).name}（${staff(db().me).role}）`;
  $('#resetDemo').onclick = () => {
    reset(); toast('初期状態に戻しました'); go('#/'); render();
  };
  $('#menuBtn').onclick = () => { $('#side').classList.add('open'); $('#scrim').classList.add('open'); };
  $('#scrim').onclick = closeSide;
  $('#view').addEventListener('click', (e) => {
    const dm = e.target.closest('[data-dismiss]');
    if (dm) { db().dismissed.push(dm.dataset.dismiss); save(); render(); return; }
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a,button')) go(row.dataset.href);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
}
init();
