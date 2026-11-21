// 請求（デモ用の仮の点数・単価で数えるだけ。実際の報酬計算ではありません）
import { db, save, todayStr, md, staffById, toMin } from './store.js';
import { $, $$, esc, toast, setTopActions, printAction, downloadCsv, yen, opt } from './ui.js';

// デモ用の仮の値（実在の報酬とは無関係）
const UNIT_YEN = 10;
const CARE_BANDS = [
  { id: 'c1', name: '訪問（30分未満）', max: 29, units: 450 },
  { id: 'c2', name: '訪問（30分以上60分未満）', max: 59, units: 800 },
  { id: 'c3', name: '訪問（60分以上）', max: 9999, units: 1100 },
];
const REHAB = { id: 'r1', name: 'リハビリ職の訪問（1回）', units: 600 };
const MEDICAL_PER_VISIT = 5500;
const ADDONS = [
  { id: 'a1', name: '24時間連絡体制（デモ）', units: 500 },
  { id: 'a2', name: '初回の訪問（デモ）', units: 300 },
  { id: 'a3', name: '特別な管理（デモ）', units: 250 },
];

const bv = { month: null, tab: 'list', pid: null };
const rate = (p) => (p.burden === '2割' ? 0.2 : p.burden === '3割' ? 0.3 : 0.1);
const monthLabel = (m) => { const [y, mm] = m.split('-'); return `${y}年${Number(mm)}月`; };

function autoSvc(r) {
  if (r.kind === 'リハビリ') return REHAB;
  const min = toMin(r.end) - toMin(r.start);
  return CARE_BANDS.find((b) => min <= b.max);
}
function svcOf(r) {
  const over = (db().billingSvc || {})[r.id];
  if (over) return [...CARE_BANDS, REHAB].find((b) => b.id === over) || autoSvc(r);
  return autoSvc(r);
}

function calc(p, month) {
  const recs = db().records.filter((r) => r.patientId === p.id && r.date.startsWith(month)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const plans = db().plans.filter((v) => v.patientId === p.id && v.date.startsWith(month));
  const T = todayStr();
  const missed = plans.filter((v) => v.date < T && !recs.some((r) => r.date === v.date && r.staffId === v.staffId)).length;
  const key = `${month}:${p.id}`;
  const addons = ((db().billingAddons || {})[key]) || [];
  let units = null, total;
  if (p.insurance === '医療保険') {
    total = recs.length * MEDICAL_PER_VISIT;
  } else {
    units = recs.reduce((a, r) => a + svcOf(r).units, 0) + (recs.length ? ADDONS.filter((a) => addons.includes(a.id)).reduce((a, x) => a + x.units, 0) : 0);
    total = units * UNIT_YEN;
  }
  const self = Math.round(total * rate(p));
  return { recs, plans, missed, units, total, insurer: total - self, self, fixed: !!(db().billingFixed || {})[key], key, addons };
}

export function renderBilling(view) {
  if (!bv.month) bv.month = todayStr().slice(0, 7);
  setTopActions([printAction()]);
  const pts = db().patients.filter((p) => p.name);
  if (!bv.pid || !pts.some((p) => p.id === bv.pid)) bv.pid = pts[0]?.id;

  view.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">BILLING</div><h1>請求</h1></div>
      <div class="head-tools"><span class="small muted">対象月</span><input type="month" id="bm" value="${bv.month}"></div>
    </div>
    <div class="notice">点数と金額は、デモ用の仮の値（1点＝${UNIT_YEN}円、訪問時間で3段階 など）で数えています。実際の報酬や請求のしくみとは関係ありません。</div>
    <div class="chips no-print">
      <button type="button" class="chip ${bv.tab === 'list' ? 'on' : ''}" data-btab="list">月次一覧</button>
      <button type="button" class="chip ${bv.tab === 'user' ? 'on' : ''}" data-btab="user">利用者ごとの実績表・請求書</button>
    </div>
    <hr class="soft">
    <div id="bill-body"></div>`;
  $('#bm').onchange = (e) => { if (e.target.value) { bv.month = e.target.value; renderBilling(view); } };
  $$('[data-btab]', view).forEach((b) => { b.onclick = () => { bv.tab = b.dataset.btab; renderBilling(view); }; });
  const body = $('#bill-body');
  if (bv.tab === 'list') listHtml(body, pts, view); else userHtml(body, pts, view);
}

function listHtml(body, pts, view) {
  const rows = pts.map((p) => ({ p, c: calc(p, bv.month) }));
  const sum = (k) => rows.reduce((a, r) => a + r.c[k], 0);
  body.innerHTML = `
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>利用者</th><th>保険</th><th>負担</th><th>予定</th><th>実績</th><th>点数</th><th>費用総額</th><th>保険請求額</th><th>利用者負担額</th><th>状態</th></tr></thead>
      <tbody>
        ${rows.map(({ p, c }) => `<tr>
          <td><button type="button" class="name-link" data-open="${p.id}">${esc(p.name)}</button></td>
          <td>${esc(p.insurance)}</td><td>${esc(p.burden)}</td><td>${c.plans.length}</td>
          <td>${c.recs.length}${c.missed ? ` <span class="badge soon">未実施 ${c.missed}</span>` : ''}</td>
          <td>${c.units == null ? '—' : c.units.toLocaleString()}</td><td>${yen(c.total)}</td><td>${yen(c.insurer)}</td><td>${yen(c.self)}</td>
          <td><span class="badge ${c.fixed ? 'ok' : 'info'}">${c.fixed ? '確定' : '未確定'}</span></td></tr>`).join('')}
        <tr class="total"><td colspan="6">合計</td><td>${yen(sum('total'))}</td><td>${yen(sum('insurer'))}</td><td>${yen(sum('self'))}</td><td></td></tr>
      </tbody>
    </table></div>
    <p class="no-print"><button type="button" class="pill" id="csv">この一覧をCSVで保存</button></p>`;
  $$('[data-open]', body).forEach((b) => { b.onclick = () => { bv.pid = b.dataset.open; bv.tab = 'user'; renderBilling(view); }; });
  $('#csv', body).onclick = () => {
    downloadCsv(`請求一覧_${bv.month}.csv`, [['利用者', '保険', '負担', '予定', '実績', '点数', '費用総額', '保険請求額', '利用者負担額', '状態'],
      ...rows.map(({ p, c }) => [p.name, p.insurance, p.burden, c.plans.length, c.recs.length, c.units ?? '', c.total, c.insurer, c.self, c.fixed ? '確定' : '未確定'])]);
    toast('CSVを保存しました（架空データ）');
  };
}

function userHtml(body, pts, view) {
  const p = pts.find((x) => x.id === bv.pid);
  if (!p) { body.innerHTML = '<p class="muted">利用者がいません。</p>'; return; }
  const c = calc(p, bv.month);
  const med = p.insurance === '医療保険';
  const svcCount = {};
  c.recs.forEach((r) => { const sname = med ? '訪問（医療保険・1回）' : svcOf(r).name; svcCount[sname] = svcCount[sname] || { n: 0, units: 0 }; svcCount[sname].n++; svcCount[sname].units += med ? 0 : svcOf(r).units; });

  body.innerHTML = `
    <div class="page-head" style="align-items:center">
      <div><div class="small muted">利用者</div>
        <select id="bp">${pts.map((x) => opt(x.id, x.name, p.id)).join('')}</select>
        <span class="small">${esc(p.insurance)}・負担 ${esc(p.burden)}</span></div>
      <button type="button" class="pill mint no-print" id="fix">${c.fixed ? '確定を取り消す' : 'この月の実績を確定'}</button>
    </div>
    <div class="panel"><h2>サービス提供実績表　${monthLabel(bv.month)}分</h2>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>日付</th><th>訪問者</th><th>時間</th><th>分</th><th>サービス内容</th><th>${med ? '金額' : '点数'}</th></tr></thead>
        <tbody>${c.recs.map((r) => {
          const a = autoSvc(r);
          const over = (db().billingSvc || {})[r.id] || '';
          return `<tr><td>${md(r.date)}</td><td>${esc(staffById(r.staffId)?.name || '')} <span class="badge kind">${r.kind}</span></td>
            <td>${r.start.replace(/^0/, '')}〜${r.end.replace(/^0/, '')}</td><td>${toMin(r.end) - toMin(r.start)}</td>
            <td>${med ? '訪問（医療保険・1回）' : `<select data-svc="${r.id}" ${c.fixed ? 'disabled' : ''}>${opt('', `自動（${a.name}）`, over)}${[...CARE_BANDS, REHAB].map((b) => opt(b.id, b.name, over)).join('')}</select>`}</td>
            <td>${med ? yen(MEDICAL_PER_VISIT) : svcOf(r).units}</td></tr>`;
        }).join('') || '<tr><td colspan="6" class="muted">この月の実績はまだありません。</td></tr>'}</tbody>
      </table></div>
    </div>
    ${med ? '' : `<div class="panel"><h2>加算（月ごと・デモ用の仮の値）</h2>
      ${ADDONS.map((a) => `<label class="ck"><input type="checkbox" data-addon="${a.id}" ${c.addons.includes(a.id) ? 'checked' : ''} ${c.fixed ? 'disabled' : ''}> ${a.name}（${a.units}点）</label>`).join('')}
    </div>`}
    <div class="panel"><h2>計算</h2>
      <div class="tbl-wrap"><table class="tbl"><tbody>
        ${med ? `<tr><td>訪問回数 × 1回の金額（デモ）</td><td>${c.recs.length}回 × ${yen(MEDICAL_PER_VISIT)}</td></tr>` : `<tr><td>点数の合計</td><td>${c.units.toLocaleString()} 点</td></tr><tr><td>1点の単価（デモ）</td><td>${UNIT_YEN} 円</td></tr>`}
        <tr><td>費用総額</td><td>${yen(c.total)}</td></tr>
        <tr><td>保険請求額</td><td>${yen(c.insurer)}</td></tr>
        <tr><td>利用者負担額（${esc(p.burden)}）</td><td>${yen(c.self)}</td></tr>
      </tbody></table></div>
      <p class="no-print"><button type="button" class="pill" id="csv-u">この実績表をCSVで保存</button></p>
    </div>
    <div class="panel"><h2>請求書（利用者負担分）</h2>
      <div>${esc(p.name)} 様　${monthLabel(bv.month)}分</div>
      <div class="bill-total">ご請求額　${yen(c.self)}</div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>内容</th><th>回数</th><th>${med ? '' : '点数'}</th></tr></thead>
        <tbody>${Object.entries(svcCount).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${med ? '' : v.units.toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">—</td></tr>'}</tbody>
      </table></div>
      <p class="small muted">費用総額 ${yen(c.total)}／保険給付 ${yen(c.insurer)}／利用者負担 ${yen(c.self)}　${esc(db().settings.office)}</p>
    </div>`;

  $('#bp', body).onchange = (e) => { bv.pid = e.target.value; renderBilling(view); };
  $('#fix', body).onclick = () => {
    db().billingFixed = db().billingFixed || {};
    db().billingFixed[c.key] = !c.fixed;
    save(); toast(c.fixed ? '確定を取り消しました' : 'この月の実績を確定しました'); renderBilling(view);
  };
  $$('[data-svc]', body).forEach((s) => {
    s.onchange = () => { db().billingSvc = db().billingSvc || {}; if (s.value) db().billingSvc[s.dataset.svc] = s.value; else delete db().billingSvc[s.dataset.svc]; save(); renderBilling(view); };
  });
  $$('[data-addon]', body).forEach((cb) => {
    cb.onchange = () => {
      db().billingAddons = db().billingAddons || {};
      const set = new Set(db().billingAddons[c.key] || []);
      if (cb.checked) set.add(cb.dataset.addon); else set.delete(cb.dataset.addon);
      db().billingAddons[c.key] = [...set]; save(); renderBilling(view);
    };
  });
  $('#csv-u', body).onclick = () => {
    downloadCsv(`実績表_${bv.month}.csv`, [['日付', '訪問者', '区分', '開始', '終了', 'サービス内容', med ? '金額' : '点数'],
      ...c.recs.map((r) => [r.date, staffById(r.staffId)?.name || '', r.kind, r.start, r.end, med ? '訪問（医療保険・1回）' : svcOf(r).name, med ? MEDICAL_PER_VISIT : svcOf(r).units])]);
    toast('CSVを保存しました（架空データ）');
  };
}
