import { load, persist, DOW } from '../store.js';
import { esc, toast, modal, icons, ask } from '../ui.js';

let tab = 'staff';
const ROLES = ['管理者', '生活相談員', '介護職員', '看護職員', '機能訓練指導員'];

export function renderSettings(view, { rerender }) {
  const data = load();
  view.innerHTML = `
    <p class="lead">勤務表づくりに使う職員・勤務区分・必要人数を設定します。変更はすぐ保存され、次の「自動作成」から使われます。</p>
    <div class="subtabs">
      <button class="${tab === 'staff' ? 'on' : ''}" data-tab="staff">職員</button>
      <button class="${tab === 'types' ? 'on' : ''}" data-tab="types">勤務区分</button>
      <button class="${tab === 'req' ? 'on' : ''}" data-tab="req">必要人数・休業日</button>
    </div>
    <div id="pane"></div>`;
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; rerender(); }));
  const pane = view.querySelector('#pane');
  ({ staff: staffPane, types: typesPane, req: reqPane })[tab](pane, data, rerender);
}

// ---- 職員 ----
function staffPane(pane, data, rerender) {
  const codes = data.shiftTypes.filter((t) => t.work);
  const chip = (c) => { const t = data.shiftTypes.find((x) => x.code === c); return t ? `<span class="code" style="--c:${t.color}" title="${esc(t.name)}">${esc(c)}</span>` : ''; };
  const active = data.staff.filter((s) => s.active !== false);
  pane.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2 style="margin:0">職員（${active.length}名 ／ 常勤 ${active.filter((s) => s.emp === '常勤').length}・パート ${active.filter((s) => s.emp === 'パート').length}）</h2>
        <button class="btn outline" id="addStaff">${icons.plus}職員を追加</button>
      </div>
      <div class="tbl-wrap" style="margin-top:8px"><table class="tbl">
        <thead><tr><th>氏名</th><th>職種</th><th>雇用</th><th>週の上限</th><th>入れる勤務</th><th>送迎</th><th></th></tr></thead>
        <tbody>${data.staff.map((s) => `<tr style="${s.active === false ? 'opacity:.5' : ''}">
          <td style="white-space:nowrap"><b>${esc(s.name)}</b>${s.active === false ? ' <span class="muted small">（休止中）</span>' : ''}</td>
          <td style="white-space:nowrap">${esc(s.role)}</td>
          <td><span class="badge ${s.emp === '常勤' ? 'published' : 'saved'}">${esc(s.emp)}</span></td>
          <td>${s.maxWeek}日</td>
          <td style="white-space:nowrap">${s.codes.map(chip).join(' ')}</td>
          <td>${s.driver ? '○' : '<span class="muted">—</span>'}</td>
          <td style="white-space:nowrap"><button class="btn small" data-edit="${s.id}">編集</button></td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;

  const open = (s) => {
    const isNew = !s;
    s = s || { name: '', role: '介護職員', emp: '常勤', maxWeek: 5, codes: ['日'], driver: false, active: true };
    const md = modal(isNew ? '職員を追加' : '職員を編集', `
      <div class="form-grid">
        <div class="full"><label class="field" for="sName">氏名</label><input class="input" id="sName" value="${esc(s.name)}" placeholder="例：山田 花子"></div>
        <div><label class="field" for="sRole">職種</label><select class="select" id="sRole">${ROLES.map((r) => `<option ${r === s.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div><label class="field" for="sEmp">雇用形態</label><select class="select" id="sEmp">${['常勤', 'パート'].map((r) => `<option ${r === s.emp ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div><label class="field" for="sMax">週の上限日数</label><input type="number" min="1" max="6" class="input" id="sMax" value="${s.maxWeek}"></div>
        <div><label class="field">送迎</label><label class="small"><input type="checkbox" id="sDriver" ${s.driver ? 'checked' : ''}> 送迎の運転ができる</label></div>
        <div class="full"><label class="field">入れる勤務</label><div class="chips">${codes.map((t) => `<label class="chip-btn"><input type="checkbox" name="sCode" value="${esc(t.code)}" ${s.codes.includes(t.code) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</div></div>
        ${isNew ? '' : `<div class="full"><label class="small" style="display:block;margin-top:12px"><input type="checkbox" id="sActive" ${s.active === false ? 'checked' : ''}> 休止中（勤務表に出さない）</label></div>`}
      </div>`, {
      extraButtons: isNew ? '' : '<button type="button" class="btn danger" data-del style="margin-right:auto">削除</button>',
      onSubmit: (f) => {
        const name = f.querySelector('#sName').value.trim();
        const picked = [...f.querySelectorAll('input[name=sCode]:checked')].map((i) => i.value);
        if (!name) { toast('氏名を入れてください'); return false; }
        if (!picked.length) { toast('入れる勤務を1つ以上選んでください'); return false; }
        Object.assign(s, {
          name, role: f.querySelector('#sRole').value, emp: f.querySelector('#sEmp').value,
          maxWeek: Math.max(1, Math.min(6, Number(f.querySelector('#sMax').value) || 1)),
          driver: f.querySelector('#sDriver').checked, codes: picked,
          active: isNew ? true : !f.querySelector('#sActive').checked,
        });
        if (isNew) data.staff.push({ id: 'st-' + Math.random().toString(36).slice(2, 9), ...s });
        persist();
        rerender();
        toast(isNew ? '職員を追加しました' : '保存しました');
      },
    });
    md.el.querySelector('[data-del]')?.addEventListener('click', () => {
      ask(`${s.name} さんを削除しますか？（作成済みの勤務表からも表示されなくなります）`, '削除する', () => {
        data.staff = data.staff.filter((x) => x.id !== s.id);
        persist();
        md.close();
        rerender();
        toast('削除しました');
      });
    });
  };
  pane.querySelector('#addStaff').addEventListener('click', () => open(null));
  pane.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => open(data.staff.find((s) => s.id === b.dataset.edit))));
}

// ---- 勤務区分 ----
function typesPane(pane, data, rerender) {
  pane.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2 style="margin:0">勤務区分（${data.shiftTypes.length}種）</h2>
        <button class="btn outline" id="addType">${icons.plus}区分を追加</button>
      </div>
      <div class="tbl-wrap" style="margin-top:8px"><table class="tbl">
        <thead><tr><th>記号</th><th>名前</th><th>時間帯</th><th>種類</th><th>色</th><th></th></tr></thead>
        <tbody>${data.shiftTypes.map((t, i) => `<tr>
          <td><span class="code" style="--c:${t.color};width:26px;height:26px;font-size:13px">${esc(t.code)}</span></td>
          <td><b>${esc(t.name)}</b></td>
          <td>${t.start ? `${t.start}〜${t.end}` : '<span class="muted">—</span>'}</td>
          <td>${t.work ? '出勤' : '休み'}</td>
          <td><span class="swatch" style="background:${t.color}"></span></td>
          <td style="white-space:nowrap"><button class="btn small" data-edit="${i}">編集</button></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small" style="margin:8px 0 0">「早番」「遅番」の記号（早・遅）は必要人数のチェックに使います。</p>
    </div>`;

  const open = (idx) => {
    const isNew = idx == null;
    const t = isNew ? { code: '', name: '', start: '09:00', end: '18:00', color: '#f4dccf', work: true } : data.shiftTypes[idx];
    const md = modal(isNew ? '勤務区分を追加' : '勤務区分を編集', `
      <div class="form-grid">
        <div><label class="field" for="tCode">記号（1文字）</label><input class="input" id="tCode" maxlength="1" value="${esc(t.code)}" ${isNew ? '' : 'readonly'}></div>
        <div><label class="field" for="tName">名前</label><input class="input" id="tName" value="${esc(t.name)}" placeholder="例：中番"></div>
        <div><label class="field">種類</label><div class="chips"><label class="chip-btn"><input type="radio" name="tWork" value="1" ${t.work ? 'checked' : ''}> 出勤</label><label class="chip-btn"><input type="radio" name="tWork" value="0" ${t.work ? '' : 'checked'}> 休み</label></div></div>
        <div><label class="field" for="tColor">色</label><input type="color" id="tColor" value="${t.color}" style="width:60px;height:32px;border:0;background:none"></div>
        <div><label class="field" for="tStart">開始</label><input type="time" class="input" id="tStart" value="${t.start}"></div>
        <div><label class="field" for="tEnd">終了</label><input type="time" class="input" id="tEnd" value="${t.end}"></div>
      </div>`, {
      extraButtons: isNew ? '' : '<button type="button" class="btn danger" data-del style="margin-right:auto">削除</button>',
      onSubmit: (f) => {
        const code = f.querySelector('#tCode').value.trim();
        const name = f.querySelector('#tName').value.trim();
        const work = f.querySelector('input[name=tWork]:checked').value === '1';
        if (!code || !name) { toast('記号と名前を入れてください'); return false; }
        if (isNew && data.shiftTypes.some((x) => x.code === code)) { toast('同じ記号がすでにあります'); return false; }
        const next = { code, name, work, color: f.querySelector('#tColor').value, start: work ? f.querySelector('#tStart').value : '', end: work ? f.querySelector('#tEnd').value : '' };
        if (work && (!next.start || !next.end || next.start >= next.end)) { toast('時間帯を正しく入れてください'); return false; }
        if (isNew) data.shiftTypes.push(next); else Object.assign(t, next);
        persist();
        rerender();
        toast('保存しました');
      },
    });
    md.el.querySelector('[data-del]')?.addEventListener('click', () => {
      if (['休'].includes(t.code)) { toast('「休」は自動作成で使うため削除できません'); return; }
      ask(`「${t.name}」を削除しますか？`, '削除する', () => {
        data.shiftTypes.splice(idx, 1);
        data.staff.forEach((s) => { s.codes = s.codes.filter((c) => c !== t.code); });
        persist();
        md.close();
        rerender();
        toast('削除しました');
      });
    });
  };
  pane.querySelector('#addType').addEventListener('click', () => open(null));
  pane.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.edit))));
}

// ---- 必要人数 ----
function reqPane(pane, data, rerender) {
  const r = data.required;
  const order = [1, 2, 3, 4, 5, 6, 0];
  pane.innerHTML = `
    <form class="card" id="reqForm">
      <h2>曜日ごとの必要人数</h2>
      <p class="muted small" style="margin:-4px 0 8px">出勤者の合計と、そのうち早番・遅番に必要な人数です。足りない日は月シフトで赤く表示されます。</p>
      <div class="tbl-wrap"><table class="tbl req-grid">
        <thead><tr><th>曜日</th><th>休業日</th><th>出勤者 合計</th><th>うち早番</th><th>うち遅番</th></tr></thead>
        <tbody>${order.map((w) => {
          const v = r.byDow[w]; const closed = r.closed.includes(w);
          return `<tr><td><b style="color:${w === 0 ? 'var(--sun)' : w === 6 ? 'var(--sat)' : 'inherit'}">${DOW[w]}曜</b></td>
            <td><input type="checkbox" name="closed" value="${w}" ${closed ? 'checked' : ''} aria-label="${DOW[w]}曜を休業日にする"></td>
            <td><input type="number" min="0" max="20" class="input" name="total-${w}" value="${v.total}" ${closed ? 'disabled' : ''}></td>
            <td><input type="number" min="0" max="20" class="input" name="early-${w}" value="${v.early}" ${closed ? 'disabled' : ''}></td>
            <td><input type="number" min="0" max="20" class="input" name="late-${w}" value="${v.late}" ${closed ? 'disabled' : ''}></td></tr>`;
        }).join('')}</tbody>
      </table></div>
      <div class="row" style="margin-top:12px"><button type="submit" class="btn save">${icons.save}保存</button></div>
    </form>`;
  const form = pane.querySelector('#reqForm');
  form.querySelectorAll('input[name=closed]').forEach((cb) => cb.addEventListener('change', () => {
    ['total', 'early', 'late'].forEach((k) => { form.querySelector(`[name=${k}-${cb.value}]`).disabled = cb.checked; });
  }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const num = (n) => Math.max(0, Number(form.querySelector(`[name=${n}]`).value) || 0);
    r.closed = [...form.querySelectorAll('input[name=closed]:checked')].map((c) => Number(c.value));
    for (const w of order) {
      const total = num(`total-${w}`);
      r.byDow[w] = { total, early: Math.min(num(`early-${w}`), total), late: Math.min(num(`late-${w}`), total) };
    }
    persist();
    rerender();
    toast('必要人数を保存しました');
  });
}
