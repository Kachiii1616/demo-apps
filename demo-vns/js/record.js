// 訪問看護記録（過去の回が横に並び、右端の列に今日の記録を入れる）
import { db, save, todayStr, md, longDate, staffById, recordsOf, kindOfStaff, uid, toMin, hhmm, actualOf } from './store.js';
import { $, $$, esc, toast, openModal, closeModal, opt } from './ui.js';

const SERIES = [
  { k: 'temp', label: '体温', unit: '℃', color: '#3d6fd1', shape: 'dot', min: 35, max: 40, ax: '℃' },
  { k: 'pulse', label: '脈拍', unit: '回/分', color: '#e07b39', shape: 'ring', min: 40, max: 140, ax: '脈' },
  { k: 'bp', label: '血圧', unit: 'mmHg', color: '#3aa17e', shape: 'tri', min: 40, max: 240, ax: '圧' },
  { k: 'weight', label: '体重', unit: 'kg', color: '#e0a526', shape: 'sq', min: 0, max: 5, ax: 'kg' },
  { k: 'spo2', label: 'SpO2', unit: '%', color: '#d26b9c', shape: 'dia', min: 85, max: 100, ax: '%' },
];
const OKS = ['OK', '△', '×'];
const HYG = ['清拭', '陰洗', '足浴'];

// 利用者ごとの表示状態（画面を切り替えても保つ）
const states = {};
function st(pid) {
  if (!states[pid]) states[pid] = { offset: 0, show: { '看護': true, 'リハビリ': true }, graph: false, editingId: null, series: { temp: true, pulse: true, bp: true, weight: true, spo2: true } };
  return states[pid];
}

export function renderRecordTab(body, p, refreshHead) {
  const s = st(p.id);
  const all = recordsOf(p.id);
  const list = all.filter((r) => s.show[r.kind]);
  const N = db().settings.visibleCount;
  const end = Math.max(0, list.length - s.offset);
  const begin = Math.max(0, end - N);
  const cols = list.slice(begin, end);
  const editing = s.editingId ? all.find((r) => r.id === s.editingId) : null;
  const draft = editing || defaultDraft(p);
  const again = () => renderRecordTab(body, p, refreshHead);

  // 体重の前回差（記録全体の並びで計算）
  const prevWeight = (r) => {
    const i = all.findIndex((x) => x.id === r.id);
    for (let j = i - 1; j >= 0; j--) if (all[j].weight) return all[j].weight;
    return null;
  };
  const wDiff = (r) => {
    const pw = prevWeight(r);
    if (!r.weight || pw == null) return '';
    const d = Math.round((r.weight - pw) * 10) / 10;
    return `（${d > 0 ? '+' : ''}${d.toFixed(1)}）`;
  };

  const row = (label, past, input, cls = '') => `<tr class="${cls}"><th>${label}</th>${cols.map(past).join('')}${input !== null ? `<td class="inp">${input}</td>` : ''}</tr>`;
  const okSel = (name, v) => `<select name="${name}" class="ok-sel"><option value=""></option>${OKS.map((o) => opt(o, o, v)).join('')}</select>`;
  const staffSel = draft.staffId || db().staff[0]?.id;

  body.innerHTML = `
    <div class="rec-tools no-print">
      <div class="chips"><button type="button" class="chip on">記録</button></div>
      <div class="chips"><span class="small muted">表示</span>
        ${['看護', 'リハビリ'].map((k) => `<button type="button" class="chip ${s.show[k] ? 'on' : ''}" data-kind="${k}">${s.show[k] ? '✓ ' : ''}${k}</button>`).join('')}
      </div>
    </div>
    <hr class="soft no-print">
    <p class="help no-print">過去の記録は直近${N}回分が見えています。表を横にスライドするか、右のボタンで前の記録に移れます（全${list.length}回）。</p>
    <div class="head-tools no-print" style="margin-bottom:12px">
      <button type="button" class="pill" id="older" ${begin > 0 ? '' : 'disabled'}>◀ 前の記録</button>
      <button type="button" class="pill" id="newer" ${s.offset > 0 ? '' : 'disabled'}>次の記録 ▶</button>
      <button type="button" class="pill" id="graph-btn">${s.graph ? 'グラフを閉じる' : '血圧・体重・SpO2のグラフ'}</button>
    </div>
    ${s.graph ? graphsHtml(list) : ''}
    <form id="rec-form" autocomplete="off">
    <div class="rec-wrap"><table class="rec">
      <tbody>
      ${row('日付・訪問者', (r) => `<td><div class="rec-date">${md(r.date)}（${esc(staffById(r.staffId)?.name || '')}）</div><span class="badge kind">${r.kind}</span> <button type="button" class="pill-sm no-print" data-edit="${r.id}">修正</button></td>`,
        `<div style="font-weight:700;margin-bottom:6px">${editing ? `修正中：${md(editing.date)} の記録` : `本日 ${longDate(todayStr())}`}</div>
         <div class="chips"><input type="date" name="date" value="${esc(draft.date)}" required>
         <select name="staffId">${db().staff.map((x) => opt(x.id, x.name, staffSel)).join('')}</select>
         <select name="kind">${['看護', 'リハビリ'].map((k) => opt(k, k, draft.kind || kindOfStaff(staffSel))).join('')}</select></div>`)}
      ${row('滞在時間', (r) => `<td>${r.start}〜${r.end}</td>`,
        `<div class="chips"><input type="time" name="start" value="${esc(draft.start || '')}"> 〜 <input type="time" name="end" value="${esc(draft.end || '')}"></div>`)}
      <tr><th class="chart-axis">${axisHtml(p, all)}</th>${cols.length ? `<td class="chart" colspan="${cols.length}">${chartSvg(cols, p, all, s.series)}</td>` : ''}
        <td class="inp"><div style="font-weight:700;margin-bottom:4px">体温表</div>
          <div class="series-ck">${SERIES.map((x) => `<label><input type="checkbox" data-series="${x.k}" ${s.series[x.k] ? 'checked' : ''}> ${glyph(x)} ${x.label} <span class="small muted">${x.unit}</span></label>`).join('')}</div>
          <p class="small muted" style="margin:6px 0 0">チェックを入れた値がグラフに出ます。目盛りは左端の列で、値ごとに別です。点に触れると値が出ます。</p></td></tr>
      ${row('血圧', (r) => `<td>${r.sys ? `${r.sys} / ${r.dia}` : ''}</td>`,
        `<input type="number" name="sys" placeholder="収縮期" value="${esc(draft.sys ?? '')}" inputmode="numeric"> / <input type="number" name="dia" placeholder="拡張期" value="${esc(draft.dia ?? '')}" inputmode="numeric">`)}
      ${row('脈拍', (r) => `<td>${r.pulse ?? ''}</td>`, `<input type="number" name="pulse" placeholder="回/分" value="${esc(draft.pulse ?? '')}">`)}
      ${row('体温', (r) => `<td>${r.temp ? `${r.temp} ℃` : ''}</td>`, `<input type="number" step="0.1" name="temp" placeholder="℃" value="${esc(draft.temp ?? '')}">`)}
      ${row('SpO2', (r) => `<td>${r.spo2 ? `${r.spo2} %` : ''}</td>`, `<input type="number" name="spo2" placeholder="%" value="${esc(draft.spo2 ?? '')}">`)}
      ${row('食欲', (r) => `<td>${esc(r.appetite || '')}</td>`, okSel('appetite', draft.appetite))}
      ${row('排尿', (r) => `<td>${esc(r.urine || '')}</td>`, okSel('urine', draft.urine))}
      ${row('排便', (r) => `<td>${esc(r.stool || '')}</td>`, okSel('stool', draft.stool))}
      ${row('体重', (r) => `<td>${r.weight ? `${r.weight} kg${wDiff(r)}` : ''}</td>`, `<input type="number" step="0.1" name="weight" placeholder="kg" value="${esc(draft.weight ?? '')}"> <span class="small muted">前回差は自動計算</span>`)}
      ${row('睡眠', (r) => `<td>${esc(r.sleep || '')}</td>`, okSel('sleep', draft.sleep))}
      ${row('保清', (r) => `<td>${esc((r.hygiene || []).join('・'))}</td>`, HYG.map((h) => `<label class="ck"><input type="checkbox" name="hygiene" value="${h}" ${(draft.hygiene || []).includes(h) ? 'checked' : ''}> ${h}</label>`).join(''))}
      ${row('看護で<br>やること', (r) => `<td><ul class="task-list">${p.tasks.map((t) => `<li>${r.tasks && r.tasks[t] ? '✓' : '□'} ${esc(t)}</li>`).join('')}</ul></td>`,
        `<div>${p.tasks.map((t) => `<label class="ck" style="display:flex"><input type="checkbox" name="task" value="${esc(t)}" ${draft.tasks && draft.tasks[t] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>
         <div class="chips no-print" style="margin-top:6px"><button type="button" class="pill-sm" id="do-btn">前回と同じ（do）</button><button type="button" class="pill-sm" id="task-edit">項目を登録・編集</button></div>`)}
      ${row('記録', (r) => `<td>${esc(r.soap || '')}</td>`, `<textarea name="soap" rows="6">${esc(draft.soap ?? 'S）\nO）')}</textarea>`)}
      ${row('アセスメント<br>計画', (r) => `<td>${esc(r.ap || '')}</td>`, `<textarea name="ap" rows="3">${esc(draft.ap ?? 'A/P）')}</textarea>`)}
      ${row('備考', (r) => `<td>${esc(r.note || '')}</td>`, `<textarea name="note" rows="2">${esc(draft.note || '')}</textarea>`)}
      ${row('次回への<br>申し送り', (r) => `<td>${esc(r.handover || '')}</td>`, `<textarea name="handover" rows="3" placeholder="次に訪問する人へ伝えたいこと">${esc(draft.handover || '')}</textarea>`)}
      ${row('', () => '<td></td>', `<div class="chips no-print"><button type="submit" class="pill mint">記録を保存</button>${editing ? '<button type="button" class="pill plain" id="cancel-edit">修正をやめる</button>' : ''}</div>`)}
      </tbody>
    </table></div>
    </form>`;

  // ---- 操作 ----
  $$('[data-kind]', body).forEach((b) => { b.onclick = () => { s.show[b.dataset.kind] = !s.show[b.dataset.kind]; s.offset = 0; again(); }; });
  $('#older', body).onclick = () => { if (begin > 0) { s.offset++; again(); } };
  $('#newer', body).onclick = () => { if (s.offset > 0) { s.offset--; again(); } };
  $('#graph-btn', body).onclick = () => { s.graph = !s.graph; again(); };
  $$('[data-series]', body).forEach((c) => { c.onchange = () => { s.series[c.dataset.series] = c.checked; again(); }; });
  $$('[data-edit]', body).forEach((b) => { b.onclick = () => { s.editingId = b.dataset.edit; again(); toast('右端の列で修正できます'); }; });
  const ce = $('#cancel-edit', body); if (ce) ce.onclick = () => { s.editingId = null; again(); };
  // 職員を選ぶと区分も合わせる
  const form = $('#rec-form', body);
  form.staffId.onchange = () => { form.kind.value = kindOfStaff(form.staffId.value); };

  // 横スクロールは最新（右端）が見える位置に
  const wrap = $('.rec-wrap', body);
  wrap.scrollLeft = wrap.scrollWidth;

  $('#do-btn', body).onclick = () => {
    const last = all[all.length - 1];
    if (!last) { toast('前回の記録がありません'); return; }
    $$('input[name=task]', form).forEach((c) => { c.checked = !!(last.tasks && last.tasks[c.value]); });
    toast('前回と同じ項目にチェックしました');
  };
  $('#task-edit', body).onclick = () => {
    openModal(`
      <h2>看護でやること（項目）</h2>
      <label class="fld">1行に1項目ずつ書きます<textarea id="task-lines" rows="8">${esc(p.tasks.join('\n'))}</textarea></label>
      <div class="modal-actions"><button type="button" class="pill" id="tl-c">閉じる</button><button type="button" class="pill mint" id="tl-s">保存</button></div>`, (m) => {
      $('#tl-c', m).onclick = closeModal;
      $('#tl-s', m).onclick = () => {
        p.tasks = $('#task-lines', m).value.split('\n').map((x) => x.trim()).filter(Boolean);
        save(); closeModal(); toast('項目を保存しました'); again();
      };
    });
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const num = (k) => { const v = String(f.get(k) || '').trim(); return v === '' ? null : Number(v); };
    const start = String(f.get('start') || ''), endT = String(f.get('end') || '');
    if (!start || !endT) { toast('滞在時間（開始・終了）を入れてください'); return; }
    if (toMin(endT) <= toMin(start)) { toast('終了は開始より後にしてください'); return; }
    const tasks = {};
    p.tasks.forEach((t) => { tasks[t] = f.getAll('task').includes(t); });
    const rec = {
      id: editing ? editing.id : uid('r'), patientId: p.id,
      date: String(f.get('date')), staffId: String(f.get('staffId')), kind: String(f.get('kind')),
      start: hhmm(toMin(start)), end: hhmm(toMin(endT)),
      sys: num('sys'), dia: num('dia'), pulse: num('pulse'), temp: num('temp'), spo2: num('spo2'), weight: num('weight'),
      appetite: String(f.get('appetite') || ''), urine: String(f.get('urine') || ''), stool: String(f.get('stool') || ''), sleep: String(f.get('sleep') || ''),
      hygiene: f.getAll('hygiene').map(String), tasks,
      soap: String(f.get('soap') || ''), ap: String(f.get('ap') || ''), note: String(f.get('note') || ''), handover: String(f.get('handover') || ''),
    };
    const d = db();
    if (editing) d.records = d.records.map((r) => (r.id === rec.id ? rec : r));
    else d.records.push(rec);
    save();
    s.editingId = null; s.offset = 0;
    toast(editing ? '記録を修正しました' : '記録を保存しました。スケジュールの実績にも入ります');
    refreshHead();
    again();
  };
}

// 今日の予定があれば、その職員・時間を最初から入れておく
function defaultDraft(p) {
  const T = todayStr();
  const plan = db().plans.filter((v) => v.patientId === p.id && v.date === T && !actualOf(v)).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (plan) return { date: T, staffId: plan.staffId, kind: plan.kind, start: plan.start, end: plan.end };
  return { date: T, staffId: db().staff[0]?.id, kind: kindOfStaff(db().staff[0]?.id), start: '', end: '' };
}

// ---------- 体温表 ----------
function weightRange(p, all) {
  const ws = all.map((r) => r.weight).filter(Boolean);
  const mean = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 50;
  const min = Math.floor(mean - 2.5);
  return [min, min + 5];
}
function glyph(x, size = 9) {
  const c = x.color;
  const map = {
    dot: `<span class="dot" style="background:${c}"></span>`,
    ring: `<span class="dot" style="border:2px solid ${c};width:${size}px;height:${size}px;box-sizing:border-box"></span>`,
    tri: `<span style="color:${c};font-size:9px">▲</span>`,
    sq: `<span style="display:inline-block;width:8px;height:8px;background:${c}"></span>`,
    dia: `<span style="color:${c};font-size:11px">◇</span>`,
  };
  return map[x.shape];
}
function axisHtml(p, all) {
  const [wmin, wmax] = weightRange(p, all);
  const ticks = (x) => {
    const [mn, mx] = x.k === 'weight' ? [wmin, wmax] : [x.min, x.max];
    return Array.from({ length: 6 }, (_, i) => Math.round((mx - (mx - mn) * i / 5) * 10) / 10);
  };
  const colsT = SERIES.map(ticks);
  let html = '<div class="axis">';
  SERIES.forEach((x) => { html += `<div class="lg">${glyph(x, 8)}<span>${x.ax}</span></div>`; });
  for (let i = 0; i < 6; i++) colsT.forEach((t) => { html += `<div class="tk">${t[i]}</div>`; });
  return html + '</div>';
}

function chartSvg(cols, p, all, show) {
  const [wmin, wmax] = weightRange(p, all);
  const top = 26 + 10.5;
  const span = 5 * 21;
  const H = 26 + 6 * 21;
  const y = (x, v) => {
    const [mn, mx] = x.k === 'weight' ? [wmin, wmax] : [x.min, x.max];
    const c = Math.max(mn, Math.min(mx, v));
    return top + (mx - c) / (mx - mn) * span;
  };
  const n = cols.length;
  const cx = (i) => `${((i + 0.5) / n) * 100}%`;
  let g = '';
  for (let i = 0; i < 6; i++) g += `<line x1="0" x2="100%" y1="${top + i * 21}" y2="${top + i * 21}" stroke="#efe4e0" stroke-width="1"/>`;
  for (let i = 1; i < n; i++) g += `<line x1="${(i / n) * 100}%" x2="${(i / n) * 100}%" y1="0" y2="${H}" stroke="#ece0dc"/>`;

  const marker = (x, i, v, label) => {
    const yy = y(x, v);
    const t = `<title>${esc(label)}</title>`;
    if (x.shape === 'dot') return `<circle cx="${cx(i)}" cy="${yy}" r="4" fill="${x.color}">${t}</circle>`;
    if (x.shape === 'ring') return `<circle cx="${cx(i)}" cy="${yy}" r="4.5" fill="#fff" stroke="${x.color}" stroke-width="2">${t}</circle>`;
    if (x.shape === 'sq') return `<svg x="${cx(i)}" y="${yy}" overflow="visible"><rect x="-4" y="-4" width="8" height="8" fill="${x.color}">${t}</rect></svg>`;
    if (x.shape === 'dia') return `<svg x="${cx(i)}" y="${yy}" overflow="visible"><path d="M0 -6 L6 0 L0 6 L-6 0 Z" fill="#fff" stroke="${x.color}" stroke-width="1.8">${t}</path></svg>`;
    return `<svg x="${cx(i)}" y="${yy}" overflow="visible"><path d="M0 -5 L5 4 L-5 4 Z" fill="${x.color}">${t}</path></svg>`;
  };

  SERIES.forEach((x) => {
    if (!show[x.k]) return;
    if (x.k === 'bp') {
      cols.forEach((r, i) => {
        if (!r.sys) return;
        g += `<line x1="${cx(i)}" x2="${cx(i)}" y1="${y(x, r.sys)}" y2="${y(x, r.dia)}" stroke="${x.color}" stroke-width="2"/>`;
        g += marker(x, i, r.sys, `血圧 ${r.sys}/${r.dia}`) + marker(x, i, r.dia, `血圧 ${r.sys}/${r.dia}`);
      });
      return;
    }
    const pts = cols.map((r, i) => ({ i, v: r[x.k] })).filter((o) => o.v != null && o.v !== '');
    for (let j = 1; j < pts.length; j++) {
      g += `<line x1="${cx(pts[j - 1].i)}" x2="${cx(pts[j].i)}" y1="${y(x, pts[j - 1].v)}" y2="${y(x, pts[j].v)}" stroke="${x.color}" stroke-width="1.6"/>`;
    }
    pts.forEach((o) => { g += marker(x, o.i, o.v, `${x.label} ${o.v}${x.unit === '回/分' ? '' : ' '}${x.unit}`); });
  });
  return `<svg width="100%" height="${H}" role="img" aria-label="体温表">${g}</svg>`;
}

// ---------- グラフ（血圧・体重・SpO2） ----------
function graphsHtml(list) {
  const recent = list.slice(-12);
  if (!recent.length) return '<div class="panel">まだ記録がありません。</div>';
  const chart = (title, unit, lines) => {
    const vals = lines.flatMap((l) => recent.map((r) => r[l.k])).filter((v) => v != null);
    if (!vals.length) return '';
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.15; mn -= pad; mx += pad;
    const W = 320, H = 150, L = 34, R = 10, Tp = 12, B = 22;
    const xs = (i) => L + (recent.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (recent.length - 1));
    const ys = (v) => Tp + (mx - v) / (mx - mn) * (H - Tp - B);
    let g = '';
    for (let i = 0; i <= 3; i++) {
      const v = mn + (mx - mn) * i / 3;
      g += `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="#efe4e0"/><text x="${L - 4}" y="${ys(v) + 3}" font-size="9" text-anchor="end" fill="#8a776d">${Math.round(v * 10) / 10}</text>`;
    }
    recent.forEach((r, i) => { if (i % Math.ceil(recent.length / 6) === 0 || i === recent.length - 1) g += `<text x="${xs(i)}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#8a776d">${md(r.date).replace(/\(.\)/, '')}</text>`; });
    lines.forEach((l) => {
      const pts = recent.map((r, i) => (r[l.k] != null ? `${xs(i)},${ys(r[l.k])}` : null)).filter(Boolean);
      g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${l.color}" stroke-width="2"/>`;
      recent.forEach((r, i) => { if (r[l.k] != null) g += `<circle cx="${xs(i)}" cy="${ys(r[l.k])}" r="3" fill="${l.color}"><title>${md(r.date)} ${l.label} ${r[l.k]}</title></circle>`; });
    });
    const last = recent[recent.length - 1];
    return `<div class="graph-card"><h3>${title} <span class="small muted">${unit}</span> <span class="small" style="float:right">${lines.map((l) => `${l.label} ${last[l.k] ?? '—'}`).join(' / ')}</span></h3>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${title}のグラフ">${g}</svg></div>`;
  };
  return `<div class="graphs">
    ${chart('血圧', 'mmHg', [{ k: 'sys', label: '上', color: '#3d6fd1' }, { k: 'dia', label: '下', color: '#7fa6e6' }])}
    ${chart('体重', 'kg', [{ k: 'weight', label: '体重', color: '#e0a526' }])}
    ${chart('SpO2', '%', [{ k: 'spo2', label: 'SpO2', color: '#d26b9c' }])}
  </div>`;
}
