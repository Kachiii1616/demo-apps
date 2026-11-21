// 架空の初期データ。「開いた日」を基準に、当月を含む直近3か月分を作る。
// 人名・施設名はすべて架空。

export const FACILITY = 'ひだまりの家（架空の施設）';

const STAFF = ['青木', '森', '石井', '小川'];

const PEOPLE = [
  { name: '山本 正一', kana: 'ヤマモト ショウイチ', note: 'ご長男より毎月預り' },
  { name: '井上 キヨ', kana: 'イノウエ キヨ', note: '理美容は月1回' },
  { name: '木村 和夫', kana: 'キムラ カズオ', note: '' },
  { name: '林 春子', kana: 'ハヤシ ハルコ', note: 'おやつは週1回まで' },
  { name: '清水 勇', kana: 'シミズ イサム', note: '通院時はタクシー利用' },
  { name: '山口 フサ', kana: 'ヤマグチ フサ', note: '' },
  { name: '松本 義男', kana: 'マツモト ヨシオ', note: 'ご長女が月初に来所' },
  { name: '池田 千代', kana: 'イケダ チヨ', note: '衣類の購入はご家族と相談' },
  { name: '前田 進', kana: 'マエダ ススム', note: '入院のため利用終了', ended: 1 },
  { name: '岡田 ハル', kana: 'オカダ ハル', note: '転居のため利用終了', ended: 2 },
];

// 小さな擬似乱数（毎回同じ並びにするため）
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function pad(n) { return String(n).padStart(2, '0'); }
export function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function buildSeed(today = new Date()) {
  const rand = rng(20261121);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b, step = 10) => a + Math.floor(rand() * ((b - a) / step + 1)) * step;

  const users = PEOPLE.map((p, i) => ({
    id: 'u' + (i + 1),
    name: p.name,
    kana: p.kana,
    order: i + 1,
    active: !p.ended,
    note: p.note,
  }));

  const first = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const months = [0, 1, 2].map((k) => new Date(first.getFullYear(), first.getMonth() + k, 1));
  const todayStr = ymd(today);

  const raw = [];
  const add = (date, userId, memo, inAmt, outAmt) => {
    if (date > todayStr) return;
    raw.push({ date, userId, memo, inAmt, outAmt, sign: pick(STAFF) });
  };
  const dayOf = (m, d) => {
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    return ymd(new Date(m.getFullYear(), m.getMonth(), Math.min(d, last)));
  };

  const OUTS = [
    () => ['日用品購入', between(300, 1900)],
    () => ['日用品購入（ティッシュ・歯みがき粉）', between(500, 1800)],
    () => ['日用品購入（洗顔料）', between(400, 900)],
    () => ['おやつ代', between(300, 800)],
    () => ['買い物代行（雑誌・切手）', between(300, 1200)],
    () => ['薬代（立替分）', between(300, 1500)],
    () => ['病院受診（立替分）', between(800, 2800)],
    () => ['小遣い', pick([1000, 1000, 2000])],
  ];

  users.forEach((u, idx) => {
    const p = PEOPLE[idx];
    months.forEach((m, mi) => {
      // 利用終了の人は1か月目（2人目は2か月目）まで
      if (p.ended && mi + 1 > p.ended) return;
      if (mi === 0) {
        // 3か月より前からの預り分を、前の月の末日に「開始時残高」として1行だけ置く
        add(ymd(new Date(m.getFullYear(), m.getMonth(), 0)), u.id, '預り金（開始時残高）', between(30000, 60000, 1000), 0);
      }
      const deposit = pick([10000, 10000, 20000, 0]);
      if (deposit) add(dayOf(m, 1 + Math.floor(rand() * 5)), u.id, '預り金（ご家族より）', deposit, 0);
      add(dayOf(m, 8 + Math.floor(rand() * 15)), u.id, '理美容代', 0, pick([1500, 2000, 2500, 3000]));
      const n = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const [memo, amt] = pick(OUTS)();
        add(dayOf(m, 2 + Math.floor(rand() * 27)), u.id, memo, 0, amt);
      }
      if (p.ended && mi + 1 === p.ended) {
        add(dayOf(m, 28), u.id, '__REFUND__', 0, 0);
      }
    });
  });

  // 日付順に並べて、残高がマイナスになる出金は落とす。返金は残高全額。
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const bal = {};
  const entries = [];
  let seq = 0;
  for (const r of raw) {
    const b = bal[r.userId] || 0;
    if (r.memo === '__REFUND__') {
      if (b <= 0) continue;
      r.memo = '残金返金（利用終了・ご家族へ）';
      r.outAmt = b;
    }
    if (r.outAmt > b + r.inAmt) continue;
    bal[r.userId] = b + r.inAmt - r.outAmt;
    entries.push({ id: 'e' + (++seq), seq, ...r });
  }

  return { version: 1, facility: FACILITY, users, entries, nextSeq: seq + 1, nextUser: users.length + 1 };
}
