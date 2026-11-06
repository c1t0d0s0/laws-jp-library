// Markdown（houritsu 形式）→ HTML 変換と、条見出しへの id 付与・目次抽出
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
// 法令本文で誤解釈されやすい記法は無効化する
md.disable(['code', 'fence', 'blockquote', 'list', 'emphasis', 'strikethrough', 'lheading', 'hr', 'backticks']);

// 外部リンク（e-Gov の添付ファイル）は新しいタブで開く
const defaultLinkOpen = md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  const href = t.attrGet('href') || '';
  if (/^https?:/.test(href)) {
    t.attrSet('target', '_blank');
    t.attrSet('rel', 'noopener');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const KD = { '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
const KU = { '十': 10, '百': 100, '千': 1000 };

/** 漢数字（千まで）を整数へ。例: 九百三十 → 930, 千五十 → 1050 */
export function kanjiToNumber(s) {
  if (/^[0-9０-９]+$/.test(s)) return parseInt(s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)), 10);
  if (!/[十百千]/.test(s)) { // 位取り表記（一〇 など）
    let n = 0;
    for (const c of s) { if (!(c in KD)) return NaN; n = n * 10 + KD[c]; }
    return n;
  }
  let total = 0, cur = 0;
  for (const c of s) {
    if (c in KD) cur = KD[c];
    else if (c in KU) { total += (cur || 1) * KU[c]; cur = 0; }
    else return NaN;
  }
  return total + cur;
}

const NUM = '[〇一二三四五六七八九十百千0-9０-９]+';
const ARTICLE_RE = new RegExp(`^第(${NUM})条((?:[のノ]${NUM})*)`);
const STRUCT_RE = new RegExp(`^(?:第${NUM}(?:編|章|節|款|目)(?:[のノ]${NUM})*|前文|別表|附則別表|様式|別記)`);

/** 条見出しテキスト → id 断片（例: 第十二条の二 → a12-2）。条でなければ null */
export function articleId(text) {
  const m = ARTICLE_RE.exec(text);
  if (!m) return null;
  const main = kanjiToNumber(m[1]);
  if (Number.isNaN(main)) return null;
  const subs = m[2] ? m[2].split(/[のノ]/).filter(Boolean).map(kanjiToNumber) : [];
  return 'a' + [main, ...subs].join('-');
}

export function isStructural(text) {
  return STRUCT_RE.test(text);
}

const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * 本文 Markdown をレンダリングする。
 * @param {string} body  frontmatter を除いた Markdown
 * @param {object} opt   { idPrefix: '' }  附則部分では 'f3-' などを渡す
 * @returns {{html:string, toc:Array<{level:number,text:string,id:string,article:boolean}>}}
 */
export function renderBody(body, opt = {}) {
  const prefix = opt.idPrefix || '';
  const tokens = md.parse(body, {});
  const used = new Set();
  const toc = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'heading_open') continue;
    const inline = tokens[i + 1];
    const text = inline.content.trim();
    const level = Number(t.tag.slice(1));
    if (level === 1) continue; // 法令名はテンプレート側で出す
    const aid = articleId(text);
    let id = prefix + (aid || 'h' + (toc.length + 1));
    if (used.has(id)) { let n = 2; while (used.has(`${id}_${n}`)) n++; id = `${id}_${n}`; }
    used.add(id);
    t.attrSet('id', id);
    if (aid) t.attrJoin('class', 'art');
    toc.push({ level, text, id, article: !!aid });
  }
  // 見出し h1 は除去（テンプレートで表示）
  const filtered = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open' && tokens[i].tag === 'h1') { i += 2; continue; }
    filtered.push(tokens[i]);
  }
  let html = md.renderer.render(filtered, md.options, {});
  // 表は横スクロール可能なコンテナで包む（入れ子の表があるので最外側のみ）
  html = wrapTables(html);
  return { html, toc };
}

function wrapTables(html) {
  let out = '', depth = 0, i = 0;
  const re = /<(\/?)table\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    out += html.slice(i, m.index);
    if (!m[1]) { if (depth === 0) out += '<div class="table-wrap">'; depth++; out += m[0]; }
    else { out += m[0]; depth = Math.max(0, depth - 1); if (depth === 0) out += '</div>'; }
    i = re.lastIndex;
  }
  return out + html.slice(i);
}

/**
 * Markdown 本文を「本則」と「附則（複数）」に分ける。
 * 附則は `## 附　則` で始まる（レベル2固定）。附則別表などはその附則に含める。
 */
export function splitSupplementary(body) {
  // レベル2見出しで区切り、附則の区画とそれ以外（本則・別表）に振り分ける。
  // 附則の後ろに来る「## 別表」は本則側に戻す。
  const re = /^## .*$/gm;
  const cuts = [0];
  let m;
  while ((m = re.exec(body))) if (m.index > 0) cuts.push(m.index);
  cuts.push(body.length);
  let main = '';
  const suppl = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const seg = body.slice(cuts[k], cuts[k + 1]);
    if (/^## 附\s*則/.test(seg)) suppl.push(seg);
    else main += seg;
  }
  return { main, suppl };
}

export { escapeHtml };
