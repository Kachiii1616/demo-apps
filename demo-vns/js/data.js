// 架空の初期データと localStorage 保存。すべて「開いた日」基準で生成する。
const KEY = 'showcase-vns:data:v1';

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => iso(new Date());
export function addDays(isoStr, n) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return iso(new Date(y, m - 1, d + n));
}
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

const STAFF = [
  { id: 's1', name: '山田 花子', role: '看護師' },
  { id: 's2', name: '佐藤 由紀', role: '看護師' },
  { id: 's3', name: '鈴木 恵', role: '看護師' },
  { id: 's4', name: '伊藤 直子', role: '看護師' },
  { id: 's5', name: '高橋 健太', role: '理学療法士' },
  { id: 's6', name: '田中 さくら', role: '作業療法士' },
];

const DOCTORS = {
  d1: { clinic: 'あおば内科クリニック', name: '森 一郎' },
  d2: { clinic: 'みなと総合病院', name: '西村 健' },
  d3: { clinic: 'はなみずき整形外科', name: '川口 修' },
};

// ins: med=医療保険 / ltc=介護保険
const CLIENTS = [
  { id: 'c01', name: '中村 清', kana: 'ナカムラ キヨシ', sex: '男', birth: '1938-04-12', ins: 'ltc', level: '要介護3', dx: '慢性心不全', doc: 'd1', addr: 'みどり市さくら町1-2-3', phone: '03-0000-0101', main: 's1', slots: [[1, '10:00', 's1'], [4, '10:00', 's1']] },
  { id: 'c02', name: '小林 ハル', kana: 'コバヤシ ハル', sex: '女', birth: '1933-09-03', ins: 'med', level: '', burden: '1割', dx: '末期がん（在宅緩和ケア）', doc: 'd2', addr: 'みどり市かえで町2-4-1', phone: '03-0000-0102', main: 's2', slots: [[0, '09:30', 's2'], [2, '09:30', 's2'], [4, '09:30', 's2'], [6, '09:30', 's4']] },
  { id: 'c03', name: '加藤 弘', kana: 'カトウ ヒロシ', sex: '男', birth: '1941-01-28', ins: 'ltc', level: '要介護2', dx: '脳梗塞後遺症', doc: 'd3', addr: 'みどり市さくら町3-8-2', phone: '03-0000-0103', main: 's5', slots: [[1, '14:00', 's5'], [5, '14:00', 's5']] },
  { id: 'c04', name: '吉田 キヨ', kana: 'ヨシダ キヨ', sex: '女', birth: '1930-11-20', ins: 'ltc', level: '要介護5', dx: '褥瘡・廃用症候群', doc: 'd1', addr: 'みどり市ひのき町4-1-9', phone: '03-0000-0104', main: 's3', slots: [[0, '11:00', 's3'], [3, '11:00', 's3'], [5, '11:00', 's3']] },
  { id: 'c05', name: '山本 進', kana: 'ヤマモト ススム', sex: '男', birth: '1944-06-07', ins: 'med', level: '', burden: '3割', dx: 'ALS（筋萎縮性側索硬化症）', doc: 'd2', addr: 'みどり市かえで町5-3-3', phone: '03-0000-0105', main: 's4', slots: [[0, '13:30', 's4'], [2, '13:30', 's4'], [4, '13:30', 's5'], [5, '15:00', 's4']] },
  { id: 'c06', name: '松本 トシ', kana: 'マツモト トシ', sex: '女', birth: '1936-02-15', ins: 'ltc', level: '要介護1', dx: '2型糖尿病（インスリン自己注射）', doc: 'd1', addr: 'みどり市さくら町6-6-1', phone: '03-0000-0106', main: 's1', slots: [[2, '14:00', 's1'], [6, '10:30', 's1']] },
  { id: 'c07', name: '井上 和夫', kana: 'イノウエ カズオ', sex: '男', birth: '1939-08-30', ins: 'ltc', level: '要介護4', dx: 'パーキンソン病', doc: 'd3', addr: 'みどり市ひのき町7-2-5', phone: '03-0000-0107', main: 's6', slots: [[1, '11:00', 's6'], [3, '15:00', 's2'], [5, '10:00', 's6']] },
  { id: 'c08', name: '木下 フミ', kana: 'キノシタ フミ', sex: '女', birth: '1932-12-01', ins: 'med', level: '', burden: '1割', dx: '在宅酸素療法（COPD）', doc: 'd2', addr: 'みどり市かえで町8-9-2', phone: '03-0000-0108', main: 's3', slots: [[1, '15:30', 's3'], [4, '15:30', 's3']] },
  { id: 'c09', name: '林 勇', kana: 'ハヤシ イサム', sex: '男', birth: '1947-03-18', ins: 'ltc', level: '要介護2', dx: '大腿骨頸部骨折術後', doc: 'd3', addr: 'みどり市さくら町9-1-4', phone: '03-0000-0109', main: 's5', slots: [[2, '10:30', 's5'], [6, '14:00', 's6']] },
  { id: 'c10', name: '清水 ミツ', kana: 'シミズ ミツ', sex: '女', birth: '1935-07-22', ins: 'ltc', level: '要介護3', dx: '認知症・高血圧', doc: 'd1', addr: 'みどり市ひのき町10-5-7', phone: '03-0000-0110', main: 's2', slots: [[3, '13:00', 's2'], [6, '16:00', 's4']] },
];

const OBS_TEXT = [
  '表情穏やか。会話はいつも通り。食事は全量摂取とのこと。',
  '日中うとうとされることが多いとご家族より。発熱なし。',
  '下肢のむくみ軽度。水分摂取は1日1,000ml程度。',
  '夜間よく眠れたとのこと。排便あり。',
];

function hashNum(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
}

function sampleRecord(v, staffRole, final) {
  const h = hashNum(v.id);
  const rehab = staffRole !== '看護師';
  return {
    vitals: {
      temp: (36.2 + (h % 7) / 10).toFixed(1),
      sys: String(118 + (h % 25)),
      dia: String(70 + (h % 12)),
      pulse: String(66 + (h % 18)),
      resp: String(14 + (h % 5)),
      spo2: String(95 + (h % 4)),
    },
    obs: rehab ? ['歩行状態', '疼痛'] : ['表情・意識', '食事・水分', h % 2 ? '皮膚状態' : '排泄'],
    care: rehab ? ['関節可動域訓練', '歩行訓練'] : (h % 3 === 0 ? ['服薬確認', '褥瘡処置', '療養指導'] : ['服薬確認', '清拭・保清', '療養指導']),
    s: rehab ? '「最近は廊下まで歩けるようになった」' : '「変わりないです。よく眠れました」',
    o: OBS_TEXT[h % OBS_TEXT.length],
    a: rehab ? '下肢筋力は維持。転倒への不安が少し残る。' : '状態安定。現在のケアを継続。',
    p: final ? (rehab ? '次回も歩行訓練を継続。屋外歩行を検討。' : '次回訪問時も同様に観察を継続する。') : '',
  };
}

export function buildSeed() {
  const today = todayIso();
  const visits = [];
  let draftCount = 0;
  let morningCount = 0;
  // 今日の前後6日ずつ（今日を含む週がかならず埋まる）
  for (let off = -6; off <= 6; off++) {
    const date = addDays(today, off);
    const [y, m, d] = date.split('-').map(Number);
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // 月=0 … 日=6
    for (const c of CLIENTS) {
      for (const [slotDow, start, staffId] of c.slots) {
        if (slotDow !== dow) continue;
        const staff = STAFF.find((s) => s.id === staffId);
        const [hh, mm] = start.split(':').map(Number);
        const len = staff.role === '看護師' ? 60 : 40;
        const endMin = hh * 60 + mm + len;
        const v = {
          id: `v${date.replace(/-/g, '')}${c.id}${start.replace(':', '')}`,
          clientId: c.id, staffId, date, start, end: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`,
          kind: staff.role === '看護師' ? '看護' : staff.role === '理学療法士' ? 'リハ(PT)' : 'リハ(OT)',
          status: 'planned', record: null, updatedAt: null,
        };
        if (off < 0) {
          // 過去分はほぼ確定、2件だけ下書きのまま
          const draft = off >= -4 && draftCount < 2 && hashNum(v.id) % 5 === 0;
          if (draft) draftCount++;
          v.status = draft ? 'draft' : 'done';
          v.record = sampleRecord(v, staff.role, !draft);
        } else if (off === 0 && start < '12:00') {
          v.status = morningCount++ % 2 === 0 ? 'done' : 'draft';
          v.record = sampleRecord(v, staff.role, v.status === 'done');
        }
        visits.push(v);
      }
    }
  }
  // 過去の下書きが1件もなければ1件作る
  if (!visits.some((v) => v.date < today && v.status === 'draft')) {
    const v = visits.find((x) => x.date === addDays(today, -1)) || visits.find((x) => x.date < today);
    if (v) { v.status = 'draft'; v.record.p = ''; }
  }

  // 指示書: 期限切れ1件・14日以内2件・他は余裕あり
  const ends = { c03: -3, c02: 5, c07: 12 };
  const orders = CLIENTS.map((c, i) => {
    const endOff = ends[c.id] ?? 30 + i * 11;
    const end = addDays(today, endOff);
    const months = c.ins === 'med' ? 1 : 6;
    const start = addDays(end, -(months === 1 ? 29 : 182));
    return {
      id: `o${c.id}`, clientId: c.id, kind: '訪問看護指示書', doc: c.doc, start, end,
      note: c.ins === 'med' ? '特別訪問看護指示期間あり' : '',
    };
  });

  return {
    station: { name: 'ひだまり訪問看護ステーション' },
    me: 's1',
    staff: STAFF,
    doctors: DOCTORS,
    clients: CLIENTS.map(({ slots, ...c }) => ({ ...c, status: '利用中', since: addDays(today, -200 - hashNum(c.id) % 300) })),
    visits,
    orders,
    dismissed: [],
    seededOn: today,
  };
}

let state = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { state = JSON.parse(raw); return state; }
  } catch (e) { /* 読めなければ初期データ */ }
  state = buildSeed();
  save();
  return state;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境でも表示は続ける */ }
}
export function reset() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  state = buildSeed();
  save();
  return state;
}
export const db = () => state;
