// データの保存と、架空の初期データ（開いた日を基準に生成）
const KEY = 'showcase-vns:data-v1';
const THEME_KEY = 'showcase-vns:theme';

// ---------- 日付の小道具 ----------
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayStr = () => ymd(new Date());
export const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const md = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
export const longDate = (s) => { const d = parseYmd(s); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`; };
export const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = (m) => `${Math.floor(m / 60)}:${pad(m % 60)}`;
export const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const uid = (p) => p + Math.random().toString(36).slice(2, 9);
export const age = (birth, at = todayStr()) => {
  if (!birth) return '';
  const b = parseYmd(birth), t = parseYmd(at);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
};

// ---------- 乱数（毎回同じ初期データにするため） ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- 初期データ ----------
function seed() {
  const T = todayStr();
  const r = rng(20261121);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const round1 = (v) => Math.round(v * 10) / 10;

  const staff = [
    { id: 's1', name: '高橋', role: '看護師' },
    { id: 's2', name: '伊藤', role: '看護師' },
    { id: 's3', name: '山本', role: '看護師' },
    { id: 's4', name: '渡辺', role: 'リハビリ職' },
  ];

  const yearsAgo = (y, m, d) => { const t = parseYmd(T); return ymd(new Date(t.getFullYear() - y, m - 1, d)); };

  const patients = [
    {
      id: 'p1', name: '松本 勝', kana: 'マツモト マサル', sex: '男', birth: yearsAgo(84, 5, 12),
      disease: '慢性心不全', care: '要介護3', burden: '3割', insurance: '介護保険',
      address: '見本県みどり市さくら町1-2-3 サンプルハイツ105', tel: '090-0000-1001',
      kp: '松本 浩二（長男）', kpTel: '090-0000-1002', kpRel: '長男',
      hospital: 'ひかり診療所', doctor: '青木 医師', cm: 'ひなた居宅介護支援 中島', cmTel: '03-0000-2001',
      orderStart: addDays(T, -160), orderEnd: addDays(T, 18), nextClinic: addDays(T, 3), nextHomeVisit: addDays(T, 9),
      caution: '体重が前回より1kg以上増えたら主治医に報告。',
      history: '高血圧（60代〜）', course: '心不全の増悪で入院。退院後の体調管理と内服確認のため訪問開始。',
      tasks: ['内服セット', '下肢浮腫チェック', '皮膚チェック', 'ADLチェック', '点眼'],
      base: { sys: 132, dia: 76, pulse: 66, temp: 36.4, spo2: 97, weight: 58.2 },
      week: { '月午前': 'ヘルパー', '水午前': 'デイ', '月午後': '訪看', '木午後': 'ヘルパー', '日午後': '家族' },
    },
    {
      id: 'p2', name: '竹内 ヨシ', kana: 'タケウチ ヨシ', sex: '女', birth: yearsAgo(89, 2, 3),
      disease: '脳梗塞後遺症', care: '要介護4', burden: '1割', insurance: '介護保険',
      address: '見本県みどり市かえで町4-5-6', tel: '03-0000-1101',
      kp: '竹内 由美（長女）', kpTel: '090-0000-1102', kpRel: '長女',
      hospital: 'ひかり診療所', doctor: '青木 医師', cm: 'ひなた居宅介護支援 中島', cmTel: '03-0000-2001',
      orderStart: addDays(T, -60), orderEnd: addDays(T, 120), nextClinic: addDays(T, 12), nextHomeVisit: '',
      caution: '右片麻痺あり。移乗は2人で。仙骨部の発赤に注意。',
      history: '脳梗塞（5年前）、骨粗しょう症', course: '在宅療養中の褥瘡予防と排便コントロールのため。',
      tasks: ['陰部洗浄', '仙骨部皮膚チェック', '摘便', '関節可動域訓練'],
      base: { sys: 124, dia: 70, pulse: 72, temp: 36.6, spo2: 96, weight: 41.5 },
      week: { '火午前': '訪問入浴', '金午前': '訪看', '水午後': 'ヘルパー' },
    },
    {
      id: 'p3', name: '西村 拓也', kana: 'ニシムラ タクヤ', sex: '男', birth: yearsAgo(49, 9, 21),
      disease: '統合失調症', care: 'なし', burden: '3割', insurance: '医療保険',
      address: '見本県みどり市つばき町7-8-9-201', tel: '090-0000-1201',
      kp: '西村 和代（母）', kpTel: '090-0000-1202', kpRel: '母',
      hospital: 'こもれびクリニック', doctor: '石井 医師', cm: '', cmTel: '',
      orderStart: addDays(T, -20), orderEnd: addDays(T, 160), nextClinic: addDays(T, 6), nextHomeVisit: '',
      caution: '話をさえぎらずに聞く。服薬の話は最後に。',
      history: '特になし', course: '退院後の服薬継続と生活リズムの支援のため。',
      tasks: ['服薬確認', '睡眠状況の確認', '生活リズムの確認'],
      base: { sys: 118, dia: 72, pulse: 78, temp: 36.3, spo2: 98, weight: 71.0 },
      week: { '月午前': '作業所', '水午前': '作業所', '金午前': '作業所', '火午後': '訪看' },
    },
    {
      id: 'p4', name: '小池 フミ', kana: 'コイケ フミ', sex: '女', birth: yearsAgo(80, 11, 30),
      disease: 'パーキンソン病', care: '要介護2', burden: '2割', insurance: '介護保険',
      address: '見本県みどり市さくら町2-2-2', tel: '03-0000-1301',
      kp: '小池 誠（夫）', kpTel: '090-0000-1302', kpRel: '夫',
      hospital: 'みどり総合病院', doctor: '森田 医師', cm: 'あおぞらケアプラン 大野', cmTel: '03-0000-2101',
      orderStart: addDays(T, -185), orderEnd: addDays(T, -3), nextClinic: addDays(T, 17), nextHomeVisit: '',
      caution: 'すくみ足あり。方向転換はゆっくり声かけ。',
      history: '腰椎圧迫骨折（3年前）', course: '転倒予防と歩行訓練、内服管理のため。',
      tasks: ['歩行訓練', '内服確認', '転倒リスク確認'],
      base: { sys: 112, dia: 66, pulse: 70, temp: 36.2, spo2: 97, weight: 47.8 },
      week: { '水午前': 'デイ', '土午前': 'デイ', '火午後': 'リハ' },
    },
    {
      id: 'p5', name: '岡田 シズ', kana: 'オカダ シズ', sex: '女', birth: yearsAgo(77, 7, 7),
      disease: '2型糖尿病', care: '要介護1', burden: '1割', insurance: '介護保険',
      address: '見本県みどり市もみじ台3-10', tel: '03-0000-1401',
      kp: '岡田 達也（次男）', kpTel: '090-0000-1402', kpRel: '次男',
      hospital: 'ひかり診療所', doctor: '青木 医師', cm: 'あおぞらケアプラン 大野', cmTel: '03-0000-2101',
      orderStart: addDays(T, -100), orderEnd: addDays(T, 80), nextClinic: addDays(T, 5), nextHomeVisit: '',
      caution: '低血糖症状（冷や汗・ふらつき）があれば補食を。',
      history: '白内障術後', course: 'インスリン自己注射の手技確認と足の観察のため。',
      tasks: ['血糖値の確認', 'インスリン手技確認', 'フットケア'],
      base: { sys: 138, dia: 80, pulse: 74, temp: 36.5, spo2: 97, weight: 62.4 },
      week: { '木午前': 'デイ', '月午後': '訪看' },
    },
  ];

  // 曜日（今日からの日数 0〜6）ごとの訪問の型
  const slots = [
    { p: 'p1', k: 0, s: 's1', st: '15:00', du: 30 },
    { p: 'p1', k: 3, s: 's2', st: '10:00', du: 30 },
    { p: 'p2', k: 0, s: 's1', st: '9:30', du: 30 },
    { p: 'p2', k: 4, s: 's3', st: '14:00', du: 40 },
    { p: 'p3', k: 0, s: 's2', st: '11:00', du: 30 },
    { p: 'p3', k: 5, s: 's2', st: '13:00', du: 30 },
    { p: 'p4', k: 0, s: 's3', st: '13:30', du: 60 },
    { p: 'p4', k: 0, s: 's4', st: '10:00', du: 40, kind: 'リハビリ' },
    { p: 'p4', k: 2, s: 's4', st: '10:00', du: 40, kind: 'リハビリ' },
    { p: 'p5', k: 1, s: 's3', st: '9:00', du: 30 },
    { p: 'p5', k: 4, s: 's1', st: '16:00', du: 30 },
  ];

  const S_POOL = ['変わりないです。', 'よく眠れた。', '元気！', '少し眠いね。', '足がだるい感じがする。', '食欲はあるよ。', '昨日は散歩に行った。', 'まあまあかな。'];
  const O_POOL = ['表情穏やか。胸部症状なし。', '浮腫なし。内服の飲み忘れなし。', '皮膚トラブルなし。', '歩行ふらつきなし。', '下肢に軽度の浮腫あり。', '食事摂取良好。', '会話しっかり。', '室温適切。'];
  const HANDOVER = ['処方が今週末まで。次回、受診できたか確認してください。', '仙骨部に軽い発赤あり。次回も観察をお願いします。', '湿布が残り少ないとのこと。家族に伝え済み。', ''];

  const plans = [];
  const records = [];
  const kindOf = (sid) => (staff.find((x) => x.id === sid).role === 'リハビリ職' ? 'リハビリ' : '看護');

  for (let w = -6; w <= 2; w++) {
    for (const sl of slots) {
      const date = addDays(T, sl.k + 7 * w);
      if (diffDays(date, T) > 42) continue;
      const kind = sl.kind || kindOf(sl.s);
      const startM = toMin(sl.st);
      const plan = { id: uid('v'), date, staffId: sl.s, patientId: sl.p, start: hhmm(startM), end: hhmm(startM + sl.du), kind };
      plans.push(plan);
      const isPast = date < T;
      const isTodayDone = date === T && sl.p === 'p2' && sl.s === 's1';
      // 過去の予定はほぼ実施済み。1件だけ未実施を残す
      const skip = isPast && sl.p === 'p4' && sl.kind && diffDays(date, T) <= 7;
      if ((isPast && !skip) || isTodayDone) {
        const p = patients.find((x) => x.id === sl.p);
        const b = p.base;
        const shift = isTodayDone ? 15 : (r() < 0.2 ? 10 : 0);
        const ok = () => (r() < 0.88 ? 'OK' : '△');
        const taskSet = {};
        p.tasks.forEach((t, i) => { taskSet[t] = i < 3 || r() < 0.5; });
        records.push({
          id: uid('r'), patientId: sl.p, date, staffId: sl.s, kind,
          start: hhmm(startM + shift), end: hhmm(startM + shift + sl.du),
          sys: Math.round(b.sys + (r() - 0.5) * 18), dia: Math.round(b.dia + (r() - 0.5) * 10),
          pulse: Math.round(b.pulse + (r() - 0.5) * 12), temp: round1(b.temp + (r() - 0.5) * 0.6),
          spo2: Math.min(100, Math.round(b.spo2 + (r() - 0.4) * 3)),
          weight: round1(b.weight + (r() - 0.5) * 1.4),
          appetite: ok(), urine: ok(), stool: ok(), sleep: ok(),
          hygiene: r() < 0.3 ? ['清拭'] : [],
          tasks: taskSet,
          soap: `S）${pick(S_POOL)}\nO）${pick(O_POOL)}`,
          ap: 'A/P）援助継続',
          note: '',
          handover: '',
        });
      }
    }
  }
  records.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  // 利用者ごとに最新の記録へ申し送りを入れる
  patients.forEach((p, i) => {
    const mine = records.filter((x) => x.patientId === p.id);
    if (mine.length) mine[mine.length - 1].handover = HANDOVER[i % HANDOVER.length];
  });

  const plansDoc = {};
  plansDoc.p1 = {
    created: addDays(T, -18), goal: '心不全の増悪なく、自宅での生活を続けられる。',
    problems: [{ date: addDays(T, -18), text: '#1 心不全増悪のリスク\n体重・浮腫・呼吸状態の観察、内服セット', eval: '体重の変動は±1kg以内で経過' }],
    supplies: '無', procedures: [], roles: ['看護師'], memo: '', author1: '高橋', role1: '看護師', author2: '', role2: '', office: '', manager: '',
  };
  plansDoc.p2 = {
    created: addDays(T, -40), goal: '褥瘡をつくらず、排便のリズムが整う。',
    problems: [
      { date: addDays(T, -40), text: '#1 褥瘡発生のリスク\n体位変換の助言、皮膚観察、陰部洗浄', eval: '仙骨部の発赤は消退と再発をくり返す' },
      { date: addDays(T, -40), text: '#2 便秘\n排便状況の確認、必要時摘便', eval: '3日に1回の排便で経過' },
    ],
    supplies: '有', procedures: [{ what: '仙骨部の保護', item: '皮膚保護剤（10cm角）', qty: '月10枚' }], roles: ['看護師', '理学療法士'],
    memo: '', author1: '伊藤', role1: '看護師', author2: '', role2: '', office: '', manager: '',
  };

  const summaries = {
    p1: { live: '集合住宅', floor: '1階', elevator: '無', present: '心不全の増悪で入院し、利尿薬の調整後に退院。', symptoms: ['倦怠感'], adlEat: '自立', adlMove: '見守り', excretion: ['自立'], sleep: '良好', med: '薬剤管理支援が必要', smoke: 'なし', drink: '機会飲酒', writer: 'みどり総合病院 3階東病棟', writeDate: addDays(T, -170) },
  };

  return {
    version: 1,
    seededOn: T,
    settings: { office: 'ひなた訪問看護ステーション', startHour: 8, endHour: 18, visibleCount: 3, noticeDays: 30 },
    staff, patients, plans, records, plansDoc, summaries,
    billingFixed: {},
  };
}

// ---------- 読み書き ----------
let state = null;
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { state = JSON.parse(raw); if (state && state.version === 1) return state; }
  } catch (e) { /* 読めないときは初期データ */ }
  state = seed();
  save();
  return state;
}
export function db() { return state || load(); }
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境でも画面は動かす */ }
}
export function reset() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  state = seed();
  save();
}
export function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'sakura'; } catch (e) { return 'sakura'; } }
export function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* noop */ } }

// ---------- よく使う参照 ----------
export const staffById = (id) => db().staff.find((s) => s.id === id);
export const patientById = (id) => db().patients.find((p) => p.id === id);
export const kindOfStaff = (id) => (staffById(id)?.role === 'リハビリ職' ? 'リハビリ' : '看護');
export const recordsOf = (pid) => db().records.filter((r) => r.patientId === pid).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

// 予定に対応する実績（同じ日・同じ利用者・同じ職員の記録）
export const actualOf = (v) => db().records.find((r) => r.patientId === v.patientId && r.date === v.date && r.staffId === v.staffId);
export const isDone = (v) => !!actualOf(v);

export function orderNotice(p) {
  if (!p.orderEnd) return null;
  const left = diffDays(todayStr(), p.orderEnd);
  if (left < 0) return { level: 'over', text: `⚠ 指示書 期限切れ（${md(p.orderEnd)}まで）` };
  if (left <= db().settings.noticeDays) return { level: 'soon', text: `△ 指示書 あと${left}日（${md(p.orderEnd)}まで）` };
  return null;
}
export function nextPlan(pid) {
  const T = todayStr();
  return db().plans
    .filter((v) => v.patientId === pid && v.date >= T && !isDone(v))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
}
