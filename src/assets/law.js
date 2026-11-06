// 法令ページ：目次ドロワー、条へ移動、文字サイズ、条リンクのコピー、検索語ハイライト
import { siteRoot, toast } from './common.js';

const root = document.documentElement;
const toc = document.getElementById('toc');
const body = document.querySelector('.law-body');

// ---- 目次ドロワー（スマホ） ----
const backdrop = document.createElement('div');
backdrop.className = 'toc-backdrop';
document.body.appendChild(backdrop);
const openBtn = document.querySelector('.toc-open');
function setToc(open) {
  toc.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  openBtn?.setAttribute('aria-expanded', String(open));
  if (open) toc.querySelector('input, a')?.focus({ preventScroll: true });
}
openBtn?.addEventListener('click', () => setToc(true));
toc.querySelector('.toc-close')?.addEventListener('click', () => setToc(false));
backdrop.addEventListener('click', () => setToc(false));
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && toc.classList.contains('open')) setToc(false); });
toc.addEventListener('click', ev => { if (ev.target.closest('a[href^="#"]')) setToc(false); });

// ---- 条へ移動 ----
const jump = toc.querySelector('.jump');
jump?.addEventListener('submit', ev => {
  ev.preventDefault();
  const input = jump.querySelector('input');
  const help = jump.querySelector('small');
  const v = input.value.trim()
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[のノ‐－ー―の_.]/g, '-');
  if (!/^\d+(-\d+)*$/.test(v)) { help.textContent = '数字で入力してください（例：12-2）'; help.classList.add('error'); return; }
  const id = 'a' + v;
  const target = document.getElementById(id);
  help.classList.remove('error');
  help.textContent = '「12-2」で第十二条の二';
  if (target) {
    setToc(false);
    history.pushState(null, '', '#' + id);
    target.scrollIntoView({ block: 'start' });
    flash(target);
  } else if (body.classList.contains('suppl')) {
    location.href = jump.dataset.base + '#' + id;
  } else {
    help.textContent = 'その条は見つかりませんでした';
    help.classList.add('error');
  }
});

function flash(el) {
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 2000);
}

// ---- 文字サイズ ----
const sizeButtons = document.querySelectorAll('.font-size button');
function syncSize() {
  const cur = root.dataset.fontSize || 'm';
  sizeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === cur)));
}
sizeButtons.forEach(b => b.addEventListener('click', () => {
  if (b.dataset.size === 'm') delete root.dataset.fontSize; else root.dataset.fontSize = b.dataset.size;
  try { localStorage.setItem('fontSize', b.dataset.size === 'm' ? '' : b.dataset.size); } catch (_) { /* ignore */ }
  syncSize();
}));
syncSize();

// ---- 条リンクのコピー（大きな法令でも固まらないよう分割して追加） ----
const heads = Array.from(body.querySelectorAll('h2[id], h3[id], h4[id], h5[id], h6[id]'));
let hi = 0;
function addAnchors(deadline) {
  while (hi < heads.length && (!deadline || deadline.timeRemaining() > 2)) {
    const h = heads[hi++];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'anchor-btn';
    btn.setAttribute('aria-label', `${h.textContent}へのリンクをコピー`);
    btn.textContent = '¶';
    h.appendChild(btn);
  }
  if (hi < heads.length) schedule();
}
const schedule = () => ('requestIdleCallback' in window ? requestIdleCallback(addAnchors, { timeout: 500 }) : setTimeout(addAnchors, 30));
schedule();
body.addEventListener('click', async ev => {
  const btn = ev.target.closest('.anchor-btn');
  if (!btn) return;
  const h = btn.parentElement;
  const url = new URL(location.href);
  url.search = '';
  url.hash = h.id;
  history.replaceState(null, '', '#' + h.id);
  try { await navigator.clipboard.writeText(url.href); toast('条へのリンクをコピーしました'); }
  catch (_) { toast('アドレスバーのURLをご利用ください'); }
});

// ---- 目次の現在位置 ----
const tocLinks = new Map(Array.from(toc.querySelectorAll('.toc-list a')).map(a => [a.getAttribute('href').slice(1), a]));
if (tocLinks.size && 'IntersectionObserver' in window) {
  let active;
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const a = tocLinks.get(en.target.id);
      if (!a || a === active) continue;
      active?.classList.remove('active');
      a.classList.add('active');
      active = a;
      if (!toc.classList.contains('open')) {
        const r = a.getBoundingClientRect(), tr = toc.getBoundingClientRect();
        if (r.top < tr.top || r.bottom > tr.bottom) toc.scrollTop += r.top - tr.top - tr.height / 3;
      }
    }
  }, { rootMargin: '-15% 0px -75% 0px' });
  for (const id of tocLinks.keys()) { const el = document.getElementById(id); if (el) io.observe(el); }
}

// ---- 検索語ハイライト（検索結果から来た場合） ----
const params = new URLSearchParams(location.search);
const hlTerms = [...new Set(params.getAll('highlight')
  .flatMap(v => v.replace(/["“”]/g, ' ').split(/[\s\u3000]+/))
  .filter(t => t && !/^[\u3041-\u3096ー]{1,2}$/.test(t)))];
if (hlTerms.length) {
  // PagefindHighlight は URL の highlight パラメータを語ごとに読むので、分かち書きした語に置き換える
  const p2 = new URLSearchParams();
  hlTerms.forEach(t => p2.append('highlight', t));
  history.replaceState(null, '', `${location.pathname}?${p2}${location.hash}`);
  import(new URL('pagefind/pagefind-highlight.js', siteRoot()).href).then(() => {
    // eslint-disable-next-line no-undef
    new PagefindHighlight({ highlightParam: 'highlight', addStyles: false, markOptions: { className: 'hl', exclude: ['[data-pagefind-ignore]', '[data-pagefind-ignore] *', '.anchor-btn'] } });
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) { target.scrollIntoView({ block: 'start' }); flash(target); }
  }).catch(() => { /* ハイライトは任意機能 */ });
} else if (location.hash) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) flash(target);
}
