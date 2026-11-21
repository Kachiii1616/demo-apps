// そのほかの画面：ホーム・利用者情報・予定・その他（メモ箱など）・通所ページの残りのタブ。
import { FACILITY, MEMBERS, STAFF, WD, WEEK_ORDER, LEVELS, JIHI_ITEMS, EXERCISES, todayStr, addDays, weekdayOf, mondayOf, staffOn, SHIFT_TIMES } from './data.js';
import * as store from './store.js';
import { esc, jpDate, md, nowHM, toast, openModal, closeModal, confirmDialog, ui, deco, scriptTitle, plainTitle, subtabs, DAY_TABS, MEMBER_TABS, dateNav, ageOf } from './ui.js';
import { member, byKana, rosterFor, membersOnWeekday, dayStatus, mealOf, waterTotal, excrOf, weightOn, weekdayLabelOf, bathLabelOf, needOf } from './model.js';
import { openVsForm, setCurrent } from './person.js';
import { commitRow } from './day.js';

const TAGS = ['記録', '申し送り', '通所', '医療', '家族連絡'];
const TEMPLATES = ['昼食は全量摂取。', '入浴実施。皮膚状態に異常なし。', '集団体操に参加。', 'トイレ誘導にて排尿あり。', '午後はレクリエーションに参加され、笑顔が見られた。'];

// =====================================================================
//  ホーム（記録アシスタント）
// =====================================================================
export function renderHome() {
  const uid = ui.homeUid;
  const tags = ui.homeTags || ['記録'];
  return `<div class="home">
    <h1 class="home-ttl">${esc(FACILITY.name)} 記録アシスタント</h1>
    <label class="f-label" for="home-q">利用者検索</label>
    <div class="suggest-wrap mb12"><input id="home-q" class="input round lg" data-home-q placeholder="利用者を指定 (未指定なら AI が判定)" value="${uid ? esc(member(uid).name) : ''}" autocomplete="off"><div class="suggest" data-home-list hidden></div></div>
    <section class="card home-card">
      <button type="button" class="mic" data-toast="音声入力はデモ版では動きません。下の欄に直接入力してください" aria-label="音声入力">🎤</button>
      <p class="mic-l">マイクを押すか、直接入力してください</p>
      <textarea class="input sq lg" data-home-text rows="4" placeholder="（例）\n青木さん、昼食全量摂取。サチュレーション98。">${esc(ui.homeText || '')}</textarea>
      <button type="button" class="toggle-l" data-home-more>${ui.homeMore ? '▲ AI要約・定型文・重要度を隠す' : '▼ AI要約・定型文・重要度'}</button>
      ${ui.homeMore ? `<div class="row mb10"><button type="button" class="btn" data-toast="AI 要約はデモ版では動きません">AI 要約</button><button type="button" class="btn xs" data-home-tpl>定型文</button><span class="f-inline">重要度:</span><select class="input round w-xs" data-home-level>${[0, 1, 2, 3].map((n) => `<option ${Number(ui.homeLevel || 0) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` : ''}
      <div class="chips mb10">${TAGS.map((t) => `<button type="button" class="chip tagpick ${tags.includes(t) ? 'on' : ''}" data-home-tag="${t}">${t}</button>`).join('')}</div>
      <label class="check-center"><input type="checkbox" data-home-raw ${ui.homeRaw ? 'checked' : ''}> 原文のまま保存（利用者指定時のみ）</label>
      <button type="button" class="btn green-big" data-home-save>記録を作成・保存</button>
    </section>
    <section class="card home-card">
      <h2 class="h3">AI に質問</h2>
      <p class="muted-p">事業所全体の記録を踏まえて回答します。</p>
      <textarea class="input sq lg" rows="3" placeholder="例: 直近1週間の睡眠状況は?"></textarea>
      <div class="row mt10"><span class="sp"></span><button type="button" class="btn pink" data-toast="AI への質問はデモ版では動きません">質問する</button></div>
    </section>
    <details class="quick" ${ui.homeQuick ? 'open' : ''} data-home-quick><summary><b>クイック記録</b><span class="muted small">ボタンから素早く記録します。利用者を選んでから操作してください。</span></summary></details>
    ${ui.homeQuick ? `<div class="quick-btns">${['体温', '血圧', '脈拍', 'SpO2', '入浴', '排尿', '排便', '服薬', '処置', 'リハビリ'].map((b) => `<button type="button" class="btn quick-b" data-quick="${b}">${b}</button>`).join('')}</div>` : ''}
  </div>`;
}

// =====================================================================
//  新規相談受付
// =====================================================================
const radios = (name, opts, v) => `<div class="radios">${opts.map((o) => `<label><input type="radio" name="${name}" value="${o}" ${v === o ? 'checked' : ''}> ${o}</label>`).join('')}</div>`;
export function renderConsult(q) {
  const tab = q.get('tab') === 'list' ? 'list' : 'new';
  const list = store.list('consults');
  const head = `${plainTitle('新規相談受付', '新規相談を紙の「新規相談受付票」と同じ項目で記録します。利用開始の登録 (利用サービス・フェイスシート) は <a class="p-link" href="#/intake">新規受付</a> から行います。')}
    <div class="seg2"><a class="btn ${tab === 'new' ? 'pink' : ''}" href="#/consult">新規相談を受け付ける</a><a class="btn ${tab === 'list' ? 'pink' : ''}" href="#/consult?tab=list">受付一覧 (${list.length})</a></div>`;
  if (tab === 'list') {
    return `${head}<section class="card">${list.length ? `<div class="grid-table-wrap"><table class="grid-table left"><thead><tr><th>受付日</th><th>利用者名</th><th>相談元</th><th>相談内容</th><th>対応</th></tr></thead><tbody>${list.slice().reverse().map((c) => `<tr><td>${c.date}</td><td>${esc(c.name)}</td><td>${esc(c.from)}</td><td>${esc(c.text)}</td><td>${esc(c.res || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">まだ相談受付がありません。</p>'}</section>`;
  }
  const staffOpts = STAFF.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  return `${head}<form class="card form-card" data-consult-form>
    <h2 class="h3">新規相談受付票 (新規)</h2>
    <div class="fgrid">
      <label class="f-col"><span>受付日</span><input type="date" class="input round" name="date" value="${todayStr()}"></label>
      <label class="f-col"><span>担当 (予定) 者</span><select class="input round" name="assign">${staffOpts}</select></label>
      <label class="f-col"><span>受付者</span><select class="input round" name="by">${staffOpts}</select></label>
      <label class="f-col"><span>相談元</span><input class="input round" name="from" placeholder="例: 地域の相談窓口"></label>
    </div>
    <div class="f-col"><span>経過区分</span>${radios('route', ['新規在宅', '新規入院・入所中', '引き継ぎ'], '新規在宅')}</div>
    <h3 class="h4">利用者</h3>
    <div class="fgrid">
      <label class="f-col"><span>利用者名 (必須)</span><input class="input round" name="name" required></label>
      <div class="f-col"><span>性別</span>${radios('sex', ['男', '女'], '')}</div>
      <label class="f-col"><span>生年月日</span><input type="date" class="input round" name="birth"></label>
      <div class="f-col"><span>世帯状況</span>${radios('house', ['独居', '老老', '同居'], '')}</div>
      <label class="f-col"><span>住所</span><input class="input round" name="addr"></label>
      <label class="f-col"><span>電話番号</span><input class="input round" name="tel" placeholder="03-0000-0000"></label>
    </div>
    <h3 class="h4">家族等</h3>
    <div class="fgrid"><label class="f-col"><span>家族等氏名</span><input class="input round" name="fam"></label><label class="f-col"><span>続柄</span><input class="input round" name="rel"></label><label class="f-col"><span>連絡先</span><input class="input round" name="famTel"></label></div>
    <label class="f-col"><span>相談内容</span><textarea class="input sq" name="text" rows="3" placeholder="経過・現在状況・病状・ADL・本人家族の意向・今後の見通し"></textarea></label>
    <label class="f-col"><span>必要と思われるサービス</span><input class="input round" name="need"></label>
    <div class="f-col"><span>対応</span>${radios('res', ['依頼を受けた', 'お断りした'], '')}</div>
    <div class="row mt10"><span class="sp"></span><button type="reset" class="btn">入力をクリア</button><button type="submit" class="btn pink">受付票を保存</button></div>
  </form>`;
}

// =====================================================================
//  新規受付
// =====================================================================
export function renderIntake(q) {
  const tab = q.get('tab') === 'sheet' ? 'sheet' : 'svc';
  const list = store.list('intakes');
  const head = `${plainTitle('新規受付', '新しい利用者さんの利用開始を登録します。① 利用サービス で通所・訪問の曜日や送迎・入浴を、② フェイスシート で基本情報 (生年月日・性別・介護度・主疾患) を登録します。 相談の記録は <a class="p-link" href="#/consult">新規相談受付</a> へ。')}
    <div class="seg2"><a class="btn ${tab === 'svc' ? 'pink' : ''}" href="#/intake">① 利用サービス</a><a class="btn ${tab === 'sheet' ? 'pink' : ''}" href="#/intake?tab=sheet">② フェイスシート・基本情報</a></div>`;
  const listHtml = list.length ? `<section class="card"><h3 class="h3">受付済み（デモ版では利用者一覧には加わりません）</h3><ul class="plain-list">${list.map((x) => `<li><b>${esc(x.name)}</b> ${esc(x.kana || '')}　${esc(x.summary || '')}</li>`).join('')}</ul></section>` : '';
  if (tab === 'sheet') {
    return `${head}<form class="card form-card" data-intake-sheet>
      <p class="muted-p">① で登録した利用者さんの基本情報を入れます。</p>
      <div class="fgrid"><label class="f-col"><span>利用者名</span><input class="input round" name="name" required></label><label class="f-col"><span>生年月日</span><input type="date" class="input round" name="birth"></label>
      <div class="f-col"><span>性別</span>${radios('sex', ['男', '女'], '')}</div><label class="f-col"><span>介護度</span><select class="input round" name="level">${LEVELS.map((l) => `<option>${l}</option>`).join('')}</select></label>
      <label class="f-col"><span>主疾患</span><input class="input round" name="disease"></label></div>
      <div class="row mt10"><span class="sp"></span><button class="btn pink" type="submit">基本情報を保存</button></div></form>${listHtml}`;
  }
  return `${head}<form class="card form-card" data-intake-form>
    <p class="muted-p">新しく通い始める利用者さんを登録します。曜日ごとに使うサービス（訪問・送迎・入浴）を選んでから「利用者を登録する」を押してください。</p>
    <div class="fgrid"><label class="f-col"><span>利用者名</span><input class="input round" name="name" required></label><label class="f-col"><span>フリガナ（任意）</span><input class="input round" name="kana"></label></div>
    <label class="f-col"><span>住所（任意。送迎ルートの参考になります）</span><input class="input round" name="addr"></label>
    <h3 class="h4">曜日ごとのサービス</h3>
    <div class="grid-table-wrap"><table class="grid-table wk-svc"><thead><tr><th>曜日</th><th>通所</th><th>訪問</th><th>送迎</th><th>入浴</th></tr></thead>
    <tbody>${WEEK_ORDER.map((w) => `<tr><th>${WD[w]}</th>${['day', 'visit', 'pick', 'bath'].map((k) => `<td><input type="checkbox" name="${k}_${w}" aria-label="${WD[w]} ${k}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="row mt10"><span class="sp"></span><button class="btn pink" type="submit">利用者を登録する</button></div>
  </form>${listHtml}`;
}

// =====================================================================
//  利用者一覧
// =====================================================================
export function renderMembers(q, names = false) {
  if (names) {
    return `${subtabs(MEMBER_TABS, '#/members/names')}${plainTitle('名前の整理', '同じ方が別の表記（全角・半角スペース、旧字など）で二重に登録されていないかを確かめます。')}
      <section class="card"><p class="ok-line">✓ 表記ゆれの候補はありません（${MEMBERS.length} 名を確認しました）</p>
      <div class="grid-table-wrap"><table class="grid-table left"><thead><tr><th>氏名</th><th>ふりがな</th><th>状態</th></tr></thead><tbody>${MEMBERS.slice().sort(byKana).map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.kana)}</td><td class="muted">問題なし</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  const tab = q.get('tab') || 'list';
  const head = `${subtabs(MEMBER_TABS, '#/members')}${plainTitle('利用者一覧', 'この事業所の利用者を 1 つの表で確認できます。 フェイスシートなどの項目は「詳細」から、業務日誌の備考は「利用者備考入力」から直せます。', '<button type="button" class="btn ghost-pink csv" data-toast="CSV 取込はデモ版では動きません">⇩ CSV<br>取込</button>')}
    <div class="seg2"><a class="btn ${tab === 'list' ? 'pink' : ''}" href="#/members">利用者一覧</a><a class="btn ${tab === 'week' ? 'pink' : ''}" href="#/members?tab=week">曜日別利用者</a><a class="btn ${tab === 'temp' ? 'pink' : ''}" href="#/members?tab=temp">一時登録の整理</a></div>`;
  if (tab === 'week') {
    const tw = weekdayOf(todayStr());
    return `${head}${scriptTitle('Weekly', '曜日別利用者', '曜日ごとに通所する利用者さんです')}<section class="card"><div class="weekly-wrap"><table class="weekly"><thead><tr>${WEEK_ORDER.map((w) => `<th class="${w === tw ? 'today' : ''}">${WD[w]} <small>${membersOnWeekday(w).length}名</small></th>`).join('')}</tr></thead><tbody><tr>${WEEK_ORDER.map((w) => `<td class="${w === tw ? 'today' : ''}">${membersOnWeekday(w).map((m) => `<div>${esc(m.name)} <small>${m.level}</small></div>`).join('')}</td>`).join('')}</tr></tbody></table></div></section>`;
  }
  if (tab === 'temp') return `${head}<section class="card"><p class="empty center">一時登録の利用者はいません</p></section>`;
  return `${head}${scriptTitle('Users', '利用者一覧', '利用者さんの登録情報を一覧で確認し、「詳細」からその場で直せます')}
    <section class="card p-card">${deco}<div class="grid-table-wrap"><table class="grid-table left users-t">
      <thead><tr><th>氏名</th><th>性別</th><th>年齢</th><th>介護度</th><th>通所曜日</th><th>入浴</th><th>業務日誌備考</th><th></th></tr></thead>
      <tbody>${MEMBERS.slice().sort(byKana).map((m) => { const p = store.getProfile(m.id); return `<tr><td><b>${esc(m.name)}</b><br><small class="muted">${esc(m.kana)}</small></td><td>${p.sex}</td><td>${ageOf(p.birth)}</td><td>${esc(p.level)}</td><td>${weekdayLabelOf(m)}</td><td>${bathLabelOf(m) || '—'}</td><td class="small">${esc(store.getMap('remarks', m.id)?.text || '')}</td><td><a class="btn xs" href="#/facesheet?u=${m.id}">📋 詳細</a></td></tr>`; }).join('')}</tbody>
    </table></div></section>`;
}

// =====================================================================
//  施設カレンダー
// =====================================================================
function dayPills(ds, mode) {
  if (mode === 'off') {
    const items = store.list('changes').filter((c) => c.date === ds).map((c) => `<span class="cal-pill off"><i>臨</i>${esc(member(c.uid)?.name || '')} ${esc(c.kinds.join('・'))}</span>`);
    rosterFor(ds).filter((m) => store.getDay(ds, m.id).absent).forEach((m) => items.push(`<span class="cal-pill off"><i>休</i>${esc(m.name)}</span>`));
    return items.join('');
  }
  return staffOn(ds).map((s) => `<span class="cal-pill"><i>勤</i>${SHIFT_TIMES[STAFF.indexOf(s)]} ${esc(s.name)} <small>日勤</small></span>`).join('');
}
export function renderCalendar() {
  const view = ui.calView;
  const mode = ui.calMode || 'plan';
  const today = todayStr();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const base = ui.calDate || today;
  const [y, mo] = base.split('-').map(Number);
  let body = '';
  let label = `${y}年${mo}月`;
  if (view === 'month') {
    const first = new Date(y, mo - 1, 1);
    const cells = [];
    for (let i = 0; i < 42; i++) { const d = new Date(y, mo - 1, 1 - first.getDay() + i); if (i >= 35 && d.getMonth() !== mo - 1) break; cells.push(d); }
    body = `<div class="cal-grid">${WD.map((w, i) => `<div class="cal-wd ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</div>`).join('')}${cells.map((d) => { const ds = ymd(d); return `<div class="cal-day ${d.getMonth() !== mo - 1 ? 'other' : ''} ${ds === today ? 'today' : ''}"><span class="dn ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}">${d.getDate()}</span>${dayPills(ds, mode)}</div>`; }).join('')}</div>`;
  } else if (view === 'week') {
    const sun = addDays(base, -weekdayOf(base));
    label = `${md(sun)} 〜 ${md(addDays(sun, 6))}`;
    body = `<div class="cal-grid week">${[0, 1, 2, 3, 4, 5, 6].map((i) => { const ds = addDays(sun, i); return `<div class="cal-day tall ${ds === today ? 'today' : ''}"><span class="dn ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${WD[i]} ${md(ds)}</span>${dayPills(ds, mode)}</div>`; }).join('')}</div>`;
  } else {
    label = jpDate(base);
    body = `<div class="cal-dayview">${dayPills(base, mode) || '<p class="empty">予定はありません</p>'}<h4 class="h4">通所の利用者（${rosterFor(base).length}名）</h4><p>${rosterFor(base).map((m) => esc(m.name)).join('、')}</p></div>`;
  }
  return `${plainTitle('施設カレンダー', '出勤の予定・利用者さんの休みや臨時の変更を 1 つのカレンダーに重ねて表示します。「利用者変更連絡」で入れた変更もここに出ます。')}
  <div class="cal-bar">
    <div class="segd">${[['month', '月'], ['week', '週'], ['day', '日(時間)']].map(([k, l]) => `<button type="button" class="${view === k ? 'on' : ''}" data-cal-view="${k}">${l}</button>`).join('')}</div>
    <div class="segd">${[['plan', '予定'], ['off', '休み・臨時']].map(([k, l]) => `<button type="button" class="${mode === k ? 'on' : ''}" data-cal-mode="${k}">${l}</button>`).join('')}</div>
    <label class="f-inline"><input type="checkbox" data-toast="担当者別の表示はデモ版では動きません"> 担当者別</label>
    <span class="sp"></span>
    <button type="button" class="btn sm" data-cal-step="-1">‹ 前</button><button type="button" class="btn sm" data-cal-step="0">今日</button><button type="button" class="btn sm" data-cal-step="1">次 ›</button><b class="month-l">${label}</b>
  </div>
  <div class="row mb10 legend-row"><span><span class="rec-dot"></span>${esc(FACILITY.name)}</span><span class="lg-i">勤</span>シフト<span class="lg-i off">臨</span>臨時・休み</div>
  <section class="card cal-card">${body}</section>`;
}

// =====================================================================
//  週間予定表
// =====================================================================
export function renderWeekly() {
  const start = ui.weeklyStart;
  const mode = ui.weeklyMode || 'day';
  const key = `${start}|${mode}`;
  const rows = store.getMap('weekly', key) || Array.from({ length: 13 }, () => Array(7).fill(''));
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
  const [sy, sm, sd] = start.split('-').map(Number);
  const end = days[6].split('-').map(Number);
  return `${plainTitle('週間予定表', '', `<div class="row"><input type="date" class="input round w-date" data-weekly-date value="${start}" aria-label="週を選ぶ"><button type="button" class="btn" data-weekly-step="0">今週</button><button type="button" class="btn" data-weekly-step="1">来週</button><button type="button" class="btn" data-weekly-reload>再読込</button></div>`)}
  <p class="lead">日付を選ぶとその週の月曜に揃えます。「利用者一覧から自動作成」は通所曜日・入浴予定を反映します。</p>
  <div class="row mb12"><div class="segd">${[['day', '通い'], ['bath', '入浴']].map(([k, l]) => `<button type="button" class="${mode === k ? 'on' : ''}" data-weekly-mode="${k}">${l}</button>`).join('')}</div>
    <button type="button" class="btn" data-weekly-auto>利用者一覧から自動作成</button><button type="button" class="btn pink" data-weekly-save>保存</button><button type="button" class="btn" data-toast="確定しました（デモ）">確定</button><button type="button" class="btn" data-print>印刷</button></div>
  <section class="card"><p class="cap"><b>週間予定表 (${mode === 'day' ? '通い' : '入浴'})</b>　${sy}年${sm}月${sd}日～${end[0]}年${end[1]}月${end[2]}日　${esc(FACILITY.name)}</p>
  <form data-weekly-form><div class="grid-table-wrap"><table class="grid-table weekly-in"><thead><tr><th>No</th>${days.map((d) => `<th>${WD[weekdayOf(d)]} (${md(d)})</th>`).join('')}<th></th></tr></thead>
  <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${r.map((v, j) => `<td><input class="input sq cell-in" name="c${i}_${j}" value="${esc(v)}" aria-label="${i + 1}行 ${WD[weekdayOf(days[j])]}"></td>`).join('')}<td><button type="button" class="btn xs red-t" data-weekly-del="${i}">削除</button></td></tr>`).join('')}
  <tr class="sum-row"><td>計</td>${days.map((_, j) => `<td>${rows.filter((r) => r[j]).length}</td>`).join('')}<td></td></tr></tbody></table></div></form>
  <button type="button" class="btn sm mt8" data-weekly-add>行を追加</button></section>`;
}
function readWeekly(view) {
  const form = view.querySelector('[data-weekly-form]');
  const out = [];
  for (let i = 0; form.elements[`c${i}_0`]; i++) out.push([0, 1, 2, 3, 4, 5, 6].map((j) => form.elements[`c${i}_${j}`].value.trim()));
  return out;
}

// =====================================================================
//  メモ箱・確認待ち・LIFE
// =====================================================================
export function renderMemo() {
  const list = store.list('memos').filter((m) => m.staff === store.getMe());
  return `${plainTitle('今日のメモ箱', '音声・手入力・画像メモを、まとめて利用者別の記録案に整理します')}
  <div class="row mb12"><button type="button" class="btn pink" data-toast="AI 整理はデモ版では動きません">AI整理を実行（${list.length}件）</button><button type="button" class="btn" data-toast="音声メモはデモ版では動きません">音声メモ</button><button type="button" class="btn" data-toast="写真の読み取りはデモ版では動きません">メモ紙の写真</button><button type="button" class="btn" data-memo-add>メモ追加</button></div>
  <p class="note-box-soft">メモ箱の中身はまだ記録ではありません。AI整理を押すと記録案になり、確認待ちで内容を確かめて 「記録する」を押した時点で経過記録として登録されます。メモは自分だけに見えます。</p>
  ${list.length ? list.slice().reverse().map((m) => `<article class="past-card"><div class="pc-meta">${m.date} ${m.time}</div><div class="pc-text">${esc(m.text)}</div><div class="row mt8"><span class="sp"></span><button type="button" class="btn xs red-t" data-memo-del="${m.id}">削除</button></div></article>`).join('') : '<section class="card center-box"><p><b>メモはありません</b></p><p class="muted-p">音声または手入力で、最初のメモを追加してください。</p></section>'}`;
}
export function renderReview() {
  return `${plainTitle('確認待ち', 'AIが整えた記録案を確認し、登録先を選んで確定します')}
  <section class="card center-box"><p class="big-num">残り <b>0</b> 件</p><p><b>確認待ちはありません</b></p><p class="muted-p">メモ箱で「AI整理を実行」を押すと、記録案がここに並びます。</p></section>`;
}
const LIFE_ITEMS = ['食事', '移乗', '整容', 'トイレ動作', '入浴', '歩行', '階段昇降', '着替え', '排便コントロール', '排尿コントロール'];
export function renderLife(q) {
  const tab = q.get('tab') || 'input';
  const uid = q.get('u');
  const head = `${plainTitle('LIFE (科学的介護)', '評価 (ADL など) を入力し、合計点の推移を確認します。提出用ファイルの作成はデモ版では動きません。')}
    <div class="seg2"><a class="btn ${tab === 'input' ? 'pink' : ''}" href="#/life">評価入力</a><a class="btn ${tab === 'csv' ? 'pink' : ''}" href="#/life?tab=csv">提出 (CSV)</a><a class="btn ${tab === 'fb' ? 'pink' : ''}" href="#/life?tab=fb">フィードバック控え</a></div>`;
  if (tab === 'csv') return `${head}<section class="card"><p class="muted-p">評価を入力した利用者の提出ファイルを作ります。</p><button type="button" class="btn pink" data-toast="ファイル出力はデモ版では動きません">提出ファイルを作成</button></section>`;
  if (tab === 'fb') return `${head}<section class="card"><p class="empty center">フィードバックの控えはまだありません</p></section>`;
  const picker = `<section class="card"><label class="f-label">利用者検索</label><select class="input round" data-jump-member="#/life?u=" aria-label="利用者"><option value="">利用者を選ぶ</option>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}" ${m.id === uid ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
    ${uid ? '' : '<p class="muted-p mt8">利用者を選ぶと、評価の入力と過去の評価 (合計点の推移) が表示されます。</p>'}</section>`;
  if (!uid || !member(uid)) return head + picker;
  const hist = store.list('life').filter((x) => x.uid === uid).sort((a, b) => b.date.localeCompare(a.date));
  return `${head}${picker}<form class="card" data-life-form="${uid}"><h3 class="h3">${esc(member(uid).name)} 様　ADL の評価</h3>
    <div class="grid-table-wrap"><table class="grid-table left"><thead><tr><th>項目</th><th>評価</th></tr></thead><tbody>${LIFE_ITEMS.map((it, i) => `<tr><td>${it}</td><td><select class="input round w-sel" name="i${i}">${[['10', '自立'], ['5', '一部介助'], ['0', '全介助']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="row mt10"><span class="sp"></span><button type="submit" class="btn pink">評価を保存</button></div></form>
    <section class="card"><h3 class="h3">過去の評価</h3>${hist.length ? `<table class="grid-table left"><thead><tr><th>評価日</th><th>合計点</th></tr></thead><tbody>${hist.map((h) => `<tr><td>${h.date}</td><td><b>${h.total}</b> / 100</td></tr>`).join('')}</tbody></table>` : '<p class="empty">まだ評価はありません</p>'}</section>`;
}

// =====================================================================
//  業務日誌（文章のほう：表で確認・修正）
// =====================================================================
export function renderBDiary() {
  const date = ui.date;
  const rows = rosterFor(date);
  const sp = store.getMap('special', date, {}) || {};
  const inp = (name, v, cls = '') => `<input class="input sq bd-in ${cls}" name="${name}" value="${esc(v ?? '')}">`;
  return `${plainTitle('業務日誌', '', `<div class="row">${dateNav(date, { cls: 'inline' })}<button type="button" class="btn" data-bd-reload>再読込</button></div>`)}
  <p class="lead">個人記録 (到着バイタル・食事・入浴など) や通所の表で保存した内容が、この日誌に並びます。ここで直して「保存」すると個人記録にも反映されます。</p>
  <div class="row mb12"><button type="button" class="btn" data-bd-fill>通所予定者から行を補完</button><button type="button" class="btn pink" data-bd-save>保存</button><button type="button" class="btn" data-toast="確定しました（デモ）">確定</button><button type="button" class="btn" data-print>印刷</button><button type="button" class="btn" data-toast="PDF 出力はデモ版では動きません">PDF 出力</button></div>
  <p class="cap"><b>業務日誌</b>　${date} (${WD[weekdayOf(date)]}) ${esc(FACILITY.name)}</p>
  <section class="card"><form data-bd-form><div class="grid-table-wrap"><table class="grid-table bd-table"><thead><tr><th>No</th><th>利用者</th><th>体温</th><th>脈拍</th><th>血圧</th><th>SpO2</th><th>体重</th><th>食事(主・副)</th><th>おやつ</th><th>入浴</th><th>運動</th><th>備考</th><th>排尿(回数)</th><th>排便(回数)</th><th>飲水量</th></tr></thead>
  <tbody>${rows.map((m, i) => {
    const e = store.getDay(date, m.id);
    const lunch = mealOf(m.id, date, '昼食');
    const p = `r_${m.id}_`;
    return `<tr><td>${i + 1}</td><td class="nm">${esc(m.name)}</td><td>${inp(p + 'temp', e.temp)}</td><td>${inp(p + 'pulse', e.pulse)}</td><td>${inp(p + 'bp', e.bpHi ? `${e.bpHi}/${e.bpLo ?? ''}` : '')}</td><td>${inp(p + 'spo2', e.spo2)}</td><td>${inp(p + 'weight', weightOn(m.id, date)?.kg)}</td>
      <td class="ms"><span>主</span>${inp(p + 'mealMain', lunch?.main, 'xs')}<span>副</span>${inp(p + 'mealSide', lunch?.side, 'xs')}</td><td>${inp(p + 'snack', mealOf(m.id, date, 'おやつ')?.main, 'xs')}</td>
      <td>${inp(p + 'bath', e.bath)}</td><td>${inp(p + 'exercise', e.exercise)}</td><td>${inp(p + 'note', e.note, 'wide')}</td>
      <td>${inp(p + 'urine', excrOf(m.id, date, '尿').length || '', 'xs')}</td><td>${inp(p + 'stool', excrOf(m.id, date, '便').length || '', 'xs')}</td><td>${inp(p + 'water', waterTotal(m.id, date) || '', 'xs')}</td></tr>`;
  }).join('') || '<tr><td colspan="15" class="empty">この日の利用者はいません</td></tr>'}</tbody></table></div></form></section>
  <h3 class="h3">特記事項</h3>
  ${(sp.notes || []).length ? `<ul class="sp-notes">${sp.notes.map((n) => `<li><span class="tag-s">${esc(n.kind)}</span>${esc(n.text)}</li>`).join('')}</ul>` : ''}
  <form class="row" data-bd-special><input class="input round w-sel2" name="text" placeholder="項目名 (例: 朝訪問時)"><button class="btn" type="submit">項目を追加</button></form>`;
}
function saveBDiary(view) {
  const form = view.querySelector('[data-bd-form]');
  const date = ui.date;
  let n = 0;
  rosterFor(date).forEach((m) => {
    const g = (k) => form.elements[`r_${m.id}_${k}`]?.value.trim() ?? '';
    const numOr = (s) => (s === '' ? '' : Number(s));
    const [hi, lo] = g('bp') ? g('bp').split('/').map(Number) : ['', ''];
    const d = { temp: numOr(g('temp')), pulse: numOr(g('pulse')), bpHi: Number.isFinite(hi) ? hi : '', bpLo: Number.isFinite(lo) ? lo : '', spo2: numOr(g('spo2')), weight: numOr(g('weight')), mealMain: numOr(g('mealMain')), mealSide: numOr(g('mealSide')), snack: numOr(g('snack')), bath: g('bath'), exercise: g('exercise'), note: g('note'), urine: numOr(g('urine')) || 0, stool: numOr(g('stool')) || 0 };
    const w = numOr(g('water')) || 0;
    const cur = waterTotal(m.id, date);
    if (w > cur) d.waterAdd = w - cur;
    const e = store.getDay(date, m.id);
    const was = JSON.stringify([e.temp, e.pulse, e.bpHi, e.bpLo, e.spo2, weightOn(m.id, date)?.kg, mealOf(m.id, date, '昼食')?.main, mealOf(m.id, date, '昼食')?.side, mealOf(m.id, date, 'おやつ')?.main, e.bath, e.exercise, e.note, excrOf(m.id, date, '尿').length, excrOf(m.id, date, '便').length].map((x) => (x ?? '') === '' ? '' : String(x)));
    const now = JSON.stringify([d.temp, d.pulse, d.bpHi, d.bpLo, d.spo2, d.weight, d.mealMain, d.mealSide, d.snack, d.bath, d.exercise, d.note, d.urine, d.stool].map((x) => (x ?? '') === '' ? '' : String(x)));
    if (was === now && !d.waterAdd) return;
    if (!d.temp && !d.pulse && !d.bpHi && !d.spo2 && !e.temp) { delete d.temp; delete d.pulse; delete d.bpHi; delete d.bpLo; delete d.spo2; }
    store.setDraft(date, m.id, d);
    commitRow(date, m.id);
    n++;
  });
  return n;
}

// =====================================================================
//  ヘルプ・設定
// =====================================================================
export function renderHelp() {
  return `${plainTitle('利用ガイド')}
  <section class="card help"><h2 class="h3">デモ版について</h2>
    <p>これは通所介護の事業所で使う介護記録アプリのデモ版です。ログインは不要で、表示されている利用者・職員・事業所はすべて架空です。本物のアプリのコードは含まない、見た目と操作の流れを再現した別の実装です。</p>
    <h3 class="h4">できること</h3>
    <ul><li><b>通所 (業務日誌)</b>: 表のマスを押して、バイタル・食事・入浴・運動などを入力し、「保存」で記録になります。見出しを押すと全員まとめて入力できます。</li>
      <li><b>利用者別介護記録 / 介護記録 / 1day介護記録</b>: 利用者を選ぶと、病態・ADL、VS 経過表、食事、水分、体重をまとめて見られます。「＋ 記録」から追加できます。</li>
      <li><b>VS経過表・体重管理・水分バランス・食事摂取量</b>: 経過のグラフと表、曜日ごとの入力。</li>
      <li><b>申し送り・過去記録・経過記録・連絡帳・施設カレンダー</b>: 入力した内容がそのまま反映されます。</li></ul>
    <p>入力した内容は、このブラウザの中 (localStorage) にだけ保存されます。画面上部の「デモデータを初期状態に戻す」で最初の状態に戻せます。</p>
    <h3 class="h4">デモ版で動かないもの</h3>
    <ul><li>AI を使う機能 (要約・AI への質問・音声や写真の文字起こし)</li><li>PDF / 表計算 / 文書ファイルへの出力、ファイルの取り込み、写真の添付</li><li>ほかのシステムとの連携、事業所の切り替え</li></ul>
  </section>`;
}
const MENU_ITEMS = ['ホーム', 'メモ箱', '確認待ち', '施設カレンダー', '通所', 'LIFE', '新規相談受付', '新規受付', '業務日誌', '申し送り', '週間予定', '過去記録', '経過記録', 'ドキュメント', '利用者'];
export function renderSettings() {
  const st = store.db().settings || {};
  const hidden = st.hidden || [];
  return `${plainTitle('設定')}
  <section class="card"><h2 class="h3">メニュー表示設定 (${esc(FACILITY.name)})</h2>
    <p class="muted-p">この事業所で表示するメニューと、最初に開く画面 (トップ) を設定します。チェックを外したメニューは左のメニューに出なくなります。</p>
    <form data-settings-form><h3 class="h4">表示するメニュー</h3><div class="check-grid">${MENU_ITEMS.map((m) => `<label><input type="checkbox" name="show" value="${m}" ${hidden.includes(m) ? '' : 'checked'}> ${m}</label>`).join('')}<label><input type="checkbox" checked disabled> ヘルプ(常時)</label></div>
    <h3 class="h4">トップに表示する画面</h3><select class="input round w-sel2" name="top">${['ホーム', '通所', '介護記録', '申し送り', '施設カレンダー'].map((x) => `<option ${st.top === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <p class="muted-p small-p">ヘッダのロゴから開いたときに、この画面が最初に表示されます。</p>
    <div class="row mt10"><button class="btn pink" type="submit">保存する</button><button type="button" class="btn" data-settings-reset>既定に戻す</button></div></form>
  </section>
  <section class="card"><h2 class="h3">記録のフラグ</h2>
    <p class="muted-p">記録に付ける印です。「申し送り」だけが申し送り画面に出ます。それ以外は記録一覧の絞り込みに使います。</p>
    <div class="grid-table-wrap"><table class="grid-table"><thead><tr><th>名前</th><th>短縮</th><th>既定でON</th><th>申し送り</th><th>重要事項</th></tr></thead>
    <tbody>${[['記録', '記', true, false, false], ['申し送り', '申送', false, true, true], ['通所', '通', false, false, false], ['医療', '医', false, false, true], ['家族連絡', '家', false, false, false]].map(([n, s, a, b, c]) => `<tr><td>${n}</td><td>${s}</td><td>${a ? '✓' : ''}</td><td>${b ? '✓' : ''}</td><td>${c ? '✓' : ''}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

// =====================================================================
//  通所ページの残りのタブ
// =====================================================================
export function renderJihi() {
  const date = ui.date;
  const rows = rosterFor(date);
  return `${subtabs(DAY_TABS, '#/day/jihi')}${plainTitle('自費サービス記録', '宿泊代・弁当代・おむつ代などの自費サービスを、日にちごとに利用者ごとの回数で記録します。 (昼食・おやつ・夕食は食事摂取量の記録から数えるので、ここにはありません)。')}
  ${dateNav(date)}
  <section class="card"><form data-jihi-form><div class="grid-table-wrap"><table class="grid-table jihi"><thead><tr><th>利用者</th>${JIHI_ITEMS.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((m) => { const v = store.getMap('jihi', `${date}|${m.id}`, {}) || {}; return `<tr><td class="nm">${esc(m.name)}</td>${JIHI_ITEMS.map((x, i) => `<td><input class="input sq cell-in num" type="number" min="0" name="j_${m.id}_${i}" value="${v[x] ?? ''}" aria-label="${esc(m.name)} ${x}"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div></form>
  <div class="row mt10"><span class="muted-p">回数は日付ごとに保存されます。</span><span class="sp"></span><button type="button" class="btn pink" data-jihi-save>保存する</button></div></section>`;
}

export function renderContact() {
  const date = ui.date;
  const sp = store.getMap('special', date, {}) || {};
  const recName = sp.rec ?? store.getMap('rec', date)?.name ?? '';
  const att = rosterFor(date).filter((m) => dayStatus(date, m.id) === 'in');
  const marked = att.filter((m) => store.getDay(date, m.id).contactPrint);
  const box = (k, v) => `<div class="cb-box"><small>${k}</small><b>${v ?? ''}</b></div>`;
  const REHAB = EXERCISES;
  const MEDS = ['朝食後', '昼食前', '昼食後', '夕食後'];
  return `${subtabs(DAY_TABS, '#/day/contact')}
  ${scriptTitle('Contact Book', '連絡帳', '', `<button type="button" class="btn" data-cb-print>印刷 (${marked.length}名 / A4 1枚に4人)</button><button type="button" class="btn" data-cb-all="1">全員を印刷対象にする</button><button type="button" class="btn" data-cb-all="0">選択を解除</button>`)}
  ${dateNav(date)}
  <section class="card no-print"><div class="row"><b>レクリエーション（種目名）</b><input class="input round w-sel2" data-cb-rec value="${esc(recName)}" placeholder="例: 風船バレー"><button type="button" class="btn" data-cb-rec-save>保存</button><button type="button" class="btn sm" data-toast="音声入力はデモ版では動きません">🎤 音声入力</button></div>
    <p class="muted-p mt8">レクリエーションカレンダーのこの日の予定を自動で入れています。全員の連絡帳に同じ種目名が載ります。</p></section>
  ${att.length ? '' : '<section class="card"><p class="empty center">この日に通所中の方がいません（通所の表で VS を入れると通所中になります）</p></section>'}
  <div class="cb-grid">${att.map((m) => {
    const e = store.getDay(date, m.id);
    const c = store.getMap('contact', `${date}|${m.id}`, {}) || {};
    const ml = (k) => { const x = mealOf(m.id, date, k); return x ? (k === 'おやつ' ? `${x.main ?? ''}割` : `${x.main ?? '-'}/${x.side ?? '-'}`) : ''; };
    const bathYN = c.bathYN || (e.bath && e.bath !== '中止' ? '有' : '');
    return `<article class="cb-card ${e.contactPrint ? '' : 'print-off'}" data-cb-uid="${m.id}">
      <header><b>${esc(m.name)} 様</b><label class="no-print"><input type="checkbox" data-cb-mark="${m.id}" ${e.contactPrint ? 'checked' : ''}> 印刷する</label></header>
      <h5>バイタルサイン</h5><div class="cb-row4">${box('体温 (℃)', e.temp)}${box('脈拍 (回/分)', e.pulse)}${box('血圧 (mmHg)', e.bpHi ? `${e.bpHi}/${e.bpLo}` : '')}${box('SpO2 (%)', e.spo2)}</div>
      <h5>食事</h5><div class="cb-row3">${box('昼食', ml('昼食'))}${box('おやつ', ml('おやつ'))}${box('夕食', ml('夕食'))}</div>
      <div class="cb-row-mix"><div><h5>入浴</h5><div class="cb-yn">${['有', '無'].map((x) => `<button type="button" class="${bathYN === x ? 'on' : ''}" data-cb-bath="${x}">${x}</button>`).join('・')}</div></div>
        <div><h5>運動</h5>${box('', e.exercise ? `${e.exercise}${e.exMin ? ' ' + e.exMin : ''}` : '')}</div>
        <div><h5>体重 (kg)</h5>${box('', weightOn(m.id, date)?.kg)}</div><div><h5>身長 (cm)</h5>${box('', store.getProfile(m.id).height)}</div></div>
      <h5>リハビリ実施</h5><div class="cb-checks">${REHAB.map((r) => `<label><input type="checkbox" data-cb-rehab="${r}" ${(c.rehab || []).includes(r) ? 'checked' : ''}> ${r}</label>`).join('')}</div>
      <h5>服薬</h5><div class="cb-checks">${MEDS.map((r) => `<label><input type="checkbox" data-cb-med="${r}" ${(c.meds || []).includes(r) ? 'checked' : ''}> ${r}</label>`).join('')}</div>
      <h5>レクリエーション</h5>${box('', esc(recName))}
      <h5>スタッフより</h5><textarea class="input sq" data-cb-staff rows="3" placeholder="ご家族への連絡・本日のご様子など">${esc(c.staff || '')}</textarea>
      <div class="cb-print-text">${esc(c.staff || '')}</div>
      <button type="button" class="btn sm mt8 no-print" data-cb-save="${m.id}">スタッフよりを保存</button>
    </article>`;
  }).join('')}</div>`;
}

export function renderRemarks() {
  const rm = store.db().remarks || {};
  const list = MEMBERS.filter((m) => rm[m.id]).sort(byKana);
  return `${subtabs(DAY_TABS, '#/day/remarks')}${plainTitle('利用者備考入力', '', '<div class="row"><button type="button" class="btn" data-bd-reload>再読込</button><button type="button" class="btn pink" data-rm-edit="">＋ 新規</button></div>')}
  <p class="lead">ここで登録した備考は、通所の表の備考欄にそのまま出ます (印刷にも出ます)。 「全利用日」はその人が来る日はいつも、「曜日固定」は毎週その曜日、「日付指定」はその日だけ出ます。</p>
  <section class="card"><div class="grid-table-wrap"><table class="grid-table left"><thead><tr><th>利用者名</th><th>備考</th><th>適用</th><th>操作</th></tr></thead>
  <tbody>${list.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(rm[m.id].text)}</td><td>${esc(rm[m.id].mode)}</td><td class="acts"><button type="button" class="btn xs" data-rm-edit="${m.id}">編集</button><button type="button" class="btn xs red-t" data-rm-del="${m.id}">取消</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">備考はまだありません</td></tr>'}</tbody></table></div></section>`;
}

export function renderChanges() {
  const list = store.list('changes').slice().sort((a, b) => b.date.localeCompare(a.date));
  const KINDS = ['休み', '入浴なし', '送迎なし', '訪問なし', '入浴時間変更', '送迎時間変更', 'その他'];
  return `${subtabs(DAY_TABS, '#/day/changes')}${scriptTitle('User Change', '利用者変更連絡', '利用者さんの予定変更（休み・入浴・送迎・時間変更など）を連絡できます')}
  <form class="card form-card" data-chg-form>
    <p class="muted-p">利用者さんの休み・入浴/送迎/訪問の変更を登録します。「休み」は通所の表とカレンダーにそのまま反映されます。</p>
    <div class="fgrid"><label class="f-col"><span>日付</span><input type="date" class="input round" name="date" value="${todayStr()}"></label>
    <label class="f-col"><span>利用者名</span><select class="input round" name="uid"><option value="">選んでください</option>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label></div>
    <div class="f-col"><span>区分</span><div class="cb-checks">${KINDS.map((k) => `<label><input type="checkbox" name="kind" value="${k}"> ${k}</label>`).join('')}</div></div>
    <label class="f-col"><span>内容・メモ（時間変更などはこちらに）</span><textarea class="input sq" name="memo" rows="2"></textarea></label>
    <div class="row"><span class="sp"></span><button class="btn pink" type="submit">登録する</button></div>
  </form>
  <section class="card"><h3 class="h3">登録済みの変更</h3>${list.length ? `<ul class="plain-list">${list.map((c) => `<li><b>${jpDate(c.date, false)}</b> ${esc(member(c.uid)?.name || '')}　<span class="tag-s">${esc(c.kinds.join('・'))}</span> ${esc(c.memo || '')} <button type="button" class="btn xs red-t" data-chg-del="${c.id}">取消</button></li>`).join('')}</ul>` : '<p class="empty">変更連絡はありません</p>'}</section>`;
}

const ITEM_COLS = [['temp', '体温'], ['pulse', '脈拍'], ['bp', '血圧'], ['spo2', 'SpO2'], ['weight', '体重'], ['mealMain', '食事(主・副)'], ['snack', 'おやつ'], ['bath', '入浴'], ['exercise', '運動'], ['urine', '排尿(回数)'], ['stool', '排便(回数)'], ['water', '飲水量']];
export function renderItems() {
  return `${subtabs(DAY_TABS, '#/day/items')}${plainTitle('業務日誌必要項目', '', '<button type="button" class="btn" data-bd-reload>再読込</button>')}
  <p class="lead">利用者ごとに、業務日誌で記録する項目を選べます (チェック = 必要)。行の「確定」で保存します。 チェックを外した項目は「不要な項目 (×)」になり、通所の表の空のマスに × が出ます。</p>
  <section class="card"><div class="grid-table-wrap"><table class="grid-table items-t"><thead><tr><th>利用者名</th>${ITEM_COLS.map(([, l]) => `<th>${l}</th>`).join('')}<th></th></tr></thead>
  <tbody>${MEMBERS.slice().sort(byKana).map((m) => { const n = needOf(m.id); return `<tr data-item-row="${m.id}"><td class="nm">${esc(m.name)}</td>${ITEM_COLS.map(([k, l]) => `<td><input type="checkbox" data-item="${k}" ${n[k] === false ? '' : 'checked'} aria-label="${esc(m.name)} ${l}"></td>`).join('')}<td class="acts"><button type="button" class="btn xs" data-item-all="${m.id}">全て</button><button type="button" class="btn xs pink" data-item-save="${m.id}">確定</button></td></tr>`; }).join('')}</tbody></table></div></section>`;
}

// =====================================================================
//  イベント
// =====================================================================
let rerender = () => {};
function homeSuggest(view, q) {
  const box = view.querySelector('[data-home-list]');
  const hits = q ? MEMBERS.filter((m) => m.name.includes(q) || m.kana.includes(q)).sort(byKana) : [];
  box.hidden = !q;
  box.innerHTML = hits.length ? hits.map((m) => `<button type="button" data-home-pick="${m.id}">${esc(m.name)} <small>${esc(m.kana)}</small></button>`).join('') : '<div class="none">該当する方がいません</div>';
}
export function initMisc(view, render) {
  rerender = render;
  view.addEventListener('click', async (ev) => {
    const t = ev.target;
    // ---- ホーム ----
    const hp = t.closest('[data-home-pick]');
    if (hp) { ui.homeUid = hp.dataset.homePick; render(); return; }
    if (t.closest('[data-home-more]')) { ui.homeText = view.querySelector('[data-home-text]').value; ui.homeMore = !ui.homeMore; render(); return; }
    const ht = t.closest('[data-home-tag]');
    if (ht) {
      ui.homeText = view.querySelector('[data-home-text]').value;
      const cur = ui.homeTags || ['記録'];
      ui.homeTags = cur.includes(ht.dataset.homeTag) ? cur.filter((x) => x !== ht.dataset.homeTag) : [...cur, ht.dataset.homeTag];
      render(); return;
    }
    if (t.closest('[data-home-tpl]')) {
      openModal(`<div class="modal"><div class="modal-head"><div class="n">定型文</div><div class="s">押すと入力欄に足します</div></div><div class="tpl-list">${TEMPLATES.map((x, i) => `<button type="button" class="btn" data-tpl="${i}">${x}</button>`).join('')}</div><div class="modal-foot2"><button type="button" class="btn" data-close>閉じる</button></div></div>`, (box) => {
        box.addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (!b) return; ui.homeText = (view.querySelector('[data-home-text]').value + TEMPLATES[Number(b.dataset.tpl)]).trim(); closeModal(); render(); });
      });
      return;
    }
    if (t.closest('[data-home-save]')) {
      const text = view.querySelector('[data-home-text]').value.trim();
      if (!ui.homeUid) { toast('利用者を指定してください（デモ版では AI による利用者の判定は動きません）'); return; }
      if (!text) { toast('内容を入力してください'); return; }
      const tags = (ui.homeTags || ['記録']).slice();
      if (!tags.includes('記録') && !tags.includes('申し送り')) tags.unshift('記録');
      store.add('notes', { uid: ui.homeUid, date: todayStr(), time: nowHM(), text, tags, level: Math.max(1, Number(ui.homeLevel || 0)), staff: store.getMe() });
      ui.homeText = '';
      toast(`${member(ui.homeUid).name} さんの記録を保存しました（過去記録・介護記録に出ます）`);
      render(); return;
    }
    if (t.closest('summary') && t.closest('[data-home-quick]')) { ev.preventDefault(); ui.homeQuick = !ui.homeQuick; render(); return; }
    const qb = t.closest('[data-quick]');
    if (qb) {
      const uid = ui.homeUid;
      if (!uid) { toast('先に利用者を選んでください'); return; }
      const k = qb.dataset.quick;
      const me = store.getMe();
      if (['体温', '血圧', '脈拍', 'SpO2'].includes(k)) { setCurrent(uid); openVsForm(null, null, uid); return; }
      if (k === '排尿' || k === '排便') store.add('excr', { uid, date: todayStr(), time: nowHM(), type: k === '排尿' ? '尿' : '便', staff: me });
      else if (k === '入浴') store.setDay(todayStr(), uid, { bath: '一般浴' });
      else store.add('notes', { uid, date: todayStr(), time: nowHM(), text: `${k}を実施。`, tags: ['記録', '通所'], level: 1, staff: me });
      toast(`${member(uid).name} さん: ${k}を記録しました`);
      return;
    }
    // ---- 施設カレンダー ----
    const cv = t.closest('[data-cal-view]');
    if (cv) { ui.calView = cv.dataset.calView; render(); return; }
    const cm = t.closest('[data-cal-mode]');
    if (cm) { ui.calMode = cm.dataset.calMode; render(); return; }
    const cs = t.closest('[data-cal-step]');
    if (cs) {
      const n = Number(cs.dataset.calStep);
      const base = ui.calDate || todayStr();
      if (n === 0) ui.calDate = todayStr();
      else if (ui.calView === 'month') { const [y, m] = base.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); ui.calDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
      else ui.calDate = addDays(base, n * (ui.calView === 'week' ? 7 : 1));
      render(); return;
    }
    // ---- 週間予定 ----
    const wm = t.closest('[data-weekly-mode]');
    if (wm) { ui.weeklyMode = wm.dataset.weeklyMode; render(); return; }
    const ws = t.closest('[data-weekly-step]');
    if (ws) { ui.weeklyStart = addDays(mondayOf(todayStr()), Number(ws.dataset.weeklyStep) * 7); render(); return; }
    if (t.closest('[data-weekly-reload]')) { render(); toast('再読込しました'); return; }
    if (t.closest('[data-weekly-auto]')) {
      const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ui.weeklyStart, i));
      const cols = days.map((d) => membersOnWeekday(weekdayOf(d)).filter((m) => (ui.weeklyMode || 'day') === 'day' || m.bathDays.includes(weekdayOf(d))).map((m) => m.name));
      const n = Math.max(13, ...cols.map((c) => c.length));
      const rows = Array.from({ length: n }, (_, i) => cols.map((c) => c[i] || ''));
      store.setMap('weekly', `${ui.weeklyStart}|${ui.weeklyMode || 'day'}`, rows);
      toast('利用者一覧から作成しました'); render(); return;
    }
    if (t.closest('[data-weekly-save]')) { store.setMap('weekly', `${ui.weeklyStart}|${ui.weeklyMode || 'day'}`, readWeekly(view)); toast('保存しました'); render(); return; }
    if (t.closest('[data-weekly-add]')) { const rows = readWeekly(view); rows.push(Array(7).fill('')); store.setMap('weekly', `${ui.weeklyStart}|${ui.weeklyMode || 'day'}`, rows); render(); return; }
    const wd = t.closest('[data-weekly-del]');
    if (wd) { const rows = readWeekly(view); rows.splice(Number(wd.dataset.weeklyDel), 1); store.setMap('weekly', `${ui.weeklyStart}|${ui.weeklyMode || 'day'}`, rows); render(); return; }
    // ---- メモ箱 ----
    if (t.closest('[data-memo-add]')) {
      openModal(`<form class="modal" novalidate><div class="modal-head"><div class="n">メモ追加</div></div><label class="f-col"><span>メモ</span><textarea class="input sq" name="text" rows="4" data-autofocus placeholder="例: 青木さん 午後に足のむくみ"></textarea></label>
        <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button class="btn grad" type="submit">追加</button></div></form>`, (form) => {
        form.addEventListener('submit', (e) => { e.preventDefault(); const v = form.text.value.trim(); if (!v) return; store.add('memos', { text: v, date: todayStr(), time: nowHM(), staff: store.getMe() }); closeModal(); toast('メモを追加しました'); render(); });
      });
      return;
    }
    const mdl = t.closest('[data-memo-del]');
    if (mdl) { store.remove('memos', mdl.dataset.memoDel); render(); return; }
    // ---- 業務日誌 ----
    if (t.closest('[data-bd-reload]')) { render(); toast('再読込しました'); return; }
    if (t.closest('[data-bd-fill]')) { toast(`通所予定の ${rosterFor(ui.date).length} 名の行がそろっています`); return; }
    if (t.closest('[data-bd-save]')) { const n = saveBDiary(view); toast(n ? `${n} 名ぶんを保存しました` : '変更はありません'); render(); return; }
    // ---- 自費 ----
    if (t.closest('[data-jihi-save]')) {
      const form = view.querySelector('[data-jihi-form]');
      rosterFor(ui.date).forEach((m) => {
        const v = {};
        JIHI_ITEMS.forEach((x, i) => { const s = form.elements[`j_${m.id}_${i}`].value; if (s !== '' && Number(s) > 0) v[x] = Number(s); });
        store.setMap('jihi', `${ui.date}|${m.id}`, Object.keys(v).length ? v : null);
      });
      toast('自費サービスの回数を保存しました'); render(); return;
    }
    // ---- 連絡帳 ----
    const ca = t.closest('[data-cb-all]');
    if (ca) { rosterFor(ui.date).filter((m) => dayStatus(ui.date, m.id) === 'in').forEach((m) => store.setDay(ui.date, m.id, { contactPrint: ca.dataset.cbAll === '1' })); render(); return; }
    if (t.closest('[data-cb-print]')) {
      if (!view.querySelector('.cb-card:not(.print-off)')) { toast('「印刷する」にチェックした方がいません'); return; }
      document.body.classList.add('print-cb'); window.print(); setTimeout(() => document.body.classList.remove('print-cb'), 500); return;
    }
    if (t.closest('[data-cb-rec-save]')) { store.setMap('special', ui.date, { ...(store.getMap('special', ui.date, {}) || {}), rec: view.querySelector('[data-cb-rec]').value.trim() }); toast('レクリエーションを保存しました'); render(); return; }
    const cbb = t.closest('[data-cb-bath]');
    if (cbb) { cbb.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === cbb)); return; }
    const cbs = t.closest('[data-cb-save]');
    if (cbs) {
      const card = cbs.closest('.cb-card');
      const uid = cbs.dataset.cbSave;
      store.setMap('contact', `${ui.date}|${uid}`, {
        staff: card.querySelector('[data-cb-staff]').value,
        rehab: [...card.querySelectorAll('[data-cb-rehab]:checked')].map((x) => x.dataset.cbRehab),
        meds: [...card.querySelectorAll('[data-cb-med]:checked')].map((x) => x.dataset.cbMed),
        bathYN: card.querySelector('[data-cb-bath].on')?.dataset.cbBath || '',
      });
      toast(`${member(uid).name} 様の連絡帳を保存しました`); render(); return;
    }
    // ---- 利用者備考 ----
    const re = t.closest('[data-rm-edit]');
    if (re) {
      const uid = re.dataset.rmEdit;
      const cur = uid ? store.getMap('remarks', uid) : { text: '', mode: '全利用日' };
      openModal(`<form class="modal" novalidate><div class="modal-head"><div class="n">利用者備考</div></div>
        <label class="f-col"><span>利用者名</span><select class="input round" name="uid" ${uid ? 'disabled' : ''}>${MEMBERS.slice().sort(byKana).map((m) => `<option value="${m.id}" ${m.id === uid ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
        <label class="f-col"><span>備考</span><textarea class="input sq" name="text" rows="3" data-autofocus>${esc(cur.text)}</textarea></label>
        <label class="f-col"><span>適用</span><select class="input round" name="mode">${['全利用日', '曜日固定', '日付指定'].map((x) => `<option ${cur.mode === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <div class="modal-foot2"><button type="button" class="btn" data-close>キャンセル</button><button class="btn grad" type="submit">保存</button></div></form>`, (form) => {
        form.addEventListener('submit', (e) => { e.preventDefault(); const v = form.text.value.trim(); if (!v) { toast('備考を入れてください'); return; } store.setMap('remarks', uid || form.uid.value, { text: v, mode: form.mode.value }); closeModal(); toast('備考を保存しました'); render(); });
      });
      return;
    }
    const rd = t.closest('[data-rm-del]');
    if (rd) { if (await confirmDialog(`${member(rd.dataset.rmDel).name} さんの備考を取り消しますか？`)) { store.setMap('remarks', rd.dataset.rmDel, null); toast('取り消しました'); render(); } return; }
    // ---- 変更連絡 ----
    const cd = t.closest('[data-chg-del]');
    if (cd) { store.remove('changes', cd.dataset.chgDel); toast('取り消しました'); render(); return; }
    // ---- 必要項目 ----
    const ia = t.closest('[data-item-all]');
    if (ia) { view.querySelectorAll(`[data-item-row="${ia.dataset.itemAll}"] [data-item]`).forEach((c) => { c.checked = true; }); return; }
    const is = t.closest('[data-item-save]');
    if (is) {
      const uid = is.dataset.itemSave;
      const n = {};
      view.querySelectorAll(`[data-item-row="${uid}"] [data-item]`).forEach((c) => { if (!c.checked) n[c.dataset.item] = false; });
      store.setMap('need', uid, Object.keys(n).length ? n : null);
      toast(`${member(uid).name} さんの必要項目を確定しました`); return;
    }
    if (t.closest('[data-settings-reset]')) { store.db().settings = {}; store.save(); toast('既定に戻しました'); render(); document.dispatchEvent(new Event('menu-changed')); }
  });
  view.addEventListener('input', (ev) => {
    if (ev.target.matches('[data-home-q]')) { if (!ev.target.value.trim()) ui.homeUid = ''; homeSuggest(view, ev.target.value.trim()); }
  });
  view.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-home-level]')) ui.homeLevel = t.value;
    if (t.matches('[data-home-raw]')) ui.homeRaw = t.checked;
    if (t.matches('[data-weekly-date]') && t.value) { ui.weeklyStart = mondayOf(t.value); render(); }
    if (t.matches('[data-cb-mark]')) { store.setDay(ui.date, t.dataset.cbMark, { contactPrint: t.checked }); render(); }
  });
  view.addEventListener('submit', (ev) => {
    const f = ev.target;
    if (f.matches('[data-consult-form]')) {
      ev.preventDefault();
      if (!f.name.value.trim()) { toast('利用者名を入れてください'); return; }
      store.add('consults', { date: f.date.value, name: f.name.value.trim(), from: f.from.value.trim(), text: f.text.value.trim(), res: f.res.value });
      toast('受付票を保存しました'); location.hash = '#/consult?tab=list'; return;
    }
    if (f.matches('[data-intake-form]')) {
      ev.preventDefault();
      if (!f.name.value.trim()) { toast('利用者名を入れてください'); return; }
      const days = WEEK_ORDER.filter((w) => f.elements[`day_${w}`].checked).map((w) => WD[w]);
      store.add('intakes', { name: f.name.value.trim(), kana: f.kana.value.trim(), summary: days.length ? `通所 ${days.join('・')}` : '' });
      toast('登録しました（デモ版では利用者一覧には加わりません）'); render(); return;
    }
    if (f.matches('[data-intake-sheet]')) { ev.preventDefault(); if (!f.name.value.trim()) { toast('利用者名を入れてください'); return; } store.add('intakes', { name: f.name.value.trim(), summary: `${f.level.value} ${f.disease.value.trim()}` }); toast('基本情報を保存しました'); render(); return; }
    if (f.matches('[data-life-form]')) {
      ev.preventDefault();
      let total = 0; for (let i = 0; f.elements[`i${i}`]; i++) total += Number(f.elements[`i${i}`].value);
      store.add('life', { uid: f.dataset.lifeForm, date: todayStr(), total });
      toast(`評価を保存しました（合計 ${total} 点）`); render(); return;
    }
    if (f.matches('[data-bd-special]')) {
      ev.preventDefault();
      const v = f.text.value.trim(); if (!v) return;
      const sp = { ...(store.getMap('special', ui.date, {}) || {}) };
      sp.notes = [...(sp.notes || []), { kind: '項目', text: v }];
      store.setMap('special', ui.date, sp); toast('特記事項に追加しました'); render(); return;
    }
    if (f.matches('[data-chg-form]')) {
      ev.preventDefault();
      const kinds = [...f.querySelectorAll('[name=kind]:checked')].map((x) => x.value);
      if (!f.uid.value || !kinds.length) { toast('利用者名と区分を選んでください'); return; }
      store.add('changes', { date: f.date.value || todayStr(), uid: f.uid.value, kinds, memo: f.memo.value.trim() });
      if (kinds.includes('休み')) store.setDay(f.date.value || todayStr(), f.uid.value, { absent: true });
      toast('変更連絡を登録しました'); render(); return;
    }
    if (f.matches('[data-settings-form]')) {
      ev.preventDefault();
      const shown = new Set([...f.querySelectorAll('[name=show]:checked')].map((x) => x.value));
      store.db().settings = { hidden: MENU_ITEMS.filter((m) => !shown.has(m)), top: f.top.value };
      store.save(); toast('メニュー表示設定を保存しました'); document.dispatchEvent(new Event('menu-changed'));
    }
  });
}
