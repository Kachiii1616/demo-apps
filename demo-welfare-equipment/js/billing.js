// デモ版の簡易な月次計算。
// 実際の請求規則ではなく「月の半分以上貸していれば月額、未満なら半額」だけを行う。
import { daysInMonth, parseYmd, toYmd } from './util.js';

export function monthlyRows(contracts, year, month) {
  const dim = daysInMonth(year, month);
  const mStart = new Date(year, month - 1, 1);
  const mEnd = new Date(year, month - 1, dim);
  const rows = [];
  for (const c of contracts) {
    const s = parseYmd(c.start);
    if (!s) continue;
    const e = parseYmd(c.end);
    const from = s > mStart ? s : mStart;
    const to = e && e < mEnd ? e : mEnd;
    if (from > to) continue;
    const days = Math.round((to - from) / 86400000) + 1;
    const full = days * 2 >= dim;
    rows.push({
      contract: c,
      from: toYmd(from),
      to: toYmd(to),
      days,
      dim,
      full,
      amount: Math.round(c.price * (full ? 1 : 0.5)),
    });
  }
  return rows;
}
