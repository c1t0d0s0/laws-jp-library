// 検索ページ：法令名検索（laws.json）＋ 条文の全文検索（Pagefind）
import { siteRoot } from './common.js';

const ROOT = siteRoot();
const PAGE_SIZE = 10;
const TITLE_LIMIT = 8;

const form = document.getElementById('search-form');
const input = document.getElementById('sq');
const catSel = document.getElementById('f-cat');
const titleBox = document.getElementById('title-results');
const textBox = document.getElementById('text-results');
const filterBox = document.querySelector('.filter-box');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 状態と URL ----------
function readState() {
  const p = new URLSearchParams(location.search);
  return { q: p.get('q') || '', cat: p.get('cat') || '', part: p.get('part') || '', kind: p.get('kind') || '' };
}
function writeState(s, push) {
  const p = new URLSearchParams();
  for (const k of ['q', 'cat', 'part', 'kind']) if (s[k]) p.set(k, s[k]);
  const url = `${location.pathname}${p.toString() ? '?' + p : ''}`;
  if (url !== location.pathname + location.search) history[push ? 'pushState' : 'replaceState'](null, '', url);
}
function formState() {
  return {
    q: input.value.trim(),
    cat: catSel.value,
    part: form.ownerDocument.querySelector('input[name="part"]:checked')?.value || '',
    kind: form.ownerDocument.querySelector('input[name="kind"]:checked')?.value || '',
  };
}
function applyState(s) {
  input.value = s.q;
  catSel.value = s.cat;
  for (const name of ['part', 'kind']) {
    const r = document.querySelector(`input[name="${name}"][value="${CSS.escape(s[name])}"]`);
    if (r) r.checked = true;
  }
  if (matchMedia('(max-width: 900px)').matches && !s.cat && !s.part && !s.kind) filterBox.open = false;
}

// ---------- 正規化 ----------
function norm(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .replace(/[\s・･,、。「」『』（）()]/g, '');
}
function terms(q) {
  return q.normalize('NFKC').split(/[\s　]+/).map(norm).filter(Boolean);
}

// ---------- 法令名検索 ----------
let lawsData = null;
let lawsIndex = null;
let lawsPromise = null;
function loadLaws() {
  return (lawsPromise ||= fetchLaws().catch(err => { lawsPromise = null; throw err; }));
}
async function fetchLaws() {
  const res = await fetch(new URL('data/laws.json', ROOT));
  lawsData = await res.json();
  lawsIndex = lawsData.laws.map(l => ({
    l, t: norm(l[1]), k: norm(l[2]), a: l[3] ? l[3].split(',').map(norm) : [],
  }));
}
function titleSearch(q, cat) {
  const ts = terms(q);
  if (!ts.length) return [];
  const catIdx = cat ? lawsData.categories.findIndex(c => c[0] === cat) : -1;
  const whole = ts.join('');
  const out = [];
  for (const e of lawsIndex) {
    if (catIdx >= 0 && e.l[5] !== catIdx) continue;
    let score = 0, ok = true;
    for (const t of ts) {
      let s = 0;
      if (e.a.includes(t)) s = 90;
      else if (e.t === t) s = 100;
      else if (e.t.startsWith(t)) s = 70;
      else if (e.t.includes(t)) s = 50;
      else if (e.a.some(a => a.includes(t))) s = 45;
      else if (e.k.includes(t)) s = 35;
      if (!s) { ok = false; break; }
      score += s;
    }
    if (!ok) continue;
    if (e.t === whole) score += 60;
    if (e.l[7]) score += 8; // 本館に全文がある法令を少し優先
    score -= Math.min(e.t.length, 60) * 0.3; // 短い名称を優先
    out.push({ e, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.map(x => x.e.l);
}
function lawHref(l) {
  return l[7] ? new URL(`law/${l[0]}/`, ROOT).href : `https://laws.e-gov.go.jp/law/${l[0]}`;
}
function renderTitles(list, q) {
  if (!list.length) { titleBox.hidden = true; titleBox.innerHTML = ''; return; }
  titleBox.hidden = false;
  const item = l => {
    const ext = !l[7];
    return `<li><a href="${esc(lawHref(l))}"${ext ? ' target="_blank" rel="noopener"' : ''}>
      <span class="tl-kind">${esc(lawsData.kinds[l[4]])}</span>
      <span class="tl-title">${highlightTitle(l[1], q)}</span>
      <span class="tl-sub">${esc(l[6])}${l[3] ? `　略称：${esc(l[3].replace(/,/g, '、'))}` : ''}${ext ? '　e-Gov ↗' : ''}</span>
    </a></li>`;
  };
  titleBox.innerHTML = `<div class="results-head"><h2>法令名の一致</h2><p>${list.length.toLocaleString()} 件</p></div>
    <ul class="title-list">${list.slice(0, TITLE_LIMIT).map(item).join('')}</ul>
    ${list.length > TITLE_LIMIT ? `<button class="title-more" type="button">ほか ${list.length - TITLE_LIMIT} 件を表示</button>` : ''}`;
  titleBox.querySelector('.title-more')?.addEventListener('click', ev => {
    titleBox.querySelector('.title-list').insertAdjacentHTML('beforeend', list.slice(TITLE_LIMIT, 200).map(item).join(''));
    ev.target.remove();
  });
}
function highlightTitle(title, q) {
  let html = esc(title);
  for (const w of q.split(/[\s　]+/).filter(Boolean)) {
    const ew = esc(w);
    if (ew && html.includes(ew)) html = html.split(ew).join(`<mark>${ew}</mark>`);
  }
  return html;
}

// ---------- 全文検索（Pagefind） ----------
let pagefindPromise = null;
function loadPagefind() {
  return (pagefindPromise ||= initPagefind().catch(err => { pagefindPromise = null; throw err; }));
}
async function initPagefind() {
  const pf = await import(new URL('pagefind/pagefind.js', ROOT).href);
  const opts = {
    baseUrl: ROOT.pathname,
    highlightParam: 'highlight',
    excerptLength: 36,
    ranking: { pageLength: 0.85, termFrequency: 0.9 },
  };
  await pf.options(opts);
  pf.init();
  // 索引は複数に分割されているので、2つ目以降を結合する
  const bundles = await fetch(new URL('data/bundles.json', ROOT)).then(r => r.json()).catch(() => ['pagefind']);
  await Promise.all(bundles.slice(1).map(b => pf.mergeIndex(new URL(`${b}/`, ROOT).href, opts)));
  return pf;
}

// ---------- 検索語の分かち書き ----------
// Pagefind は語単位の索引なので、「正当防衛」→「正当 防衛」のように分けてから渡す。
const segmenter = 'Segmenter' in Intl ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
const STOP = /^[ぁ-ゖー]{1,2}$/; // の・は・を などの短いひらがな語は除く
// 入力の空白区切りごとに語の配列を返す: 「正当防衛 要件」→ [[正当, 防衛], [要件]]
function segmentQuery(q) {
  const chunks = [];
  for (const chunk of q.normalize('NFKC').replace(/["“”]/g, '').split(/[\s　]+/).filter(Boolean)) {
    if (!segmenter) { chunks.push([chunk]); continue; }
    const segs = [...segmenter.segment(chunk)].filter(s => s.isWordLike).map(s => s.segment);
    const kept = segs.filter(s => !STOP.test(s));
    const ws = kept.length ? kept : segs;
    if (ws.length) chunks.push(ws);
  }
  return chunks;
}
// Pagefind はフレーズ（"…"）を1つだけ扱えるので、最も長い複数語の塊をフレーズにする
function phraseQuery(chunks) {
  let best = -1;
  chunks.forEach((c, i) => { if (c.length > 1 && (best < 0 || c.join('').length > chunks[best].join('').length)) best = i; });
  if (best < 0) return null;
  return chunks.map((c, i) => (i === best ? `"${c.join(' ')}"` : c.join(' '))).join(' ');
}
// 0件のときの再試行用：3文字以上の漢字語を2文字ずつに分ける（過失致死 → 過失 致死）
function finerQuery(words) {
  return words.flatMap(w => (/^[一-鿿々〆ヶ]{3,}$/.test(w) ? w.match(/.{1,2}/gu) : [w]));
}
const plain = html => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');

let runId = 0;
let current = null; // { results, shown }
async function runSearch(s) {
  const id = ++runId;
  if (!s.q) {
    titleBox.hidden = true;
    textBox.innerHTML = `<div class="empty-state"><p>調べたい語句や法令名を入力してください。</p><p class="tl-sub">例：「正当防衛」「敷金」「年次有給休暇」「景表法」</p></div>`;
    document.title = '検索｜法令図書館';
    return;
  }
  document.title = `「${s.q}」の検索結果｜法令図書館`;
  textBox.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

  // 法令名
  loadLaws().then(() => { if (id === runId) renderTitles(titleSearch(s.q, s.cat), s.q); })
    .catch(() => { titleBox.hidden = true; });

  // 条文
  try {
    const pf = await loadPagefind();
    const base = {};
    if (s.cat) base['分類'] = s.cat;
    if (s.kind) base['種別'] = s.kind;
    const chunks = segmentQuery(s.q);
    const words = chunks.flat();
    const phrase = phraseQuery(chunks);
    const loose = words.join(' ');
    // 表示順：主要法令の本則 → その他の本則 → 附則。各段で「語句どおり（フレーズ一致）」を先に。
    const main = s.part !== '附則';
    const suppl = s.part !== '本則';
    const tierMain = [{ ...base, 区分: '本則', 主要: '1' }, { ...base, 区分: '本則' }];
    const tierSuppl = [{ ...base, 区分: '附則' }];
    const plan = [];
    if (main) {
      if (phrase) tierMain.forEach(f => plan.push([phrase, f, true]));
      tierMain.forEach(f => plan.push([loose, f, false]));
    }
    if (suppl) {
      if (phrase) tierSuppl.forEach(f => plan.push([phrase, f, true]));
      tierSuppl.forEach(f => plan.push([loose, f, false]));
    }
    const outs = await Promise.all(plan.map(([q, filters]) => pf.search(q, { filters })));
    let results = [];
    let exactCount = 0;
    const seen = new Set();
    outs.forEach((o, i) => {
      for (const r of o.results) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        results.push(r);
        if (plan[i][2]) exactCount++;
      }
    });
    if (!results.length) {
      const finer = finerQuery(words);
      const filters = s.part ? { ...base, 区分: s.part } : base;
      if (finer.join(' ') !== loose) results = (await pf.search(finer.join(' '), { filters })).results;
    }
    if (id !== runId) return;
    current = { results, shown: 0, q: s.q, phrases: s.q.normalize('NFKC').split(/[\s　]+/).filter(Boolean) };
    textBox.innerHTML = `<div class="results-head"><h2>条文の一致</h2><p>${results.length.toLocaleString()} 件${exactCount && exactCount < results.length ? `（うち語句どおり ${exactCount.toLocaleString()} 件）` : ''}</p></div><div class="result-list"></div>`;
    if (!results.length) {
      textBox.querySelector('.result-list').innerHTML = `<div class="empty-state"><p>条文に一致するものは見つかりませんでした。</p><p class="tl-sub">言い換えや、より短い語句でお試しください。${s.cat || s.part || s.kind ? '絞り込みを解除すると見つかることがあります。' : ''}</p></div>`;
      return;
    }
    await showMore(id);
  } catch (err) {
    console.error(err);
    if (id === runId) textBox.innerHTML = `<div class="empty-state"><p>全文検索の索引を読み込めませんでした。</p><p class="tl-sub">時間をおいて再度お試しください。</p></div>`;
  }
}

async function showMore(id) {
  const list = textBox.querySelector('.result-list');
  textBox.querySelector('.load-more')?.remove();
  const slice = current.results.slice(current.shown, current.shown + PAGE_SIZE);
  current.shown += slice.length;
  const datas = await Promise.all(slice.map(r => r.data()));
  if (id !== runId) return;
  list.insertAdjacentHTML('beforeend', datas.map(renderResult).join(''));
  if (current.shown < current.results.length) {
    const btn = document.createElement('button');
    btn.className = 'load-more';
    btn.type = 'button';
    btn.textContent = `さらに表示（残り ${current.results.length - current.shown} 件）`;
    btn.addEventListener('click', () => showMore(id));
    textBox.appendChild(btn);
  }
}

function renderResult(d) {
  const m = d.meta || {};
  const isSuppl = m.part === '附則';
  // 入力どおりの語句（「正当防衛」など）を含む条を優先する
  const phrases = current?.phrases || [];
  const score = s => {
    const t = s.title || '', ex = plain(s.excerpt);
    let v = s.locations?.length || 0;
    for (const p of phrases) { if (t.includes(p)) v += 60; if (ex.includes(p)) v += 25; }
    return v;
  };
  const subs = (d.sub_results || [])
    .filter(s => s.anchor && s.anchor.id)
    .map(s => ({ s, v: score(s) }))
    .sort((a, b) => b.v - a.v)
    .map(x => x.s);
  const top = subs.slice(0, 3);
  const rest = subs.length - top.length;
  const title = (m.title || '').replace(/附則$/, '');
  const subHtml = top.length
    ? `<ul class="sub-results">${top.map(s => `<li><a class="sr-title" href="${esc(s.url)}">${esc(cleanHeading(s.title))}</a><p class="sr-excerpt">${tidyExcerpt(s.excerpt)}</p></li>`).join('')}</ul>
       ${rest > 0 ? `<p class="result-meta"><a href="${esc(d.url)}">ほか ${rest} か所</a></p>` : ''}`
    : `<p class="sr-excerpt">${tidyExcerpt(d.excerpt)}</p>`;
  return `<article class="result-card">
    <p class="call-number"><span>${esc(m.cat || '')}</span><span>${isSuppl ? '附則' : '本則'}</span></p>
    <h3><a href="${esc(d.url)}">${esc(title)}${isSuppl ? '（附則）' : ''}</a></h3>
    <p class="result-meta">${esc(m.num || '')}</p>
    ${subHtml}
  </article>`;
}
function tidyExcerpt(html) {
  return String(html || '')
    .replace(/<\/mark>\s*<mark>/g, '')
    .replace(/([\u3000-\u30ff\u4e00-\u9fff\uff01-\uff5e])\s+(?=<mark>|[\u3000-\u30ff\u4e00-\u9fff])/g, '$1');
}
function cleanHeading(t) {
  return String(t || '').replace(/¶$/, '').trim();
}

// ---------- イベント ----------
let timer;
function onInput(push) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const s = formState();
    writeState(s, push);
    runSearch(s);
  }, push ? 0 : 350);
}
form.addEventListener('submit', ev => { ev.preventDefault(); input.blur(); onInput(true); });
input.addEventListener('input', () => onInput(false));
catSel.addEventListener('change', () => onInput(true));
document.querySelectorAll('input[name="part"], input[name="kind"]').forEach(r => r.addEventListener('change', () => onInput(true)));
window.addEventListener('popstate', () => { const s = readState(); applyState(s); runSearch(s); });

const initial = readState();
applyState(initial);
runSearch(initial);
if (!initial.q) input.focus();
// 索引の読み込みを先に始めておく
loadPagefind().catch(() => {});
loadLaws().catch(() => {});
