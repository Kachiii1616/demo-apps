// ブラウザ内だけで完結する保存層（localStorage）。
import { buildSeed, todayStr, SEED_VERSION } from './data.js';

const PREFIX = 'showcase-record:';
const DATA_KEY = PREFIX + 'data';
const USER_KEY = PREFIX + 'me';
const PREF_KEY = PREFIX + 'prefs';

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, val) { try { localStorage.setItem(key, val); } catch { /* 保存できない環境でも画面は動かす */ } }
function safeRemove(key) { try { localStorage.removeItem(key); } catch { /* noop */ } }

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
export function reset() { safeRemove(DATA_KEY); state = buildSeed(); save(); }
export function db() { return state; }

export function newId(prefix) {
  state.nextId = (state.nextId || 1000) + 1;
  return prefix + state.nextId;
}

// ---- 一覧（配列）の汎用操作 ----
export function list(name) { return state[name] || (state[name] = []); }
export function find(name, id) { return list(name).find((x) => x.id === id); }
export function add(name, item) { const it = { id: newId(name[0]), ...item }; list(name).push(it); save(); return it; }
export function update(name, id, patch) { const it = find(name, id); if (it) Object.assign(it, patch); save(); return it; }
export function remove(name, id) { state[name] = list(name).filter((x) => x.id !== id); save(); }

// ---- キー付きの入れ物（オブジェクト）の汎用操作 ----
export function getMap(name, key, fallback = undefined) { const m = state[name] || (state[name] = {}); return m[key] ?? fallback; }
export function setMap(name, key, val) {
  const m = state[name] || (state[name] = {});
  if (val === undefined || val === null) delete m[key]; else m[key] = val;
  save();
}

// ---- 日ごとの記録（業務日誌のマス） ----
export function getDay(date, uid) { return state.daily[`${date}|${uid}`] || {}; }
export function setDay(date, uid, patch) {
  const key = `${date}|${uid}`;
  const next = { ...(state.daily[key] || {}), ...patch };
  Object.keys(next).forEach((k) => { if (next[k] === '' || next[k] === null || next[k] === undefined || next[k] === false) delete next[k]; });
  state.daily[key] = next;
  save();
}

// ---- 業務日誌の下書き（「保存」を押すまで記録にしない） ----
export function getDraft(date, uid) { return state.drafts[`${date}|${uid}`]; }
export function setDraft(date, uid, patch) {
  const key = `${date}|${uid}`;
  state.drafts[key] = { ...(state.drafts[key] || {}), ...patch };
  save();
}
export function dropDraft(date, uid) { delete state.drafts[`${date}|${uid}`]; save(); }
export function draftKeys(date) { return Object.keys(state.drafts).filter((k) => k.startsWith(date + '|')).map((k) => k.split('|')[1]); }

// ---- 基本情報 ----
export function getProfile(uid) { return state.profiles[uid] || {}; }
export function setProfile(uid, patch) { state.profiles[uid] = { ...getProfile(uid), ...patch }; save(); }

// ---- ログイン中の職員（デモ用の切り替え）と表示の好み ----
export function getMe() { return safeGet(USER_KEY) || 's1'; }
export function setMe(id) { safeSet(USER_KEY, id); }
export function getPref(k, d) { try { return JSON.parse(safeGet(PREF_KEY) || '{}')[k] ?? d; } catch { return d; } }
export function setPref(k, v) { let p = {}; try { p = JSON.parse(safeGet(PREF_KEY) || '{}'); } catch { /* noop */ } p[k] = v; safeSet(PREF_KEY, JSON.stringify(p)); }
