// 从 Markdown 文本提取标题(ATX 与 Setext),跳过代码块和 front matter。不依赖 node / DOM,两端共用

export interface Heading {
  level: number;
  text: string;
  /** 0 起的行号 */
  line: number;
}

/** 去掉标题里的行内标记,留下可读文字 */
export function plainHeading(raw: string): string {
  return raw
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|\*|_|`)/g, "")
    .trim();
}

export function extractHeadings(text: string): Heading[] {
  const lines = text.split(/\r?\n/);
  const out: Heading[] = [];
  let i = 0;
  // front matter
  if (lines[0]?.trim() === "---") {
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === "---" || lines[j].trim() === "...") {
        i = j + 1;
        break;
      }
    }
  }
  let fence: string | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0].repeat(f[1].length);
      else if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fence) continue;
    const atx = /^\s{0,3}(#{1,6})(?:\s+(.*))?$/.exec(line);
    if (atx) {
      out.push({ level: atx[1].length, text: plainHeading(atx[2] ?? ""), line: i });
      continue;
    }
    const next = lines[i + 1];
    if (next !== undefined && line.trim() && !/^\s{0,3}([-*+]|\d+[.)])\s/.test(line) && !/^\s{0,3}>/.test(line)) {
      if (/^\s{0,3}=+\s*$/.test(next)) out.push({ level: 1, text: plainHeading(line), line: i });
      else if (/^\s{0,3}-+\s*$/.test(next) && !/^\s*$/.test(line)) out.push({ level: 2, text: plainHeading(line), line: i });
    }
  }
  return out;
}

/** front matter 的范围(字符偏移),没有时返回 null */
export function frontMatterRange(text: string): { from: number; to: number } | null {
  if (!/^---\r?\n/.test(text)) return null;
  const m = /\r?\n(---|\.\.\.)[ \t]*(\r?\n|$)/.exec(text.slice(3));
  if (!m) return null;
  return { from: 0, to: 3 + m.index + m[0].replace(/\r?\n$/, "").length };
}
