// 架空データと保存（このブラウザの localStorage だけ）
const PREFIX = 'showcase-bento:';

export const WEEK = ['月', '火', '水', '木', '金', '土', '日'];
export const FORMS = ['常食', '一口大', '刻み', 'ソフト食', 'ミキサー', 'おかゆ'];
export const DRINKS = ['', 'お茶', 'コーヒー', '紅茶', '栄養ドリンク'];
export const ADDS = ['', 'なし', '砂糖', 'ミルク', '砂糖・ミルク'];

// ---- 日付 ----
export function pad(n) { return String(n).padStart(2, '0'); }
export function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function weekIdx(d) { return (d.getDay() + 6) % 7; } // 月=0 … 日=6
export function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function mondayOf(d) { return addDays(d, -weekIdx(d)); }
export function md(d) { return `${d.getMonth() + 1}月${d.getDate()}日`; }

// ---- 決まった並びの乱数（同じ月なら毎回同じデータ） ----
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 初期データ ----
const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];

function seedUsers() {
  const u = (name, kana, days, lunch, dinner, form, extra = {}) => ({
    id: 'u' + Math.random().toString(36).slice(2, 9),
    name, kana, days, lunch, dinner, form,
    nightForm: '', note: '', snackDays: [], snack: '', drink: '', add: '', ...extra,
  });
  return [
    u('青山 一郎', 'あおやま いちろう', [0, 2, 4], true, false, '常食', { snackDays: [0, 2, 4], drink: 'コーヒー', add: '砂糖・ミルク' }),
    u('井上 花子', 'いのうえ はなこ', ALL, true, true, '一口大', { note: '汁物とろみ', snackDays: [0, 2, 4], drink: '紅茶', add: 'ミルク' }),
    u('上田 次郎', 'うえだ じろう', [1, 3, 5], true, true, '常食', { note: 'ご飯少なめ' }),
    u('江藤 春子', 'えとう はるこ', WEEKDAYS, false, true, '刻み', { snackDays: [1, 3], snack: 'ゼリー', drink: '栄養ドリンク', add: 'なし' }),
    u('大西 三郎', 'おおにし さぶろう', [0, 2, 4], true, false, 'ソフト食', { note: 'むせ込み注意', snackDays: [0, 2, 4], snack: 'ゼリー', drink: 'お茶', add: 'なし' }),
    u('小川 夏子', 'おがわ なつこ', [1, 4], true, true, 'ミキサー', { note: '水分とろみ', snackDays: [1, 4], snack: 'ゼリー・刻み', drink: '紅茶', add: '砂糖' }),
    u('川村 四郎', 'かわむら しろう', ALL, false, true, '常食', { nightForm: 'おかゆ' }),
    u('木下 秋子', 'きのした あきこ', [0, 3], true, false, '一口大', { snackDays: [0, 3], drink: 'コーヒー', add: '砂糖' }),
    u('栗田 五郎', 'くりた ごろう', [2, 5, 6], true, true, '常食'),
    u('小林 冬美', 'こばやし ふゆみ', WEEKDAYS, true, false, 'おかゆ', { note: '梅干しなし', snackDays: WEEKDAYS, drink: 'お茶', add: 'なし' }),
    u('斉藤 六郎', 'さいとう ろくろう', [1, 3], false, true, '刻み', { snackDays: [1, 3], drink: 'コーヒー', add: 'ミルク' }),
    u('清水 和子', 'しみず かずこ', ALL, true, true, 'ソフト食', { nightForm: 'ミキサー', note: '食事はゆっくり', snackDays: [5, 6], snack: 'プリン', drink: '紅茶', add: 'なし' }),
  ];
}

function seedStaff() {
  const s = (id, name, dept) => ({ id, name, dept });
  return [
    s('s1', '山田 太郎', 'デイサービス'),
    s('s2', '佐藤 花子', 'デイサービス'),
    s('s3', '鈴木 一郎', 'デイサービス'),
    s('s4', '高橋 美咲', '訪問介護'),
    s('s5', '田中 健太', '訪問介護'),
    s('s6', '伊藤 由美', '訪問介護'),
    s('s7', '渡辺 誠', '事務'),
    s('s8', '中村 恵', '事務'),
  ];
}

// 今月分の注文（平日のみ）。今日より前は「受取」中心、今日以降は「注文」中心。
function seedOrders(staff) {
  const t = today();
  const y = t.getFullYear(), m = t.getMonth();
  const r = rng(y * 100 + m + 7);
  const orders = {};
  const last = new Date(y, m + 1, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(y, m, day);
    if (weekIdx(d) > 4) continue;
    const key = ymd(d);
    const row = {};
    staff.forEach((st, i) => {
      const v = r();
      const low = i === 6 || i === 7; // 事務の2人は少なめ
      if (d < t) row[st.id] = v < (low ? 0.6 : 0.85) ? 'r' : 'x';
      else if (+d === +t) row[st.id] = v < 0.8 ? 'o' : 'x';
      else if (v < (low ? 0.4 : 0.7)) row[st.id] = 'o';
      else if (v < 0.8) row[st.id] = 'x';
    });
    orders[key] = row;
  }
  return orders;
}

// ---- 保存 ----
function read(name) {
  try { const v = localStorage.getItem(PREFIX + name); return v ? JSON.parse(v) : null; } catch { return null; }
}
function write(name, value) {
  try { localStorage.setItem(PREFIX + name, JSON.stringify(value)); } catch { /* 保存できない環境でも画面は動かす */ }
}

export const db = {
  users: [], staff: [], orders: {}, price: 300,
  load() {
    this.staff = read('staff') || seedStaff();
    this.users = read('users') || seedUsers();
    this.orders = read('orders') || seedOrders(this.staff);
    this.price = read('price') ?? 300;
    this.saveAll();
  },
  saveAll() { ['staff', 'users', 'orders', 'price'].forEach(k => write(k, this[k])); },
  save(name) { write(name, this[name]); },
  reset() {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && k !== PREFIX + 'theme').forEach(k => localStorage.removeItem(k)); } catch { /* noop */ }
    this.staff = seedStaff(); this.users = seedUsers(); this.orders = seedOrders(this.staff); this.price = 300;
    this.saveAll();
  },
};

// ---- 利用者の食事（その日に昼・夜があるか） ----
export function mealsOn(user, date) {
  const w = weekIdx(date);
  if (!user.days.includes(w)) return { lunch: null, dinner: null };
  return {
    lunch: user.lunch ? user.form : null,
    dinner: user.dinner ? (user.nightForm || user.form) : null,
  };
}
export function snackOn(user, date) { return user.snackDays.includes(weekIdx(date)); }
export function newUser() {
  return {
    id: 'u' + Date.now().toString(36), name: '', kana: '', days: [], lunch: true, dinner: false,
    form: '常食', nightForm: '', note: '', snackDays: [], snack: '', drink: '', add: '',
  };
}
