/* ============================================================
   árbol — app core
   本体(index.html)と改善スタジオ(studio/)の共有部分。
   いつもの時間割・カテゴリ・保存データの形はここが唯一の出どころ。
   予定を変えるときはこのファイルの timeline() だけ直せばよい。
   ============================================================ */

/* ===== timezone: GT=UTC-6 (DSTなし), JP=UTC+9 → 差は常に +15h ===== */
const DIFF = 15 * 60;
const pad = n => String(n).padStart(2, '0');
const m2hm = m => { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
const gt2jp = m => m + DIFF;
const jp2gt = m => m - DIFF;
function nowParts(off) {
  const d = new Date();
  const u = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(u + off * 3600000);
}
const WK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WKJ = ['日', '月', '火', '水', '木', '金', '土'];

/* ===== date helpers（すべて現地=GT基準） ===== */
function todayStr() { const g = nowParts(-6); return g.getFullYear() + '-' + pad(g.getMonth() + 1) + '-' + pad(g.getDate()); }
function dow(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function dayType(s) { const w = dow(s); if (w === 0 || w === 6) return 'W'; if (w === 2) return 'B'; return 'A'; }
function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n);
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}
function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
}
const ROUTINE_LABEL = { A: '🇪🇸授業', B: '📚自習', W: '🎉遊び' };
const DAYTYPE_NAME = { A: '平日A（会話の日）', B: '火・自習厚め', W: '週末' };

/* ===== categories ===== */
const CAT = {
  fix:   { e: '🇪🇸', n: '授業／絶対', bar: '#159f76' },
  apo:   { e: '🤝', n: 'アポ',        bar: '#c9971c' },
  work:  { e: '💼', n: '日本仕事',    bar: '#3b4fc0' },
  study: { e: '📚', n: '勉強・自習',  bar: '#2f7fc0' },
  talk:  { e: '🗣️', n: '会話',        bar: '#c0417a' },
  play:  { e: '🎉', n: '遊び',        bar: '#d0504d' },
  ai:    { e: '🤖', n: 'AI作業',      bar: '#6a4fd0' },
  film:  { e: '🎬', n: '撮影編集',    bar: '#c05a2e' },
  sns:   { e: '📣', n: '発信',        bar: '#d07a1c' },
  train: { e: '💪', n: 'トレ',        bar: '#5a9a2a' },
  meal:  { e: '🍴', n: 'ごはん',      bar: '#8a6a42' },
  free:  { e: '🆓', n: 'フリー',      bar: '#6b7280' },
  self:  { e: '🪞', n: '内省',        bar: '#5a7a9a' },
};
const catOf = k => CAT[k] || CAT.free;

/* ===== いつもの時間割（GTの分） ===== */
function timeline(type) {
  const sch  = { g: 9 * 60,  e: 13 * 60, t: '🇪🇸 Clase de español ／ スペイン語授業', fix: true, cat: 'fix' };
  const work = { g: 20 * 60, e: 22 * 60, t: '💼 Trabajo en vivo de Japón + citas ／ 日本のリアルタイム仕事＋アポ', fix: true, cat: 'fix' };
  if (type === 'A') return [
    { g: 6 * 60,      t: '📲 SNS投稿＋日本の連絡確認＋撮影 ／ Publicar + revisar + grabar', cat: 'sns' },
    { g: 6 * 60 + 30, t: '✍️ 1日の設計＋余白(5分) ／ Diseño del día', cat: 'self' },
    { g: 7 * 60,      t: '💪 筋トレ・散歩1h ／ Gym / caminata', cat: 'train' },
    { g: 8 * 60,      t: '🍳 朝食・身支度・移動 ／ Desayuno y traslado', cat: 'meal' },
    { ...sch },
    { g: 13 * 60,      t: '🍴 ランチ＋昼リール ／ Almuerzo + reel', cat: 'meal' },
    { g: 14 * 60,      t: '🗣️ スペイン語会話＋撮影 ／ Conversación + grabar', e: 15 * 60 + 30, cat: 'talk' },
    { g: 15 * 60 + 30, t: '🆓 フリー(余白・移動) ／ Libre', e: 16 * 60, cat: 'free' },
    { g: 16 * 60,      t: '☕ カフェで自習 ／ Autoestudio en café', e: 17 * 60, cat: 'study' },
    { g: 17 * 60,      t: '🎬 編集＋西語字幕＋マーケ ／ Edición + subtítulos', e: 18 * 60 + 30, cat: 'film' },
    { g: 18 * 60 + 30, t: '🍳 自炊の晩ごはん(vlog) ／ Cena casera', cat: 'meal' },
    { g: 19 * 60,      t: '📚 夜の自習 ／ Autoestudio nocturno', e: 19 * 60 + 30, cat: 'study' },
    { g: 19 * 60 + 30, t: '🆓 フリー ／ Libre', e: 20 * 60, cat: 'free' },
    { ...work },
    { g: 22 * 60,      t: '🌙 夜リール＋翌朝分を予約 ／ Reel nocturno', cat: 'sns' },
    { g: 22 * 60 + 30, t: '🪞 夜の振り返り(5分) ／ Reflexión', cat: 'self' },
    { g: 23 * 60,      t: '😴 就寝(0:00–6:00, 6h) ／ A dormir', cat: 'self' },
  ];
  if (type === 'B') return [
    { g: 6 * 60,      t: '📲 SNS投稿＋日本の連絡確認＋撮影 ／ Publicar + revisar', cat: 'sns' },
    { g: 6 * 60 + 30, t: '✍️ 1日の設計＋余白(5分) ／ Diseño del día', cat: 'self' },
    { g: 7 * 60,      t: '💪 筋トレ・散歩1h ／ Gym / caminata', cat: 'train' },
    { g: 8 * 60,      t: '🍳 朝食・身支度・移動 ／ Desayuno y traslado', cat: 'meal' },
    { ...sch },
    { g: 13 * 60, t: '🍴 ランチ＋昼リール ／ Almuerzo + reel', cat: 'meal' },
    { g: 14 * 60, t: '☕ カフェ自習(2h) ／ Autoestudio en café', e: 16 * 60, cat: 'study' },
    { g: 16 * 60, t: '🎬 編集・マーケ ／ Edición + marketing', e: 18 * 60, cat: 'film' },
    { g: 18 * 60, t: '🍳 自炊の晩ごはん(vlog) ／ Cena casera', cat: 'meal' },
    { g: 19 * 60, t: '📚 夜の自習 ／ Autoestudio nocturno', e: 19 * 60 + 30, cat: 'study' },
    { ...work },
    { g: 22 * 60,      t: '🌙 夜リール＋翌朝分を予約 ／ Reel nocturno', cat: 'sns' },
    { g: 22 * 60 + 30, t: '🪞 夜の振り返り(5分) ／ Reflexión', cat: 'self' },
    { g: 23 * 60,      t: '😴 就寝(0:00–6:00, 6h) ／ A dormir', cat: 'self' },
  ];
  return [
    { g: 7 * 60,  t: '🌅 ゆっくり起床・撮りだめ ／ Despertar tranquilo', cat: 'sns' },
    { g: 10 * 60, t: '🎉 遊びに行く(観光・サルサ・友達) ／ Salir a divertirse', e: 14 * 60, cat: 'play' },
    { g: 14 * 60, t: '🆓 フリー(休憩・何でも) ／ Libre', e: 16 * 60, cat: 'free' },
    { g: 16 * 60, t: '🤖 AI作業(軽め・週の振り返り) ／ Trabajo con IA', e: 17 * 60, cat: 'ai' },
    { g: 18 * 60, t: '🍽️ 晩ごはん ／ Cena', cat: 'meal' },
    { g: 20 * 60, t: '🎬 週のまとめ編集を軽めに ／ Edición ligera', cat: 'film' },
    { g: 22 * 60, t: '😴 しっかり休んで月曜リセット ／ Descansar', cat: 'self' },
  ];
}

/* アポ枠: JP 11:00..13:30 の30分×6 = GT 20:00..22:30
   jp2gt(11:00) は -240 と負になる（前日にまたぐ計算のため）。
   表示は m2hm が丸めるので見た目は正しかったが、生の値で並べ替えると
   アポが 6:00 より前＝1日の先頭に出てしまう。0..1439 に正規化して持つ。 */
const APO = [];
for (let i = 0; i < 6; i++) {
  const jp = 11 * 60 + i * 30;
  const g = jp2gt(jp);
  APO.push({ i, jp, gt: ((g % 1440) + 1440) % 1440 });
}

/* ============================================================
   storage
   DB = { appts:{ds:{slot:{name,memo}}},
          events:{ds:[{id,title,gt,dur,cat}]},
          ranges:[{id,start,end,title,cat}],
          done:{ds:{key:1}},
          prefs:{theme,accent,showRoutine,legendOpen} }
   キーと形は旧版のまま。増えたのは done と prefs だけなので前のデータもそのまま開く。
   ============================================================ */
const KEY = 'takuha_sched_v1';
let DB;
try { DB = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { DB = {}; }

function normalizeDB() {
  if (!DB || typeof DB !== 'object') DB = {};
  if (!DB.appts  || typeof DB.appts  !== 'object') DB.appts = {};
  if (!DB.events || typeof DB.events !== 'object') DB.events = {};
  if (!Array.isArray(DB.ranges)) DB.ranges = [];
  if (!DB.done   || typeof DB.done   !== 'object') DB.done = {};
  if (!DB.prefs  || typeof DB.prefs  !== 'object') DB.prefs = {};
  const p = DB.prefs;
  if (p.showRoutine === undefined) {
    const old = localStorage.getItem('tree_showRoutine');   /* 旧キーから1回だけ引き継ぐ */
    p.showRoutine = old === null ? true : old === '1';
  }
  if (p.legendOpen === undefined) {
    const old = localStorage.getItem('tree_legendOpen');
    p.legendOpen = old === null ? false : old === '1';
  }
  if (p.theme === undefined) p.theme = 'auto';
  if (p.accent === undefined) p.accent = 'tree';
}
normalizeDB();

function saveDB() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; }
  catch (_) { return false; }
}
function reloadDB() {
  try { DB = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { DB = {}; }
  normalizeDB();
}
const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function rangesFor(ds) { return DB.ranges.filter(r => ds >= r.start && ds <= r.end); }

/* ============================================================
   appearance — テーマ(自動/明/暗) × アクセント色
   ============================================================ */
const ACCENTS = {
  tree:   { n: '🌳 ツリー',  dark: { b: '#22b085', i: '#5ee0b4', d: '#0d4f42', o: '#04241c' }, light: { b: '#0f8f6c', i: '#0a7053', d: '#0b6b50', o: '#ffffff' } },
  ocean:  { n: '🌊 オーシャン', dark: { b: '#2e9fd8', i: '#6fcdf2', d: '#0d4159', o: '#04222e' }, light: { b: '#0e7ba8', i: '#0a6187', d: '#0b5877', o: '#ffffff' } },
  violet: { n: '🔮 バイオレット', dark: { b: '#8b6ff0', i: '#bda9ff', d: '#2f2260', o: '#120a2e' }, light: { b: '#6a4fd0', i: '#5540ab', d: '#4a3897', o: '#ffffff' } },
  sunset: { n: '🌅 サンセット', dark: { b: '#e08a2e', i: '#f5bd72', d: '#5a3410', o: '#2a1704' }, light: { b: '#b96a12', i: '#94540c', d: '#8a4f0b', o: '#ffffff' } },
  rose:   { n: '🌸 ローズ',  dark: { b: '#e05c85', i: '#f79bb6', d: '#5c1f33', o: '#2e0a17' }, light: { b: '#c33a63', i: '#9d2c4e', d: '#932a4a', o: '#ffffff' } },
  slate:  { n: '🪨 スレート', dark: { b: '#7f8ca8', i: '#b4c0d8', d: '#2b3348', o: '#0b0f18' }, light: { b: '#4a5670', i: '#39435a', d: '#333c52', o: '#ffffff' } },
};
function resolvedTheme() {
  const t = DB.prefs.theme || 'auto';
  if (t !== 'auto') return t;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyAppearance() {
  const root = document.documentElement;
  const t = DB.prefs.theme || 'auto';
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const a = ACCENTS[DB.prefs.accent] || ACCENTS.tree;
  const c = a[resolvedTheme()];
  root.style.setProperty('--brand', c.b);
  root.style.setProperty('--brand-ink', c.i);
  root.style.setProperty('--brand-deep', c.d);
  root.style.setProperty('--brand-on', c.o);
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyAppearance);
