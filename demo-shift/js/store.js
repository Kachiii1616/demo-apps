// データの保存・初期データ・簡易な自動作成（すべてデモ用の新規実装）
const KEY = 'showcase-shift:data';
const VERSION = 1;

export const pad = (n) => String(n).padStart(2, '0');
export const monthKey = (y, m) => `${y}-${pad(m)}`;
export const dateKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const daysIn = (y, m) => new Date(y, m, 0).getDate();
export const dowOf = (y, m, d) => new Date(y, m - 1, d).getDay();
export const DOW = ['日', '月', '火', '水', '木', '金', '土'];
export const addMonth = (y, m, diff) => {
  const t = new Date(y, m - 1 + diff, 1);
  return [t.getFullYear(), t.getMonth() + 1];
};
export const parseMonthKey = (k) => k.split('-').map(Number);
export const today = () => {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
};

const uid = (p) => p + Math.random().toString(36).slice(2, 9);

// ---- 業務（1日業務分担表で使う項目） ----
export const TASK_CATS = {
  transport: { label: '送迎', color: '#d9e5f7' },
  bath: { label: '入浴', color: '#d4eedd' },
  floor: { label: 'フロア', color: '#fbf0cc' },
  care: { label: '看護・訓練', color: '#f9dfe3' },
  rest: { label: '休憩', color: '#e6def3' },
  office: { label: '事務・準備', color: '#eceae6' },
};
export const TASKS = [
  { id: 't-pick', label: '送迎（迎え）', cat: 'transport' },
  { id: 't-drop', label: '送迎（送り）', cat: 'transport' },
  { id: 't-bath', label: '入浴介助', cat: 'bath' },
  { id: 't-bathprep', label: '入浴準備', cat: 'bath' },
  { id: 't-vital', label: 'バイタル測定', cat: 'care' },
  { id: 't-rehab', label: '個別機能訓練', cat: 'care' },
  { id: 't-exercise', label: '朝の体操', cat: 'floor' },
  { id: 't-watch', label: 'フロア見守り', cat: 'floor' },
  { id: 't-lunch', label: '昼食介助', cat: 'floor' },
  { id: 't-oral', label: '口腔ケア', cat: 'floor' },
  { id: 't-rec', label: 'レクリエーション', cat: 'floor' },
  { id: 't-snack', label: 'おやつ・水分補給', cat: 'floor' },
  { id: 't-rest', label: '休憩', cat: 'rest' },
  { id: 't-prep', label: '開所準備・清掃', cat: 'office' },
  { id: 't-record', label: '記録・連絡帳', cat: 'office' },
  { id: 't-close', label: '片付け・戸締り', cat: 'office' },
];
export const taskById = (id) => TASKS.find((t) => t.id === id);

// ---- 初期データ ----
function seedStaff() {
  const S = (name, role, emp, maxWeek, codes, driver = false) => ({ id: uid('st-'), name, role, emp, maxWeek, codes, driver, active: true });
  return [
    S('山田 太郎', '管理者', '常勤', 5, ['日']),
    S('青木 恵', '生活相談員', '常勤', 5, ['早', '日', '遅']),
    S('松本 健', '介護職員', '常勤', 5, ['早', '日', '遅'], true),
    S('井上 美和', '看護職員', '常勤', 5, ['日', '遅']),
    S('木村 拓也', '介護職員', '常勤', 5, ['早', '日', '遅'], true),
    S('林 さおり', '介護職員', '常勤', 5, ['早', '日', '遅']),
    S('清水 大地', '介護職員', '常勤', 5, ['早', '日', '遅'], true),
    S('森 ゆかり', '介護職員', 'パート', 4, ['短', '日']),
    S('池田 真理', '看護職員', 'パート', 3, ['短']),
    S('橋本 亮', '機能訓練指導員', 'パート', 3, ['日', '短']),
    S('石川 春香', '介護職員', 'パート', 3, ['短', '早']),
    S('前田 修', '介護職員', 'パート', 3, ['短'], true),
  ];
}

function seedShiftTypes() {
  return [
    { code: '早', name: '早番', start: '07:30', end: '16:30', color: '#f8d6bb', work: true },
    { code: '日', name: '日勤', start: '08:30', end: '17:30', color: '#cbe8d4', work: true },
    { code: '遅', name: '遅番', start: '09:30', end: '18:30', color: '#dcd3f0', work: true },
    { code: '短', name: '短時間', start: '09:00', end: '15:00', color: '#d0e4f6', work: true },
    { code: '休', name: '公休', start: '', end: '', color: '#ebebeb', work: false },
    { code: '有', name: '有給', start: '', end: '', color: '#fbedb9', work: false },
  ];
}

function seedRequired() {
  const byDow = {};
  for (let w = 0; w < 7; w++) byDow[w] = { total: 7, early: 2, late: 2 };
  byDow[6] = { total: 6, early: 2, late: 1 };
  return { byDow, closed: [0] };
}

function seed() {
  const t = today();
  const [ny, nm] = addMonth(t.y, t.m, 1);
  const data = {
    version: VERSION,
    facility: 'ひまわりデイサービス',
    staff: seedStaff(),
    shiftTypes: seedShiftTypes(),
    required: seedRequired(),
    months: {},
    requests: [],
    events: [],
    daily: {},
  };
  const st = data.staff;
  // 休み希望（今月2件・来月5件）
  const pick = (y, m, wanted) => {
    let d = Math.min(wanted, daysIn(y, m));
    while (dowOf(y, m, d) === 0) d = d < daysIn(y, m) ? d + 1 : d - 1;
    return dateKey(y, m, d);
  };
  const R = (s, y, m, d, kind, note) => data.requests.push({ id: uid('rq-'), staffId: s.id, date: pick(y, m, d), kind, note, createdAt: Date.now() });
  R(st[2], t.y, t.m, 10, '公休希望', '通院のため');
  R(st[5], t.y, t.m, 18, '有給希望', '');
  R(st[1], ny, nm, 5, '公休希望', '家族の行事');
  R(st[3], ny, nm, 12, '有給希望', '');
  R(st[4], ny, nm, 12, '公休希望', '');
  R(st[7], ny, nm, 19, '公休希望', '子どもの参観日');
  R(st[9], ny, nm, 24, '公休希望', '');

  // 今月：自動作成して公開済み
  const cur = monthKey(t.y, t.m);
  data.months[cur] = { cells: autoCreate(data, t.y, t.m), status: 'published', savedAt: Date.now(), publishedAt: Date.now() };
  // 来月：前半だけ作成した下書き
  const next = monthKey(ny, nm);
  const draft = autoCreate(data, ny, nm);
  const half = Math.ceil(daysIn(ny, nm) / 2);
  for (const sid of Object.keys(draft)) for (let d = half + 1; d <= daysIn(ny, nm); d++) delete draft[sid][d];
  data.months[next] = { cells: draft, status: 'draft', savedAt: Date.now(), publishedAt: null };

  // 行事
  const E = (y, m, d, title, kind, time = '') => data.events.push({ id: uid('ev-'), date: pick(y, m, d), title, kind, time });
  E(t.y, t.m, 3, '誕生日会', 'event', '14:00');
  E(t.y, t.m, 9, '運営会議', 'meeting', '17:30');
  E(t.y, t.m, 14, '避難訓練', 'event', '10:30');
  E(t.y, t.m, 20, '感染症対策 研修', 'training', '16:30');
  E(t.y, t.m, 26, '季節の手作りおやつ', 'event', '15:00');
  E(ny, nm, 6, '運営会議', 'meeting', '17:30');
  E(ny, nm, 13, '音楽療法の日', 'event', '14:00');
  E(ny, nm, 20, '季節の行事（作品づくり）', 'event', '14:00');
  E(ny, nm, 24, '認知症ケア 研修', 'training', '16:30');

  // 今日の業務分担（今日が休業日でなければ作っておく）
  if (!data.required.closed.includes(dowOf(t.y, t.m, t.d))) {
    data.daily[dateKey(t.y, t.m, t.d)] = { assign: autoAssignDay(data, t.y, t.m, t.d), savedAt: Date.now() };
  }
  return data;
}

// ---- 読み書き ----
let cache = null;
export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.version === VERSION) { cache = d; return cache; }
    }
  } catch (e) { /* 読めないときは初期データ */ }
  cache = seed();
  persist();
  return cache;
}
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* 保存できない環境では画面内だけで動く */ }
}
export function reset() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  cache = null;
  return load();
}

// ---- 参照ヘルパー ----
export const typeOf = (data, code) => data.shiftTypes.find((t) => t.code === code);
export const isWork = (data, code) => !!typeOf(data, code)?.work;
export const activeStaff = (data) => data.staff.filter((s) => s.active !== false);
export const isClosed = (data, y, m, d) => data.required.closed.includes(dowOf(y, m, d));

export function requestMap(data, y, m) {
  const prefix = monthKey(y, m) + '-';
  const map = {};
  for (const r of data.requests) {
    if (!r.date.startsWith(prefix)) continue;
    const d = Number(r.date.slice(8));
    (map[r.staffId] ||= {})[d] = r;
  }
  return map;
}

// ---- 自動作成（デモ用の簡単な割り当て） ----
// 1) 希望休の日は外す 2) 出勤が少ない人から順に 早番→遅番→残りを日勤/短時間 で必要人数まで割り当て
// 3) 希望休で足りない日は、週の上限を超えてでも休みの人から補う（ただし6連勤にはしない）
export function autoCreate(data, y, m) {
  const n = daysIn(y, m);
  const staff = activeStaff(data);
  const req = requestMap(data, y, m);
  const cells = {}, worked = {}, streak = {}, week = {};
  staff.forEach((s) => { cells[s.id] = {}; worked[s.id] = 0; streak[s.id] = 0; week[s.id] = 0; });
  const offCode = (s, d) => (req[s.id]?.[d]?.kind === '有給希望' ? '有' : '休');
  const workCodeFor = (s) => (s.codes.includes('日') && s.emp === '常勤' ? '日' : s.codes.includes('短') ? '短' : s.codes.find((c) => isWork(data, c)));

  for (let d = 1; d <= n; d++) {
    const w = dowOf(y, m, d);
    if (w === 1) staff.forEach((s) => (week[s.id] = 0));
    if (data.required.closed.includes(w)) {
      staff.forEach((s) => { cells[s.id][d] = offCode(s, d); streak[s.id] = 0; });
      continue;
    }
    const rule = data.required.byDow[w] || { total: 0, early: 0, late: 0 };
    const order = staff
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !req[s.id]?.[d])
      .sort((a, b) => (worked[a.s.id] / a.s.maxWeek) - (worked[b.s.id] / b.s.maxWeek) || ((a.i + d) % staff.length) - ((b.i + d) % staff.length))
      .map(({ s }) => s);
    const picked = new Map();
    const canWork = (s, loose) => !picked.has(s.id) && streak[s.id] < 5 && (loose || week[s.id] < s.maxWeek);
    const take = (code, count, loose) => {
      for (const s of order) {
        if (count <= 0) break;
        if (canWork(s, loose) && s.codes.includes(code)) { picked.set(s.id, code); count--; }
      }
    };
    take('早', rule.early, false);
    take('遅', rule.late, false);
    const fill = (loose) => {
      for (const s of order) {
        if (picked.size >= rule.total) break;
        const code = workCodeFor(s);
        if (code && canWork(s, loose)) picked.set(s.id, code);
      }
    };
    fill(false);
    if (picked.size < rule.total) { take('早', rule.early - countOf(picked, '早'), true); take('遅', rule.late - countOf(picked, '遅'), true); fill(true); }
    staff.forEach((s) => {
      const c = picked.get(s.id);
      if (c) { cells[s.id][d] = c; worked[s.id]++; streak[s.id]++; week[s.id]++; }
      else { cells[s.id][d] = offCode(s, d); streak[s.id] = 0; }
    });
  }
  return cells;
}
const countOf = (map, code) => [...map.values()].filter((c) => c === code).length;

// ---- チェック（人数不足・連勤・希望休との重なり） ----
export function checkMonth(data, y, m, cells) {
  const n = daysIn(y, m);
  const staff = activeStaff(data);
  const req = requestMap(data, y, m);
  const counts = dayCounts(data, y, m, cells);
  const shortDays = [];
  for (let d = 1; d <= n; d++) {
    if (isClosed(data, y, m, d)) continue;
    const rule = data.required.byDow[dowOf(y, m, d)];
    const c = counts[d];
    if (c.blank) continue;
    if (c.total < rule.total || c.early < rule.early || c.late < rule.late) shortDays.push(d);
  }
  const streaks = [], conflicts = [], streakCells = new Set();
  for (const s of staff) {
    let run = 0;
    for (let d = 1; d <= n + 1; d++) {
      const code = cells[s.id]?.[d];
      if (d <= n && isWork(data, code)) { run++; continue; }
      if (run >= 6) {
        streaks.push({ staff: s, from: d - run, to: d - 1, len: run });
        for (let k = d - run; k < d; k++) streakCells.add(`${s.id}:${k}`);
      }
      run = 0;
    }
    for (const d of Object.keys(req[s.id] || {})) {
      if (isWork(data, cells[s.id]?.[d])) conflicts.push({ staff: s, d: Number(d) });
    }
  }
  return { shortDays, streaks, conflicts, streakCells, counts };
}

export function dayCounts(data, y, m, cells) {
  const out = {};
  const staff = activeStaff(data);
  for (let d = 1; d <= daysIn(y, m); d++) {
    const c = { total: 0, early: 0, late: 0, day: 0, short: 0, blank: 0 };
    for (const s of staff) {
      const code = cells[s.id]?.[d];
      if (!code) { c.blank++; continue; }
      if (!isWork(data, code)) continue;
      c.total++;
      if (code === '早') c.early++;
      else if (code === '遅') c.late++;
      else if (code === '短') c.short++;
      else c.day++;
    }
    out[d] = c;
  }
  return out;
}

// ---- 1日業務分担の自動割り振り（デモ用の決まったパターン） ----
export const SLOTS = (() => {
  const out = [];
  for (let h = 7; h <= 18; h++) for (const mm of ['00', '30']) {
    if (h === 7 && mm === '00') continue;
    out.push(`${pad(h)}:${mm}`);
  }
  return out; // 07:30 〜 18:30
})();
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const inShift = (type, slot) => type && type.start && toMin(slot) >= toMin(type.start) && toMin(slot) < toMin(type.end);

export function workingOn(data, y, m, d) {
  const mon = data.months[monthKey(y, m)];
  if (!mon) return [];
  return activeStaff(data)
    .map((s) => ({ s, code: mon.cells[s.id]?.[d] }))
    .filter(({ code }) => isWork(data, code))
    .map(({ s, code }) => ({ staff: s, code, type: typeOf(data, code) }))
    .sort((a, b) => toMin(a.type.start || '00:00') - toMin(b.type.start || '00:00'));
}

export function autoAssignDay(data, y, m, d) {
  const people = workingOn(data, y, m, d);
  const assign = {};
  const drivers = people.filter((p) => p.staff.driver);
  const others = people.filter((p) => !p.staff.driver && p.staff.role === '介護職員');
  const transport = [...drivers, ...others].filter((p) => p.code !== '短').slice(0, 2).map((p) => p.staff.id);
  const bathers = people.filter((p) => p.staff.role === '介護職員' && !transport.includes(p.staff.id)).slice(0, 2).map((p) => p.staff.id);
  people.forEach((p, idx) => {
    const a = {};
    const set = (from, to, task) => { for (const sl of SLOTS) if (toMin(sl) >= toMin(from) && toMin(sl) < toMin(to) && inShift(p.type, sl)) a[sl] = task; };
    const isNurse = p.staff.role === '看護職員';
    const isTrainer = p.staff.role === '機能訓練指導員';
    const isOffice = p.staff.role === '管理者' || p.staff.role === '生活相談員';
    set('07:30', '08:30', 't-prep');
    set('08:30', '09:30', transport.includes(p.staff.id) ? 't-pick' : isOffice ? 't-record' : 't-watch');
    set('09:30', '10:00', isNurse ? 't-vital' : 't-exercise');
    if (bathers.includes(p.staff.id)) { set('09:30', '10:00', 't-bathprep'); set('10:00', '12:00', 't-bath'); }
    else set('10:00', '12:00', isNurse ? 't-vital' : isTrainer ? 't-rehab' : isOffice ? 't-record' : 't-watch');
    set('12:00', '12:30', 't-lunch');
    const restFrom = idx % 2 === 0 ? '12:30' : '13:30';
    set('12:30', '14:30', 't-watch');
    set('12:30', '13:00', 't-oral');
    set('14:00', '14:30', 't-rec');
    set(restFrom, restFrom === '12:30' ? '13:30' : '14:30', 't-rest');
    set('14:30', '15:00', isTrainer ? 't-rehab' : 't-rec');
    set('15:00', '15:30', 't-snack');
    set('15:30', '16:00', idx % 2 === 0 ? 't-record' : 't-watch');
    set('16:00', '17:00', transport.includes(p.staff.id) ? 't-drop' : 't-close');
    set('17:00', '18:30', 't-record');
    set('17:30', '18:30', 't-close');
    // 短時間勤務の人は昼休憩を短くし、途中で区切る
    if (p.code === '短') { set('12:30', '13:00', 't-rest'); set('13:00', '14:00', 't-watch'); }
    assign[p.staff.id] = a;
  });
  return assign;
}
