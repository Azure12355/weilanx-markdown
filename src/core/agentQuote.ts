// 选中文字 → 发给 Agent 的引用块:文件路径、行号、所在章节、原文。纯函数,便于单测
import { extractHeadings } from "./outline";

export interface QuoteOptions {
  /** 显示用的文件路径(相对工作区) */
  path: string;
  /** 超过这个行数时只保留开头和结尾 */
  maxLines: number;
  zh: boolean;
}

/** 字符偏移 → 1 起的行号 */
function lineAt(text: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** 选区起点之前最近的标题(跳过代码块和 front matter 里的 #) */
export function sectionAt(text: string, line: number): string | undefined {
  let found: string | undefined;
  for (const h of extractHeadings(text)) {
    if (h.line + 1 > line) break;
    found = h.text;
  }
  return found;
}

export function buildQuote(text: string, ranges: [number, number][], opt: QuoteOptions): string {
  const blocks: string[] = [];
  for (const [from, to] of ranges.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])) {
    const start = lineAt(text, from);
    // 选区停在下一行行首时,不把那一行算进去
    let end = lineAt(text, to);
    if (end > start && text[to - 1] === "\n") end--;
    const lines = text.slice(from, to).replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");

    const where = start === end ? (opt.zh ? `第 ${start} 行` : `line ${start}`) : opt.zh ? `第 ${start}–${end} 行` : `lines ${start}–${end}`;
    const section = sectionAt(text, start);
    const head = [`📄 \`${opt.path}\``, where];
    if (section) head.push(opt.zh ? `章节：${section}` : `section: ${section}`);

    let body = lines;
    const max = Math.max(2, opt.maxLines);
    if (lines.length > max) {
      const keepHead = Math.ceil(max / 2);
      const keepTail = max - keepHead;
      const omitted = lines.length - max;
      const a = start + keepHead;
      const b = a + omitted - 1;
      const note = opt.zh ? `……（中间省略 ${omitted} 行，见原文第 ${a}–${b} 行）` : `… (${omitted} lines omitted, see lines ${a}–${b})`;
      body = [...lines.slice(0, keepHead), note, ...lines.slice(lines.length - keepTail)];
    }
    blocks.push([head.join(" · "), "", ...body].map((l) => (l ? `> ${l}` : ">")).join("\n"));
  }
  return blocks.length ? blocks.join("\n\n") + "\n\n" : "";
}
