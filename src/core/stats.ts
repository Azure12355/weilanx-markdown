// 字数统计:先去掉 Markdown 标记得到「读者看到的文字」,再计数。纯函数,便于单测。

export interface TextStats {
  /** 字数 = 中日韩文字 + 英文单词(和公众号、知乎的口径一致) */
  words: number;
  cjk: number;
  latinWords: number;
  /** 字符数(不含空白) */
  chars: number;
  /** 字符数(含空格,不含换行) */
  charsWithSpaces: number;
  paragraphs: number;
  sentences: number;
  lines: number;
  headings: number;
  images: number;
  links: number;
  codeBlocks: number;
  tables: number;
  /** X(Twitter)计数:中日韩字符和 emoji 按 2 计 */
  xWeighted: number;
}

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯\u{20000}-\u{2fa1f}]/u;
const CJK_G = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯\u{20000}-\u{2fa1f}]/gu;
const LATIN_WORD = /[A-Za-z0-9À-ɏ]+(?:['’.-][A-Za-z0-9À-ɏ]+)*/g;

/** Markdown → 读者看到的纯文本(不含代码块),同时统计结构元素 */
export function toPlain(md: string): { text: string; headings: number; images: number; links: number; codeBlocks: number; tables: number } {
  let text = md.replace(/\r\n?/g, "\n");
  let headings = 0;
  let images = 0;
  let links = 0;
  let codeBlocks = 0;
  let tables = 0;
  // front matter
  text = text.replace(/^---\n[\s\S]*?\n(---|\.\.\.)[ \t]*(\n|$)/, "");
  // 代码块:不计入字数
  text = text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n {0,3}\1[`~]*[ \t]*(?=\n|$)|$)/gm, () => {
    codeBlocks++;
    return "";
  });
  // 块级公式
  text = text.replace(/^\s*\$\$[\s\S]*?\$\$\s*$/gm, "");
  // HTML 注释
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  const out: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    // 表格:分隔行去掉,其余行把竖线换成空格
    if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l) && i > 0 && lines[i - 1].includes("|")) {
      tables++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l)) l = l.replace(/\|/g, " ");
    if (/^\s{0,3}#{1,6}\s/.test(l)) headings++;
    l = l
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/\s+#+\s*$/, "")
      .replace(/^\s*(?:>\s?)+/, "")
      .replace(/^\s*\[!(note|tip|important|warning|caution)\]\s*$/i, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, "")
      .replace(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/, "");
    out.push(l);
  }
  text = out.join("\n");
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, () => {
    images++;
    return "";
  });
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, (_m, label) => {
    links++;
    return label;
  });
  text = text.replace(/<(https?:\/\/[^>]+)>/g, (_m, u) => {
    links++;
    return u;
  });
  text = text
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/(\*\*|__|~~|\*|_|`)/g, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1");
  return { text, headings, images, links, codeBlocks, tables };
}

export function countText(plain: string): Pick<TextStats, "words" | "cjk" | "latinWords" | "chars" | "charsWithSpaces" | "sentences" | "xWeighted"> {
  const cjk = (plain.match(CJK_G) ?? []).length;
  // 英文单词:去掉中日韩字符后再匹配,避免「Claude号」这类粘连被漏算
  const latinWords = (plain.replace(CJK_G, " ").match(LATIN_WORD) ?? []).length;
  const chars = Array.from(plain.replace(/\s/g, "")).length;
  const charsWithSpaces = Array.from(plain.replace(/\n/g, "")).length;
  const sentences = (plain.match(/[。！？!?]+|[.](?=\s|$)/g) ?? []).length;
  let xWeighted = 0;
  for (const ch of plain.replace(/\n/g, " ")) {
    const cp = ch.codePointAt(0)!;
    xWeighted += CJK.test(ch) || cp > 0x2fff ? 2 : 1;
  }
  return { words: cjk + latinWords, cjk, latinWords, chars, charsWithSpaces, sentences, xWeighted };
}

export function computeStats(md: string): TextStats {
  const p = toPlain(md);
  const c = countText(p.text);
  const paragraphs = p.text.split(/\n\s*\n/).filter((b) => b.trim()).length;
  return {
    ...c,
    paragraphs,
    lines: md.length ? md.split(/\r?\n/).length : 0,
    headings: p.headings,
    images: p.images,
    links: p.links,
    codeBlocks: p.codeBlocks,
    tables: p.tables,
  };
}

/** 估算时长(秒):中文按「字/分钟」,英文按「词/分钟」 */
export function durationSeconds(s: Pick<TextStats, "cjk" | "latinWords">, cjkPerMin: number, wordsPerMin: number): number {
  return Math.round((s.cjk / Math.max(1, cjkPerMin) + s.latinWords / Math.max(1, wordsPerMin)) * 60);
}

/** 90 → 「1:30」;3725 → 「1:02:05」 */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatMinutes(sec: number): string {
  if (sec <= 0) return "0";
  return sec < 60 ? "<1" : String(Math.round(sec / 60));
}

export interface PlatformLimit {
  name: string;
  limit: number;
  /** words 字数 / chars 字符(不含空白)/ x 按 X 的规则加权 */
  unit: "words" | "chars" | "x";
}

export const DEFAULT_PLATFORMS: PlatformLimit[] = [
  { name: "小红书正文", limit: 1000, unit: "chars" },
  { name: "小红书标题", limit: 20, unit: "chars" },
  { name: "X / Twitter", limit: 280, unit: "x" },
  { name: "公众号摘要", limit: 120, unit: "chars" },
];

export function platformValue(s: Pick<TextStats, "words" | "chars" | "xWeighted">, unit: PlatformLimit["unit"]): number {
  return unit === "words" ? s.words : unit === "x" ? s.xWeighted : s.chars;
}
