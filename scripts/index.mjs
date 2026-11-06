#!/usr/bin/env node
// site/law/**.html から Pagefind の全文検索インデックスを作る。
// 全法律をまとめて索引化するとメモリが 10GB を超えるため、HTML 約 SHARD_MB ごとに
// 別々のインデックス（pagefind/, pagefind-2/, …）に分けて作り、ブラウザ側で mergeIndex する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pagefind from 'pagefind';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const SHARD_BYTES = Number(process.env.SHARD_MB || 45) * 1e6;

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  const files = walk(path.join(SITE, 'law')).sort().map(p => ({ p, size: fs.statSync(p).size }));
  // 本則を先に、附則を後に並べる（同じインデックス内の語の統計が揃いやすい）
  files.sort((a, b) => Number(a.p.endsWith('fusoku.html')) - Number(b.p.endsWith('fusoku.html')));

  const shards = [];
  let cur = [], curSize = 0;
  for (const f of files) {
    if (cur.length && curSize + f.size > SHARD_BYTES) { shards.push(cur); cur = []; curSize = 0; }
    cur.push(f); curSize += f.size;
  }
  if (cur.length) shards.push(cur);

  for (const d of fs.readdirSync(SITE)) if (/^pagefind(-\d+)?$/.test(d)) fs.rmSync(path.join(SITE, d), { recursive: true });

  const bundles = [];
  for (let i = 0; i < shards.length; i++) {
    const dir = i === 0 ? 'pagefind' : `pagefind-${i + 1}`;
    const { index, errors } = await pagefind.createIndex({ forceLanguage: 'ja' });
    if (errors.length) throw new Error(errors.join('\n'));
    let pages = 0;
    for (const f of shards[i]) {
      const url = '/' + path.relative(SITE, f.p).split(path.sep).join('/').replace(/index\.html$/, '');
      const res = await index.addHTMLFile({ url, content: fs.readFileSync(f.p, 'utf8') });
      if (res.errors.length) console.warn(url, res.errors);
      else pages++;
    }
    const w = await index.writeFiles({ outputPath: path.join(SITE, dir) });
    if (w.errors.length) throw new Error(w.errors.join('\n'));
    await index.deleteIndex();
    await pagefind.close(); // バックエンドを終了してメモリを解放
    bundles.push(dir);
    const mb = (shards[i].reduce((s, f) => s + f.size, 0) / 1e6).toFixed(0);
    console.log(`  ${dir}: ${pages} ページ（HTML ${mb}MB）`);
  }
  fs.writeFileSync(path.join(SITE, 'data', 'bundles.json'), JSON.stringify(bundles));
  console.log(`索引 ${bundles.length} 個を作成しました（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
}

main().catch(err => { console.error(err); process.exit(1); });
