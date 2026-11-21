// localStorage への保存と、架空の初期データ（開いた日を基準に生成）
const PREFIX = 'showcase-cbt:';
const DATA_KEY = PREFIX + 'data';
const DRAFT_KEY = PREFIX + 'draft';

export const pad = (n) => String(n).padStart(2, '0');
export function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* 保存できない環境では無視 */ }
}

// 再現性のある乱数（毎回同じ形の初期データにするため）
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const NOTES = [
  'よく眠れた', '朝ごはんをゆっくり食べた', '雨で少し気が重い', '買い物が早く済んだ', '友人から連絡があった',
  '散歩が気持ちよかった', '肩がこっている', '予定が詰まっていた', '夕焼けがきれいだった', '部屋が片付いた',
  '寝つきが悪かった', '好きなパン屋が開いていた', '', '', '', '',
];
const POS = ['穏やか', '安心', '嬉しい', '楽しい', '気が楽'];
const NEG = ['不安', '疲れ', '焦り', '落ち込み', 'イライラ', '寂しい', '緊張'];

function buildSeed(now = new Date()) {
  const r = rng(20261121);
  const moods = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let ago = 29; ago >= 0; ago--) {
    const day = addDays(today, -ago);
    // ゆるやかな波：少し落ち込む時期をはさんで持ち直す
    const base = 5.5 + 1.3 * Math.sin((29 - ago) / 3.6) - (ago >= 18 && ago <= 24 ? 1.8 : 0) + (ago <= 6 ? 0.6 : 0);
    const count = r() < 0.45 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      if (ago === 0 && k > 0) break;
      const score = Math.max(1, Math.min(9, Math.round(base + (r() - 0.5) * 2.2)));
      let hour = k === 0 ? 7 + Math.floor(r() * 3) : 19 + Math.floor(r() * 3);
      let min = Math.floor(r() * 6) * 10;
      if (ago === 0) {
        hour = now.getHours() >= 9 ? 8 : Math.max(0, now.getHours() - 1);
        min = 10;
      }
      const at = new Date(day); at.setHours(hour, min, 0, 0);
      const pool = score >= 6 ? POS : score <= 4 ? NEG : (r() < 0.5 ? POS : NEG);
      const f1 = pool[Math.floor(r() * pool.length)];
      const feelings = [f1];
      if (r() < 0.35) {
        const f2 = pool[Math.floor(r() * pool.length)];
        if (f2 !== f1) feelings.push(f2);
      }
      moods.push({ id: uid(), at: at.toISOString(), score, feelings, memo: NOTES[Math.floor(r() * NOTES.length)] });
    }
  }

  const d = (n) => dayKey(addDays(today, -n));
  const columns = [
    {
      id: uid(), date: d(3), createdAt: addDays(today, -3).toISOString(),
      situation: 'スーパーのレジで小銭を落としてしまい、拾っているあいだに後ろの人がため息をついた気がした。',
      emotions: [{ name: '恥ずかしい', pct: 60 }, { name: '焦り', pct: 40 }],
      thought: '迷惑な人だと思われた。自分はいつも段取りが悪い。', belief: 70,
      evidence: '小銭を拾うのに30秒ほどかかった。後ろの人が小さく息をついた。',
      counter: 'ため息が自分に向けたものかは分からない。店員さんは「大丈夫ですよ」と言ってくれた。ふだんの会計は落ち着いてできている。',
      habits: ['心の読みすぎ', '一般化のしすぎ'],
      balanced: '手間取ったのは事実だけれど、30秒ほどのこと。ため息の理由は分からないし、いつも段取りが悪いわけでもない。', balancedBelief: 65,
      after: [{ name: '恥ずかしい', pct: 25 }, { name: '焦り', pct: 10 }], beliefAfter: 30,
      next: '小銭入れをすぐ出せるポケットに入れておく',
    },
    {
      id: uid(), date: d(10), createdAt: addDays(today, -10).toISOString(),
      situation: '習い事の発表会に向けた練習で、同じ箇所を何度も間違えた。',
      emotions: [{ name: '落ち込み', pct: 55 }, { name: '不安', pct: 50 }],
      thought: '本番もきっと失敗する。ほかの人の足を引っ張ってしまう。', belief: 75,
      evidence: '同じ4小節で3回つまずいた。',
      counter: '通しでは最後まで弾けた。先生は「ここは練習すれば大丈夫」と言っていた。先月苦手だった箇所は、今はできている。',
      habits: ['先読みの誤り', '心のフィルター'],
      balanced: '一か所はまだ不安定だけれど、全体は弾けている。本番まで2週間あるので、その部分だけ毎日少しずつ練習すればいい。', balancedBelief: 70,
      after: [{ name: '落ち込み', pct: 20 }, { name: '不安', pct: 30 }], beliefAfter: 35,
      next: '苦手な4小節だけを毎日5分練習する',
    },
    {
      id: uid(), date: d(19), createdAt: addDays(today, -19).toISOString(),
      situation: '家族に夕食の片付けを頼んだら「あとでやる」と言われ、寝る前までそのままになっていた。',
      emotions: [{ name: 'イライラ', pct: 65 }, { name: '疲れ', pct: 50 }],
      thought: '私ばかり家のことをしている。誰もわかってくれない。', belief: 80,
      evidence: 'その日の夕食づくりと洗濯は自分がした。',
      counter: '週末の掃除は家族がしてくれている。「あとで」がいつなのかを決めずに頼んでいた。',
      habits: ['すべき思考', '一般化のしすぎ', '拡大解釈・過小評価'],
      balanced: '今日は自分の負担が多かったけれど、いつも私ばかりというわけではない。頼むときに時間も伝えれば行き違いが減りそう。', balancedBelief: 70,
      after: [{ name: 'イライラ', pct: 25 }, { name: '疲れ', pct: 35 }], beliefAfter: 30,
      next: '週末に家事の分担を一緒に書き出す',
    },
  ];

  const actions = [
    { id: uid(), date: d(0), slot: '夜', title: '湯船に10分つかる', status: 'plan', before: null, after: null, mastery: null, pleasure: null, memo: '' },
    { id: uid(), date: d(-1), slot: '朝', title: '窓を開けて換気する', status: 'plan', before: null, after: null, mastery: null, pleasure: null, memo: '' },
    { id: uid(), date: d(2), slot: '午前', title: '近所を10分歩く', status: 'done', before: 4, after: 6, mastery: 5, pleasure: 7, memo: '公園の木が色づいていた' },
    { id: uid(), date: d(5), slot: '夕方', title: '机の上を5分片付ける', status: 'done', before: 4, after: 6, mastery: 7, pleasure: 4, memo: '' },
    { id: uid(), date: d(8), slot: '夜', title: 'ストレッチ5分', status: 'skip', before: null, after: null, mastery: null, pleasure: null, memo: '眠くて明日に回した' },
    { id: uid(), date: d(13), slot: '昼', title: '友人に近況を送る', status: 'done', before: 5, after: 7, mastery: 4, pleasure: 7, memo: '' },
  ];

  return { version: 1, seededOn: dayKey(today), moods, columns, actions };
}

let state = null;

export function load() {
  const raw = safeGet(DATA_KEY);
  if (raw) {
    try { state = JSON.parse(raw); } catch { state = null; }
  }
  if (!state || state.version !== 1) {
    state = buildSeed();
    save();
  }
  return state;
}
export function data() { return state || load(); }
export function save() { safeSet(DATA_KEY, JSON.stringify(state)); }
export function reset() {
  safeRemove(DRAFT_KEY);
  state = buildSeed();
  save();
}

export function loadDraft() {
  const raw = safeGet(DRAFT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export function saveDraft(d) { safeSet(DRAFT_KEY, JSON.stringify(d)); }
export function clearDraft() { safeRemove(DRAFT_KEY); }
