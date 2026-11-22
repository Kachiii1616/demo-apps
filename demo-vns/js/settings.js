// 設定（事業所名・スタッフ・表示・着せ替え・データ）
import { db, save, reset, getTheme, setTheme, uid } from './store.js';
import { $, $$, esc, toast, setTopActions, printAction, opt } from './ui.js';

const THEMES = [['sakura', 'さくら色'], ['sora', 'そら色'], ['haru', 'はる色'], ['rose', 'ローズゴールド'], ['std', '標準']];

export function renderSettings(view, applyTheme) {
  setTopActions([printAction()]);
  const s = db().settings;
  const used = (id) => db().plans.some((v) => v.staffId === id) || db().records.some((r) => r.staffId === id);
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const again = () => renderSettings(view, applyTheme);

  view.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">SETTINGS</div><h1>設定</h1></div></div>
    <div class="panel"><h2>事業所</h2>
      <div class="fgrid"><div class="fcell w4"><div class="fl">事業所名（画面の左上に表示）</div><div class="fv"><input type="text" id="office" value="${esc(s.office)}"></div></div></div>
    </div>
    <div class="panel"><h2>スタッフ</h2>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>氏名</th><th style="width:160px">職種</th><th style="width:80px"></th></tr></thead>
        <tbody>${db().staff.map((st) => `<tr>
          <td><input type="text" data-sname="${st.id}" value="${esc(st.name)}" aria-label="氏名"></td>
          <td><select data-srole="${st.id}" aria-label="職種">${['看護師', 'リハビリ職'].map((r) => opt(r, r, st.role)).join('')}</select></td>
          <td><button type="button" class="link-btn" data-sdel="${st.id}" ${used(st.id) ? 'title="予定や記録で使われているため削除できません"' : ''}>削除</button></td></tr>`).join('')}</tbody>
      </table></div>
      <p><button type="button" class="pill" id="s-add">スタッフを追加</button></p>
      <p class="help">職種は、訪問スケジュールの「看護／リハビリ」の表示切り替えに使います。看護師の訪問は看護、リハビリ職の訪問はリハビリとして表示します。予定や記録で使われているスタッフは削除できません。</p>
    </div>
    <div class="panel"><h2>表示</h2>
      <div class="fgrid">
        <div class="fcell"><div class="fl">スケジュールの開始（時）</div><div class="fv"><select data-set="startHour">${hours.slice(0, 24).map((h) => opt(h, h, s.startHour)).join('')}</select></div></div>
        <div class="fcell"><div class="fl">スケジュールの終了（時）</div><div class="fv"><select data-set="endHour">${hours.slice(1).map((h) => opt(h, h, s.endHour)).join('')}</select></div></div>
        <div class="fcell"><div class="fl">記録表で一度に見える過去の回数</div><div class="fv"><select data-set="visibleCount">${[2, 3, 4, 5].map((h) => opt(h, h, s.visibleCount)).join('')}</select></div></div>
        <div class="fcell"><div class="fl">期限のお知らせを出す時期（何日前から）</div><div class="fv"><select data-set="noticeDays">${[14, 30, 45, 60].map((h) => opt(h, h, s.noticeDays)).join('')}</select></div></div>
      </div>
    </div>
    <div class="panel"><h2>着せ替え</h2>
      <select id="theme">${THEMES.map(([v, l]) => opt(v, l, getTheme())).join('')}</select> <span class="small muted">この端末だけに適用されます。</span>
    </div>
    <div class="panel"><h2>データ</h2>
      <button type="button" class="pill" id="reset2">サンプルデータに戻す</button> <span class="small muted">入力した内容を消して、最初の架空データに戻します。</span>
    </div>`;

  $('#office').oninput = (e) => { s.office = e.target.value; save(); $('#brand-name').textContent = s.office || '訪問看護ステーション'; };
  $$('[data-sname]', view).forEach((i) => { i.oninput = () => { db().staff.find((x) => x.id === i.dataset.sname).name = i.value; save(); }; });
  $$('[data-srole]', view).forEach((i) => {
    i.onchange = () => { db().staff.find((x) => x.id === i.dataset.srole).role = i.value; save(); toast('職種を変更しました'); };
  });
  $$('[data-sdel]', view).forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.sdel;
      if (used(id)) { toast('予定や記録で使われているため削除できません'); return; }
      db().staff = db().staff.filter((x) => x.id !== id); save(); toast('スタッフを削除しました'); again();
    };
  });
  $('#s-add').onclick = () => { db().staff.push({ id: uid('s'), name: '新しいスタッフ', role: '看護師' }); save(); again(); };
  $$('[data-set]', view).forEach((sel) => {
    sel.onchange = () => {
      const k = sel.dataset.set;
      const v = Number(sel.value);
      if (k === 'startHour' && v >= s.endHour) { toast('開始は終了より前にしてください'); sel.value = s.startHour; return; }
      if (k === 'endHour' && v <= s.startHour) { toast('終了は開始より後にしてください'); sel.value = s.endHour; return; }
      s[k] = v; save(); toast('保存しました');
    };
  });
  $('#theme').onchange = (e) => { setTheme(e.target.value); applyTheme(); };
  $('#reset2').onclick = () => {
    if (!confirm('入力した内容を消して、最初の架空データに戻します。よろしいですか？')) return;
    reset(); toast('サンプルデータに戻しました'); again();
  };
}
