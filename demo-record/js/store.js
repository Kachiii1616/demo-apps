// ブラウザ内だけで完結する保存層（localStorage）。
import { buildSeed, todayStr, SEED_VERSION } from './data.js';

const PREFIX = 'showcase-record:';
const DATA_KEY = PREFIX + 'data';
const USER_KEY = PREFIX + 'me';

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* 保存できない環境でも画面は動かす */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

let state = null;

export function load() {
  const raw = safeGet(DATA_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // 日付が変わったら、その日を基準に作り直す
      if (parsed && parsed.seedDate === todayStr() && parsed.version === SEED_VERSION) { state = parsed; return state; }
    } catch { /* 壊れていたら作り直す */ }
  }
  state = buildSeed();
  save();
  return state;
}

export function save() { safeSet(DATA_KEY, JSON.stringify(state)); }

export function reset() {
  safeRemove(DATA_KEY);
  state = buildSeed();
  save();
}

export function db() { return state; }

export function newId(prefix) {
  state.nextId = (state.nextId || 1000) + 1;
  return prefix + state.nextId;
}

// ---- 日ごとの記録 ----
export function getDay(date, uid) { return state.daily[`${date}|${uid}`] || {}; }
export function setDay(date, uid, patch) {
  const key = `${date}|${uid}`;
  const next = { ...(state.daily[key] || {}), ...patch };
  Object.keys(next).forEach((k) => { if (next[k] === '' || next[k] === null || next[k] === undefined) delete next[k]; });
  state.daily[key] = next;
  save();
}

// ---- 介護記録 ----
export function addNote(n) { const it = { id: newId('n'), ...n }; state.notes.push(it); save(); return it; }
export function removeNote(id) { state.notes = state.notes.filter((n) => n.id !== id); save(); }

export function updateNote(id, patch) {
  const n = state.notes.find((x) => x.id === id);
  if (n) Object.assign(n, patch);
  save();
}

// ---- 利用者別介護記録で使う一覧（VSの追加分・食事・体重） ----
// list は 'vsLog' | 'meals' | 'weights'
export function addItem(list, item) { const it = { id: newId(list[0]), ...item }; state[list].push(it); save(); return it; }
export function updateItem(list, id, patch) {
  const it = state[list].find((x) => x.id === id);
  if (it) Object.assign(it, patch);
  save();
}
export function removeItem(list, id) { state[list] = state[list].filter((x) => x.id !== id); save(); }

// ---- 基本情報 ----
export function getProfile(uid) { return state.profiles[uid] || {}; }
export function setProfile(uid, patch) { state.profiles[uid] = { ...getProfile(uid), ...patch }; save(); }

// ---- 申し送り ----
export function addHandover(h) { const it = { id: newId('h'), done: false, ...h }; state.handovers.push(it); save(); return it; }
export function updateHandover(id, patch) {
  const h = state.handovers.find((x) => x.id === id);
  if (h) Object.assign(h, patch);
  save();
}
export function removeHandover(id) { state.handovers = state.handovers.filter((h) => h.id !== id); save(); }

// ---- 連絡帳 ----
export function getContact(date, uid) { return state.contact[`${date}|${uid}`] || { staff: '', family: '' }; }
export function setContact(date, uid, patch) {
  const key = `${date}|${uid}`;
  state.contact[key] = { ...getContact(date, uid), ...patch };
  save();
}

// ---- ログイン中の職員（デモ用の切り替え） ----
export function getMe() { return safeGet(USER_KEY) || 's1'; }
export function setMe(id) { safeSet(USER_KEY, id); }
