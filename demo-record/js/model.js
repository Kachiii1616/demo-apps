// 画面をまたいで使う、データの読み方（集計・判定）。業務ロジックは見た目に必要な単純なものだけ。
import { MEMBERS, STAFF, scheduledIds, addDays, weekdayOf } from './data.js';
import * as store from './store.js';
import { daysBetween, md } from './ui.js';

export const member = (id) => MEMBERS.find((m) => m.id === id);
export const staffName = (id) => STAFF.find((s) => s.id === id)?.name || '';
export const byKana = (a, b) => a.kana.localeCompare(b.kana, 'ja');
export const membersOnWeekday = (w) => MEMBERS.filter((m) => m.days.includes(w)).sort(byKana);

// その日の名簿：曜日の予定 ＋ 行を追加した人 ＋ 予定外でも記録がある人
export function rosterFor(date) {
  const ids = new Set(scheduledIds(date));
  (store.getMap('extraRows', date, []) || []).forEach((id) => ids.add(id));
  MEMBERS.forEach((m) => { if (Object.keys(store.getDay(date, m.id)).length) ids.add(m.id); });
  return MEMBERS.filter((m) => ids.has(m.id)).sort(byKana);
}

export function dayStatus(date, uid, e = store.getDay(date, uid)) {
  if (e.absent) return 'off';
  if (e.arrive || e.temp || e.bpHi) return 'in';
  return 'wait';
}

// 基準を外れた VS（デモ用の固定の目安）
export const vsOut = {
  temp: (v) => v >= 37.5,
  bp: (hi, lo) => hi >= 160 || hi < 90 || (lo != null && lo >= 100),
  pulse: (v) => v >= 100 || v < 50,
  spo2: (v) => v < 93,
};

export const mealOf = (uid, date, kind) => store.list('meals').find((m) => m.uid === uid && m.date === date && m.kind === kind);
export const drinksOf = (uid, date) => store.list('drinks').filter((d) => d.uid === uid && d.date === date).sort((a, b) => a.time.localeCompare(b.time));
export const waterTotal = (uid, date) => drinksOf(uid, date).reduce((s, d) => s + (d.ml || 0), 0);
export const excrOf = (uid, date, type) => store.list('excr').filter((x) => x.uid === uid && x.date === date && (!type || x.type === type)).sort((a, b) => a.time.localeCompare(b.time));
export const weightOn = (uid, date) => store.list('weights').find((w) => w.uid === uid && w.date === date);

export function lastStool(uid, date) {
  const xs = store.list('excr').filter((x) => x.uid === uid && x.type === '便' && x.date <= date).map((x) => x.date).sort();
  return xs.length ? xs[xs.length - 1] : null;
}
// 「11/20 (1日)」の形。3日以上あいたら注意色
export function lastStoolLabel(uid, date) {
  const ls = lastStool(uid, date);
  if (!ls) {
    const first = addDays(date, -7);
    return { text: `なし (${daysBetween(first, date) + 1}日)`, warn: true };
  }
  const n = daysBetween(ls, date);
  return { text: `${md(ls)} (${n}日)`, warn: n >= 3, date: ls, days: n };
}

// 業務日誌で「不要」にした項目（× を出す）
export const needOf = (uid) => store.getMap('need', uid, {}) || {};
export const isNeeded = (uid, key) => needOf(uid)[key] !== false;

export const weekdayLabelOf = (m) => m.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((w) => '日月火水木金土'[w]).join('・');
export const bathLabelOf = (m) => (m.bathDays.length ? m.bathDays.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((w) => '日月火水木金土'[w]).join('・') : '');
export const serviceLabel = (m) => `通所 ${weekdayLabelOf(m)}${m.bathDays.length ? `（入浴 ${bathLabelOf(m)}）` : ''}`;
export const isToday = (date, today) => date === today;
export const wdOf = weekdayOf;
