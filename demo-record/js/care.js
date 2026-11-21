// 介護記録の画面群：介護記録・1day介護記録・利用者別介護記録・過去記録・申し送り・経過記録。
import { MEMBERS, FILTER_TAGS, todayStr, addDays, mondayOf } from './data.js';
import * as store from './store.js';
import { esc, nowHM, toast, openModal, closeModal, confirmDialog, ui, deco, scriptTitle, plainTitle, subtabs, CARE_TABS, DAY_TABS, weekdayButtons, memberCards } from './ui.js';
import { member, staffName, membersOnWeekday, byKana, rosterFor } from './model.js';
import { cardsFor, dateBar, nameRow, menuBtn, setCurrent, noteTags } from './person.js';
import { faceSheetPaper, procedureSheet } from './docs.js';
import { vsDetail, weightDetail, waterIndiv, mealIndiv, exerciseIndiv } from './vitals.js';

const searchBox = (ph) => `<input class="search" type="search" data-search placeholder="🔍 ${ph}" value="${esc(ui.search)}">`;
const hitMembers = () => { const q = ui.search.trim(); return MEMBERS.filter((m) => !q || m.name.includes(q) || m.kana.includes(q)).sort(byKana); };

// =====================================================================
//  介護記録
// =====================================================================
export function renderCare(q) {
  const uid = q.get('u');
  const head = `${subtabs(CARE_TABS, '#/care')}${scriptTitle('Care Record', '介護記録', '利用者さんごとの記録（病態・ADL / VS / 食事 / 水分 / 体重 / 申し送り）を 1 画面で確認・入力・編集できます')}`;
  if (uid && member(uid)) {
    setCurrent(uid);
    return `${head}<a href="#/care" class="back-link no-print">← 利用者一覧へ</a>${dateBar(ui.date)}${cardsFor(uid, ui.date)}`;
  }
  const list = ui.search.trim() ? hitMembers() : membersOnWeekday(ui.weekday);
  return `${head}<section class="card">${deco}
    <p class="hint-top">曜日ごとの利用者さんです（通所、五十音順）。名前を押すと<b>介護記録</b>が開きます。 リストにない方はお名前で検索するか、プルダウンから選んでください。</p>
    ${weekdayButtons(ui.weekday)}
    <div class="search-row">${searchBox('お名前で検索（全利用者から）')}
      <select class="input round sel-big" data-jump-member="#/care?u=" aria-label="一覧から選ぶ"><option value="">▼ 一覧から選ぶ（${MEMBERS.length}名）</option>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
    <p class="group-l">通所</p>
    ${memberCards(list, (m) => `#/care?u=${m.id}`)}
  </section>`;
}

// =====================================================================
//  1day介護記録
// =====================================================================
export function renderOneDay(q) {
  const date = ui.date;
  const roster = rosterFor(date);
  let uid = q.get('u');
  if (!roster.some((m) => m.id === uid)) uid = uid && member(uid) ? uid : roster[0]?.id;
  const head = `${subtabs(DAY_TABS, '#/oneday')}${scriptTitle('1 day', '1day介護記録', 'その日の利用者さんの介護記録をタブで切り替えて確認できます')}`;
  const top = `${dateBar(date, { withName: false })}
    <div class="od-tabs no-print"><span class="od-tab on">通所 <small>${roster.length}</small></span><span class="od-tab">訪問 <small>0</small></span></div>
    <section class="card od-members no-print"><div class="chips">${roster.map((m) => `<a class="chip ${m.id === uid ? 'on' : ''}" href="#/oneday?u=${m.id}">${esc(m.name)}</a>`).join('') || '<span class="empty">この日の通所予定はありません</span>'}</div></section>`;
  if (!uid) return head + top;
  setCurrent(uid);
  return `${head}${top}
    <section class="card p-card">${deco}<div class="od-person"><span class="sp"></span><button type="button" class="btn sm no-print" data-p-print>🖨 印刷</button>${menuBtn()}</div>${nameRow(uid)}</section>
    ${cardsFor(uid, date)}`;
}

// =====================================================================
//  利用者別介護記録
// =====================================================================
const PERSON_TABS = [
  ['sheet', 'フェイスシート'], ['record', '介護記録'], ['weight', '体重管理'], ['water', '水分バランス'], ['vs', 'VS経過表'],
  ['meal', '食事摂取量'], ['ex', '運動'], ['medical', '受診付き添い'], ['day', '通所手順書'], ['bath', '入浴手順書'], ['visit', '訪問手順書'], ['transport', '送迎手順書'],
];
export function renderPerson(q) {
  const uid = q.get('u');
  const head = `${subtabs(CARE_TABS, '#/person')}${scriptTitle('Personal', '利用者別介護記録', '利用者さんを選ぶと、フェイスシート・介護記録・体重管理・水分バランス・VS経過表・食事摂取量をタブで見られます')}`;
  const m = uid && member(uid);
  if (!m) {
    const list = hitMembers();
    return `${head}<section class="card">${deco}
      <p class="hint-top">利用者さんを選ぶと、その方の記録のページが開きます。リストにない方はお名前で検索してください。</p>
      ${searchBox('お名前で検索（通所・訪問の全利用者から）')}
      <div class="chips mb12"><span class="chip on">通所</span><button type="button" class="chip" data-toast="訪問の利用者はこのデモにはいません">訪問</button></div>
      <div class="member-grid">${list.map((x) => `<a class="member-btn" href="#/person?u=${x.id}">${esc(x.name)}<span class="kana">${esc(x.kana)}</span></a>`).join('') || '<p class="empty">該当する方がいません。</p>'}</div>
    </section>`;
  }
  setCurrent(uid);
  const tab = PERSON_TABS.some(([k]) => k === q.get('tab')) ? q.get('tab') : 'sheet';
  let body = '';
  if (tab === 'sheet') body = `<p class="small-lead">表示のみです。編集・印刷は ${'<a class="p-link" href="#/facesheet?u=' + uid + '">フェイスシートのページ</a>'} から行えます。</p>${faceSheetPaper(uid)}`;
  else if (tab === 'record') body = dateBar(ui.date) + cardsFor(uid, ui.date);
  else if (tab === 'weight') body = weightDetail(uid);
  else if (tab === 'water') body = waterIndiv(uid);
  else if (tab === 'vs') body = vsDetail(uid);
  else if (tab === 'meal') body = mealIndiv(uid);
  else if (tab === 'ex') body = exerciseIndiv(uid);
  else body = procedureSheet(tab, uid, true);
  return `${head}
    <div class="p-who"><a href="#/person" class="back-link no-print">← 利用者一覧へ</a><strong>${esc(m.name)}</strong><span class="unit">（${esc(m.kana)}）</span></div>
    <div class="p-tabs no-print" role="tablist">${PERSON_TABS.map(([k, l]) => `<a role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" href="#/person?u=${uid}&tab=${k}">${l}</a>`).join('')}</div>
    ${body}`;
}

// =====================================================================
//  過去記録
// =====================================================================
const TAG_CLS = { 通所: 'g', 申し送り: 'o', 医療: 'b', 家族連絡: 'v', 訪問: 'n', 訪問介護: 'n', 訪問看護: 'n' };
export function renderPast() {
  const today = todayStr();
  const ranges = { today: [today, today], yday: [addDays(today, -1), addDays(today, -1)], week: [mondayOf(today), today] };
  const [from, to] = ui.pastRange === 'custom' ? [ui.pastFrom || addDays(today, -6), ui.pastTo || today] : ranges[ui.pastRange];
  const uncls = ui.pastMode === 'uncls';
  let list = store.list('notes').filter((n) => n.date >= from && n.date <= to);
  if (uncls) list = store.list('notes').filter((n) => !(n.tags || []).some((t) => t !== '記録'));
  if (ui.pastTag !== 'all') list = list.filter((n) => noteTags(n).includes(ui.pastTag));
  if (ui.pastUser) list = list.filter((n) => n.uid === ui.pastUser);
  if (ui.pastQ) list = list.filter((n) => n.text.includes(ui.pastQ) || member(n.uid)?.name.includes(ui.pastQ));
  if (ui.pastLevel) list = list.filter((n) => (n.level || 1) >= Number(ui.pastLevel));
  list = list.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return `${subtabs(CARE_TABS, '#/past')}${plainTitle('過去記録')}
  <div class="seg2"><button type="button" class="btn ${uncls ? '' : 'pink'}" data-past-mode="">直近の記録</button><button type="button" class="btn ${uncls ? 'pink' : ''}" data-past-mode="uncls">未分類</button></div>
  <section class="card">
    <label class="f-label">利用者検索</label>
    <select class="input round mb10" data-past-user aria-label="利用者で絞り込み"><option value="">利用者で絞り込み (任意)</option>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}" ${ui.pastUser === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
    <form class="search-row" data-past-search><input class="input round" name="q" value="${esc(ui.pastQ)}" placeholder="内容・利用者名で検索"><button class="btn pink" type="submit">検索</button></form>
    <div class="row mt10"><span class="f-inline">期間:</span>${[['today', '今日'], ['yday', '昨日'], ['week', '今週']].map(([k, l]) => `<button type="button" class="chip ${ui.pastRange === k ? 'on' : ''}" data-past-range="${k}">${l}</button>`).join('')}
      <input type="date" class="input round w-date" data-past-from value="${ui.pastRange === 'custom' ? from : ''}" aria-label="開始日"> 〜 <input type="date" class="input round w-date" data-past-to value="${ui.pastRange === 'custom' ? to : ''}" aria-label="終了日"></div>
    <div class="row mt10"><button type="button" class="chip ${ui.pastTag === 'all' ? 'on' : ''}" data-past-tag="all">すべて</button>${FILTER_TAGS.map((t) => `<button type="button" class="chip tagc-${TAG_CLS[t] || 'n'} ${ui.pastTag === t ? 'on' : ''}" data-past-tag="${t}">${t}</button>`).join('')}</div>
    <div class="row mt10"><span class="f-inline">重要度:</span><select class="input round w-sel" data-past-level>${[['', '指定なし'], ['2', '★★ 以上'], ['3', '★★★']].map(([v, l]) => `<option value="${v}" ${String(ui.pastLevel || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="btn" data-past-refresh>更新</button><button type="button" class="btn" data-print>この利用者の記録を印刷</button></div>
  </section>
  ${list.map((n) => {
    const tags = noteTags(n).filter((t) => t !== '記録');
    return `<article class="past-card"><div class="pc-meta">${n.date} ${n.time} | ${esc(member(n.uid)?.name || '')} <span class="stars">${'★'.repeat(n.level || 1)}</span></div>
      <div class="pc-tags">${tags.map((t) => `<span class="ptag tagc-${TAG_CLS[t] || 'n'}">${t === '申し送り' ? '申送' : t}</span>`).join('')}</div>
      <div class="pc-text">${esc(n.text)}</div></article>`;
  }).join('') || `<section class="card"><p class="empty center">${uncls ? '未分類の記録はありません' : 'この条件の記録はありません'}</p></section>`}`;
}

// =====================================================================
//  申し送り
// =====================================================================
export function renderHandover() {
  const date = ui.hoDate || todayStr();
  const list = store.list('notes').filter((n) => n.date === date && noteTags(n).includes('申し送り')).sort((a, b) => a.time.localeCompare(b.time));
  const groups = new Map();
  list.forEach((h) => { if (!groups.has(h.uid)) groups.set(h.uid, []); groups.get(h.uid).push(h); });
  return `${plainTitle('申し送り', '', `<div class="row"><input type="date" class="input round w-date" data-ho-date value="${date}" max="${todayStr()}" aria-label="対象日"><button type="button" class="btn" data-ho-day="0">今日</button><button type="button" class="btn" data-ho-day="-1">昨日</button><button type="button" class="btn" data-ho-reload>再読込</button></div>`)}
  <p class="lead"><b>${date}</b> ぶんの申し送りです (当日ぶん)。日付は作成した日ではなく<b>対象日</b>です。<br>個人記録のうち「申し送り」付きの内容を利用者ごとにまとめて表示します。 この画面から本文の編集・新規追加・削除もできます。</p>
  <div class="note-box-soft">記録アプリに入った分から集めています。</div>
  <div class="row mb12"><button type="button" class="btn" data-ho-copy>本文コピー</button><button type="button" class="btn" data-print>印刷</button><button type="button" class="btn" data-toast="PDF 出力はデモ版では動きません">PDF 出力</button><button type="button" class="btn pink" data-toast="文書ファイルへの出力はデモ版では動きません">ドキュメント出力</button></div>
  <section class="ho-add">
    <h3 class="h3">申し送りを追加</h3>
    <form class="ho-form" data-ho-form>
      <select class="input round" name="uid" aria-label="利用者名" required><option value="">利用者名</option>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
      <textarea class="input sq" name="text" placeholder="申し送り内容" rows="3"></textarea>
      <button class="btn pink" type="submit">追加</button>
    </form>
  </section>
  <h3 class="h3">申し送り</h3>
  ${[...groups.entries()].map(([uid, items]) => `<div class="ho-group"><h4>${esc(member(uid)?.name || '')} 様</h4><ul>${items.map((h) => `<li><span>${esc(h.text)}</span> <button type="button" class="btn xs" data-ho-edit="${h.id}">編集</button><button type="button" class="btn xs red" data-ho-del="${h.id}">削除</button></li>`).join('')}</ul></div>`).join('') || '<p class="empty">この日の申し送りはありません。</p>'}
  <p class="muted-p">申し送り件数: ${list.length} 件</p>`;
}

// =====================================================================
//  経過記録
// =====================================================================
export function renderKeika(q) {
  const uid = q.get('u');
  const m = uid && member(uid);
  const head = plainTitle('経過記録', '支援経過・担当者会議録・電話連絡などを利用者ごとに時系列で残します。 登録した本文は編集できません。訂正・補足は「追記」として残してください。');
  const picker = `<section class="card"><label class="f-label">利用者検索 <span class="req">*</span></label>
    <div class="suggest-wrap"><input class="input round" data-keika-q placeholder="氏名・ふりがなで検索" value="${m ? esc(m.name) : ''}" autocomplete="off"><div class="suggest" data-keika-list hidden></div></div></section>`;
  if (!m) return head + picker;
  const list = store.list('progress').filter((p) => p.uid === uid).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return `${head}${picker}
  <section class="card">${deco}
    <h3 class="h3">${esc(m.name)} 様　経過記録を追加</h3>
    <form class="keika-form" data-keika-form>
      <div class="row"><input type="date" class="input round w-date" name="date" value="${todayStr()}" max="${todayStr()}"><input type="time" class="input round w-time" name="time" value="${nowHM()}">
      <select class="input round w-sel" name="kind">${['支援経過', '電話連絡', '担当者会議', '訪問', 'その他'].map((k) => `<option>${k}</option>`).join('')}</select></div>
      <textarea class="input sq mt8" name="text" rows="3" placeholder="内容"></textarea>
      <div class="row mt8"><span class="sp"></span><button class="btn pink" type="submit">登録する</button></div>
    </form>
  </section>
  ${list.map((p) => `<article class="past-card"><div class="pc-meta">${p.date} ${p.time} | <span class="ptag tagc-n">${esc(p.kind)}</span> 記録: ${esc(staffName(p.staff))}</div>
    <div class="pc-text">${esc(p.text)}</div>
    ${p.addenda.map((a) => `<div class="addendum">追記 ${a.date} ${a.time}（${esc(staffName(a.staff))}）: ${esc(a.text)}</div>`).join('')}
    <div class="row mt8"><button type="button" class="btn xs" data-keika-add="${p.id}">追記</button></div></article>`).join('') || '<section class="card"><p class="empty center">まだ経過記録はありません</p></section>'}`;
}

// =====================================================================
//  イベント
// =====================================================================
let rerender = () => {};
export function initCare(view, render) {
  rerender = render;
  view.addEventListener('click', async (ev) => {
    const t = ev.target;
    const pm = t.closest('[data-past-mode]');
    if (pm) { ui.pastMode = pm.dataset.pastMode; render(); return; }
    const pr = t.closest('[data-past-range]');
    if (pr) { ui.pastRange = pr.dataset.pastRange; render(); return; }
    const pt = t.closest('[data-past-tag]');
    if (pt) { ui.pastTag = pt.dataset.pastTag; render(); return; }
    if (t.closest('[data-past-refresh]')) { render(); toast('更新しました'); return; }
    const hd = t.closest('[data-ho-day]');
    if (hd) { ui.hoDate = addDays(todayStr(), Number(hd.dataset.hoDay)); render(); return; }
    if (t.closest('[data-ho-reload]')) { render(); toast('再読込しました'); return; }
    if (t.closest('[data-ho-copy]')) {
      const date = ui.hoDate || todayStr();
      const txt = store.list('notes').filter((n) => n.date === date && noteTags(n).includes('申し送り')).map((n) => `${member(n.uid)?.name} 様: ${n.text}`).join('\n');
      try { await navigator.clipboard.writeText(txt); toast('本文をコピーしました'); } catch { toast('コピーできませんでした'); }
      return;
    }
    const he = t.closest('[data-ho-edit]');
    if (he) {
      const n = store.find('notes', he.dataset.hoEdit);
      openModal(`<form class="modal" novalidate><div class="modal-head"><div class="n">申し送りを編集</div><div class="s">${esc(member(n.uid).name)} 様</div></div>
        <label class="f-col"><span>内容</span><textarea class="input sq" name="text" rows="4" data-autofocus>${esc(n.text)}</textarea></label>
        <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button class="btn grad" type="submit">保存</button></div></form>`, (form) => {
        form.addEventListener('submit', (e2) => { e2.preventDefault(); const v = form.text.value.trim(); if (!v) return; store.update('notes', n.id, { text: v }); closeModal(); toast('保存しました'); render(); });
      });
      return;
    }
    const hdl = t.closest('[data-ho-del]');
    if (hdl) {
      if (await confirmDialog('この申し送りを削除しますか？', '削除')) { store.remove('notes', hdl.dataset.hoDel); toast('削除しました'); render(); }
      return;
    }
    const kp = t.closest('[data-keika-pick]');
    if (kp) { location.hash = `#/keika?u=${kp.dataset.keikaPick}`; return; }
    const ka = t.closest('[data-keika-add]');
    if (ka) {
      openModal(`<form class="modal" novalidate><div class="modal-head"><div class="n">追記</div><div class="s">本文は変えずに、訂正・補足を追記として残します</div></div>
        <label class="f-col"><span>追記の内容</span><textarea class="input sq" name="text" rows="3" data-autofocus></textarea></label>
        <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button class="btn grad" type="submit">追記する</button></div></form>`, (form) => {
        form.addEventListener('submit', (e2) => {
          e2.preventDefault();
          const v = form.text.value.trim(); if (!v) return;
          const p = store.find('progress', ka.dataset.keikaAdd);
          store.update('progress', p.id, { addenda: [...p.addenda, { date: todayStr(), time: nowHM(), text: v, staff: store.getMe() }] });
          closeModal(); toast('追記しました'); render();
        });
      });
    }
  });
  view.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-jump-member]') && t.value) { location.hash = t.dataset.jumpMember + t.value; return; }
    if (t.matches('[data-past-user]')) { ui.pastUser = t.value; render(); return; }
    if (t.matches('[data-past-level]')) { ui.pastLevel = t.value; render(); return; }
    if (t.matches('[data-past-from], [data-past-to]')) {
      const f = view.querySelector('[data-past-from]').value; const to = view.querySelector('[data-past-to]').value;
      if (f && to) { ui.pastRange = 'custom'; ui.pastFrom = f <= to ? f : to; ui.pastTo = f <= to ? to : f; render(); }
      return;
    }
    if (t.matches('[data-ho-date]') && t.value) { ui.hoDate = t.value; render(); }
  });
  view.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!t.matches('[data-keika-q]')) return;
    const box = view.querySelector('[data-keika-list]');
    const q = t.value.trim();
    const hits = q ? MEMBERS.filter((m) => m.name.includes(q) || m.kana.includes(q)).sort(byKana) : [];
    box.hidden = !q;
    box.innerHTML = hits.length ? hits.map((m) => `<button type="button" data-keika-pick="${m.id}">${esc(m.name)} <small>${esc(m.kana)}</small></button>`).join('') : '<div class="none">該当する方がいません</div>';
  });
  view.addEventListener('submit', (ev) => {
    const f = ev.target;
    if (f.matches('[data-past-search]')) { ev.preventDefault(); ui.pastQ = f.q.value.trim(); render(); return; }
    if (f.matches('[data-ho-form]')) {
      ev.preventDefault();
      const text = f.text.value.trim();
      if (!f.uid.value || !text) { toast('利用者名と内容を入れてください'); return; }
      store.add('notes', { uid: f.uid.value, date: ui.hoDate || todayStr(), time: nowHM(), text, tags: ['申し送り'], level: 1, staff: store.getMe() });
      toast('申し送りを追加しました'); render(); return;
    }
    if (f.matches('[data-keika-form]')) {
      ev.preventDefault();
      const text = f.text.value.trim();
      if (!text) { toast('内容を入れてください'); return; }
      const uid = new URLSearchParams(location.hash.split('?')[1]).get('u');
      store.add('progress', { uid, date: f.date.value || todayStr(), time: f.time.value || nowHM(), kind: f.kind.value, text, staff: store.getMe(), addenda: [] });
      toast('経過記録を登録しました'); render();
    }
  });
}
