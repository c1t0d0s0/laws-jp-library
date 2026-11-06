#!/usr/bin/env node
// houritsu/laws の Markdown から静的サイト（site/）を生成する。
// 全文検索インデックスは、このあと `pagefind --site site` で作る。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter } from './lib/frontmatter.mjs';
import { renderBody, splitSupplementary, escapeHtml as e } from './lib/render.mjs';
import { layout, lawPage, KIND_LABEL, SITE_NAME, SITE_TAGLINE } from './lib/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(ROOT, process.env.HOURITSU_DIR || 'houritsu', 'laws');
const OUT = path.join(ROOT, 'site');
// LIMIT=刑法,民法 のように指定すると、その法令だけのページを作る（試作・確認用）
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

const TYPE_DIRS = {
  constitution: 'C', act: 'A', 'cabinet-order': 'CO', 'imperial-order': 'IO',
  'ministerial-ordinance': 'MO', rule: 'R',
};
const PAGE_KINDS = new Set(['C', 'A']);

// トップページに並べる主要法令（タイトル完全一致）
const MAJOR = [
  '日本国憲法', '民法', '刑法', '商法', '会社法', '民事訴訟法', '刑事訴訟法',
  '行政手続法', '行政事件訴訟法', '国家賠償法', '労働基準法', '労働契約法',
  '個人情報の保護に関する法律', '著作権法', '特許法', '借地借家法', '消費者契約法',
  '道路交通法', '地方自治法', '所得税法', '民事執行法', '破産法', '少年法', '児童福祉法',
];

// 検索結果で優先表示する法令（書架に並べるもの＋α）
const PRIORITY = new Set([...MAJOR,
  '刑法施行法', '民法施行法', '人事訴訟法', '家事事件手続法', '民事保全法', '非訟事件手続法', '行政不服審査法',
  '労働組合法', '労働安全衛生法', '最低賃金法', '雇用の分野における男女の均等な機会及び待遇の確保等に関する法律',
  '育児休業、介護休業等育児又は家族介護を行う労働者の福祉に関する法律', '特定商取引に関する法律', '割賦販売法',
  '私的独占の禁止及び公正取引の確保に関する法律', '不当景品類及び不当表示防止法', '不正競争防止法', '商標法', '意匠法', '実用新案法',
  '手形法', '小切手法', '保険法', '信託法', '金融商品取引法', '銀行法', '不動産登記法', '建物の区分所有等に関する法律',
  '戸籍法', '国籍法', '公職選挙法', '国会法', '内閣法', '国家公務員法', '地方公務員法', '裁判所法', '弁護士法',
  '法人税法', '消費税法', '相続税法', '国税通則法', '生活保護法', '健康保険法', '国民年金法', '厚生年金保険法',
  '道路運送車両法', '自動車の運転により人を死傷させる行為等の処罰に関する法律', '軽犯罪法', '刑事収容施設及び被収容者等の処遇に関する法律',
  '出入国管理及び難民認定法', '行政機関の保有する情報の公開に関する法律', '電気通信事業法', '電子消費者契約に関する民法の特例に関する法律',
  'ストーカー行為等の規制等に関する法律', '配偶者からの暴力の防止及び被害者の保護等に関する法律', '児童虐待の防止等に関する法律',
  '特定電気通信による情報の流通によって発生する権利侵害等への対処に関する法律', '建築基準法', '都市計画法', '宅地建物取引業法', '農地法',
]);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function write(rel, content) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name), b = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

function main() {
  const t0 = Date.now();
  if (!fs.existsSync(SRC)) {
    console.error(`法令データが見つかりません: ${SRC}\n  git clone https://github.com/Kohei-Wada/houritsu.git を実行してください。`);
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // ---- 1. 全法令のメタデータ ----
  const laws = [];
  for (const [dir, kind] of Object.entries(TYPE_DIRS)) {
    const d = path.join(SRC, dir);
    if (!fs.existsSync(d)) continue;
    for (const file of walk(d)) {
      const raw = fs.readFileSync(file, 'utf8');
      const { data, content } = parseFrontMatter(raw);
      const id = String(data.law_id || path.basename(file, '.md'));
      laws.push({
        id, kind, file,
        title: String(data.title || id),
        kana: data.title_kana ? String(data.title_kana) : '',
        abbrev: data.abbrev ? String(data.abbrev) : '',
        law_num: data.law_num ? String(data.law_num) : '',
        category: data.category ? String(data.category) : 'その他',
        amendment: data.amendment || null,
        source: data.source || `https://laws.e-gov.go.jp/law/${id}`,
        content: PAGE_KINDS.has(kind) ? content : null,
      });
    }
  }
  // 並び順: 種別 → かな
  const kindOrder = { C: 0, A: 1, CO: 2, IO: 3, MO: 4, R: 5 };
  laws.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.kana.localeCompare(b.kana, 'ja') || a.id.localeCompare(b.id));

  // 分類
  const catNames = [...new Set(laws.map(l => l.category))].sort((a, b) => a.localeCompare(b, 'ja'));
  const categories = catNames.map((name, i) => ({ name, slug: `c${String(i + 1).padStart(2, '0')}`, laws: [] }));
  const catByName = new Map(categories.map(c => [c.name, c]));
  for (const l of laws) catByName.get(l.category).laws.push(l);

  // ---- 2. 法令ページ（憲法・法律） ----
  let pages = 0, bytes = 0;
  for (const law of laws) {
    if (!law.content) continue;
    if (ONLY && !ONLY.has(law.title)) { law.hasPage = false; continue; }
    law.hasPage = true;
    law.priority = PRIORITY.has(law.title);
    const category = catByName.get(law.category);
    const root = '../../';
    const { main: mainMd, suppl } = splitSupplementary(law.content);
    const mainR = renderBody(mainMd);
    const html = lawPage({ law, root, part: 'main', html: mainR.html, toc: mainR.toc, supplCount: suppl.length, category });
    write(`law/${law.id}/index.html`, html); pages++; bytes += html.length;
    if (suppl.length) {
      const parts = suppl.map((s, k) => {
        const r = renderBody(s, { idPrefix: `f${k + 1}-` });
        return { html: `<section class="suppl-block">\n${r.html}\n</section>`, toc: r.toc };
      });
      const sh = lawPage({
        law, root, part: 'suppl', category, supplCount: suppl.length,
        html: parts.map(p => p.html).join('\n'), toc: parts.flatMap(p => p.toc),
      });
      write(`law/${law.id}/fusoku.html`, sh); pages++; bytes += sh.length;
    }
    law.content = null; // メモリ解放
  }

  // ---- 3. laws.json（法令名検索用：全法令）----
  const catIndex = new Map(categories.map((c, i) => [c.name, i]));
  const compact = {
    v: 1,
    kinds: KIND_LABEL,
    categories: categories.map(c => [c.name, c.slug]),
    // [id, title, kana, abbrev, kind, catIndex, law_num, hasPage]
    laws: laws.map(l => [l.id, l.title, l.kana, l.abbrev, l.kind, catIndex.get(l.category), l.law_num, l.hasPage ? 1 : 0]),
  };
  write('data/laws.json', JSON.stringify(compact));

  // ---- 4. 分類ページ ----
  writeBrowse(categories);

  // ---- 5. トップ・検索・案内 ----
  writeHome(laws, categories);
  writeSearch(categories);
  writeAbout(laws);
  write('404.html', layout({ title: 'ページが見つかりません', root: './', body: `<section class="page-head"><h1>ページが見つかりません</h1><p>お探しのページは移動または削除された可能性があります。</p><p><a class="btn" href="./">トップへ戻る</a></p></section>` }));

  // ---- 6. 静的ファイル ----
  copyDir(path.join(ROOT, 'src/assets'), path.join(OUT, 'assets'));
  const cfg = path.join(ROOT, 'config.js');
  if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(OUT, 'config.js'));
  else fs.writeFileSync(path.join(OUT, 'config.js'), 'const GTM_ID = "";\n');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`法令 ${laws.length} 件（分類 ${categories.length}）、法令ページ ${pages} 枚（${(bytes / 1e6).toFixed(1)}MB）を生成しました（${sec}秒）`);
}

function lawLink(l, root) {
  return l.hasPage ? `${root}law/${l.id}/` : l.source;
}

function writeBrowse(categories) {
  const root = '../';
  const grid = categories.map(c => {
    const nPage = c.laws.filter(l => l.hasPage).length;
    return `<li><a class="catalog-card" href="${c.slug}.html"><span class="cc-name">${e(c.name)}</span><span class="cc-count">法律 ${nPage}・全 ${c.laws.length} 件</span></a></li>`;
  }).join('');
  write('browse/index.html', layout({
    title: '分類から探す', root,
    body: `<section class="page-head"><h1>分類から探す</h1><p>e-Gov法令検索の分類に従い、${categories.length} の書架に整理しています。</p></section>
<ul class="catalog-grid">${grid}</ul>`,
  }));
  for (const c of categories) {
    const groups = {};
    for (const l of c.laws) (groups[l.kind] ||= []).push(l);
    const sections = Object.entries(groups).map(([kind, ls]) => `
<section class="shelf-section">
  <h2>${e(KIND_LABEL[kind])}<span class="count">${ls.length}</span></h2>
  <ul class="law-list">${ls.map(l => `<li><a href="${e(lawLink(l, root))}"${l.hasPage ? '' : ' target="_blank" rel="noopener"'}><span class="ll-title">${e(l.title)}</span>${l.hasPage ? '' : '<span class="ext" aria-label="e-Gov（外部サイト）">e-Gov ↗</span>'}</a><span class="ll-num">${e(l.law_num)}</span></li>`).join('')}</ul>
</section>`).join('');
    write(`browse/${c.slug}.html`, layout({
      title: `${c.name}の法令`, root,
      description: `分類「${c.name}」に属する法令の一覧（${c.laws.length}件）。`,
      body: `<nav class="breadcrumb" aria-label="パンくずリスト"><a href="../">トップ</a><span aria-hidden="true">›</span><a href="./">分類</a><span aria-hidden="true">›</span><span>${e(c.name)}</span></nav>
<section class="page-head"><p class="call-number"><span>分類</span></p><h1>${e(c.name)}</h1><p>${c.laws.length} 件の法令。憲法・法律は本館で全文を閲覧できます。政令・府省令などは e-Gov法令検索へご案内します。</p></section>
${sections}`,
    }));
  }
}

function writeHome(laws, categories) {
  const root = './';
  const byTitle = new Map();
  for (const l of laws) if (l.hasPage && !byTitle.has(l.title)) byTitle.set(l.title, l);
  const spines = MAJOR.map(t => byTitle.get(t)).filter(Boolean).map((l, i) => {
    const short = l.abbrev ? l.abbrev.split(',')[0] : l.title;
    const label = short.length <= 12 ? short : l.title.replace(/に関する法律$/, '法').slice(0, 12);
    return `<li><a class="spine s${i % 6}" href="law/${l.id}/" title="${e(l.title)}"><span class="spine-title">${e(label)}</span></a></li>`;
  }).join('');
  const nAct = laws.filter(l => l.hasPage).length;
  const cats = categories.map(c => `<li><a href="browse/${c.slug}.html">${e(c.name)}<span class="count">${c.laws.length}</span></a></li>`).join('');
  const body = `
<section class="hero">
  <p class="hero-kicker">閲覧室へようこそ</p>
  <h1 class="hero-title"><span class="nw">条文のことばから、</span><span class="nw">法令を探す。</span></h1>
  <p class="hero-lead">日本国憲法と ${nAct.toLocaleString()} の法律の全文、そして政令・府省令を含む ${laws.length.toLocaleString()} 件の法令名を収めた、静かな書庫です。</p>
  <form class="hero-search" action="search.html" role="search">
    <label class="visually-hidden" for="q">語句・法令名で検索</label>
    <input id="q" name="q" type="search" placeholder="例：正当防衛、敷金" autocomplete="off" enterkeyhint="search" autofocus>
    <button type="submit">検索</button>
  </form>
  <p class="hero-hints">よく調べられる語：<a href="search.html?q=正当防衛">正当防衛</a><a href="search.html?q=敷金">敷金</a><a href="search.html?q=年次有給休暇">年次有給休暇</a><a href="search.html?q=肖像">肖像</a><a href="search.html?q=時効">時効</a><a href="search.html?q=未成年者">未成年者</a></p>
</section>
<section class="shelf">
  <div class="section-head"><h2>主要法令の書架</h2><p>背表紙を選ぶと全文を閲覧できます。</p></div>
  <ul class="bookshelf">${spines}</ul>
</section>
<section class="catalog">
  <div class="section-head"><h2>分類目録</h2><a class="more" href="browse/">すべての分類 →</a></div>
  <ul class="cat-chips">${cats}</ul>
</section>`;
  write('index.html', layout({ root, body, bodyClass: 'page-home', hideHeaderSearch: true }));
}

function writeSearch(categories) {
  const root = './';
  const body = `
<section class="search-page">
  <form class="search-main" role="search" id="search-form">
    <label class="visually-hidden" for="sq">語句・法令名で検索</label>
    <input id="sq" name="q" type="search" placeholder="語句・法令名で検索" autocomplete="off" enterkeyhint="search">
    <button type="submit">検索</button>
  </form>
  <div class="search-layout">
    <aside class="filters" aria-label="絞り込み">
      <details class="filter-box" open>
        <summary>絞り込み</summary>
        <label for="f-cat">分類</label>
        <select id="f-cat" name="cat"><option value="">すべての分類</option>${categories.map(c => `<option>${e(c.name)}</option>`).join('')}</select>
        <fieldset><legend>区分</legend>
          <label><input type="radio" name="part" value="" checked> すべて</label>
          <label><input type="radio" name="part" value="本則"> 本則のみ</label>
          <label><input type="radio" name="part" value="附則"> 附則のみ</label>
        </fieldset>
        <fieldset><legend>種別</legend>
          <label><input type="radio" name="kind" value="" checked> すべて</label>
          <label><input type="radio" name="kind" value="憲法"> 憲法</label>
          <label><input type="radio" name="kind" value="法律"> 法律</label>
        </fieldset>
      </details>
      <p class="filter-note">条文検索は憲法・法律が対象です。政令・府省令は法令名で探せます。</p>
    </aside>
    <div class="results" aria-live="polite">
      <section id="title-results" class="title-results" hidden></section>
      <section id="text-results" class="text-results"></section>
    </div>
  </div>
</section>`;
  write('search.html', layout({ title: '検索', root, body, bodyClass: 'page-search', hideHeaderSearch: true, scripts: ['search.js'] }));
}

function writeAbout(laws) {
  const root = './';
  const counts = {};
  for (const l of laws) counts[l.kind] = (counts[l.kind] || 0) + 1;
  const rows = Object.entries(KIND_LABEL).map(([k, v]) => `<tr><th scope="row">${v}</th><td>${(counts[k] || 0).toLocaleString()} 件</td><td>${k === 'C' || k === 'A' ? '全文検索・閲覧（附則を含む）' : '法令名検索（e-Gov へリンク）'}</td></tr>`).join('');
  const body = `
<section class="page-head"><h1>ご利用案内</h1><p>${SITE_NAME}は、日本の法令を条文の語句から探すための閲覧室です。</p></section>
<article class="prose">
<h2>収蔵資料</h2>
<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">種別</th><th scope="col">件数</th><th scope="col">利用方法</th></tr></thead><tbody>${rows}</tbody></table></div>
<h2>検索のしかた</h2>
<ul>
<li>語句を入力すると、<strong>法令名の一致</strong>（全法令が対象：正式名・読み・略称）と、<strong>条文の一致</strong>（憲法・法律が対象）を並べて表示します。</li>
<li>空白で区切って複数の語を入れると、すべてを含む法令を探します。</li>
<li>検索結果の条見出しを選ぶと、その条へ直接移動し、検索語に印が付きます。</li>
<li>法令のページでは「条へ移動」に数字を入れると、その条へ移動できます（例：<code>622-2</code> で第六百二十二条の二）。</li>
<li>附則は別のページにまとめています。検索結果は「区分」で本則・附則に絞り込めます。</li>
</ul>
<h2>出典とライセンス</h2>
<p>法令データは <a href="https://laws.e-gov.go.jp/">e-Gov法令検索</a> から取得されたもので、<a href="https://www.digital.go.jp/resources/open_data/public_data_license_v1.0">公共データ利用規約（第1.0版）</a>のもとで提供されています。Markdown への変換は <a href="https://github.com/Kohei-Wada/houritsu">Kohei-Wada/houritsu</a>（CC BY 4.0）によるものです。</p>
<p>本サイトの掲載内容は参考情報であり、正確性を保証するものではありません。法令の正確な内容は、e-Gov法令検索や官報でご確認ください。</p>
</article>`;
  write('about.html', layout({ title: 'ご利用案内', root, body }));
}

main();
