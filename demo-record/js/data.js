// 架空の初期データを「開いた日」基準で作る。実在の人物・事業所とは関係ありません。

export const FACILITY = { name: 'こもれびデイサービス', kind: '通所介護' };

export const MEMBERS = [
  { id: 'u01', name: '青木 ハル', kana: 'あおき はる', age: 86, sex: '女', level: '要介護2', bath: true },
  { id: 'u02', name: '石井 正男', kana: 'いしい まさお', age: 81, sex: '男', level: '要介護1', bath: false },
  { id: 'u03', name: '上田 キヨ', kana: 'うえだ きよ', age: 90, sex: '女', level: '要介護3', bath: true },
  { id: 'u04', name: '大野 茂', kana: 'おおの しげる', age: 78, sex: '男', level: '要支援2', bath: false },
  { id: 'u05', name: '川口 澄子', kana: 'かわぐち すみこ', age: 84, sex: '女', level: '要介護2', bath: true },
  { id: 'u06', name: '木下 勇', kana: 'きのした いさむ', age: 88, sex: '男', level: '要介護3', bath: true },
  { id: 'u07', name: '坂本 トミ', kana: 'さかもと とみ', age: 92, sex: '女', level: '要介護1', bath: false },
  { id: 'u08', name: '中島 弘', kana: 'なかじま ひろし', age: 80, sex: '男', level: '要介護2', bath: true },
  { id: 'u09', name: '松本 フミ', kana: 'まつもと ふみ', age: 87, sex: '女', level: '要介護1', bath: true },
  { id: 'u10', name: '森 和夫', kana: 'もり かずお', age: 83, sex: '男', level: '要支援2', bath: false },
];

export const STAFF = [
  { id: 's1', name: '山田 花子', role: '介護職員' },
  { id: 's2', name: '佐藤 健', role: '看護師' },
  { id: 's3', name: '鈴木 由美', role: '介護職員' },
  { id: 's4', name: '田中 誠', role: '生活相談員' },
  { id: 's5', name: '高橋 恵', role: '介護職員' },
];

export const CATEGORIES = ['様子', '食事', '入浴', '排泄', '機能訓練', '健康', '家族連絡'];

export const BATH_OPTIONS = ['一般浴', '機械浴', 'シャワー浴', '清拭', 'なし'];

// 利用者別介護記録の「種類」（複数選べる）
export const RECORD_TAGS = ['記録', '申し送り', '通所', '医療', '家族連絡'];
export const MEAL_KINDS = ['昼食', 'おやつ', '夕食'];
export const LEVELS = ['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'];

// 基本情報（フェイスシート相当）の初期値。すべて架空。
const PROFILE_POOL = {
  nurseGoal: [
    '体調の変化を早めに見つけ、安定した状態で通所を続ける。',
    '血圧の変動に気をつけ、むくみや息切れがないか毎回確認する。',
    '水分をこまめにとり、脱水や便秘を防ぐ。',
    '皮膚の状態を観察し、乾燥や傷を早めにケアする。',
  ],
  careGoal: [
    '下肢の筋力を保ち、自宅での生活を続けられるようにする。',
    '他の利用者との交流を楽しみ、外出の機会を保つ。',
    '入浴を安全に行い、清潔を保つ。',
    '転倒せずに室内を歩けるよう、歩行訓練を続ける。',
  ],
  disease: ['高血圧症、変形性膝関節症', '糖尿病（内服治療中）', '骨粗しょう症、腰部脊柱管狭窄症', '軽度認知症、高血圧症', '心不全（経過観察中）'],
  meds: ['降圧剤（朝）', '整腸剤（朝・夕）', '血糖降下剤（朝・夕）', '鎮痛剤（頓用）、湿布', '利尿剤（朝）'],
  indep: ['障害 J2／認知 自立', '障害 A1／認知 Ⅰ', '障害 A2／認知 Ⅱa', '障害 B1／認知 Ⅱb'],
  plan: ['', '週2回の通所で入浴と機能訓練を行う。', '通所でのレクリエーション参加と、栄養状態の確認。', '歩行訓練と、ご家族の介護負担の軽減。'],
};
export function buildProfiles(today) {
  const year = Number(today.slice(0, 4));
  const out = {};
  MEMBERS.forEach((m, i) => {
    const pick = (k, mul) => PROFILE_POOL[k][(i * mul) % PROFILE_POOL[k].length];
    out[m.id] = {
      birth: `${year - m.age - 1}-${String((i * 5) % 12 + 1).padStart(2, '0')}-${String((i * 7) % 27 + 1).padStart(2, '0')}`,
      sex: m.sex,
      level: m.level,
      plan: pick('plan', 3),
      nurseGoal: pick('nurseGoal', 1),
      careGoal: pick('careGoal', 3),
      disease: pick('disease', 2),
      meds: pick('meds', 3),
      indep: pick('indep', 1),
      service: `通所 週${3 + (i % 2)}回${m.bath ? '（入浴あり）' : ''}`,
    };
  });
  return out;
}

// ---- 日付ユーティリティ ----
export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return ymd(dt);
}
export function todayStr() { return ymd(new Date()); }

// ---- 決まった乱数（毎回同じ並びになる） ----
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const NOTE_TEXT = {
  様子: [
    '午前は塗り絵に集中され、職員と昔の話で笑顔が見られた。',
    '体操の時間は前列で参加。周りの方に声をかけておられた。',
    '午後は少し眠そうにされていたが、おやつの時間には元気に会話。',
    '囲碁を楽しまれ、勝ったと嬉しそうに話された。',
    '歌の会で手拍子をしながら参加された。',
  ],
  食事: [
    '昼食は全量摂取。魚の煮付けが美味しいと話された。',
    '副食を少し残されたが、主食は完食。',
    'むせ込みなく自力で摂取。食後に口腔ケア実施。',
  ],
  入浴: [
    '入浴実施。背部に発赤なし。湯加減よいとのこと。',
    '機械浴にて入浴。皮膚の乾燥あり保湿剤塗布。',
    '入浴後、水分補給 150ml。ふらつきなし。',
  ],
  排泄: [
    'トイレ誘導にて排尿あり。自力で衣服の上げ下げ可。',
    '午後に排便あり（普通便）。',
  ],
  機能訓練: [
    '平行棒内歩行 3 往復。ふらつき少なく安定。',
    'マシントレーニング 10 分。痛みの訴えなし。',
    '立ち上がり訓練 10 回 × 2 セット実施。',
  ],
  健康: [
    '来所時やや血圧高め。再測定で落ち着く。看護師へ報告済み。',
    '右膝の痛みの訴えあり。湿布貼付し様子観察。',
  ],
};

const HANDOVER_TEXT = [
  ['u03', '来週から入浴日が火・金に変更になります。'],
  ['u05', 'ご家族より、夜間よく眠れていないとの連絡あり。日中の様子を観察してください。'],
  [null, '送迎車 2 号車のタイヤ点検があるため、明日は 1 号車で回ります。'],
  ['u08', '内服薬が変わりました（昼食後の薬が 1 錠追加）。'],
  ['u01', '靴を新しくされました。歩行時の様子を見てください。'],
  [null, '午後のレクは秋の歌の会です。歌詞カードは事務所の棚にあります。'],
  ['u06', '水分摂取が少なめ。こまめな声かけをお願いします。'],
];

const STAFF_COMMENT = [
  '今日は体操に積極的に参加され、お友達との会話も弾んでいました。',
  '入浴されてさっぱりされたご様子でした。昼食も美味しく召し上がりました。',
  '午後は少しお疲れのご様子でしたが、おやつの後は笑顔で過ごされました。',
  '歌の会で懐かしい歌を口ずさんでおられました。',
  '歩行訓練を頑張られました。ご自宅でも無理のない範囲で続けてください。',
];

const NOTE_FOR_DIARY = ['', '', '', '午後うとうと', '体操に積極的', '膝の痛み訴えあり', '笑顔多い'];

const TIMES = ['10:15', '10:40', '11:20', '12:30', '13:40', '14:15', '15:00'];

// その日に利用予定の人（1日 7 名程度、日ごとに入れ替わる）
export function scheduledIds(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNo = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return MEMBERS.filter((_, i) => (dayNo + i * 3) % 10 < 7).map((u) => u.id);
}

export const SEED_VERSION = 2;

export function buildSeed() {
  const today = todayStr();
  const daily = {};
  const notes = [];
  const handovers = [];
  const contact = {};
  let noteId = 1;
  let hoId = 1;
  const meals = [];
  const weights = [];
  let extraId = 1;

  // 体重: 月に1回、半年分
  MEMBERS.forEach((m, i) => {
    const r = rng(9000 + i * 17);
    const base = (m.sex === '男' ? 54 : 42) + Math.floor(r() * 12);
    for (let k = 6; k >= 0; k--) {
      weights.push({ id: `w${extraId++}`, uid: m.id, date: addDays(today, -1 - k * 30), kg: Math.round((base + (r() - 0.5) * 2.4) * 10) / 10 });
    }
  });

  for (let off = -6; off <= 0; off++) {
    const date = addDays(today, off);
    const ids = scheduledIds(date);
    const r = rng(Number(date.replaceAll('-', '')));

    ids.forEach((uid, idx) => {
      const u = MEMBERS.find((m) => m.id === uid);
      const key = `${date}|${uid}`;

      // 今日: 先頭4名は入力途中、5・6人目は未入力、7人目は欠席連絡
      if (off === 0 && idx >= 4) {
        if (idx === ids.length - 1) {
          daily[key] = { absent: true, note: '体調不良のため欠席（ご家族より電話）' };
        }
        return;
      }
      // 過去日もときどき欠席
      if (off < 0 && r() < 0.06) {
        daily[key] = { absent: true, note: '私用のため欠席' };
        return;
      }

      const hot = r() < 0.08;
      const e = {
        arrive: `09:${String(5 + Math.floor(r() * 30)).padStart(2, '0')}`,
        temp: hot ? 37.3 : Math.round((36.0 + r() * 0.9) * 10) / 10,
        pulse: 60 + Math.floor(r() * 26),
        bpHi: 112 + Math.floor(r() * 38),
        bpLo: 62 + Math.floor(r() * 24),
        spo2: 94 + Math.floor(r() * 5),
      };
      const full = off < 0 || idx < 2;
      if (full) {
        e.mealMain = [10, 10, 10, 8, 7, 5][Math.floor(r() * 6)];
        e.mealSide = [10, 10, 8, 8, 6, 5][Math.floor(r() * 6)];
        e.water = 600 + Math.floor(r() * 7) * 100;
        e.urine = 1 + Math.floor(r() * 4);
        e.stool = r() < 0.4 ? 1 : 0;
        if (u.bath) e.bath = r() < 0.8 ? (u.level === '要介護3' ? '機械浴' : '一般浴') : 'なし';
        e.note = NOTE_FOR_DIARY[Math.floor(r() * NOTE_FOR_DIARY.length)];
        meals.push({ id: `m${extraId++}`, uid, date, kind: 'おやつ', main: r() < 0.8 ? 10 : 8, side: null, memo: '' });
      } else {
        e.water = 200;
      }
      daily[key] = e;

      // 介護記録
      const cats = full ? ['様子', ['食事', '機能訓練', '排泄', '入浴'][Math.floor(r() * 4)]] : ['様子'];
      if (hot) cats.push('健康');
      cats.forEach((c0, ci) => {
        const cat = c0 === '入浴' && !u.bath ? '機能訓練' : c0;
        const pool = NOTE_TEXT[cat];
        notes.push({
          id: `n${noteId++}`,
          uid,
          date,
          time: TIMES[(ci * 3 + Math.floor(r() * 3)) % TIMES.length],
          cat,
          text: hot && cat === '健康' ? '来所時 37.3℃。午後再検 36.8℃。看護師へ報告済み。' : pool[Math.floor(r() * pool.length)],
          staff: STAFF[Math.floor(r() * STAFF.length)].id,
          tags: cat === '健康' ? ['記録', '通所', '医療'] : ['記録', '通所'],
        });
      });

      if (off < 0) {
        contact[key] = { staff: STAFF_COMMENT[Math.floor(r() * STAFF_COMMENT.length)], family: '' };
      }
    });

    // 申し送り（1日 1〜2 件）
    const n = off === 0 ? 2 : 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const [uid, text] = HANDOVER_TEXT[((off + 6) * 2 + k) % HANDOVER_TEXT.length];
      handovers.push({
        id: `h${hoId++}`,
        date,
        uid,
        text,
        time: ['08:45', '12:10', '16:30'][k % 3],
        staff: STAFF[Math.floor(r() * STAFF.length)].id,
        done: off < -1,
        level: 1 + ((off + 6 + k) % 3),
      });
    }
  }
  notes.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return {
    version: SEED_VERSION, seedDate: today, daily, notes, handovers, contact,
    meals, weights, vsLog: [], profiles: buildProfiles(today), nextId: noteId + hoId + extraId + 100,
  };
}
