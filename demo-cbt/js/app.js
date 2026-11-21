import { FEELINGS, SLOTS, IDEAS, HABITS, STEPS, faceFor } from './content.js';
import * as store from './store.js';
import { dayKey, addDays, uid, pad } from './store.js';

const $view = document.getElementById('view');
const $sheetRoot = document.getElementById('sheetRoot');
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// ---------- 小道具 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDay(k) { const d = typeof k === 'string' ? parseKey(k) : k; return `${d.getMonth() + 1}月${d.getDate()}日(${WEEK[d.getDay()]})`; }
function fmtTime(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const todayKey = () => dayKey(new Date());

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function paintRange(input) {
  const min = Number(input.min || 0), max = Number(input.max || 100);
  input.style.setProperty('--pct', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

function openSheet(html, mount) {
  $sheetRoot.innerHTML = `<div class="sheet-back"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  const back = $sheetRoot.firstElementChild;
  const close = () => { $sheetRoot.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelectorAll('input[type=range]').forEach(paintRange);
  mount?.(back.firstElementChild, close);
}

function chipList(items, selected, attr) {
  return items.map((f) => `<button type="button" class="chip" data-${attr}="${esc(f)}" aria-pressed="${selected.includes(f)}">${esc(f)}</button>`).join('');
}

const head = (en, ja) => `<h1 class="page-en">${en}</h1>${ja ? `<h2 class="page-ja">${ja}</h2>` : ''}`;

const CRISIS = `
  <section class="card warm">
    <h3 class="card-title">とてもつらいときは</h3>
    <p class="lead small">このアプリはセルフケアのための道具で、治療の代わりにはなりません。落ち込みが2週間以上続く、眠れない・食べられない日が続くときは、かかりつけの医療機関や、お住まいの地域の保健所・精神保健福祉センターなどの相談窓口に相談してください。</p>
    <p class="lead small" style="margin-top:8px">「消えてしまいたい」と感じるときは、ひとりで抱えずに、公的な電話相談窓口や身近な人に連絡してください。命の危険があるときは <b>119</b> へ。</p>
  </section>`;

// ---------- ホーム ----------
const home = { score: 5, feelings: [], memo: '' };

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'こんばんは';
  if (h < 11) return 'おはようございます';
  if (h < 17) return 'こんにちは';
  return 'おつかれさまです';
}

function renderHome() {
  const db = store.data();
  const tk = todayKey();
  const todays = db.moods.filter((m) => dayKey(new Date(m.at)) === tk).sort((a, b) => b.at.localeCompare(a.at));
  const todayActs = db.actions.filter((a) => a.date === tk);
  const doneActs = todayActs.filter((a) => a.status === 'done').length;

  $view.innerHTML = `
    ${head('Today')}
    <section class="card">
      <p class="greet">${greeting()}</p>
      <p class="lead">いまの気持ちに名前をつけるだけでも、少し距離をおいて眺められます。</p>
    </section>

    <section class="card">
      <h3 class="card-title">いまの気分</h3>
      <div class="mood-face" id="face" aria-hidden="true">${faceFor(home.score)}</div>
      <div class="slider-row">
        <span class="small muted">つらい</span>
        <input type="range" id="score" min="0" max="10" step="1" value="${home.score}" aria-label="いまの気分（0〜10）">
        <span class="small muted">よい</span>
        <span class="val" id="scoreVal">${home.score}</span>
      </div>
      <span class="lbl">あてはまる気持ち（いくつでも）</span>
      <div class="chips" id="feelChips">${chipList(FEELINGS, home.feelings, 'feel')}</div>
      <label class="lbl" for="memo">ひとことメモ（任意）</label>
      <input class="field" id="memo" maxlength="80" placeholder="例: 出かける前で少しそわそわしている" value="${esc(home.memo)}">
      <button type="button" class="btn primary block" id="saveMood">記録する</button>
    </section>

    <div class="quick">
      <a class="card" href="#/column/write">
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/></svg></span>
        <b>考えを整理する</b><small>コラム法</small>
      </a>
      <a class="card" href="#/action">
        <span class="ic"><svg viewBox="0 0 24 24"><circle cx="12.5" cy="4.5" r="1.8"/><path d="m9.5 21 2.5-7 2.5 2.5V21M12 14l.5-5.5L9 10.5V13M12.5 8.5l2.5 3 2.5 1"/></svg></span>
        <b>今日の行動</b><small>${todayActs.length ? `${doneActs} / ${todayActs.length} 件できた` : '予定を入れる'}</small>
      </a>
    </div>

    <section class="card">
      <h3 class="card-title">今日の記録</h3>
      ${todays.length ? todays.map((m) => `
        <div class="log-row">
          <span class="time">${fmtTime(m.at)}</span>
          <span aria-hidden="true">${faceFor(m.score)}</span>
          <span>${m.score}/10</span>
          <span class="feel">${esc(m.feelings.join('、'))}${m.memo ? `<br><span class="muted">${esc(m.memo)}</span>` : ''}</span>
          <button type="button" class="del" data-del="${m.id}" aria-label="${fmtTime(m.at)}の記録を削除">×</button>
        </div>`).join('') : '<p class="empty">まだ記録はありません。</p>'}
    </section>
    ${CRISIS}
  `;

  const score = $view.querySelector('#score');
  paintRange(score);
  score.addEventListener('input', () => {
    home.score = Number(score.value);
    $view.querySelector('#scoreVal').textContent = home.score;
    $view.querySelector('#face').textContent = faceFor(home.score);
    paintRange(score);
  });
  $view.querySelector('#feelChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-feel]'); if (!b) return;
    const f = b.dataset.feel;
    home.feelings = home.feelings.includes(f) ? home.feelings.filter((x) => x !== f) : [...home.feelings, f];
    b.setAttribute('aria-pressed', home.feelings.includes(f));
  });
  $view.querySelector('#memo').addEventListener('input', (e) => { home.memo = e.target.value; });
  $view.querySelector('#saveMood').addEventListener('click', () => {
    db.moods.push({ id: uid(), at: new Date().toISOString(), score: home.score, feelings: [...home.feelings], memo: home.memo.trim() });
    store.save();
    home.feelings = []; home.memo = ''; home.score = 5;
    toast('記録しました');
    renderHome();
  });
  $view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('この記録を削除しますか？')) return;
    db.moods = db.moods.filter((m) => m.id !== b.dataset.del);
    store.save();
    renderHome();
  }));
}

// ---------- コラム法 ----------
let wiz = null;

function blankColumn() {
  return {
    id: null, step: 0, date: todayKey(), situation: '', emotions: [], thought: '', belief: 70,
    evidence: '', counter: '', habits: [], balanced: '', balancedBelief: 50, after: [], beliefAfter: 70, next: '',
  };
}

function columnCard(c) {
  const b = c.emotions[0], a = c.after.find((x) => x.name === b?.name);
  return `
    <button type="button" class="item" data-col="${c.id}">
      <div class="meta">${fmtDay(c.date)}${b ? ` ・ ${esc(b.name)} ${b.pct}% → ${a ? a.pct : '–'}%` : ''}</div>
      <div class="title">${esc(c.thought)}</div>
      ${c.balanced ? `<div class="sub">→ ${esc(c.balanced)}</div>` : ''}
      <div>${c.habits.map((h) => `<span class="tag">${esc(h)}</span>`).join('')}</div>
    </button>`;
}

function renderColumnList() {
  const db = store.data();
  const draft = store.loadDraft();
  const list = [...db.columns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  $view.innerHTML = `
    ${head('Thought Record', 'コラム法（思考記録）')}
    <section class="card">
      <p class="lead">気持ちが大きく揺れた場面を一つ選び、7つのステップで書き出します。「考え」と「事実」を分けて並べてみると、別の見方に気づきやすくなります。</p>
      ${draft ? `
        <button type="button" class="btn primary block" id="resume">書きかけを再開する</button>
        <button type="button" class="btn block" id="discard" style="margin-top:10px">書きかけを破棄して新しく書く</button>`
      : '<button type="button" class="btn primary block" id="newCol">新しく書く</button>'}
    </section>
    ${list.length ? list.map(columnCard).join('') : '<p class="empty">まだコラムはありません。</p>'}
  `;
  $view.querySelector('#newCol')?.addEventListener('click', () => { wiz = blankColumn(); location.hash = '#/column/write'; });
  $view.querySelector('#resume')?.addEventListener('click', () => { wiz = draft; location.hash = '#/column/write'; });
  $view.querySelector('#discard')?.addEventListener('click', () => { store.clearDraft(); wiz = blankColumn(); location.hash = '#/column/write'; });
  $view.querySelectorAll('[data-col]').forEach((b) => b.addEventListener('click', () => showColumn(b.dataset.col)));
}

function showColumn(id) {
  const db = store.data();
  const c = db.columns.find((x) => x.id === id); if (!c) return;
  const emo = (arr) => arr.map((e) => `${e.name} ${e.pct}%`).join('、') || '–';
  openSheet(`
    <h2>コラム ${fmtDay(c.date)}</h2>
    <dl>
      <dt>状況</dt><dd>${esc(c.situation)}</dd>
      <dt>気分</dt><dd>${esc(emo(c.emotions))}</dd>
      <dt>自動思考</dt><dd>${esc(c.thought)}（確信度 ${c.belief}%）</dd>
      <dt>根拠</dt><dd>${esc(c.evidence || '–')}</dd>
      <dt>反証</dt><dd>${esc(c.counter || '–')}</dd>
      <dt>考え方のくせ</dt><dd>${esc(c.habits.join('、') || '–')}</dd>
      <dt>適応的思考</dt><dd>${esc(c.balanced || '–')}（確信度 ${c.balancedBelief}%）</dd>
      <dt>気分の変化</dt><dd>${esc(emo(c.after))}</dd>
      <dt>最初の考えの確信度</dt><dd>${c.belief}% → ${c.beliefAfter}%</dd>
      ${c.next ? `<dt>次にやってみること</dt><dd>${esc(c.next)}</dd>` : ''}
    </dl>
    <div class="sheet-actions">
      <button type="button" class="btn danger" data-act="del">削除</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-act="close">閉じる</button>
      <button type="button" class="btn primary" data-act="edit">編集</button>
    </div>`, (sheet, close) => {
    sheet.querySelector('[data-act=close]').addEventListener('click', close);
    sheet.querySelector('[data-act=del]').addEventListener('click', () => {
      if (!confirm('このコラムを削除しますか？')) return;
      db.columns = db.columns.filter((x) => x.id !== id);
      store.save(); close(); toast('削除しました'); renderColumnList();
    });
    sheet.querySelector('[data-act=edit]').addEventListener('click', () => {
      wiz = { ...JSON.parse(JSON.stringify(c)), step: 0 };
      close(); location.hash = '#/column/write';
    });
  });
}

function emotionEditor(list, listKey) {
  const names = list.map((e) => e.name);
  const extra = names.filter((n) => !FEELINGS.includes(n));
  return `
    <div class="chips" data-emochips="${listKey}">${chipList([...FEELINGS, ...extra], names, 'emo')}</div>
    <div data-emorows="${listKey}">
      ${list.map((e, i) => `
        <div class="emo-row">
          <b>${esc(e.name)}</b>
          <input type="range" min="0" max="100" step="5" value="${e.pct}" data-pct="${i}" aria-label="${esc(e.name)}の強さ">
          <span class="small" data-pctval="${i}">${e.pct}%</span>
          <button type="button" class="x" data-rm="${i}" aria-label="${esc(e.name)}を外す">×</button>
        </div>`).join('')}
    </div>
    <div class="add-row">
      <input class="field" data-newemo placeholder="ほかの気持ち" maxlength="12">
      <button type="button" class="btn" data-addemo>追加</button>
    </div>`;
}

function bindEmotionEditor(root, listKey, rerender) {
  const list = wiz[listKey];
  const toggle = (name) => {
    const i = list.findIndex((e) => e.name === name);
    if (i >= 0) list.splice(i, 1); else list.push({ name, pct: 50 });
    persist(); rerender();
  };
  root.querySelector(`[data-emochips="${listKey}"]`).addEventListener('click', (e) => {
    const b = e.target.closest('[data-emo]'); if (b) toggle(b.dataset.emo);
  });
  root.querySelectorAll('[data-pct]').forEach((r) => r.addEventListener('input', () => {
    const i = Number(r.dataset.pct);
    list[i].pct = Number(r.value);
    root.querySelector(`[data-pctval="${i}"]`).textContent = `${r.value}%`;
    paintRange(r); persist();
  }));
  root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { list.splice(Number(b.dataset.rm), 1); persist(); rerender(); }));
  const input = root.querySelector('[data-newemo]');
  const add = () => {
    const v = input.value.trim(); if (!v) return;
    if (!list.some((e) => e.name === v)) list.push({ name: v, pct: 50 });
    persist(); rerender();
  };
  root.querySelector('[data-addemo]').addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
}

function persist() { if (wiz) store.saveDraft(wiz); }

function refBox(label, text) {
  return text ? `<div class="ref"><span class="lbl">${label}</span>${esc(text)}</div>` : '';
}

function sliderLine(id, label, value) {
  return `
    <label class="lbl" for="${id}">${label}</label>
    <div class="slider-line">
      <input type="range" id="${id}" min="0" max="100" step="5" value="${value}">
      <span class="val" data-val-for="${id}">${value}%</span>
    </div>`;
}

function stepBody(w) {
  switch (w.step) {
    case 0: return `
      <p class="q">いつ・どこで・誰と・何があった？</p>
      <p class="hint">事実だけを、写真に写すように書きます。受け取り方や気持ちは次のステップで。</p>
      <label class="lbl" for="f-date">日付</label>
      <input class="field" type="date" id="f-date" value="${esc(w.date)}" max="${todayKey()}">
      <label class="lbl" for="f-situation">出来事</label>
      <textarea class="field" id="f-situation" data-bind="situation" placeholder="例: 帰りの電車で、友人からのメッセージに既読がついたまま返事が来なかった">${esc(w.situation)}</textarea>`;
    case 1: return `
      <p class="q">そのとき、どんな気持ちだった？ 強さは？</p>
      <p class="hint">気持ちは「不安」「悲しい」など一言で表せるもの。強さを 0〜100% でつけます。</p>
      ${emotionEditor(w.emotions, 'emotions')}`;
    case 2: return `
      <p class="q">そのとき、頭に浮かんだ考えは？</p>
      <div class="hint"><ul><li>何が頭をよぎった？</li><li>自分・相手・この先について、どう思った？</li><li>いちばん気持ちを揺らした考えはどれ？</li></ul></div>
      <textarea class="field" data-bind="thought" placeholder="例: 何か気にさわることを言ってしまったに違いない">${esc(w.thought)}</textarea>
      ${sliderLine('f-belief', 'この考えをどのくらい信じている？', w.belief)}`;
    case 3: return `
      <p class="q">その考えを支える「事実」は？</p>
      <p class="hint">推測や気持ちではなく、実際に起きたこと・見聞きしたことを書きます。</p>
      ${refBox('自動思考', w.thought)}
      <textarea class="field" data-bind="evidence" placeholder="例: 昼に送ったメッセージに、夜まで返事がない">${esc(w.evidence)}</textarea>`;
    case 4: return `
      <p class="q">その考えに合わない事実は？</p>
      <div class="hint"><ul><li>友人が同じ状況なら、なんと声をかける？</li><li>前に似たことがあったとき、どうなった？</li><li>少し先の自分から見たら、どう見える？</li></ul></div>
      ${refBox('自動思考', w.thought)}
      <textarea class="field" data-bind="counter" placeholder="例: 友人は平日は忙しく、まとめて返事をすることが多い">${esc(w.counter)}</textarea>
      <span class="lbl" style="margin-top:18px">考え方のくせ（あてはまるものを選ぶ）</span>
      <div id="habitList">
        ${HABITS.map((h) => `
          <button type="button" class="habit" data-habit="${esc(h.name)}" aria-pressed="${w.habits.includes(h.name)}">
            <b>${esc(h.name)}</b><span>${esc(h.desc)}</span><em>問いかけ: ${esc(h.ask)}</em>
          </button>`).join('')}
      </div>`;
    case 5: return `
      <p class="q">根拠と反証をふまえた、バランスのよい考えは？</p>
      <p class="hint">無理に前向きにしなくて大丈夫です。「〜だけれど、〜でもある」とつなげるとまとめやすくなります。</p>
      ${refBox('自動思考', w.thought)}
      <textarea class="field" data-bind="balanced" placeholder="例: 返事はまだだけれど、忙しいだけかもしれない。明日まで待ってみよう">${esc(w.balanced)}</textarea>
      ${sliderLine('f-bbelief', 'この新しい考えをどのくらい信じられる？', w.balancedBelief)}`;
    case 6: return `
      <p class="q">いま、最初の気分はどのくらい？</p>
      <p class="hint">少しでも和らいでいれば十分です。変わらなくても、書き出したこと自体に意味があります。</p>
      <p class="small muted" style="margin:0 0 8px">最初の気分: ${esc(w.emotions.map((e) => `${e.name} ${e.pct}%`).join('、') || '–')}</p>
      ${emotionEditor(w.after, 'after')}
      ${sliderLine('f-bafter', '最初の自動思考を、いまはどのくらい信じている？', w.beliefAfter)}
      <label class="lbl" for="f-next">次にやってみること（任意）</label>
      <input class="field" id="f-next" data-bind="next" maxlength="60" placeholder="例: 明日の夜にもう一度だけ連絡してみる" value="${esc(w.next)}">`;
    default: return '';
  }
}

function stepReady(w) {
  if (w.step === 0) return w.situation.trim() !== '';
  if (w.step === 1) return w.emotions.length > 0;
  if (w.step === 2) return w.thought.trim() !== '';
  if (w.step === 5) return w.balanced.trim() !== '';
  return true;
}

function renderWizard() {
  if (!wiz) wiz = store.loadDraft() || blankColumn();
  const w = wiz;
  const s = STEPS[w.step];
  $view.innerHTML = `
    <h1 class="page-en">Thought Record</h1>
    <div class="step-head">
      <span class="step-no">${s.no}</span>
      <span class="step-name">${s.name}</span>
      <button type="button" class="btn" id="wizClose">閉じる</button>
    </div>
    <div class="progress" aria-label="ステップ ${w.step + 1} / 7">${STEPS.map((_, i) => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}</div>
    <section class="card" id="stepCard">${stepBody(w)}</section>
    <div class="wiz-nav">
      ${w.step > 0 ? '<button type="button" class="btn" id="wizBack">← 戻る</button>' : ''}
      <button type="button" class="btn primary" id="wizNext" ${stepReady(w) ? '' : 'disabled'}>${w.step === 6 ? '保存する' : '次へ →'}</button>
    </div>
  `;
  const card = $view.querySelector('#stepCard');
  const next = $view.querySelector('#wizNext');
  const refreshReady = () => { next.disabled = !stepReady(w); };

  card.querySelectorAll('[data-bind]').forEach((f) => f.addEventListener('input', () => { w[f.dataset.bind] = f.value; persist(); refreshReady(); }));
  card.querySelector('#f-date')?.addEventListener('change', (e) => { w.date = e.target.value || todayKey(); persist(); });
  const ranges = { 'f-belief': 'belief', 'f-bbelief': 'balancedBelief', 'f-bafter': 'beliefAfter' };
  card.querySelectorAll('input[type=range]').forEach(paintRange);
  Object.entries(ranges).forEach(([id, key]) => {
    const r = card.querySelector('#' + id); if (!r) return;
    r.addEventListener('input', () => { w[key] = Number(r.value); card.querySelector(`[data-val-for="${id}"]`).textContent = `${r.value}%`; paintRange(r); persist(); });
  });
  if (w.step === 1) bindEmotionEditor(card, 'emotions', renderWizard);
  if (w.step === 6) bindEmotionEditor(card, 'after', renderWizard);
  card.querySelector('#habitList')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-habit]'); if (!b) return;
    const h = b.dataset.habit;
    w.habits = w.habits.includes(h) ? w.habits.filter((x) => x !== h) : [...w.habits, h];
    b.setAttribute('aria-pressed', w.habits.includes(h)); persist();
  });

  $view.querySelector('#wizClose').addEventListener('click', () => {
    persist(); wiz = null; toast('書きかけを保存しました'); location.hash = '#/column';
  });
  $view.querySelector('#wizBack')?.addEventListener('click', () => { w.step--; persist(); renderWizard(); window.scrollTo(0, 0); });
  next.addEventListener('click', () => {
    if (!stepReady(w)) return;
    if (w.step < 6) {
      w.step++;
      if (w.step === 6 && w.after.length === 0) w.after = w.emotions.map((e) => ({ ...e }));
      if (w.step === 6 && w.id == null) w.beliefAfter = w.belief;
      persist(); renderWizard(); window.scrollTo(0, 0);
      return;
    }
    const db = store.data();
    const { step, ...rec } = w;
    if (rec.id) {
      const i = db.columns.findIndex((c) => c.id === rec.id);
      if (i >= 0) db.columns[i] = { ...db.columns[i], ...rec };
      else db.columns.push({ ...rec, createdAt: new Date().toISOString() });
    } else {
      db.columns.push({ ...rec, id: uid(), createdAt: new Date().toISOString() });
    }
    store.save(); store.clearDraft(); wiz = null;
    toast('コラムを保存しました');
    location.hash = '#/column';
  });
}

// ---------- 行動活性化 ----------
const actForm = { date: '', slot: '指定なし', title: '' };
let pendingAct = null;

function actCard(a) {
  const label = { plan: '予定', done: 'できた', skip: '見送り' }[a.status];
  const scores = a.status === 'done' && a.mastery != null
    ? `<div class="sub">達成感 ${a.mastery} ・ 楽しさ ${a.pleasure ?? '–'}${a.before != null && a.after != null ? ` ・ 気分 ${a.before}→${a.after}` : ''}</div>` : '';
  return `
    <button type="button" class="item" data-act="${a.id}">
      <div class="meta">${fmtDay(a.date)}${a.slot && a.slot !== '指定なし' ? ` ${esc(a.slot)}` : ''}<span class="badge ${a.status}">${label}</span></div>
      <div class="title">${esc(a.title)}</div>${scores}
    </button>`;
}

function renderAction() {
  const db = store.data();
  if (!actForm.date) actForm.date = todayKey();
  const slotOrder = (s) => SLOTS.indexOf(s);
  const upcoming = db.actions.filter((a) => a.status === 'plan').sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot));
  const past = db.actions.filter((a) => a.status !== 'plan').sort((a, b) => b.date.localeCompare(a.date) || slotOrder(b.slot) - slotOrder(a.slot));

  $view.innerHTML = `
    ${head('Action', '行動活性化')}
    <section class="card">
      <p class="lead">気分が沈んでいるときは「やる気が出てから動く」より、「小さく動くと気分があとからついてくる」ことがよくあります。5〜10分でできることを予定に入れ、やったあとに<b>達成感</b>と<b>楽しさ</b>をつけてみましょう。</p>
    </section>
    <section class="card">
      <h3 class="card-title">予定を追加</h3>
      <div class="row2">
        <div><label class="lbl" for="a-date">日付</label><input class="field" type="date" id="a-date" value="${esc(actForm.date)}"></div>
        <div><label class="lbl" for="a-slot">時間帯</label><select class="field" id="a-slot">${SLOTS.map((s) => `<option ${s === actForm.slot ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>
      <label class="lbl" for="a-title">やること</label>
      <input class="field" id="a-title" maxlength="40" placeholder="例: 近所を10分歩く" value="${esc(actForm.title)}">
      <span class="lbl">アイデア</span>
      <div class="chips" id="ideas">${IDEAS.map((i) => `<button type="button" class="chip" data-idea="${esc(i)}">${esc(i)}</button>`).join('')}</div>
      <button type="button" class="btn primary block" id="addAct">予定に入れる</button>
    </section>
    <h3 class="section-title">これからの予定</h3>
    ${upcoming.length ? upcoming.map(actCard).join('') : '<p class="empty">予定はありません。小さなことを一つ入れてみましょう。</p>'}
    <h3 class="section-title">これまで</h3>
    ${past.length ? past.map(actCard).join('') : '<p class="empty">まだ記録はありません。</p>'}
  `;
  const title = $view.querySelector('#a-title');
  $view.querySelector('#a-date').addEventListener('change', (e) => { actForm.date = e.target.value; });
  $view.querySelector('#a-slot').addEventListener('change', (e) => { actForm.slot = e.target.value; });
  title.addEventListener('input', () => { actForm.title = title.value; });
  $view.querySelector('#ideas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-idea]'); if (!b) return;
    title.value = actForm.title = b.dataset.idea; title.focus();
  });
  $view.querySelector('#addAct').addEventListener('click', () => {
    const t = actForm.title.trim();
    if (!t) { toast('やることを入れてください'); title.focus(); return; }
    db.actions.push({ id: uid(), date: actForm.date || todayKey(), slot: actForm.slot, title: t, status: 'plan', before: null, after: null, mastery: null, pleasure: null, memo: '' });
    store.save();
    actForm.title = '';
    toast('予定に入れました');
    renderAction();
  });
  $view.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => editAction(b.dataset.act)));
  if (pendingAct) { const id = pendingAct; pendingAct = null; editAction(id); }
}

function editAction(id) {
  const db = store.data();
  const a = db.actions.find((x) => x.id === id); if (!a) return;
  const draft = { ...a };
  const scoreField = (key, label) => `
    <label class="lbl" for="s-${key}">${label}（0〜10）</label>
    <div class="slider-line">
      <input type="range" id="s-${key}" data-score="${key}" min="0" max="10" step="1" value="${draft[key] ?? 5}" class="${draft[key] == null ? 'unset' : ''}">
      <span class="val" data-sval="${key}">${draft[key] ?? '–'}</span>
    </div>`;
  openSheet(`
    <h2>${esc(a.title)}</h2>
    <p class="small muted" style="margin:0 0 12px">${fmtDay(a.date)}${a.slot !== '指定なし' ? ` ${esc(a.slot)}` : ''}</p>
    <section class="card">
      <label class="lbl" for="e-title" style="margin-top:0">やること</label>
      <input class="field" id="e-title" maxlength="40" value="${esc(draft.title)}">
      <div class="row2">
        <div><label class="lbl" for="e-date">日付</label><input class="field" type="date" id="e-date" value="${esc(draft.date)}"></div>
        <div><label class="lbl" for="e-status">状態</label>
          <select class="field" id="e-status">
            <option value="plan" ${draft.status === 'plan' ? 'selected' : ''}>予定</option>
            <option value="done" ${draft.status === 'done' ? 'selected' : ''}>できた</option>
            <option value="skip" ${draft.status === 'skip' ? 'selected' : ''}>見送り</option>
          </select></div>
      </div>
      ${scoreField('before', '始める前の気分')}
      ${scoreField('after', '終わったあとの気分')}
      ${scoreField('mastery', '達成感')}
      ${scoreField('pleasure', '楽しさ')}
      <label class="lbl" for="e-memo">メモ</label>
      <input class="field" id="e-memo" maxlength="60" value="${esc(draft.memo)}">
    </section>
    <div class="sheet-actions">
      <button type="button" class="btn danger" data-x="del">削除</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-x="close">閉じる</button>
      <button type="button" class="btn primary" data-x="save">保存</button>
    </div>`, (sheet, close) => {
    sheet.querySelectorAll('[data-score]').forEach((r) => r.addEventListener('input', () => {
      const k = r.dataset.score;
      draft[k] = Number(r.value);
      r.classList.remove('unset');
      sheet.querySelector(`[data-sval="${k}"]`).textContent = r.value;
      paintRange(r);
      const st = sheet.querySelector('#e-status');
      if (st.value === 'plan' && (k === 'after' || k === 'mastery' || k === 'pleasure')) st.value = 'done';
    }));
    sheet.querySelector('[data-x=close]').addEventListener('click', close);
    sheet.querySelector('[data-x=del]').addEventListener('click', () => {
      if (!confirm('この行動を削除しますか？')) return;
      db.actions = db.actions.filter((x) => x.id !== id);
      store.save(); close(); renderAction();
    });
    sheet.querySelector('[data-x=save]').addEventListener('click', () => {
      draft.title = sheet.querySelector('#e-title').value.trim() || a.title;
      draft.date = sheet.querySelector('#e-date').value || a.date;
      draft.status = sheet.querySelector('#e-status').value;
      draft.memo = sheet.querySelector('#e-memo').value.trim();
      Object.assign(a, draft);
      store.save(); close(); toast('保存しました'); renderAction();
    });
  });
}

// ---------- 振り返り ----------
let reviewFilter = 'all';

function moodChart(moods) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i); const k = dayKey(d);
    const ms = moods.filter((m) => dayKey(new Date(m.at)) === k);
    days.push({ k, d, avg: ms.length ? ms.reduce((s, m) => s + m.score, 0) / ms.length : null, n: ms.length });
  }
  const W = 340, H = 160, L = 22, R = 8, T = 10, B = 24;
  const x = (i) => L + (i / 29) * (W - L - R);
  const y = (v) => T + (1 - v / 10) * (H - T - B);
  const pts = days.map((d, i) => (d.avg == null ? null : { ...d, i, cx: x(i), cy: y(d.avg) })).filter(Boolean);
  const path = pts.map((p, j) => `${j ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join('');
  const grid = [0, 5, 10].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(70,82,100,${v === 0 ? 0.35 : 0.14})" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="9" fill="#7a8596">${v}</text>`).join('');
  const ticks = [0, 7, 14, 21, 29].map((i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}" font-size="9" fill="#7a8596">${days[i].d.getMonth() + 1}/${days[i].d.getDate()}</text>`).join('');
  const dots = pts.map((p) => `<circle cx="${p.cx}" cy="${p.cy}" r="2.6" fill="#f7f8fa" stroke="#5b6a80" stroke-width="1.6"/>`).join('');
  const table = `<table class="sr-only"><caption>日ごとの平均気分</caption><tr><th>日付</th><th>平均</th></tr>${pts.map((p) => `<tr><td>${fmtDay(p.k)}</td><td>${p.avg.toFixed(1)}</td></tr>`).join('')}</table>`;
  return {
    html: `<div class="chart-wrap" id="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="過去30日の気分の推移（日ごとの平均、0〜10）">
        ${grid}${ticks}
        <path d="${path}" fill="none" stroke="#5b6a80" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        <line id="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="rgba(70,82,100,.35)" stroke-dasharray="3 3" visibility="hidden"/>
        <circle id="hot" r="5" fill="#5b6a80" stroke="#fff" stroke-width="2" visibility="hidden"/>
        <rect id="hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/>
      </svg>
      <div class="chart-tip" id="tip"></div>${table}</div>`,
    bind(root) {
      const wrap = root.querySelector('#chart'); if (!wrap || !pts.length) return;
      const svg = wrap.querySelector('svg'), tip = wrap.querySelector('#tip');
      const cross = svg.querySelector('#cross'), hot = svg.querySelector('#hot');
      const move = (ev) => {
        const rect = svg.getBoundingClientRect();
        const sx = ((ev.clientX - rect.left) / rect.width) * W;
        let best = pts[0];
        for (const p of pts) if (Math.abs(p.cx - sx) < Math.abs(best.cx - sx)) best = p;
        cross.setAttribute('x1', best.cx); cross.setAttribute('x2', best.cx); cross.setAttribute('visibility', 'visible');
        hot.setAttribute('cx', best.cx); hot.setAttribute('cy', best.cy); hot.setAttribute('visibility', 'visible');
        tip.style.display = 'block';
        tip.style.left = `${(best.cx / W) * rect.width}px`;
        tip.style.top = `${(best.cy / H) * rect.height}px`;
        tip.innerHTML = `${fmtDay(best.k)}　<b>${best.avg.toFixed(1)}</b>（${best.n}回）`;
      };
      const leave = () => { tip.style.display = 'none'; cross.setAttribute('visibility', 'hidden'); hot.setAttribute('visibility', 'hidden'); };
      const hit = svg.querySelector('#hit');
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', leave);
    },
  };
}

function renderReview() {
  const db = store.data();
  const since = dayKey(addDays(new Date(), -29));
  const recentMoods = db.moods.filter((m) => dayKey(new Date(m.at)) >= since);
  const avg = recentMoods.length ? recentMoods.reduce((s, m) => s + m.score, 0) / recentMoods.length : null;
  const doneCount = db.actions.filter((a) => a.status === 'done').length;

  // コラム前後の変化（最初に選んだ気持ちの強さの差の平均）
  const drops = db.columns.map((c) => {
    const b = c.emotions[0]; if (!b) return null;
    const a = c.after.find((x) => x.name === b.name);
    return a ? b.pct - a.pct : null;
  }).filter((v) => v != null);
  const drop = drops.length ? Math.round(drops.reduce((s, v) => s + v, 0) / drops.length) : null;

  const habitCount = {};
  db.columns.forEach((c) => c.habits.forEach((h) => { habitCount[h] = (habitCount[h] || 0) + 1; }));
  const habitRank = Object.entries(habitCount).sort((a, b) => b[1] - a[1]);
  const maxH = habitRank[0]?.[1] || 1;

  const actScore = {};
  db.actions.filter((a) => a.status === 'done' && a.mastery != null && a.pleasure != null).forEach((a) => {
    (actScore[a.title] ||= []).push(a.mastery + a.pleasure);
  });
  const actRank = Object.entries(actScore).map(([t, v]) => [t, v.reduce((s, x) => s + x, 0) / v.length, v.length]).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const chart = moodChart(db.moods);

  const entries = [
    ...db.moods.map((m) => ({ kind: 'mood', sort: m.at, m })),
    ...db.columns.map((c) => ({ kind: 'column', sort: `${c.date}T23:59`, c })),
    ...db.actions.map((a) => ({ kind: 'action', sort: `${a.date}T${pad(SLOTS.indexOf(a.slot) * 3)}:00`, a })),
  ].filter((e) => reviewFilter === 'all' || e.kind === reviewFilter).sort((a, b) => b.sort.localeCompare(a.sort));

  const entryHtml = (e) => {
    if (e.kind === 'column') return columnCard(e.c);
    if (e.kind === 'action') return actCard(e.a);
    const m = e.m;
    return `<div class="item mood-item" style="cursor:default">
      <div class="meta">${fmtDay(new Date(m.at))} ${fmtTime(m.at)}</div>
      <div class="title">${faceFor(m.score)} ${m.score}/10 <span class="small muted">${esc(m.feelings.join('、'))}${m.memo ? ` ・ ${esc(m.memo)}` : ''}</span></div>
    </div>`;
  };

  $view.innerHTML = `
    ${head('Reflection', '振り返り')}
    <section class="card">
      <div class="stats">
        <div><b>${avg == null ? '–' : avg.toFixed(1)}</b><span>30日の平均気分</span></div>
        <div><b>${db.columns.length}</b><span>コラム</span></div>
        <div><b>${doneCount}</b><span>できた行動</span></div>
      </div>
      ${drop != null ? `<p class="effect">コラムを書いたあと、最初の気持ちの強さは平均 <b>${drop}ポイント</b> 下がりました</p>` : ''}
    </section>
    <section class="card">
      <h3 class="card-title">気分の推移（30日）</h3>
      ${chart.html}
    </section>
    <section class="card">
      <h3 class="card-title">よく出る考え方のくせ</h3>
      ${habitRank.length ? habitRank.map(([h, n]) => `
        <div class="bar-row"><div class="top"><span>${esc(h)}</span><span>${n}回</span></div>
        <div class="track"><div class="fill" style="width:${(n / maxH) * 100}%"></div></div></div>`).join('')
      : '<p class="empty">コラムを書くと、ここに集計されます。</p>'}
    </section>
    <section class="card">
      <h3 class="card-title">気分が上がりやすい行動</h3>
      <p class="small muted" style="margin:-6px 0 6px">達成感＋楽しさの平均が高い順</p>
      ${actRank.length ? actRank.map(([t, v, n]) => `<div class="act-rank">${esc(t)}<span>${v.toFixed(1)} / 20（${n}回）</span></div>`).join('')
      : '<p class="empty">行動を「できた」にすると、ここに並びます。</p>'}
    </section>
    <h3 class="section-title">記録一覧</h3>
    <div class="seg" role="group" aria-label="記録の種類">
      ${[['all', 'すべて'], ['mood', '気分'], ['column', 'コラム'], ['action', '行動']].map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${reviewFilter === k}">${l}</button>`).join('')}
    </div>
    <div id="entries">${entries.slice(0, 60).map(entryHtml).join('') || '<p class="empty">記録がありません。</p>'}</div>
  `;
  chart.bind($view);
  $view.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    reviewFilter = b.dataset.filter;
    const y = window.scrollY; renderReview(); window.scrollTo(0, y);
  }));
  $view.querySelectorAll('[data-col]').forEach((b) => b.addEventListener('click', () => showColumn(b.dataset.col)));
  $view.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { pendingAct = b.dataset.act; location.hash = '#/action'; }));
}

// ---------- 学ぶ ----------
function renderLearn() {
  $view.innerHTML = `
    ${head('Learn', '認知行動療法について')}
    <section class="card">
      <p class="lead">認知行動療法（CBT）は、出来事そのものよりも、それを<b>どう受け取ったか（認知）</b>が気分や行動に影響する、という考え方にもとづく方法です。</p>
      <div class="flow"><span>出来事</span><i>→</i><span>考え</span><i>→</i><span>気分・からだ</span><i>→</i><span>行動</span></div>
      <p class="lead" style="margin-top:10px">つらいときにふと浮かぶ「自動思考」に気づき、事実と照らし合わせて別の見方を探すことで、気分や行動を少しずつ楽にしていきます。</p>
    </section>
    <section class="card">
      <h3 class="card-title">このアプリの使い方</h3>
      <ol class="howto">
        <li><b>気分チェック</b>（ホーム）: 1日に何回でも。気分の波に気づく練習になります。</li>
        <li><b>コラム法</b>: 気持ちが大きく動いた場面で。少し落ち着いてから書くのがおすすめです。</li>
        <li><b>行動活性化</b>: 落ち込みが続くときに。小さな行動を予定し、やったあとの気分をつけます。</li>
        <li><b>振り返り</b>: 週に一度くらい、気分の推移やよく出るくせを眺めてみましょう。</li>
      </ol>
    </section>
    <section class="card">
      <h3 class="card-title">考え方のくせ（認知のゆがみ）</h3>
      <p class="small muted" style="margin:-6px 0 4px">誰にでもある心の“近道”です。くせに名前がつくと、気づいたときに一歩引いて眺めやすくなります。</p>
      ${HABITS.map((h) => `
        <details class="dist">
          <summary>${esc(h.name)}</summary>
          <p>${esc(h.desc)}</p>
          <p class="ex">${esc(h.ex)}</p>
          <p>💭 ${esc(h.ask)}</p>
        </details>`).join('')}
    </section>
    ${CRISIS}
  `;
}

// ---------- ルーター ----------
const routes = {
  home: renderHome,
  column: renderColumnList,
  'column/write': renderWizard,
  action: renderAction,
  review: renderReview,
  learn: renderLearn,
};

function route() {
  const path = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  const fn = routes[path] || renderHome;
  $sheetRoot.innerHTML = '';
  const tab = path.split('/')[0];
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const on = a.dataset.tab === (routes[path] ? tab : 'home');
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  fn();
  if (route._last !== path) window.scrollTo(0, 0);
  route._last = path;
}

function setTodayLabel() {
  const d = new Date();
  document.getElementById('todayLabel').textContent = fmtDay(d);
}

document.getElementById('resetDemo').addEventListener('click', () => {
  if (!confirm('デモデータを初期状態に戻しますか？（追加・変更した内容は消えます）')) return;
  store.reset();
  wiz = null; home.feelings = []; home.memo = ''; home.score = 5; reviewFilter = 'all';
  toast('初期状態に戻しました');
  route();
});

store.load();
setTodayLabel();
window.addEventListener('hashchange', route);
route();
