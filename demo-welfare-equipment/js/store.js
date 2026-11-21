// localStorage に保存する小さなデータ置き場
import { buildSeed } from './seed.js';
import { todayYmd } from './util.js';

const KEY = 'showcase-welfare:data';
let state = null;

function safeGet() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function safeSet(v) {
  try { localStorage.setItem(KEY, v); } catch { /* 保存できない環境でも画面は動かす */ }
}

export function load() {
  const raw = safeGet();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) { state = parsed; return state; }
    } catch { /* 壊れていたら作り直す */ }
  }
  state = buildSeed();
  save();
  return state;
}

export function save() { safeSet(JSON.stringify(state)); }

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  state = buildSeed();
  save();
}

export const db = {
  get users() { return state.users; },
  get products() { return state.products; },
  get contracts() { return state.contracts; },
  get careOffices() { return state.careOffices; },

  user(id) { return state.users.find((u) => u.id === id); },
  product(id) { return state.products.find((p) => p.id === id); },
  careOffice(id) { return state.careOffices.find((c) => c.id === id); },
  contractsOf(userId) { return state.contracts.filter((c) => c.userId === userId); },

  upsertUser(u) {
    u.updatedAt = todayYmd();
    const i = state.users.findIndex((x) => x.id === u.id);
    if (i >= 0) state.users[i] = u; else state.users.push(u);
    save();
  },
  removeUser(id) {
    state.users = state.users.filter((u) => u.id !== id);
    state.contracts = state.contracts.filter((c) => c.userId !== id);
    save();
  },
  addContract(c) { state.contracts.push(c); touch(c.userId); save(); },
  updateContract(id, patch) {
    const c = state.contracts.find((x) => x.id === id);
    if (c) { Object.assign(c, patch); touch(c.userId); save(); }
  },
  removeContract(id) {
    const c = state.contracts.find((x) => x.id === id);
    state.contracts = state.contracts.filter((x) => x.id !== id);
    if (c) touch(c.userId);
    save();
  },
  upsertProduct(p) {
    const i = state.products.findIndex((x) => x.id === p.id);
    if (i >= 0) state.products[i] = p; else state.products.push(p);
    save();
  },
};

function touch(userId) {
  const u = state.users.find((x) => x.id === userId);
  if (u) u.updatedAt = todayYmd();
}
