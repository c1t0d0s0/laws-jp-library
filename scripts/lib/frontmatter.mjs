// Markdown 先頭の YAML フロントマターを data と content に分ける。
// gray-matter の代替（CVE-2026-78847：`---js` のフロントマターを eval で実行してしまう）。
// YAML 以外の言語指定（`---js` など）は受け付けず、フロントマターなしとして扱う。
import yaml from 'js-yaml';

const OPEN = /^---[ \t]*\r?\n/;
const CLOSE = /^---[ \t]*$/m;

/**
 * @param {string} raw
 * @returns {{ data: Record<string, any>, content: string }}
 */
export function parseFrontMatter(raw) {
  let str = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const open = str.match(OPEN);
  if (!open) return { data: {}, content: str };

  const rest = str.slice(open[0].length);
  // 閉じの `---` は行全体（空のフロントマター `---\n---` にも対応）
  const close = rest.match(CLOSE);
  if (!close) return { data: {}, content: str };

  const src = rest.slice(0, close.index);
  let content = rest.slice(close.index + close[0].length);
  if (content.startsWith('\r\n')) content = content.slice(2);
  else if (content.startsWith('\n')) content = content.slice(1);

  // js-yaml v4 の load() は既定で安全なスキーマ（関数などは生成しない）
  const parsed = yaml.load(src);
  const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return { data, content };
}
