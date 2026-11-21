// ドキュメント系の画面：ドキュメント・フェイスシート・各手順書・レクリエーションカレンダー。
import { MEMBERS, STAFF, REC_CATS, todayStr } from './data.js';
import { openBasicForm, setCurrent } from './person.js';
import * as store from './store.js';
import { esc, jpDate, toast, openModal, closeModal, confirmDialog, ui, deco, scriptTitle, plainTitle, subtabs, CARE_TABS, weekdayButtons, memberCards, ageOf } from './ui.js';
import { member, staffName, membersOnWeekday, byKana, serviceLabel, weekdayLabelOf, bathLabelOf } from './model.js';

// =====================================================================
//  フェイスシート（紙の様式）
// =====================================================================
const wareki = (ds) => { const [y, m, d] = ds.split('-').map(Number); return `${y}年${m}月${d}日`; };
export function faceSheetPaper(uid) {
  const m = member(uid);
  const p = store.getProfile(uid);
  const now = new Date();
  const stamp = `${jpDate(todayStr()).replace(/（.）/, '')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const band = (ja, en) => `<tr class="band"><th colspan="6">✻ ${ja} <small>${en}</small></th></tr>`;
  return `<article class="paper">
    <h2 class="paper-title">✻ フェイスシート ✻</h2><div class="paper-sub">F A C E　S H E E T</div>
    <div class="paper-stamp">作成日時: <b>${stamp}</b>　／　更新: 1ヶ月ごと</div>
    <table class="fs">
      <tr><th>氏名</th><td colspan="5"><small class="ruby">${esc(m.kana)}</small><span class="fs-name">${esc(m.name)}</span> <small>様</small></td></tr>
      <tr><th>生年月日</th><td colspan="2">${p.birth ? wareki(p.birth) : ''}</td><th>年齢・性別</th><td colspan="2">${ageOf(p.birth)} 歳　／　${p.sex}</td></tr>
      <tr><th>住所</th><td colspan="5">${esc(p.address || '')}</td></tr>
      <tr><th>キーパーソン</th><td colspan="5">${esc(p.keyPerson || '')}</td></tr>
      ${band('目標', 'Goals')}
      <tr><th>看護目標</th><td colspan="5">${esc(p.nurseGoal || '')}</td></tr>
      <tr><th>介護目標</th><td colspan="5">${esc(p.careGoal || '')}</td></tr>
      ${band('医療', 'Medical')}
      <tr><th>主疾患</th><td colspan="5">${esc(p.disease || '')}</td></tr>
      <tr><th>薬剤</th><td colspan="5">${esc(p.meds || '')}</td></tr>
      <tr><th>受診状況</th><td colspan="5">${esc(p.clinic || '')}</td></tr>
      ${band('心身の状態', 'Condition')}
      <tr><th>介護度</th><td>${esc(p.level || '')}</td><th>障害自立度</th><td>${esc(p.phys || '')}</td><th>認知自立度</th><td>${esc(p.cog || '')}</td></tr>
      <tr><th>認定終了日</th><td>${p.certEnd ? wareki(p.certEnd) : ''}</td><th>身長</th><td>${p.height ? p.height + ' cm' : ''}</td><th>利用曜日</th><td>${weekdayLabelOf(m)}</td></tr>
      <tr><th>ADL</th><td colspan="5">${esc(p.adl || '')}</td></tr>
      <tr><th>IADL</th><td colspan="5">${esc(p.iadl || '')}</td></tr>
      ${band('サービス', 'Service')}
      <tr><th>利用状況</th><td colspan="5">${esc(serviceLabel(m))}</td></tr>
      <tr><th>ケアプラン</th><td colspan="5">${esc(p.plan || '（未記入）')}</td></tr>
      <tr><th>備考</th><td colspan="5">${esc(store.getMap('remarks', uid)?.text || '')}</td></tr>
    </table>
  </article>`;
}

const pickerCard = (title, href, note, { small = false, visit = false } = {}) => {
  const q = ui.search.trim();
  const list = visit ? [] : q ? MEMBERS.filter((m) => m.name.includes(q) || m.kana.includes(q)).sort(byKana) : membersOnWeekday(ui.weekday);
  return `<section class="card p-card">${deco}<p class="hint-top">${note}</p>
    ${weekdayButtons(ui.weekday, { small })}
    <input class="search" type="search" data-search placeholder="🔍 お名前で検索（${title}）" value="${esc(ui.search)}">
    ${visit ? '<p class="empty center">この曜日の訪問利用者は登録されていません</p>' : memberCards(list, href)}</section>`;
};

export function renderFaceSheet(q) {
  const uid = q.get('u');
  const head = `${subtabs(CARE_TABS, '#/facesheet')}${scriptTitle('Face Sheet', 'フェイスシート', '利用者さんの基本情報シートを表示・編集し、A4 で印刷できます')}`;
  if (uid && member(uid)) {
    return `${head}<div class="row mb12 no-print"><a href="#/facesheet" class="btn ghost-pink">← 利用者一覧へ</a><span class="sp"></span><button type="button" class="btn ghost-pink" data-print>印刷</button><button type="button" class="btn pink" data-fs-edit="${uid}">編集する</button></div>${faceSheetPaper(uid)}`;
  }
  const qq = ui.search.trim();
  const list = MEMBERS.filter((m) => !qq || m.name.includes(qq) || m.kana.includes(qq)).sort(byKana);
  return `${head}<section class="card p-card">${deco}
    <p class="hint-top">利用者さんの一覧です（通所、五十音順）。名前を押すと<b>フェイスシート</b>が開きます。 リストにない方はお名前で検索するか、プルダウンから選んでください。</p>
    <div class="search-row"><input class="search" type="search" data-search placeholder="🔍 お名前で検索" value="${esc(ui.search)}"><button type="button" class="btn pink" data-toast="新規登録は「新規受付」の画面から行えます">＋ 新規登録</button><button type="button" class="btn ghost-pink" data-print>🖨 全員分を印刷</button></div>
    <select class="input round sel-big w-half" data-jump-member="#/facesheet?u=" aria-label="一覧から選ぶ"><option value="">▼ 一覧から選ぶ（${MEMBERS.length}名）</option>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
    <p class="group-l">通所の利用者</p>
    ${memberCards(list, (m) => `#/facesheet?u=${m.id}`)}
  </section>
  <section class="card p-card">${deco}<button type="button" class="btn ghost-pink" data-toast="表計算ファイルからの取り込みはデモ版では動きません">📥 表計算ファイルから取り込み</button></section>`;
}

// =====================================================================
//  手順書
// =====================================================================
export const PROC_TYPES = {
  bath: { script: 'Bathing', ja: '入浴手順書', lead: '利用者さんごとの入浴介助の手順書です。入浴方法・補助具・手順と留意点をまとめ、印刷して使えます。', sec: '入浴基本情報', selLabel: '入浴方法', sel: ['一般浴（個浴）', '一般浴（大浴槽）', 'シャワー浴', '機械浴（チェアー浴）', '機械浴（ストレッチャー浴）', '清拭', 'その他'], chipLabel: '補助具', chips: ['シャワーチェア', 'シャワーキャリー', 'バスボード', '浴槽内いす', '滑り止めマット', '手すり', 'リフト', '移乗台'] },
  transport: { script: 'Transport', ja: '送迎手順書', lead: '利用者さんごとの送迎（乗り降りの介助）の手順書です。乗車位置・補助具・送迎前と送迎時の手順をまとめ、印刷して使えます。', sec: '送迎基本情報', selLabel: '乗車位置', sel: ['助手席', '後部座席（左）', '後部座席（右）', '車いすスペース'], chipLabel: '補助具', chips: ['踏み台', '手すり', '車いす', '歩行器', '杖', 'スライディングボード'] },
  visit: { script: 'Visiting', ja: '訪問手順書', lead: '利用者さんごとの訪問時の手順書です。入室方法・福祉用具・手順と留意点をまとめ、印刷して使えます。', sec: '訪問基本情報', selLabel: '入室方法', sel: ['インターホン', '鍵を預かり', 'キーボックス', 'ご家族が対応'], chipLabel: '福祉用具', chips: ['介護ベッド', '車いす', '歩行器', 'ポータブルトイレ', '手すり'], visit: true },
  medical: { script: 'Medical', ja: '受診付き添い手順書', lead: '利用者さんごとの受診付き添いの手順書です。受診情報・持ち物・受診前と当日の手順をまとめ、印刷して使えます。', sec: '受診情報', selLabel: '受診の頻度', sel: ['月1回', '2週に1回', '週1回', '不定期'], chipLabel: '持ち物', chips: ['保険証', 'お薬手帳', '診察券', '紹介状', '着替え', '飲み物'] },
  day: { script: 'Day Service', ja: '通所手順書', lead: '利用者さんごとの通所時の手順書です。補助具・手順と留意点をまとめ、印刷して使えます。', sec: '通所基本情報', selLabel: '移動', sel: ['独歩', '杖歩行', '歩行器', '伝い歩き', '車椅子'], chipLabel: '補助具', chips: ['杖', '歩行器', '車いす', '手すり', '補聴器', '眼鏡'] },
};
const MOVES = ['独歩', '杖歩行', '歩行器', '伝い歩き', '車椅子', 'シャワーキャリー', '2人介助', 'その他'];

export function procedureSheet(type, uid, embedded = false) {
  const cfg = PROC_TYPES[type];
  const m = member(uid);
  const p = store.getProfile(uid);
  const saved = store.getMap('procedures', `${type}|${uid}`, {}) || {};
  const steps = saved.steps && saved.steps.length ? saved.steps : [{ s: '', n: '' }, { s: '', n: '' }, { s: '', n: '' }];
  const info = [
    ['ケアプラン', p.plan || '（フェイスシート未記入）'], ['看護目標', p.nurseGoal], ['介護目標', p.careGoal], ['疾患', p.disease], ['薬剤', p.meds],
    ['介護度', p.level], ['自立度', `障害: ${p.phys} ／ 認知: ${p.cog}`], ['サービス利用状況', `通所: ${weekdayLabelOf(m)}${m.bathDays.length ? `　入浴: ${bathLabelOf(m)}` : ''}`], ['ADL', p.adl],
  ];
  return `<form data-proc-form="${type}|${uid}">
    ${embedded ? '' : `<div class="row mb12 no-print"><a href="#/proc/${type}" class="btn ghost-pink">← 利用者一覧へ</a><span class="sp"></span><button type="button" class="btn ghost-pink" data-print>印刷</button><button type="submit" class="btn pink">保存する</button></div>`}
    <section class="card p-card">${deco}
      <div class="proc-name"><span class="muted small">利用者名</span> <b>${esc(m.name)} 様</b> <span class="muted small">${esc(m.kana)}</span></div>
      <p class="proc-cap">基本情報（フェイスシートから参照 — 修正はフェイスシートの画面で）</p>
      <dl class="proc-info">${info.map(([k, v]) => `<dt>${k}</dt><dd class="${!v || v.startsWith('（') ? 'muted small' : ''}">${esc(v || '')}</dd>`).join('')}</dl>
      <label class="f-inline-row"><b>移動</b><select class="input round w-half" name="move"><option value="">（選択してください）</option>${MOVES.map((x) => `<option ${saved.move === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    </section>
    <section class="card p-card">${deco}
      <h3 class="h3">${cfg.sec}</h3>
      <label class="f-inline-row"><b>${cfg.selLabel}</b><select class="input round w-half" name="sel"><option value="">（選択してください）</option>${cfg.sel.map((x) => `<option ${saved.sel === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <p class="h4">${cfg.chipLabel}</p><p class="muted small">使うものを押して選んでください（複数可）。</p>
      <div class="chips big-chips" data-proc-chips>${cfg.chips.map((c) => `<button type="button" class="chip ${(saved.chips || []).includes(c) ? 'on' : ''}" data-v="${c}">${c}</button>`).join('')}</div>
      <label class="f-inline-row mt10"><b>その他</b><input class="input round" name="other" value="${esc(saved.other || '')}" placeholder="一覧にないものがあれば入力"></label>
    </section>
    <section class="card p-card">${deco}
      <h3 class="h3">手順と留意点</h3>
      <div class="grid-table-wrap"><table class="grid-table left steps"><thead><tr><th>#</th><th>手順</th><th>留意点</th><th></th></tr></thead>
      <tbody>${steps.map((s, i) => `<tr><td>${i + 1}</td><td><textarea class="input sq" name="s${i}" rows="2">${esc(s.s)}</textarea></td><td><textarea class="input sq" name="n${i}" rows="2">${esc(s.n)}</textarea></td><td><button type="button" class="p-x" data-step-del="${i}" aria-label="行を削除">✕</button></td></tr>`).join('')}</tbody></table></div>
      <button type="button" class="btn sm mt8" data-step-add>＋ 行を追加</button>
      ${embedded ? '<div class="row mt10"><span class="sp"></span><button type="submit" class="btn pink">保存する</button></div>' : ''}
    </section>
  </form>`;
}
function readProc(form) {
  const steps = [];
  for (let i = 0; form.elements[`s${i}`]; i++) steps.push({ s: form.elements[`s${i}`].value, n: form.elements[`n${i}`].value });
  return { move: form.elements.move.value, sel: form.elements.sel.value, other: form.elements.other.value, chips: [...form.querySelectorAll('[data-proc-chips] .chip.on')].map((c) => c.dataset.v), steps };
}

export function renderProc(type, q) {
  const cfg = PROC_TYPES[type];
  if (!cfg) return '';
  const uid = q.get('u');
  const head = `${subtabs(CARE_TABS, `#/proc/${type}`)}${scriptTitle(cfg.script, cfg.ja, cfg.lead)}`;
  if (uid && member(uid)) return head + procedureSheet(type, uid);
  return head + pickerCard('全利用者から', (m) => `#/proc/${type}?u=${m.id}`, `曜日ごとの${cfg.visit ? '訪問' : '通所'}利用者さんです（五十音順）。名前を押すと<b>${cfg.ja}</b>が開きます。 リストにない方はお名前で検索してください。`, { small: true, visit: cfg.visit && !ui.search.trim() });
}

// =====================================================================
//  ドキュメント
// =====================================================================
export function renderDocs(q) {
  const uid = q.get('u');
  const m = uid && member(uid);
  const head = plainTitle('ドキュメント', '利用者の書類 (フェイスシート / 入浴・送迎・訪問・受診付き添い・通所の手順書) をまとめて開けます。 書類の中身は各画面で編集できます。');
  const picker = `<section class="card"><label class="f-label">利用者検索 <span class="req">*</span></label>
    <div class="suggest-wrap"><input class="input round" data-doc-q placeholder="氏名・ふりがなで検索" value="${m ? esc(m.name) : ''}" autocomplete="off"><div class="suggest" data-doc-list hidden></div></div></section>`;
  if (!m) return head + picker;
  const docs = [['フェイスシート', `#/facesheet?u=${uid}`, '基本情報・目標・医療・心身の状態'], ...Object.entries(PROC_TYPES).map(([k, c]) => [c.ja, `#/proc/${k}?u=${uid}`, c.lead.split('。')[1] || ''])];
  return `${head}${picker}<section class="card p-card">${deco}<h3 class="h3">${esc(m.name)} 様の書類</h3>
    <div class="doc-list">${docs.map(([t, h, d]) => `<a class="doc-item" href="${h}"><b>${t}</b><small>${esc(d)}</small><span class="doc-open">開く ›</span></a>`).join('')}</div></section>`;
}

// =====================================================================
//  レクリエーションカレンダー
// =====================================================================
const catOf = (k) => REC_CATS.find((c) => c.key === k) || REC_CATS[3];
export function renderRec(q) {
  const tab = q.get('tab') === 'master' ? 'master' : 'cal';
  const head = `${subtabs(CARE_TABS, '#/rec')}${plainTitle('レクリエーションカレンダー', 'カレンダーの日付を押して、その日のレクリエーション (種類・カテゴリー・時間) を入れてください。 入れた種類は自動で種類マスタに残り、次の月からは選ぶだけで入力できます。')}
    <div class="seg2"><a class="btn ${tab === 'cal' ? 'pink' : ''}" href="#/rec">カレンダー</a><a class="btn ${tab === 'master' ? 'pink' : ''}" href="#/rec?tab=master">種類マスタ (設定)</a></div>`;
  if (tab === 'master') {
    return `${head}<section class="card"><div class="grid-table-wrap"><table class="grid-table left"><thead><tr><th>種類</th><th>カテゴリー</th><th>時間</th><th></th></tr></thead>
      <tbody>${store.list('recMaster').map((r, i) => `<tr><td>${esc(r.name)}</td><td><span class="rec-dot" style="background:${catOf(r.cat).color};border-color:${catOf(r.cat).border}"></span>${catOf(r.cat).label}</td><td>${esc(r.dur)}</td><td><button type="button" class="btn xs red-t" data-recm-del="${i}">削除</button></td></tr>`).join('')}</tbody></table></div>
      <form class="row mt10" data-recm-form><input class="input round w-sel2" name="name" placeholder="種類 (例: 体操)"><select class="input round w-sel" name="cat">${REC_CATS.map((c) => `<option value="${c.key}">${c.label}</option>`).join('')}</select><input class="input round w-sel" name="dur" placeholder="時間 (例: 30分)"><button class="btn pink" type="submit">追加</button></form></section>`;
  }
  const [y, mo] = ui.recMonth.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const startOff = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, mo - 1, 1 - startOff + i);
    cells.push(d);
    if (i >= 34 && d.getMonth() !== mo - 1 && (i + 1) % 7 === 0) break;
  }
  const today = todayStr();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${head}
    <div class="row mb10"><button type="button" class="btn sm" data-rec-month="-1">◀ 前月</button><button type="button" class="btn sm" data-rec-month="0">今月</button><button type="button" class="btn sm" data-rec-month="1">翌月 ▶</button><b class="month-l">${y}年${mo}月</b>
      <span class="sp"></span><button type="button" class="btn sm" data-rec-auto>条件から自動作成</button><button type="button" class="btn sm" data-rec-clear>この月を消す</button><button type="button" class="btn sm" data-print>印刷</button></div>
    <div class="row mb10 legend-row">${REC_CATS.map((c) => `<span><span class="rec-dot" style="background:${c.color};border-color:${c.border}"></span>${c.label}</span>`).join('')}</div>
    <section class="card cal-card"><div class="cal-grid mon">${['月', '火', '水', '木', '金', '土', '日'].map((w, i) => `<div class="cal-wd ${i === 5 ? 'sat' : i === 6 ? 'sun' : ''}">${w}</div>`).join('')}
      ${cells.map((d) => { const ds = ymd(d); const r = store.getMap('rec', ds); const other = d.getMonth() !== mo - 1; return `<button type="button" class="cal-day ${other ? 'other' : ''} ${ds === today ? 'today' : ''}" data-rec-day="${ds}"><span class="dn ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}">${d.getDate()}</span>${r && !other ? `<span class="rec-ev" style="background:${catOf(r.cat).color};border-left-color:${catOf(r.cat).border}"><b>${esc(r.name)}</b> ${esc(r.dur)}<br>主催: ${esc(staffName(r.host))}</span>` : ''}</button>`; }).join('')}
    </div></section>`;
}
function openRecDay(ds) {
  const r = store.getMap('rec', ds) || {};
  const master = store.list('recMaster');
  openModal(`<form class="modal" novalidate><div class="modal-head"><div class="d">${jpDate(ds)}</div><div class="n">レクリエーション</div></div>
    <label class="f-col"><span>種類</span><input class="input round" name="name" list="rec-names" value="${esc(r.name || '')}" placeholder="例: 風船バレー" data-autofocus><datalist id="rec-names">${master.map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist></label>
    <label class="f-col"><span>カテゴリー</span><select class="input round" name="cat">${REC_CATS.map((c) => `<option value="${c.key}" ${r.cat === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
    <label class="f-col"><span>時間</span><input class="input round" name="dur" value="${esc(r.dur || '')}" placeholder="例: 45分"></label>
    <label class="f-col"><span>主催</span><select class="input round" name="host">${STAFF.map((s) => `<option value="${s.id}" ${r.host === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    <div class="modal-foot3"><button type="button" class="btn" data-close>キャンセル</button><button type="button" class="btn ghost-pink" data-rec-remove>この日を消す</button><button type="submit" class="btn grad">保存</button></div></form>`, (form) => {
    form.name.addEventListener('change', () => { const x = master.find((mm) => mm.name === form.name.value); if (x) { form.cat.value = x.cat; form.dur.value = x.dur; } });
    form.querySelector('[data-rec-remove]').addEventListener('click', () => { store.setMap('rec', ds, null); closeModal(); toast('消しました'); rerender(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) { toast('種類を入れてください'); return; }
      store.setMap('rec', ds, { name, cat: form.cat.value, dur: form.dur.value.trim(), host: form.host.value });
      if (!master.some((x) => x.name === name)) { store.list('recMaster').push({ name, cat: form.cat.value, dur: form.dur.value.trim() }); store.save(); }
      closeModal(); toast('保存しました'); rerender();
    });
  });
}

// =====================================================================
//  イベント
// =====================================================================
let rerender = () => {};
export function initDocs(view, render) {
  rerender = render;
  view.addEventListener('click', async (ev) => {
    const t = ev.target;
    const fe = t.closest('[data-fs-edit]');
    if (fe) { setCurrent(fe.dataset.fsEdit); openBasicForm(fe.dataset.fsEdit); return; }
    const chip = t.closest('[data-proc-chips] .chip');
    if (chip) { chip.classList.toggle('on'); return; }
    const sa = t.closest('[data-step-add]');
    if (sa) {
      const form = sa.closest('form');
      const data = readProc(form);
      data.steps.push({ s: '', n: '' });
      store.setMap('procedures', form.dataset.procForm, data);
      render();
      return;
    }
    const sd = t.closest('[data-step-del]');
    if (sd) {
      const form = sd.closest('form');
      const data = readProc(form);
      data.steps.splice(Number(sd.dataset.stepDel), 1);
      store.setMap('procedures', form.dataset.procForm, data);
      render();
      return;
    }
    const dp = t.closest('[data-doc-pick]');
    if (dp) { location.hash = `#/docs?u=${dp.dataset.docPick}`; return; }
    const rm = t.closest('[data-rec-month]');
    if (rm) {
      const n = Number(rm.dataset.recMonth);
      if (n === 0) ui.recMonth = todayStr().slice(0, 7);
      else { const [y, m] = ui.recMonth.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); ui.recMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
      render();
      return;
    }
    const rd = t.closest('[data-rec-day]');
    if (rd) { openRecDay(rd.dataset.recDay); return; }
    if (t.closest('[data-rec-auto]')) {
      const [y, m] = ui.recMonth.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      const master = store.list('recMaster');
      let n = 0;
      for (let d = 1; d <= last; d++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (store.getMap('rec', ds)) continue;
        const x = master[(d * 3) % master.length];
        store.setMap('rec', ds, { name: x.name, cat: x.cat, dur: x.dur, host: STAFF[d % STAFF.length].id });
        n++;
      }
      toast(n ? `空いている ${n} 日に入れました` : '空いている日はありません');
      render();
      return;
    }
    if (t.closest('[data-rec-clear]')) {
      if (!(await confirmDialog(`${ui.recMonth.replace('-', '年')}月のレクリエーションをすべて消しますか？`, '消す'))) return;
      Object.keys(store.db().rec).filter((k) => k.startsWith(ui.recMonth)).forEach((k) => delete store.db().rec[k]);
      store.save(); toast('消しました'); render();
      return;
    }
    const md = t.closest('[data-recm-del]');
    if (md) { store.list('recMaster').splice(Number(md.dataset.recmDel), 1); store.save(); render(); }
  });
  view.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!t.matches('[data-doc-q]')) return;
    const box = view.querySelector('[data-doc-list]');
    const q = t.value.trim();
    const hits = q ? MEMBERS.filter((m) => m.name.includes(q) || m.kana.includes(q)).sort(byKana) : [];
    box.hidden = !q;
    box.innerHTML = hits.length ? hits.map((m) => `<button type="button" data-doc-pick="${m.id}">${esc(m.name)} <small>${esc(m.kana)}</small></button>`).join('') : '<div class="none">該当する方がいません</div>';
  });
  view.addEventListener('submit', (ev) => {
    const f = ev.target;
    if (f.matches('[data-proc-form]')) { ev.preventDefault(); store.setMap('procedures', f.dataset.procForm, readProc(f)); toast('手順書を保存しました'); return; }
    if (f.matches('[data-recm-form]')) {
      ev.preventDefault();
      const name = f.name.value.trim();
      if (!name) return;
      store.list('recMaster').push({ name, cat: f.cat.value, dur: f.dur.value.trim() || '1時間' });
      store.save(); toast('種類を追加しました'); render();
    }
  });
}
