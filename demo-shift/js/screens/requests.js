import { load, persist, today, addMonth, monthKey, dateKey, activeStaff, DOW, dowOf, parseMonthKey } from '../store.js';
import { esc, toast, ask } from '../ui.js';

const KINDS = ['公休希望', '有給希望', 'その他'];
const form = { staffId: '', dates: [], kind: '公休希望', note: '' };

export function renderRequests(view, { query, rerender }) {
  const data = load();
  const t = today();
  const [ny, nm] = addMonth(t.y, t.m, 1);
  const listKey = query.get('ym') || monthKey(ny, nm);
  const [ly, lm] = parseMonthKey(listKey);
  const staff = activeStaff(data);
  const defDate = dateKey(ny, nm, 1);

  const monthOpts = [-1, 0, 1, 2].map((k) => {
    const [yy, mm] = addMonth(t.y, t.m, k);
    const v = monthKey(yy, mm);
    return `<option value="${v}" ${v === listKey ? 'selected' : ''}>${yy}年${mm}月</option>`;
  }).join('');

  const list = data.requests
    .filter((r) => r.date.startsWith(listKey + '-'))
    .sort((a, b) => a.date.localeCompare(b.date));
  const nameOf = (id) => data.staff.find((s) => s.id === id)?.name || '（削除された職員）';
  const fmtD = (iso) => { const [yy, mm, dd] = iso.split('-').map(Number); return `${mm}/${dd}（${DOW[dowOf(yy, mm, dd)]}）`; };
  const mon = data.months[listKey];

  view.innerHTML = `
    <p class="lead">職員が休みたい日を登録します。登録した日は、月シフトの「自動作成」で休み（有給希望は「有」）として扱われ、表のマスに印が付きます。</p>
    <div class="req-layout">
      <form class="card form-card" id="reqForm" novalidate>
        <p class="muted small" style="margin:0">休み希望を登録します。複数の日をまとめて登録できます。</p>
        <label class="field" for="fStaff">お名前</label>
        <select class="select" id="fStaff" style="width:100%">
          <option value="">選択してください</option>
          ${staff.map((s) => `<option value="${s.id}" ${s.id === form.staffId ? 'selected' : ''}>${esc(s.name)}（${esc(s.emp)}）</option>`).join('')}
        </select>
        <label class="field" for="fDate">希望日（「追加」で複数日も可）</label>
        <div class="row" style="flex-wrap:nowrap">
          <input type="date" class="input" id="fDate" value="${defDate}" style="flex:1;min-width:0">
          <button type="button" class="btn outline" id="addDate">追加</button>
        </div>
        <div class="date-chips">${form.dates.map((dt, i) => `<span>${fmtD(dt)}<button type="button" data-rm="${i}" aria-label="${fmtD(dt)}を外す">×</button></span>`).join('')}</div>
        <label class="field">区分</label>
        <div class="chips">${KINDS.map((k) => `<button type="button" class="chip-btn ${k === form.kind ? 'on' : ''}" data-kind="${k}">${k}</button>`).join('')}</div>
        <label class="field" for="fNote">備考（あれば）</label>
        <input class="input" id="fNote" style="width:100%" placeholder="例：家族の行事のため" value="${esc(form.note)}">
        <button type="submit" class="btn primary big">登録する</button>
      </form>

      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0">登録済みの休み希望</h2>
          <select class="select" id="listMonth" aria-label="表示する月">${monthOpts}</select>
        </div>
        <p class="muted small" style="margin:6px 0 8px">${ly}年${lm}月の勤務表：${!mon ? '未作成' : mon.status === 'published' ? '公開済み（希望の追加は管理者が手直しで反映します）' : '作成中'}</p>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>日付</th><th>お名前</th><th>区分</th><th>備考</th><th></th></tr></thead>
          <tbody>${list.map((r) => `<tr>
            <td style="white-space:nowrap">${fmtD(r.date)}</td><td style="white-space:nowrap">${esc(nameOf(r.staffId))}</td>
            <td><span class="badge ${r.kind === '有給希望' ? 'draft' : 'saved'}">${esc(r.kind)}</span></td>
            <td class="small">${esc(r.note) || '<span class="muted">—</span>'}</td>
            <td><button class="btn small danger" data-del="${r.id}">取り消し</button></td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="muted" style="text-align:center;padding:24px 0">この月の休み希望はまだありません。</p>'}
      </div>
    </div>`;

  const $ = (s) => view.querySelector(s);
  const keep = () => { form.staffId = $('#fStaff').value; form.note = $('#fNote').value; };
  $('#addDate').addEventListener('click', () => {
    keep();
    const v = $('#fDate').value;
    if (!v) return;
    if (!form.dates.includes(v)) form.dates.push(v);
    form.dates.sort();
    rerender();
  });
  view.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { keep(); form.dates.splice(Number(b.dataset.rm), 1); rerender(); }));
  view.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { keep(); form.kind = b.dataset.kind; rerender(); }));
  $('#listMonth').addEventListener('change', (e) => { location.hash = `#/requests?ym=${e.target.value}`; });

  $('#reqForm').addEventListener('submit', (e) => {
    e.preventDefault();
    keep();
    const dates = form.dates.length ? form.dates : [$('#fDate').value].filter(Boolean);
    if (!form.staffId) { toast('お名前を選んでください'); return; }
    if (!dates.length) { toast('希望日を入れてください'); return; }
    let added = 0;
    for (const dt of dates) {
      if (data.requests.some((r) => r.staffId === form.staffId && r.date === dt)) continue;
      data.requests.push({ id: 'rq-' + Math.random().toString(36).slice(2, 9), staffId: form.staffId, date: dt, kind: form.kind, note: form.note.trim(), createdAt: Date.now() });
      added++;
    }
    persist();
    const firstMonth = dates[0].slice(0, 7);
    Object.assign(form, { dates: [], note: '' });
    toast(added ? `${added}件の休み希望を登録しました` : 'すでに登録済みの日です');
    if (firstMonth !== listKey) location.hash = `#/requests?ym=${firstMonth}`; else rerender();
  });

  view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    ask('この休み希望を取り消しますか？', '取り消す', () => {
      data.requests = data.requests.filter((r) => r.id !== b.dataset.del);
      persist();
      rerender();
      toast('取り消しました');
    });
  }));
}
