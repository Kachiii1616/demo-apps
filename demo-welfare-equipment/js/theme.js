// 着せ替え（テーマ）の切替。選んだテーマは localStorage に覚えておく。
// 最初の適用は index.html の head 内で済ませてある（標準が一瞬見えないように）。
const KEY = 'showcase-welfare:theme';
const THEMES = ['', 'mint', 'simple'];
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Zen+Maru+Gothic:wght@400;500;700&family=Josefin+Sans:wght@300;400&family=Zen+Kaku+Gothic+New:wght@300;400;500&display=swap';
const root = document.documentElement;
const select = document.getElementById('themeSelect');

function apply(t) {
  if (t) root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  // 「シンプル」以外に切り替えたとき、まだ Web フォントを読んでいなければ読み込む
  if (t !== 'simple' && !document.getElementById('webfonts')) {
    const l = document.createElement('link');
    l.id = 'webfonts'; l.rel = 'stylesheet'; l.href = FONT_URL;
    document.head.appendChild(l);
  }
}

const current = root.getAttribute('data-theme') || '';
select.value = THEMES.includes(current) ? current : '';

select.addEventListener('change', () => {
  const t = THEMES.includes(select.value) ? select.value : '';
  apply(t);
  try {
    if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY);
  } catch { /* 保存できない環境でも切替だけはする */ }
  // 印刷プレビューは書体で高さが変わるので、A4 に収め直すため描き直す
  if (location.hash.startsWith('#/print')) window.dispatchEvent(new HashChangeEvent('hashchange'));
  updateNo();
});

// 右上の丸い飾りに「いま何番目の画面か / 4」を出す
const ORDER = ['users', 'new', 'products', 'monthly'];
const no = document.getElementById('decoNo');
function updateNo() {
  const top = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'users';
  const i = ORDER.indexOf(top === 'print' ? 'users' : top);
  no.textContent = String(i < 0 ? 1 : i + 1);
}
window.addEventListener('hashchange', updateNo);
updateNo();
