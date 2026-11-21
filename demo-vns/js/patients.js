// 利用者一覧と利用者ごとの画面（訪問看護記録・基本情報・計画書・サマリ）
import { db, save, todayStr, md, age, patientById, staffById, recordsOf, orderNotice, nextPlan, uid, toMin, hhmm, kindOfStaff, parseYmd } from './store.js';
import { $, $$, esc, toast, setTopActions, printAction, openModal, closeModal, opt } from './ui.js';
import { gridHtml, bindFields } from './form.js';
import { renderRecordTab } from './record.js';
import { showScheduleWeek } from './schedule.js';

const dispName = (p) => p.name || '（新規・氏名未入力）';
const burdenText = (p) => (p.insurance === '医療保険' ? '医療保険' : p.burden);

// ================= 一覧 =================
let query = '';
let armedDelete = null;

export function renderPatients(view) {
  setTopActions([printAction()]);
  const q = query.trim();
  const list = db().patients.filter((p) => !q || [p.name, p.kana, p.disease, p.address, p.hospital].some((x) => (x || '').includes(q)));
  view.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">PATIENTS</div><h1>利用者一覧</h1></div>
      <div class="head-tools no-print">
        <input type="search" id="q" value="${esc(query)}" placeholder="氏名・フリガナ・疾患・住所・病院で検索" style="width:260px">
        <a class="pill mint" href="#/new">新規登録</a>
      </div>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>利用者名</th><th>お知らせ</th><th>年齢</th><th>性別</th><th>主疾患</th><th>要介護度</th><th>負担割合</th><th>住所</th><th>連絡先</th><th>KP</th><th>KP連絡先</th><th>病院</th><th>ケアマネ</th><th>ケアマネ連絡先</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${list.map((p) => {
            const n = orderNotice(p);
            return `<tr>
              <td><a class="name-link" href="#/patient/${p.id}/record">${esc(dispName(p))}</a></td>
              <td>${n ? `<span class="badge ${n.level}">${esc(n.text)}</span>` : ''}</td>
              <td>${age(p.birth)}</td><td>${esc(p.sex)}</td><td>${esc(p.disease)}</td><td>${esc(p.care)}</td><td>${esc(burdenText(p))}</td>
              <td>${esc(p.address)}</td><td>${esc(p.tel)}</td><td>${esc(p.kp)}</td><td>${esc(p.kpTel)}</td><td>${esc(p.hospital)}</td><td>${esc(p.cm)}</td><td>${esc(p.cmTel)}</td>
              <td class="no-print"><button type="button" class="link-btn danger-link" data-del="${p.id}">${armedDelete === p.id ? 'もう一度押すと削除' : '削除'}</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="15" class="muted">該当する利用者はいません。</td></tr>'}
        </tbody>
      </table>
    </div>`;
  const qi = $('#q');
  qi.oninput = () => { query = qi.value; const pos = qi.selectionStart; renderPatients(view); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-del]', view).forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.del;
      if (armedDelete !== id) { armedDelete = id; renderPatients(view); return; }
      deletePatient(id);
      armedDelete = null;
      toast('利用者を削除しました');
      renderPatients(view);
    };
  });
}

function deletePatient(id) {
  const d = db();
  d.patients = d.patients.filter((p) => p.id !== id);
  d.plans = d.plans.filter((v) => v.patientId !== id);
  d.records = d.records.filter((r) => r.patientId !== id);
  delete d.plansDoc[id];
  delete d.summaries[id];
  save();
}

// ================= 利用者ごとの画面 =================
const TABS = [
  { id: 'record', label: '訪問看護記録', print: '訪問看護記録として印刷' },
  { id: 'info', label: '基本情報', print: '基本情報として印刷' },
  { id: 'plan', label: '訪問看護計画書', print: '看護計画書として印刷' },
  { id: 'summary', label: '看護サマリ', print: 'この画面を印刷' },
];

export function renderPatient(view, pid, tab, sub) {
  const p = patientById(pid);
  if (!p) { view.innerHTML = '<p>利用者が見つかりません。<a href="#/patients">一覧へ</a></p>'; return; }
  const t = TABS.find((x) => x.id === tab) || TABS[0];
  setTopActions([printAction(t.print)]);

  view.innerHTML = `
    <div id="pt-head"></div>
    <div class="tabs no-print" role="tablist">
      ${TABS.map((x) => `<button type="button" role="tab" class="tab ${x.id === t.id ? 'on' : ''}" data-tab="${x.id}" aria-selected="${x.id === t.id}">${x.label}</button>`).join('')}
    </div>
    <div id="tab-body"></div>`;
  renderHead(p);
  $$('[data-tab]', view).forEach((b) => { b.onclick = () => { location.hash = `#/patient/${pid}/${b.dataset.tab}`; }; });

  const body = $('#tab-body');
  const refreshHead = () => renderHead(p);
  if (t.id === 'record') renderRecordTab(body, p, refreshHead);
  else if (t.id === 'info') renderInfo(body, p, sub || 'basic', refreshHead);
  else if (t.id === 'plan') renderPlan(body, p);
  else renderSummary(body, p);
}

function renderHead(p) {
  const box = $('#pt-head');
  if (!box) return;
  const n = orderNotice(p);
  const nv = nextPlan(p.id);
  const recs = recordsOf(p.id);
  const last = [...recs].reverse().find((r) => r.handover);
  const meta = [age(p.birth) !== '' ? `${age(p.birth)}歳` : '歳', p.sex, p.disease, p.insurance === '医療保険' ? '医療保険' : p.care].map((x) => x || '').join('・');
  box.innerHTML = `
    <div class="pt-head">
      <a href="#/patients" class="name-link no-print">← 一覧</a>
      <h1>${esc(dispName(p))} 様</h1>
      <span class="small">${esc(meta)}</span>
    </div>
    ${p.isNew && !p.name ? '<div class="notice" style="margin:10px 0">新規登録：下の「基本情報」に氏名などを入力してください。入力はその場で保存されます。</div>' : `
    <div class="pt-meta">
      ${n ? `<span class="badge ${n.level}">${esc(n.text)}</span>` : ''}
      ${nv ? `<span class="badge info">次回訪問 ${md(nv.date)} ${nv.start.replace(/^0/, '')}〜 ${esc(staffById(nv.staffId)?.name || '')}（${nv.kind}）</span>` : ''}
      ${p.nextClinic ? `<span class="badge info">次回通院 ${md(p.nextClinic)}</span>` : ''}
      ${p.nextHomeVisit ? `<span class="badge info">次回往診 ${md(p.nextHomeVisit)}</span>` : ''}
      ${p.orderStart && p.orderEnd ? `<span class="small muted">指示書 ${md(p.orderStart)}〜${md(p.orderEnd)}</span>` : ''}
    </div>
    ${last || p.caution ? `<div class="handover-box">
      ${last ? `<div class="hb-title">前回（${md(last.date)} ${esc(staffById(last.staffId)?.name || '')}）からの申し送り</div><div>${esc(last.handover)}</div>` : ''}
      ${last && p.caution ? '<div class="sep"></div>' : ''}
      ${p.caution ? `<div><span class="caution-tag">注意</span><span class="hb-title">ケア時の注意点</span></div><div>${esc(p.caution)}</div>` : ''}
    </div>` : ''}`}
  `;
}

// ================= 基本情報 =================
const SUBS = [
  { id: 'basic', label: '基本' },
  { id: 'medical', label: '病状・医療' },
  { id: 'care', label: '介護・保険' },
  { id: 'week', label: '週間予定' },
];
const HEAD_KEYS = ['name', 'kana', 'birth', 'sex', 'disease', 'care', 'insurance', 'orderStart', 'orderEnd', 'nextClinic', 'nextHomeVisit', 'caution'];

function renderInfo(body, p, sub, refreshHead) {
  body.innerHTML = `
    <div class="subtabs no-print" role="tablist" aria-label="基本情報の区分">
      ${SUBS.map((s) => `<button type="button" role="tab" class="chip ${s.id === sub ? 'on' : ''}" data-sub="${s.id}">${s.label}</button>`).join('')}
    </div>
    <div id="sub-body"></div>`;
  $$('[data-sub]', body).forEach((b) => { b.onclick = () => { location.hash = `#/patient/${p.id}/info/${b.dataset.sub}`; }; });
  const sb = $('#sub-body', body);
  const onChange = (k) => {
    if (k === 'name' && p.name) delete p.isNew;
    if (HEAD_KEYS.includes(k)) { save(); refreshHead(); }
  };

  if (sub === 'basic') {
    sb.innerHTML = `
      <div class="panel"><h2>訪問看護記録（基本情報）</h2>
        ${gridHtml([
          { k: 'created', label: '作成日', type: 'date' }, { k: 'firstVisit', label: '初回訪問日', type: 'date' },
          { k: 'name', label: '利用者氏名', ph: '例）山田 太郎' }, { k: 'kana', label: 'フリガナ' },
          { k: 'sex', label: '性別', type: 'radio', opts: ['男', '女'] }, { k: 'birth', label: '生年月日', type: 'date' }, { k: 'tel', label: '電話', w: 2 },
          { k: 'address', label: '住所', w: 4 },
          { band: '緊急連絡先' },
          { k: 'kp', label: '① 名前（キーパーソン）' }, { k: 'kpRel', label: '続柄' }, { k: 'kpTel', label: '電話' }, { k: 'kpAddr', label: '住所' },
          { k: 'kp2', label: '② 名前' }, { k: 'kp2Rel', label: '続柄' }, { k: 'kp2Tel', label: '電話' }, { k: 'kp2Addr', label: '住所' },
        ], p)}
        <h3>家族図</h3>
        ${gridHtml([{ k: 'family', label: '家族構成のメモ（□男性 ○女性／同居・死亡 など）', type: 'textarea', w: 4 }], p)}
      </div>
      <div class="panel no-print"><h2>利用者の削除</h2>
        <button type="button" class="pill" id="del-pt">この利用者を削除</button> <span class="small muted">まちがえて作ったときに使います。</span>
      </div>`;
    let armed = false;
    $('#del-pt', sb).onclick = (e) => {
      if (!armed) { armed = true; e.target.textContent = 'もう一度押すと、この利用者の記録もすべて削除します'; return; }
      deletePatient(p.id); toast('利用者を削除しました'); location.hash = '#/patients';
    };
  } else if (sub === 'medical') {
    sb.innerHTML = `
      <div class="panel"><h2>病状</h2>
        ${gridHtml([
          { k: 'disease', label: '主な傷病名', w: 2 }, { k: 'history', label: '既往歴', w: 2 },
          { k: 'course', label: '訪問看護に至る経過', type: 'textarea', w: 4 },
          { k: 'infections', label: '感染症', type: 'checks', opts: ['梅毒', 'HCV', 'HBV', 'MRSA', 'その他'], w: 2 }, { k: 'infectNote', label: '感染症 その他の内容', w: 2 },
          { k: 'allergyFood', label: 'アレルギー 食品', type: 'radio', opts: ['有', '無'] }, { k: 'allergyFoodNote', label: '食品の内容' },
          { k: 'allergyDrug', label: 'アレルギー 薬剤', type: 'radio', opts: ['有', '無'] }, { k: 'allergyDrugNote', label: '薬剤の内容' },
          { k: 'policySelf', label: '急変・終末期の方針 本人', type: 'textarea', rows: 2, w: 2 }, { k: 'policyFamily', label: '急変・終末期の方針 家族', type: 'textarea', rows: 2, w: 2 },
        ], p)}
      </div>
      <div class="panel"><h2>医療機関・指示書</h2>
        ${gridHtml([
          { k: 'hospital', label: '医療機関' }, { k: 'doctor', label: '主治医' }, { k: 'hospTel', label: 'TEL', w: 2 },
          { k: 'orderStart', label: '指示書の開始日', type: 'date' }, { k: 'orderEnd', label: '指示書の終了日（期限が近づくとお知らせ）', type: 'date' },
          { k: 'nextClinic', label: '次回の通院日', type: 'date' }, { k: 'nextHomeVisit', label: '次回の往診日', type: 'date' },
          { k: 'caution', label: 'ケア時の注意点（記録画面の上に表示）', type: 'textarea', rows: 2, w: 4 },
        ], p)}
      </div>`;
  } else if (sub === 'care') {
    sb.innerHTML = `
      <div class="panel"><h2>介護・保険</h2>
        ${gridHtml([
          { k: 'insurance', label: '保険の種類', type: 'select', opts: ['介護保険', '医療保険'] },
          { k: 'care', label: '要介護度', type: 'select', opts: ['なし', '要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'] },
          { k: 'burden', label: '負担割合', type: 'select', opts: ['1割', '2割', '3割'] },
          { k: 'certEnd', label: '認定の有効期限', type: 'date' },
          { k: 'cm', label: 'ケアマネジャー（事業所・氏名）', w: 2 }, { k: 'cmTel', label: 'ケアマネ連絡先', w: 2 },
          { k: 'services', label: 'ほかに使っているサービス', type: 'checks', opts: ['訪問介護', '通所介護', '訪問入浴', '福祉用具', 'ショートステイ'], w: 4 },
        ], p)}
      </div>`;
  } else {
    renderWeek(sb, p, () => renderInfo(body, p, 'week', refreshHead));
    return;
  }
  bindFields(sb, p, onChange);
}

function renderWeek(sb, p, again) {
  const T = todayStr();
  const ups = db().plans.filter((v) => v.patientId === p.id && v.date >= T).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const days = ['月', '火', '水', '木', '金', '土', '日'];
  p.week = p.week || {};
  sb.innerHTML = `
    <div class="panel"><h2>訪問の予定</h2>
      <div class="chips no-print" style="margin-bottom:10px">
        <button type="button" class="pill mint" id="w-add">＋ 訪問を登録</button>
        <button type="button" class="pill" id="w-sched">訪問スケジュール（週間）で見る</button>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>訪問日</th><th>時間</th><th>訪問者</th><th>区分</th><th class="no-print"></th></tr></thead>
        <tbody>${ups.map((v) => `<tr><td>${md(v.date)}</td><td>${v.start.replace(/^0/, '')}〜${v.end.replace(/^0/, '')}</td><td>${esc(staffById(v.staffId)?.name || '')}</td><td><span class="badge kind">${v.kind}</span></td><td class="no-print"><button type="button" class="pill-sm" data-delv="${v.id}">削除</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">今日以降の予定はありません。</td></tr>'}</tbody>
      </table></div>
      <p class="help">訪問スケジュールで登録した今日以降の予定が、ここに自動で入ります。ここから登録・削除した内容も、訪問スケジュールに反映されます。</p>
    </div>
    <div class="panel"><h2>一週間のすごし方</h2>
      <div class="tbl-wrap"><table class="tbl week">
        <thead><tr><th></th>${days.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>${['午前', '午後'].map((ap) => `<tr><th>${ap}</th>${days.map((d) => `<td><input type="text" data-wk="${d}${ap}" value="${esc(p.week[d + ap] || '')}" aria-label="${d}曜${ap}"></td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <p class="help">デイサービスやヘルパーなど、ほかのサービスも書いておくと訪問の調整に便利です。</p>
    </div>`;
  $$('[data-wk]', sb).forEach((i) => { i.oninput = () => { p.week[i.dataset.wk] = i.value; save(); }; });
  $$('[data-delv]', sb).forEach((b) => {
    b.onclick = () => {
      if (!confirm('この予定を削除しますか？')) return;
      db().plans = db().plans.filter((v) => v.id !== b.dataset.delv); save(); toast('予定を削除しました'); again();
    };
  });
  $('#w-sched', sb).onclick = () => showScheduleWeek(T);
  $('#w-add', sb).onclick = () => {
    openModal(`
      <h2>訪問を登録（${esc(dispName(p))} 様）</h2>
      <form id="wf">
        <label class="fld">訪問日<input type="date" name="date" value="${addDay(T)}" required></label>
        <label class="fld">訪問者<select name="staff">${db().staff.map((x) => opt(x.id, `${x.name}（${x.role}）`)).join('')}</select></label>
        <div class="row2"><label class="fld">開始<input type="time" name="start" value="10:00" required></label><label class="fld">終了<input type="time" name="end" value="10:30" required></label></div>
        <div class="modal-actions"><button type="button" class="pill" id="wf-c">閉じる</button><button type="submit" class="pill mint">登録する</button></div>
      </form>`, (m) => {
      $('#wf-c', m).onclick = closeModal;
      $('#wf', m).onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const a = String(f.get('start')), b = String(f.get('end'));
        if (toMin(b) <= toMin(a)) { toast('終了は開始より後にしてください'); return; }
        const sid = String(f.get('staff'));
        db().plans.push({ id: uid('v'), date: String(f.get('date')), staffId: sid, patientId: p.id, start: hhmm(toMin(a)), end: hhmm(toMin(b)), kind: kindOfStaff(sid) });
        save(); closeModal(); toast('訪問を登録しました'); again();
      };
    });
  };
}
const addDay = (s) => { const d = parseYmd(s); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ================= 自動で入る基本情報の帯 =================
function autoStrip(p) {
  const b = p.birth ? parseYmd(p.birth) : null;
  const wareki = b ? warekiText(b) : '';
  return `<div class="panel" style="padding:10px 16px;border-radius:14px">
    <div class="small muted">基本情報から自動で入ります（ここでは変更できません）</div>
    <div class="small" style="display:flex;gap:18px;flex-wrap:wrap;font-weight:700">
      <span>氏名：${esc(dispName(p))} 様</span><span>生年月日：${esc(wareki)}${p.birth ? `（${age(p.birth)}歳）` : ''}</span>
      <span>性別：${esc(p.sex || '')}</span><span>要介護度：${esc(p.care || '')}</span><span>住所：${esc(p.address || '')}</span>
    </div></div>`;
}
function warekiText(d) {
  const y = d.getFullYear();
  const era = y >= 2019 ? ['令和', 2018] : y >= 1989 ? ['平成', 1988] : y >= 1926 ? ['昭和', 1925] : ['大正', 1911];
  return `${era[0]}${y - era[1]}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ================= 訪問看護計画書 =================
function renderPlan(body, p) {
  const docs = db().plansDoc;
  if (!docs[p.id]) docs[p.id] = { created: todayStr(), goal: '', problems: [{ date: todayStr(), text: '', eval: '' }], supplies: '', procedures: [], roles: [], memo: '', author1: '', role1: '', author2: '', role2: '', office: db().settings.office, manager: '' };
  const d = docs[p.id];
  const again = () => renderPlan(body, p);
  body.innerHTML = `
    ${autoStrip(p)}
    <div class="panel"><h2>訪問看護計画書</h2>
      ${gridHtml([{ k: 'created', label: '計画書作成日', type: 'date' }, { k: 'goal', label: '看護・リハビリテーションの目標', type: 'textarea', w: 4 }], d)}
      <h3>問題点・解決策・評価</h3>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th style="width:150px">年月日</th><th>問題点・解決策</th><th>評価</th><th class="no-print" style="width:60px"></th></tr></thead>
        <tbody>${d.problems.map((r, i) => `<tr>
          <td><input type="date" data-pr="${i}" data-f="date" value="${esc(r.date)}"></td>
          <td class="wrap"><textarea data-pr="${i}" data-f="text" rows="2">${esc(r.text)}</textarea></td>
          <td class="wrap"><textarea data-pr="${i}" data-f="eval" rows="2">${esc(r.eval)}</textarea></td>
          <td class="no-print"><button type="button" class="link-btn" data-prdel="${i}">削除</button></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="no-print"><button type="button" class="pill" id="pr-add">行を追加</button></p>
      ${gridHtml([{ k: 'supplies', label: '衛生材料等が必要な処置の有無', type: 'radio', opts: ['有', '無'], w: 4 }], d)}
      <div class="tbl-wrap" style="margin-top:10px"><table class="tbl">
        <thead><tr><th>処置の内容</th><th>衛生材料（種類・サイズ）等</th><th>必要量</th><th class="no-print" style="width:60px"></th></tr></thead>
        <tbody>${d.procedures.map((r, i) => `<tr>
          <td><input type="text" data-pc="${i}" data-f="what" value="${esc(r.what)}"></td>
          <td><input type="text" data-pc="${i}" data-f="item" value="${esc(r.item)}"></td>
          <td><input type="text" data-pc="${i}" data-f="qty" value="${esc(r.qty)}"></td>
          <td class="no-print"><button type="button" class="link-btn" data-pcdel="${i}">削除</button></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="no-print"><button type="button" class="pill" id="pc-add">処置を追加</button></p>
      ${gridHtml([
        { k: 'roles', label: '訪問予定の職種', type: 'checks', opts: ['看護師', '准看護師', '保健師', '理学療法士', '作業療法士', '言語聴覚士'], w: 4 },
        { k: 'memo', label: '備考', type: 'textarea', rows: 2, w: 4 },
        { k: 'author1', label: '作成者① 氏名' }, { k: 'role1', label: '作成者① 職種' }, { k: 'author2', label: '作成者② 氏名' }, { k: 'role2', label: '作成者② 職種' },
        { k: 'office', label: '事業所名', w: 2 }, { k: 'manager', label: '管理者氏名', w: 2 },
      ], d)}
      <p class="small muted">入力はその場で保存されます。</p>
    </div>`;
  bindFields(body, d);
  $$('[data-pr]', body).forEach((el) => { el.oninput = () => { d.problems[Number(el.dataset.pr)][el.dataset.f] = el.value; save(); }; });
  $$('[data-pc]', body).forEach((el) => { el.oninput = () => { d.procedures[Number(el.dataset.pc)][el.dataset.f] = el.value; save(); }; });
  $$('[data-prdel]', body).forEach((b) => { b.onclick = () => { d.problems.splice(Number(b.dataset.prdel), 1); save(); again(); }; });
  $$('[data-pcdel]', body).forEach((b) => { b.onclick = () => { d.procedures.splice(Number(b.dataset.pcdel), 1); save(); again(); }; });
  $('#pr-add', body).onclick = () => { d.problems.push({ date: todayStr(), text: `#${d.problems.length + 1} `, eval: '' }); save(); again(); };
  $('#pc-add', body).onclick = () => { d.procedures.push({ what: '', item: '', qty: '' }); save(); again(); };
}

// ================= 看護サマリ =================
function renderSummary(body, p) {
  const all = db().summaries;
  if (!all[p.id]) all[p.id] = {};
  const s = all[p.id];
  const ADL = ['自立', '見守り', '一部介助', '全介助'];
  body.innerHTML = `
    ${autoStrip(p)}
    <div class="panel"><h2>1. 患者基本情報</h2>
      ${gridHtml([
        { k: 'live', label: '居住状況', type: 'radio', opts: ['一戸建て', '集合住宅'] }, { k: 'floor', label: '階' },
        { k: 'elevator', label: 'エレベータ', type: 'radio', opts: ['有', '無'] }, { k: 'homeTel', label: '自宅電話番号' },
        { k: 'present', label: '現病歴', type: 'textarea', w: 4 },
      ], s)}
    </div>
    <div class="panel"><h2>2. 家族・支援者情報</h2>
      ${gridHtml([
        { k: 'mainCarer', label: '主介護者' }, { k: 'carerAge', label: '年齢' }, { k: 'carerHealth', label: '健康状態', w: 2 },
        { k: 'household', label: '世帯', type: 'checks', opts: ['高齢者世帯', '独居', '日中独居', '家族介護要', '家族が遠方'], w: 4 },
        { k: 'familyNote', label: '補足', type: 'textarea', rows: 2, w: 4 },
      ], s)}
    </div>
    <div class="panel"><h2>3. アレルギー情報</h2>
      ${gridHtml([{ k: 'alDrug', label: '薬剤アレルギー等', w: 2 }, { k: 'alFood', label: '食物アレルギー', w: 2 }], s)}
    </div>
    <div class="panel"><h2>4. 身体状態情報</h2>
      ${gridHtml([
        { k: 'symptoms', label: '身体症状', type: 'checks', opts: ['なし', '痛み', '倦怠感', '眠気', '吐き気', '食欲不振', '呼吸困難', '不安'], w: 4 },
        { k: 'ulcer', label: '褥瘡', type: 'radio', opts: ['無', 'リスク有', '有'], w: 2 }, { k: 'move', label: '移動手段', type: 'radio', opts: ['徒歩', '杖', '車いす'], w: 2 },
        { band: 'ADL' },
        { k: 'adlEat', label: '食事', type: 'select', opts: ADL }, { k: 'adlMove', label: '移乗', type: 'select', opts: ADL },
        { k: 'adlToilet', label: 'トイレ動作', type: 'select', opts: ADL }, { k: 'adlBath', label: '入浴', type: 'select', opts: ADL },
      ], s)}
    </div>
    <div class="panel"><h2>5. 医療処置情報</h2>
      ${gridHtml([
        { k: 'excretion', label: '排泄', type: 'checks', opts: ['自立', 'トイレ介助要', 'オムツ排泄', '膀胱留置カテーテル'], w: 4 },
        { k: 'sleep', label: '睡眠', type: 'radio', opts: ['良好', '入眠困難', '中途覚醒'], w: 2 },
        { k: 'nutrition', label: '栄養', type: 'radio', opts: ['経口栄養', '経腸栄養', '静脈栄養'], w: 2 },
        { k: 'med', label: '薬剤管理', type: 'radio', opts: ['自己管理', '薬剤管理支援が必要'], w: 4 },
        { k: 'procs', label: '医療処置', type: 'checks', opts: ['在宅酸素', '吸引・吸入', '胃瘻', '創傷処置', '褥瘡処置', '自己血糖測定', 'インスリン自己注射'], w: 4 },
      ], s)}
    </div>
    <div class="panel"><h2>6. 生活支援情報</h2>
      ${gridHtml([
        { k: 'smoke', label: '喫煙', type: 'radio', opts: ['あり', 'やめた', 'なし'], w: 2 }, { k: 'drink', label: '飲酒', type: 'radio', opts: ['飲む', '飲まない', '機会飲酒'], w: 2 },
        { band: '記載元' },
        { k: 'writer', label: '病院・病棟', w: 2 }, { k: 'nurse', label: '担当看護師' }, { k: 'writeDate', label: 'サマリ記載日', type: 'date' },
      ], s)}
      <p class="small muted">入力はその場で保存されます。</p>
    </div>`;
  bindFields(body, s);
}
