import {
  load, persist, today, monthKey, parseMonthKey, addMonth, daysIn, dowOf, DOW,
  activeStaff, typeOf, isClosed, requestMap, autoCreate, checkMonth,
} from '../store.js';
import { esc, toast, popover, modal, icons, ask } from '../ui.js';

// 保存前の編集中データ（画面を移っても残す）
const work = {};
export const hasUnsaved = () => Object.values(work).some((w) => w.dirty);
export const clearWork = () => Object.keys(work).forEach((k) => delete work[k]);
export function savedOrWorkCells(data, key) {
  return work[key]?.cells || data.months[key]?.cells || {};
}

const clone = (o) => JSON.parse(JSON.stringify(o));
const fmtTime = (ts) => {
  if (!ts) return '';
  const t = new Date(ts);
  return `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
};

function getWork(data, key) {
  if (!work[key]) {
    const mon = data.months[key];
    work[key] = { cells: clone(mon?.cells || {}), dirty: false, undo: [] };
  }
  return work[key];
}

export function renderMonth(view, { query, rerender }) {
  const data = load();
  const t = today();
  const key = query.get('ym') || monthKey(t.y, t.m);
  const [y, m] = parseMonthKey(key);
  const mon = data.months[key];
  const w = getWork(data, key);
  const staff = activeStaff(data);
  const n = daysIn(y, m);
  const req = requestMap(data, y, m);
  const chk = checkMonth(data, y, m, w.cells);
  const filled = staff.reduce((a, s) => a + Object.keys(w.cells[s.id] || {}).length, 0);
  const total = staff.length * n;

  const status = mon?.status || 'none';
  const statusBadge = {
    none: '<span class="badge draft">未作成</span>',
    draft: '<span class="badge draft">作成中</span>',
    saved: '<span class="badge saved">保存済み（未公開）</span>',
    published: '<span class="badge published">公開済み</span>',
  }[status];
  const changedAfter = status === 'published' && mon.changedAfterPublish;

  const [py, pm] = addMonth(y, m, -1);
  const [ny, nm] = addMonth(y, m, 1);
  const yearOpts = [t.y - 1, t.y, t.y + 1].map((v) => `<option value="${v}" ${v === y ? 'selected' : ''}>${v}年</option>`).join('');
  const monthOpts = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${i + 1}月</option>`).join('');

  // 警告
  const warn = [];
  if (chk.shortDays.length) warn.push(`必要人数に届かない日：${chk.shortDays.map((d) => `${m}/${d}`).join('、')}`);
  chk.streaks.forEach((s) => warn.push(`${esc(s.staff.name)} さんが ${m}/${s.from}〜${m}/${s.to} の ${s.len} 連勤です`));
  chk.conflicts.forEach((c) => warn.push(`${esc(c.staff.name)} さんの休み希望日（${m}/${c.d}）に勤務が入っています`));

  const head = Array.from({ length: n }, (_, i) => {
    const d = i + 1, wd = dowOf(y, m, d);
    const cls = [wd === 6 ? 'sat' : '', wd === 0 ? 'sun' : '', y === t.y && m === t.m && d === t.d ? 'today' : ''].join(' ');
    return `<th class="${cls}">${d}<br><small>${DOW[wd]}</small></th>`;
  }).join('');

  const rows = staff.map((s) => {
    let work = 0, off = 0, paid = 0;
    const tds = Array.from({ length: n }, (_, i) => {
      const d = i + 1;
      const code = w.cells[s.id]?.[d];
      const type = code ? typeOf(data, code) : null;
      if (type?.work) work++; else if (code === '有') paid++; else if (code) off++;
      const cls = ['cell'];
      if (!code) cls.push('empty');
      else if (isClosed(data, y, m, d) && !type?.work) cls.push('closed');
      if (req[s.id]?.[d]) cls.push('req');
      if (req[s.id]?.[d] && type?.work) cls.push('conflict');
      if (chk.streakCells.has(`${s.id}:${d}`)) cls.push('streak');
      const style = type && !cls.includes('closed') ? `style="--c:${type.color}"` : '';
      const title = `${s.name} ${m}/${d}${type ? ' ' + type.name + (type.start ? ` ${type.start}〜${type.end}` : '') : ' 未設定'}${req[s.id]?.[d] ? '（' + req[s.id][d].kind + '）' : ''}`;
      return `<td class="${cls.join(' ')}" ${style} data-s="${s.id}" data-d="${d}" title="${esc(title)}">${code ? esc(code) : '・'}</td>`;
    }).join('');
    return `<tr><th class="who"><b>${esc(s.name)}</b><span>${esc(s.role)}・${esc(s.emp)}</span></th>${tds}
      <td class="sum">${work}</td><td class="sum">${off}</td><td class="sum">${paid}</td></tr>`;
  }).join('');

  const footRow = (label, fn, cls = '') => `<tr class="${cls}"><th class="who">${label}</th>${Array.from({ length: n }, (_, i) => {
    const d = i + 1;
    if (isClosed(data, y, m, d)) return '<td class="muted">休</td>';
    const r = fn(d);
    return `<td class="${r.short ? 'short' : ''}">${r.v}</td>`;
  }).join('')}<td class="sum" colspan="3"></td></tr>`;
  const rule = (d) => data.required.byDow[dowOf(y, m, d)];
  const foot = [
    footRow('出勤者数', (d) => ({ v: chk.counts[d].total, short: !chk.counts[d].blank && chk.counts[d].total < rule(d).total }), 'total'),
    footRow('必要人数', (d) => ({ v: rule(d).total })),
    footRow('早番', (d) => ({ v: chk.counts[d].early, short: !chk.counts[d].blank && chk.counts[d].early < rule(d).early })),
    footRow('遅番', (d) => ({ v: chk.counts[d].late, short: !chk.counts[d].blank && chk.counts[d].late < rule(d).late })),
    footRow('日勤・短時間', (d) => ({ v: chk.counts[d].day + chk.counts[d].short })),
  ].join('');

  const legend = data.shiftTypes.map((tp) => `<span class="chip"><span class="code" style="--c:${tp.color}">${esc(tp.code)}</span>${esc(tp.name)}${tp.start ? ` <span class="muted small">${tp.start}〜${tp.end}</span>` : ''}</span>`).join('');

  view.innerHTML = `
    <p class="lead">職員・勤務区分・必要人数・休み希望をもとに1か月の勤務表をつくります。マスをタップすると勤務を変えられます。「保存」で確定し、「公開」すると職員が見られる状態になります。</p>
    <div class="row">
      <button class="btn small" data-nav="${monthKey(py, pm)}" aria-label="前の月">${icons.left}</button>
      <select class="select" id="selY" aria-label="年">${yearOpts}</select>
      <select class="select" id="selM" aria-label="月">${monthOpts}</select>
      <button class="btn small" data-nav="${monthKey(ny, nm)}" aria-label="次の月">${icons.right}</button>
      ${statusBadge}
      ${changedAfter ? '<span class="badge dirty">公開後に変更あり</span>' : ''}
      ${w.dirty ? '<span class="badge dirty">未保存の変更があります</span>' : ''}
      <span class="muted small">入力 ${filled}/${total} マス${mon?.savedAt ? ` ・ 最終保存 ${fmtTime(mon.savedAt)}` : ''}${status === 'published' ? ` ・ 公開 ${fmtTime(mon.publishedAt)}` : ''}</span>
    </div>
    <div class="row">
      <button class="btn outline" id="btnAuto">${icons.wand}自動作成</button>
      <button class="btn" id="btnUndo" ${w.undo.length ? '' : 'disabled'}>${icons.undo}1つ戻す</button>
      <button class="btn save" id="btnSave" ${w.dirty || !mon ? '' : 'disabled'}>${icons.save}保存</button>
      <button class="btn primary" id="btnPub">${icons.send}${status === 'published' ? (changedAfter || w.dirty ? '保存して再公開' : '公開を取り消す') : '公開'}</button>
      <a class="btn blue" href="#/print/${key}">${icons.print}印刷（A4横）</a>
    </div>
    <div class="legend">${legend}
      <span class="chip"><span style="width:8px;height:8px;border-radius:50%;background:var(--coral);margin-left:6px"></span>休み希望あり</span>
      <span class="chip"><span style="width:16px;height:3px;background:#e2a23b;margin-left:6px"></span>6連勤以上</span>
    </div>
    ${warn.length ? `<div class="notice warn"><b>確認してください（${warn.length}件）</b><ul>${warn.slice(0, 8).map((x) => `<li>${x}</li>`).join('')}${warn.length > 8 ? `<li>ほか ${warn.length - 8} 件</li>` : ''}</ul></div>`
      : filled ? '<div class="notice ok">人数不足・連勤・休み希望との重なりはありません。</div>' : '<div class="notice info">まだ勤務が入っていません。「自動作成」で下書きをつくれます。</div>'}
    <div class="shift-wrap">
      <table class="shift">
        <thead><tr><th class="who">職員</th>${head}<th>出</th><th>休</th><th>有</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>${foot}</tfoot>
      </table>
    </div>
    <p class="muted small">※ 赤いマスは必要人数に届いていない日です。休業日（${data.required.closed.map((x) => DOW[x] + '曜').join('・') || 'なし'}）は人数を数えません。</p>
  `;

  const go = (k) => { location.hash = `#/month?ym=${k}`; };
  view.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => go(b.dataset.nav)));
  const onSel = () => go(monthKey(Number(view.querySelector('#selY').value), Number(view.querySelector('#selM').value)));
  view.querySelector('#selY').addEventListener('change', onSel);
  view.querySelector('#selM').addEventListener('change', onSel);

  const pushUndo = () => { w.undo.push(clone(w.cells)); if (w.undo.length > 30) w.undo.shift(); };

  // マスの変更
  view.querySelector('tbody').addEventListener('click', (e) => {
    const td = e.target.closest('td.cell');
    if (!td) return;
    const sid = td.dataset.s, d = Number(td.dataset.d);
    const s = staff.find((x) => x.id === sid);
    const cur = w.cells[sid]?.[d];
    const r = req[sid]?.[d];
    const opts = data.shiftTypes.map((tp) => `<button type="button" class="opt ${tp.code === cur ? 'cur' : ''}" style="--c:${tp.color}" data-val="${esc(tp.code)}"><b>${esc(tp.code)}</b>${esc(tp.name)}</button>`).join('');
    popover(td, `<h4>${esc(s.name)} ・ ${m}/${d}（${DOW[dowOf(y, m, d)]}）${r ? `<br><span style="color:var(--coral-deep)">${esc(r.kind)}${r.note ? '：' + esc(r.note) : ''}</span>` : ''}</h4>
      <div class="grid">${opts}<button type="button" class="opt clear" data-val="">空欄</button></div>`, (val) => {
      pushUndo();
      (w.cells[sid] ||= {});
      if (val) w.cells[sid][d] = val; else delete w.cells[sid][d];
      w.dirty = true;
      rerender();
    });
  });

  view.querySelector('#btnUndo').addEventListener('click', () => {
    if (!w.undo.length) return;
    w.cells = w.undo.pop();
    w.dirty = true;
    rerender();
  });

  view.querySelector('#btnAuto').addEventListener('click', () => {
    const run = (onlyBlank) => {
      pushUndo();
      const made = autoCreate(data, y, m);
      for (const s of staff) {
        w.cells[s.id] ||= {};
        for (let d = 1; d <= n; d++) {
          if (onlyBlank && w.cells[s.id][d]) continue;
          w.cells[s.id][d] = made[s.id][d];
        }
      }
      w.dirty = true;
      rerender();
      toast(onlyBlank ? '空欄のマスを自動で埋めました（未保存）' : '自動作成しました。内容を確かめて保存してください');
    };
    if (!filled) return run(false);
    const md = modal('自動作成', `<p class="small">すでに ${filled} マス入力されています。どちらで作成しますか？</p>
      <p class="muted small">休み希望の日を外し、出勤が少ない人から順に必要人数まで割り当てます（デモ用の簡単な処理です）。</p>`, {
      extraButtons: '<button type="button" class="btn outline" data-mode="blank">空欄だけ埋める</button><button type="button" class="btn danger" data-mode="all">すべて作り直す</button>',
    });
    md.el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { md.close(); run(b.dataset.mode === 'blank'); }));
  });

  const save = () => {
    const prev = data.months[key];
    data.months[key] = {
      cells: clone(w.cells),
      status: prev?.status === 'published' ? 'published' : filledCount(w.cells) >= total ? 'saved' : 'draft',
      savedAt: Date.now(),
      publishedAt: prev?.publishedAt || null,
      changedAfterPublish: prev?.status === 'published' ? (prev.changedAfterPublish || w.dirty) : false,
    };
    persist();
    w.dirty = false;
  };
  const filledCount = (cells) => staff.reduce((a, s) => a + Object.keys(cells[s.id] || {}).length, 0);

  view.querySelector('#btnSave').addEventListener('click', () => {
    save();
    rerender();
    toast('保存しました');
  });

  view.querySelector('#btnPub').addEventListener('click', () => {
    if (status === 'published' && !changedAfter && !w.dirty) {
      ask('公開を取り消して「保存済み（未公開）」に戻しますか？', '公開を取り消す', () => {
        data.months[key].status = 'saved';
        persist();
        rerender();
        toast('公開を取り消しました');
      });
      return;
    }
    const blanks = total - filledCount(w.cells);
    if (blanks > 0) { toast(`空欄が ${blanks} マスあります。すべて埋めてから公開してください`); return; }
    const msg = chk.shortDays.length || chk.streaks.length || chk.conflicts.length
      ? `確認事項が ${chk.shortDays.length + chk.streaks.length + chk.conflicts.length} 件ありますが、公開しますか？`
      : `${y}年${m}月の勤務表を公開しますか？`;
    ask(msg, '公開する', () => {
      save();
      Object.assign(data.months[key], { status: 'published', publishedAt: Date.now(), changedAfterPublish: false });
      persist();
      rerender();
      toast('公開しました（デモ版のため通知は送られません）');
    });
  });
}
