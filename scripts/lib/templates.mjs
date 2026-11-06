// HTML テンプレート群（相対パスで構成し、GitHub Pages のサブパスでも動くようにする）
import { escapeHtml as e } from './render.mjs';

export const SITE_NAME = '法令図書館';
export const SITE_TAGLINE = '日本の法令 全文検索';

const ICON_SVG = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5c3.6-1.6 7.3-1.6 11 0v18c-3.7-1.6-7.4-1.6-11 0z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M27 7.5c-3.6-1.6-7.3-1.6-11 0v18c3.7-1.6 7.4-1.6 11 0z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 11.5c2-.6 4-.6 5.5 0M8 15c2-.6 4-.6 5.5 0M18.5 11.5c1.5-.6 3.5-.6 5.5 0M18.5 15c1.5-.6 3.5-.6 5.5 0" stroke="currentColor" stroke-width="1" fill="none" opacity=".7"/></svg>`;

const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2f4a3a"/><path d="M6 9c3.3-1.4 6.7-1.4 10 0v15c-3.3-1.4-6.7-1.4-10 0zM26 9c-3.3-1.4-6.7-1.4-10 0v15c3.3-1.4 6.7-1.4 10 0z" fill="none" stroke="#d9bf7f" stroke-width="1.8" stroke-linejoin="round"/></svg>')}`;

/**
 * 共通レイアウト
 * @param {object} p { title, description, root, body, bodyClass, scripts:[], q }
 */
export function layout(p) {
  const root = p.root;
  const fullTitle = p.title ? `${p.title}｜${SITE_NAME}` : `${SITE_NAME}｜${SITE_TAGLINE}`;
  const scripts = (p.scripts || []).map(s => `<script type="module" src="${root}assets/${s}"></script>`).join('\n');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(fullTitle)}</title>
<meta name="description" content="${e(p.description || '日本の憲法・法律を全文検索できる閲覧室。政令・省令も法令名から探せます。')}">
<meta name="site-root" content="${root}">
<meta name="theme-color" content="#24382c">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&display=swap">
<link rel="stylesheet" href="${root}assets/style.css">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;var f=localStorage.getItem('fontSize');if(f)document.documentElement.dataset.fontSize=f;}catch(_){}</script>
<script src="${root}config.js"></script>
<script src="${root}assets/analytics.js" defer></script>
</head>
<body class="${p.bodyClass || ''}">
<a class="skip-link" href="#content">本文へスキップ</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="${root}">${ICON_SVG}<span class="brand-text"><span class="brand-name">${SITE_NAME}</span><span class="brand-sub">${SITE_TAGLINE}</span></span></a>
    ${p.hideHeaderSearch ? '' : `<form class="header-search" action="${root}search.html" role="search">
      <label class="visually-hidden" for="hq">法令を検索</label>
      <input id="hq" name="q" type="search" placeholder="語句・法令名で検索" value="${e(p.q || '')}" autocomplete="off" enterkeyhint="search">
      <button type="submit" aria-label="検索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    </form>`}
    <nav class="header-nav" aria-label="サイト">
      <a href="${root}browse/">分類</a>
      <a href="${root}about.html">案内</a>
      <button class="theme-toggle" type="button" aria-label="表示テーマを切り替え" title="表示テーマを切り替え"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button>
    </nav>
  </div>
</header>
<div id="content" class="${p.containerClass || 'container'}">
${p.body}
</div>
<footer class="site-footer">
  <div class="footer-inner">
    <p class="footer-brand">${SITE_NAME}</p>
    <p>法令データの出典：<a href="https://laws.e-gov.go.jp/" rel="noopener">e-Gov法令検索</a>（<a href="https://www.digital.go.jp/resources/open_data/public_data_license_v1.0" rel="noopener">公共データ利用規約 第1.0版</a>）。Markdown 変換：<a href="https://github.com/Kohei-Wada/houritsu" rel="noopener">houritsu</a>（CC BY 4.0）。</p>
    <p>本サイトの内容は参考情報です。正確な法令の内容は、必ずe-Gov法令検索や官報でご確認ください。</p>
    <p class="footer-copy"><small>&copy; 2026 c1t0d0s0</small></p>
  </div>
</footer>
<script type="module" src="${root}assets/common.js"></script>
${scripts}
</body>
</html>
`;
}

/** YAML の日付（Date または文字列）を「2026年6月24日」形式に */
export function fmtDate(v) {
  if (v == null || v === '') return '';
  if (v === 'undetermined') return '未定';
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

const KIND_LABEL = { C: '憲法', A: '法律', CO: '政令', IO: '勅令', MO: '府省令', R: '規則' };
export { KIND_LABEL };

/** 法令ページ（本則 or 附則） */
export function lawPage(p) {
  const { law, root, part, html, toc, supplCount, category } = p;
  const isSuppl = part === 'suppl';
  const kind = law.kind === 'C' ? '憲法' : '法律';
  const base = `${root}law/${law.id}/`;
  const amend = law.amendment && law.amendment.title
    ? `<div class="meta-row"><dt>最終改正</dt><dd>${e(law.amendment.law_num || '')}${law.amendment.title ? `「${e(law.amendment.title)}」` : ''}${law.amendment.enforced ? `<span class="meta-date">（${e(fmtDate(law.amendment.enforced))}施行）</span>` : ''}</dd></div>`
    : '';
  const tabs = supplCount
    ? `<nav class="part-tabs" aria-label="本則と附則">
        <a href="${base}" ${!isSuppl ? 'aria-current="page"' : ''}>本則</a>
        <a href="${base}fusoku.html" ${isSuppl ? 'aria-current="page"' : ''}>附則<span class="count">${supplCount}</span></a>
      </nav>` : '';
  const tocHtml = renderToc(toc, isSuppl);
  const body = `
<nav class="breadcrumb" aria-label="パンくずリスト"><a href="${root}">トップ</a><span aria-hidden="true">›</span><a href="${root}browse/${category.slug}.html">${e(category.name)}</a><span aria-hidden="true">›</span><span>${e(law.title)}</span></nav>
<div class="law-layout">
  <aside class="law-toc" id="toc" aria-label="目次" data-pagefind-ignore>
    <div class="toc-head"><span>目次</span><button class="toc-close" type="button" aria-label="目次を閉じる">×</button></div>
    <form class="jump" data-base="${base}" data-suppl="${supplCount ? 1 : 0}">
      <label for="jump-n">条へ移動</label>
      <div class="jump-row"><span>第</span><input id="jump-n" inputmode="numeric" pattern="[0-9]+(-[0-9]+)*" placeholder="9" aria-describedby="jump-help"><span>条</span><button type="submit">移動</button></div>
      <small id="jump-help">「12-2」で第十二条の二</small>
    </form>
    ${tocHtml}
  </aside>
  <main class="law-main" data-pagefind-body>
    <header class="law-header">
      <p class="call-number"><span>${e(kind)}</span><span>${e(category.name)}</span></p>
      <h1 class="law-title" data-pagefind-meta="title" data-pagefind-weight="10">${e(law.title)}${isSuppl ? '<span class="part-label">附則</span>' : ''}</h1>
      ${law.kana ? `<p class="law-kana" data-pagefind-weight="4">${e(law.kana)}</p>` : ''}
      <dl class="law-meta" data-pagefind-ignore>
        <div class="meta-row"><dt>法令番号</dt><dd>${e(law.law_num || '')}</dd></div>
        ${law.abbrev ? `<div class="meta-row"><dt>略称</dt><dd>${e(law.abbrev.split(',').join('、'))}</dd></div>` : ''}
        ${amend}
        <div class="meta-row"><dt>原文</dt><dd><a href="${e(law.source)}" target="_blank" rel="noopener">e-Gov法令検索で見る ↗</a></dd></div>
      </dl>
      <span hidden data-pagefind-meta="num:${e(law.law_num || '')}"></span>
      <span hidden data-pagefind-meta="cat:${e(category.name)}"></span>
      <span hidden data-pagefind-meta="part:${isSuppl ? '附則' : '本則'}"></span>
      <span hidden data-pagefind-filter="分類:${e(category.name)}"></span>
      <span hidden data-pagefind-filter="種別:${kind}"></span>
      <span hidden data-pagefind-filter="区分:${isSuppl ? '附則' : '本則'}"></span>
      ${law.priority ? '<span hidden data-pagefind-filter="主要:1"></span>' : ''}
      ${law.abbrev ? `<span hidden data-pagefind-weight="6">${e(law.abbrev)}</span>` : ''}
    </header>
    ${tabs}
    <div class="law-tools" data-pagefind-ignore>
      <button class="toc-open" type="button" aria-controls="toc">目次・条へ移動</button>
      <div class="font-size" role="group" aria-label="文字サイズ">
        <button type="button" data-size="s" aria-label="文字サイズ 小">小</button>
        <button type="button" data-size="m" aria-label="文字サイズ 中">中</button>
        <button type="button" data-size="l" aria-label="文字サイズ 大">大</button>
      </div>
    </div>
    <article class="law-body${isSuppl ? ' suppl' : ''}">
${html || '<p class="empty">本文はありません。</p>'}
    </article>
    ${tabs ? `<div class="part-foot">${tabs}</div>` : ''}
  </main>
</div>`;
  return layout({
    title: isSuppl ? `${law.title}（附則）` : law.title,
    description: `${law.title}（${law.law_num || ''}）の${isSuppl ? '附則' : '条文'}。`,
    root, body, bodyClass: 'page-law', containerClass: 'container wide',
    scripts: ['law.js'],
  });
}

function renderToc(toc, isSuppl) {
  const structural = toc.filter(t => !t.article);
  // 構造見出しが少なければ条も載せる（小さな法律向け）
  let items;
  if (isSuppl) items = toc.filter(t => t.level === 2);
  else if (structural.length >= 2) items = structural;
  else items = toc.filter(t => t.article).slice(0, 400);
  if (!items.length) return '<p class="toc-empty">見出しはありません。</p>';
  const minLevel = Math.min(...items.map(t => t.level));
  const lis = items.map(t => `<li class="lv${Math.min(t.level - minLevel, 4)}"><a href="#${t.id}">${e(t.text)}</a></li>`).join('');
  return `<ol class="toc-list">${lis}</ol>`;
}
