// 架空の初期データを「開いた日」基準で作る。実在の人物・事業所とは関係ありません。

export const FACILITY = { name: 'こもれびデイサービス', kind: '通所介護' };

// days: 通所する曜日（0=日 … 6=土）、bathDays: 入浴する曜日
export const MEMBERS = [
  { id: 'u01', name: '青木 ハル', kana: 'あおき はる', age: 86, sex: '女', level: '要介護2', days: [2, 4, 5, 6, 0], bathDays: [2, 5] },
  { id: 'u02', name: '石井 正男', kana: 'いしい まさお', age: 81, sex: '男', level: '要介護1', days: [1, 3, 5, 6], bathDays: [] },
  { id: 'u03', name: '上田 キヨ', kana: 'うえだ きよ', age: 90, sex: '女', level: '要介護3', days: [1, 2, 3, 4, 5, 6], bathDays: [1, 4] },
  { id: 'u04', name: '大野 茂', kana: 'おおの しげる', age: 78, sex: '男', level: '要支援2', days: [2, 4, 6, 0], bathDays: [] },
  { id: 'u05', name: '川口 澄子', kana: 'かわぐち すみこ', age: 84, sex: '女', level: '要介護2', days: [1, 3, 4, 6, 0], bathDays: [3, 6] },
  { id: 'u06', name: '木下 勇', kana: 'きのした いさむ', age: 88, sex: '男', level: '要介護3', days: [1, 2, 4, 5, 6], bathDays: [2, 5] },
  { id: 'u07', name: '坂本 トミ', kana: 'さかもと とみ', age: 92, sex: '女', level: '要介護1', days: [1, 3, 4, 5, 0], bathDays: [] },
  { id: 'u08', name: '中島 弘', kana: 'なかじま ひろし', age: 80, sex: '男', level: '要介護2', days: [2, 3, 4, 5, 6, 0], bathDays: [3, 6] },
  { id: 'u09', name: '松本 フミ', kana: 'まつもと ふみ', age: 87, sex: '女', level: '要介護1', days: [1, 2, 3, 4, 5], bathDays: [2, 4] },
  { id: 'u10', name: '森 和夫', kana: 'もり かずお', age: 83, sex: '男', level: '要支援2', days: [1, 3, 4, 6, 0], bathDays: [] },
];

export const STAFF = [
  { id: 's1', name: '山田 花子', role: '介護職員' },
  { id: 's2', name: '佐藤 健', role: '看護師' },
  { id: 's3', name: '鈴木 由美', role: '介護職員' },
  { id: 's4', name: '田中 誠', role: '生活相談員' },
  { id: 's5', name: '高橋 恵', role: '介護職員' },
];

export const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// 記録の種類（記録に付ける印）
export const RECORD_TAGS = ['記録', '申し送り', '通所', '医療', '家族連絡'];
export const FILTER_TAGS = ['訪問', '申し送り', '訪問介護', '通所', '訪問看護', '医療', '家族連絡'];
export const MEAL_KINDS = ['昼食', 'おやつ', '夕食'];
export const LEVELS = ['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'];
export const EXERCISES = ['集団体操', 'リズム体操', '個別機能訓練', '筋力トレーニング', '歩行訓練', 'ストレッチ', 'マシントレーニング', 'ボール運動', '脳トレ'];
export const EX_MINUTES = ['5分', '10分', '15分', '20分', '30分', '40分', '45分', '50分', '60分'];
export const BATH_KINDS = ['一般浴', '機械浴', 'シャワー浴', '清拭', '中止'];
export const JIHI_ITEMS = ['朝食代', '宿泊代', '弁当代', '代食', 'おむつ代', 'パット代', '洗濯代', '髭剃り代'];
export const REC_CATS = [
  { key: 'game', label: 'ゲーム', color: '#dcebfb', border: '#6c95c9' },
  { key: 'music', label: '音楽', color: '#fde3ea', border: '#e58aa2' },
  { key: 'brain', label: '脳トレ', color: '#ece3fb', border: '#9a82cf' },
  { key: 'craft', label: '創作', color: '#efebe5', border: '#8d8175' },
];
export const REC_MASTER = [
  { name: '風船バレー', cat: 'game', dur: '1時間' },
  { name: '歌の会', cat: 'music', dur: '45分' },
  { name: '折り紙', cat: 'craft', dur: '1時間' },
  { name: '書道', cat: 'craft', dur: '1時間' },
  { name: '脳トレクイズ', cat: 'brain', dur: '30分' },
  { name: '輪投げ', cat: 'game', dur: '1時間' },
  { name: '貼り絵', cat: 'craft', dur: '1時間' },
  { name: '合唱', cat: 'music', dur: '45分' },
];

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
  indep: [['J2', '自立'], ['A1', 'Ⅰ'], ['A2', 'Ⅱa'], ['B1', 'Ⅱb']],
  plan: ['', '週2回の通所で入浴と機能訓練を行う。', '通所でのレクリエーション参加と、栄養状態の確認。', '歩行訓練と、ご家族の介護負担の軽減。'],
  adl: ['歩行: 杖使用で自立 / 入浴: 一部介助', '歩行: 見守り / 入浴: 一部介助', '歩行: 歩行器使用 / 入浴: 全介助', '歩行: 自立 / 入浴: 見守り', '移動: 車いす / 入浴: 全介助'],
  iadl: ['買い物・調理は家族が支援', '服薬管理は家族が支援', '買い物は週1回ヘルパーと', 'ほぼ自立（金銭管理のみ家族）'],
  clinic: ['みなみ内科クリニック（月1回）', 'ひがし整形外科（2週に1回）', 'さくら台医院（月1回）', 'みどり総合病院 内科（月1回）'],
  keyRel: ['長女', '長男', '次女', '妻', '夫'],
  town: ['みどり市本町', 'みどり市中央', 'さくら市西町', 'さくら市東町', 'こもれび市北町'],
  remark: [
    '耳が遠いので、正面からゆっくり声かけ。',
    '水分は 1 日 1000ml まで（主治医の指示）。',
    '右片麻痺あり。食事は一口大。',
    '帰宅を気にされることあり。声かけで落ち着かれる。',
    '左膝に痛みあり。歩行時は見守り。',
    '甘いものは控えめに（ご家族希望）。',
    '手芸が得意。レクで声をかけると喜ばれる。',
    'とろみ剤使用。むせ込みに注意。',
    '体操に意欲的。',
    '朝のこわばりあり。午前はゆっくり。',
  ],
};

export function buildProfiles(today) {
  const year = Number(today.slice(0, 4));
  const out = {};
  MEMBERS.forEach((m, i) => {
    const pick = (k, mul) => PROFILE_POOL[k][(i * mul) % PROFILE_POOL[k].length];
    const [phys, cog] = pick('indep', 1);
    out[m.id] = {
      birth: `${year - m.age - 1}-${String((i * 5) % 12 + 1).padStart(2, '0')}-${String((i * 7) % 27 + 1).padStart(2, '0')}`,
      sex: m.sex,
      level: m.level,
      plan: pick('plan', 3),
      nurseGoal: pick('nurseGoal', 1),
      careGoal: pick('careGoal', 3),
      disease: pick('disease', 2),
      meds: pick('meds', 3),
      phys, cog,
      adl: pick('adl', 1),
      iadl: pick('iadl', 3),
      clinic: pick('clinic', 1),
      address: `〒000-0000　${pick('town', 1)}${i + 1}-${(i * 3) % 9 + 1}-${(i * 5) % 9 + 1}`,
      keyPerson: `${m.name.split(' ')[0]} ${['一美', '健一', '直子', '浩二', '由紀'][i % 5]}（${pick('keyRel', 1)}）03-0000-00${String(10 + i).padStart(2, '0')}`,
      certEnd: `${year + 1 + (i % 2)}-${String((i * 4) % 12 + 1).padStart(2, '0')}-${String(28 + (i % 2)).padStart(2, '0')}`,
      height: m.sex === '男' ? 160 + (i * 3) % 12 : 146 + (i * 3) % 10,
    };
  });
  return out;
}

export function buildRemarks() {
  const out = {};
  MEMBERS.forEach((m, i) => { out[m.id] = { text: PROFILE_POOL.remark[i], mode: '全利用日' }; });
  return out;
}

// ---- 日付ユーティリティ ----
export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
}
export function todayStr() { return ymd(new Date()); }
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
export function mondayOf(dateStr) {
  const w = weekdayOf(dateStr);
  return addDays(dateStr, w === 0 ? -6 : 1 - w);
}

// その日に通所予定の人（曜日で決まる）
export function scheduledIds(dateStr) {
  const w = weekdayOf(dateStr);
  return MEMBERS.filter((m) => m.days.includes(w)).map((m) => m.id);
}
export function bathPlanned(uid, dateStr) {
  const m = MEMBERS.find((x) => x.id === uid);
  return !!m && m.bathDays.includes(weekdayOf(dateStr));
}

// 出勤する職員（デモ用に曜日でずらすだけ）
export function staffOn(dateStr) {
  const w = weekdayOf(dateStr);
  return STAFF.filter((_, i) => (w + i) % 5 !== 0).slice(0, 4);
}
export const SHIFT_TIMES = ['08:30', '08:30', '09:00', '09:00', '08:30'];

// ---- 決まった乱数（毎回同じ並びになる） ----
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const NOTE_TEXT = [
  '他の利用者さんと談笑され、穏やかに過ごされる。',
  '集団体操に最後まで参加。「足が軽くなった」とのこと。',
  '午後、やや傾眠がち。声かけで覚醒し、お茶を 150ml 飲まれる。',
  'トイレ誘導にて排尿あり。ズボンの上げ下ろしは一部介助。',
  '歩行時にふらつきあり。手引きで移動し、様子観察とする。',
  '囲碁を楽しまれ、勝ったと嬉しそうに話された。',
  '歌の会で手拍子をしながら参加された。',
  '昼食は全量摂取。魚の煮付けが美味しいと話された。',
  '入浴実施。背部に発赤なし。湯加減よいとのこと。',
  '平行棒内歩行 3 往復。ふらつき少なく安定。',
];
const MED_NOTE = '来所時 37.3℃。午後再検 36.8℃。看護師へ報告済み。';
const FAMILY_NOTE = '連絡帳にご家族から返信あり。「自宅でも体操を続けています」とのこと。';

const HANDOVER_TEXT = [
  ['u03', '来週から入浴日が月・木に変わります。'],
  ['u05', 'ご家族より、夜間よく眠れていないとの連絡あり。日中の様子を観察してください。'],
  ['u08', '内服薬が変わりました（昼食後の薬が 1 錠追加）。'],
  ['u01', '靴を新しくされました。歩行時の様子を見てください。'],
  ['u06', '水分摂取が少なめ。こまめな声かけをお願いします。'],
  ['u02', '昼食後の薬を飲み忘れそうになった。次回から配薬時に声かけを徹底する。'],
  ['u10', '右手首に軽い痛みの訴えあり。様子を見てください。'],
];

const PROGRESS_TEXT = [
  ['電話連絡', 'ご家族（長女）より電話。来週の受診のため水曜はお休みとのこと。'],
  ['担当者会議', 'サービス担当者会議に出席。現行のプランを継続、入浴回数は週2回のまま。'],
  ['支援経過', '通所時の歩行が以前より安定。機能訓練の内容を一段階上げることを提案。'],
];

export const SEED_VERSION = 4;

export function buildSeed() {
  const today = todayStr();
  const daily = {};
  const notes = [];
  const meals = [];
  const weights = [];
  const drinks = [];
  const excr = [];
  const contact = {};
  let id = 1;
  const nid = (p) => `${p}${id++}`;

  // 体重: 月に1回、半年分
  MEMBERS.forEach((m, i) => {
    const r = rng(9000 + i * 17);
    const base = (m.sex === '男' ? 54 : 42) + Math.floor(r() * 12);
    for (let k = 6; k >= 0; k--) {
      weights.push({ id: nid('w'), uid: m.id, date: addDays(today, -1 - k * 30), kg: Math.round((base + (r() - 0.5) * 2.4) * 10) / 10, staff: 's1' });
    }
  });

  for (let off = -13; off <= 0; off++) {
    const date = addDays(today, off);
    const ids = scheduledIds(date);
    const r = rng(Number(date.replaceAll('-', '')));

    ids.forEach((uid, idx) => {
      const key = `${date}|${uid}`;
      // 今日: 後ろ2名はまだ来ていない
      if (off === 0 && idx >= ids.length - 2) return;
      if (off < 0 && r() < 0.05) { daily[key] = { absent: true }; return; }

      const hot = r() < 0.07;
      const arrive = `09:${String(5 + Math.floor(r() * 25)).padStart(2, '0')}`;
      const e = {
        arrive,
        temp: hot ? 37.3 : Math.round((36.0 + r() * 0.9) * 10) / 10,
        pulse: 60 + Math.floor(r() * 26),
        bpHi: 112 + Math.floor(r() * 38),
        bpLo: 62 + Math.floor(r() * 24),
        spo2: 94 + Math.floor(r() * 5),
        vsTime: arrive,
        vsStaff: STAFF[Math.floor(r() * STAFF.length)].id,
      };
      const full = off < 0;
      if (full) {
        e.nurse = true;
        e.medNoonA = true;
        if (bathPlanned(uid, date)) e.bath = r() < 0.9 ? '一般浴' : '中止';
        e.exercise = EXERCISES[Math.floor(r() * 4)];
        e.exMin = ['10分', '15分', '20分', '30分'][Math.floor(r() * 4)];
        e.book = true;
        meals.push({ id: nid('m'), uid, date, kind: '昼食', main: [10, 10, 10, 8, 7, 5][Math.floor(r() * 6)], side: [10, 10, 8, 8, 6, 5][Math.floor(r() * 6)], time: '12:30', staff: 's3', memo: '' });
        meals.push({ id: nid('m'), uid, date, kind: 'おやつ', main: r() < 0.8 ? 10 : 8, side: null, time: '15:00', staff: 's3', memo: '' });
        ['10:00', '12:30', '15:00'].forEach((t, k) => drinks.push({ id: nid('d'), uid, date, time: t, ml: [150, 200, 150][k], what: ['お茶', 'お茶', 'コーヒー'][k], staff: 's5' }));
        const nU = 1 + Math.floor(r() * 3);
        for (let k = 0; k < nU; k++) excr.push({ id: nid('x'), uid, date, time: ['10:20', '13:10', '15:40'][k], type: '尿', staff: STAFF[(idx + k) % 5].id });
        if (r() < 0.35) excr.push({ id: nid('x'), uid, date, time: '11:30', type: '便', staff: 's2' });
      } else {
        // 今日: 来ている人は朝のバイタルと水分・排尿だけ
        drinks.push({ id: nid('d'), uid, date, time: '10:00', ml: 150, what: 'お茶', staff: 's5' });
        excr.push({ id: nid('x'), uid, date, time: '10:20', type: '尿', staff: STAFF[idx % 5].id });
      }
      daily[key] = e;

      // 介護記録
      const count = full ? 1 + (r() < 0.4 ? 1 : 0) : 1;
      for (let k = 0; k < count; k++) {
        const med = hot && k === 0;
        notes.push({
          id: nid('n'), uid, date,
          time: `${10 + k * 3 + Math.floor(r() * 2)}:${String(Math.floor(r() * 50) + 10)}`,
          text: med ? MED_NOTE : NOTE_TEXT[Math.floor(r() * NOTE_TEXT.length)],
          staff: STAFF[Math.floor(r() * STAFF.length)].id,
          tags: med ? ['記録', '通所', '医療'] : ['記録', '通所'],
          level: 1,
        });
      }
      if (full) contact[key] = { staff: '今日は体操に積極的に参加され、お友達との会話も弾んでいました。', rehab: [e.exercise], meds: ['昼食後'], rec: '', bathYN: e.bath && e.bath !== '中止' ? '有' : '無' };
    });

    // 申し送り（1日 0〜1 件、今日は 1 件）
    if (off === 0 || r() < 0.6) {
      const [uid, text] = HANDOVER_TEXT[(off + 13) % HANDOVER_TEXT.length];
      if (ids.includes(uid) || off === 0) notes.push({ id: nid('n'), date, uid, text, time: ['09:40', '12:10', '16:20'][(off + 13) % 3], staff: STAFF[Math.floor(r() * STAFF.length)].id, tags: ['申し送り'], level: 1 + ((off + 13) % 3) });
    }
  }
  // 今日の家族連絡（申し送り付き）
  const famUid = scheduledIds(today)[0];
  const fam = { id: nid('n'), uid: famUid, date: today, time: '09:40', text: FAMILY_NOTE, staff: 's4', tags: ['申し送り', '家族連絡'], level: 3 };
  notes.push(fam);

  notes.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // 経過記録
  const progress = [];
  PROGRESS_TEXT.forEach(([kind, text], i) => {
    progress.push({ id: nid('p'), uid: MEMBERS[i].id, date: addDays(today, -3 - i * 4), time: '14:00', kind, text, staff: 's4', addenda: [] });
  });

  // レクリエーション（今月の毎日）
  const rec = {};
  const [ty, tm] = today.split('-').map(Number);
  const last = new Date(ty, tm, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const ds = `${ty}-${String(tm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const mItem = REC_MASTER[(d * 5) % 6];
    rec[ds] = { name: mItem.name, cat: mItem.cat, dur: mItem.dur, host: STAFF[d % STAFF.length].id };
  }

  // 利用者変更連絡（今日の1件）
  const changes = [{ id: nid('c'), date: today, uid: 'u07', kinds: ['送迎時間変更'], memo: '家族送迎のため 10:30 来所' }];
  const special = { [today]: { schedule: '【休み・臨時】\n坂本 トミ／送迎時間変更／家族送迎のため 10:30 来所', staff: staffOn(today).map((s) => s.name).join('、') } };

  return {
    version: SEED_VERSION, seedDate: today,
    daily, notes, meals, weights, drinks, excr, vsLog: [], contact,
    profiles: buildProfiles(today), remarks: buildRemarks(),
    need: Object.fromEntries(MEMBERS.filter((m) => !m.bathDays.length).map((m) => [m.id, { bath: false }])),
    progress, rec, recMaster: REC_MASTER.map((x) => ({ ...x })), changes,
    drafts: {}, extraRows: {}, special, jihi: {}, weekly: {}, memos: [], consults: [], intakes: [], procedures: {}, life: [], settings: {},
    nextId: id + 100,
  };
}
