// 列表缩进 / 反缩进与有序列表重新编号。纯函数,输入输出都是行数组,便于单测。

export interface ListLine {
  indent: number;
  ordered: boolean;
  num: number;
  /** 有序列表的分隔符 . 或 ) ;无序列表为符号本身 - * + */
  mark: string;
  /** 标记连同后面空格的结束位置(即内容起始列) */
  contentCol: number;
  /** 标记后面的内容 */
  rest: string;
}

const LIST_RE = /^( *)(?:(\d{1,9})([.)])|([-*+]))( +|$)/;

export function parseListLine(text: string): ListLine | null {
  const m = LIST_RE.exec(text.replace(/\t/g, "    "));
  if (!m) return null;
  return {
    indent: m[1].length,
    ordered: m[2] !== undefined,
    num: m[2] !== undefined ? Number(m[2]) : 0,
    mark: m[3] ?? m[4],
    contentCol: m[0].length || m[1].length + (m[2]?.length ?? 0) + 2,
    rest: text.replace(/\t/g, "    ").slice(m[0].length),
  };
}

const lead = (s: string) => /^ */.exec(s.replace(/\t/g, "    "))![0].length;
const blank = (s: string) => !s.trim();

function markerText(l: ListLine, num = l.num): string {
  return l.ordered ? `${num}${l.mark}` : l.mark;
}

function build(indent: number, marker: string, rest: string): string {
  return " ".repeat(indent) + marker + " " + rest;
}

/** 这一项的子内容(更深缩进的行和其中的空行)的结束行(不含) */
function subtreeEnd(lines: string[], i: number, indent: number): number {
  let j = i + 1;
  let lastContent = i;
  for (; j < lines.length; j++) {
    if (blank(lines[j])) continue;
    if (lead(lines[j]) <= indent) break;
    lastContent = j;
  }
  return lastContent + 1;
}

function shift(lines: string[], from: number, to: number, delta: number) {
  for (let k = from; k < to; k++) {
    if (blank(lines[k])) continue;
    lines[k] = delta >= 0 ? " ".repeat(delta) + lines[k] : lines[k].replace(new RegExp(`^ {0,${-delta}}`), "");
  }
}

/** Tab:变成前一个兄弟的子项;有序列表在新的一层里从 1 开始(那一层已有条目时接着编号) */
export function indentItem(input: string[], i: number): string[] | null {
  const lines = input.slice();
  const cur = parseListLine(lines[i]);
  if (!cur) return null;
  let sib = -1;
  for (let j = i - 1; j >= 0; j--) {
    if (blank(lines[j])) continue;
    const p = parseListLine(lines[j]);
    const ind = lead(lines[j]);
    if (p && p.indent === cur.indent) {
      sib = j;
      break;
    }
    if (ind < cur.indent || (!p && ind <= cur.indent)) return null;
  }
  if (sib < 0) return null;
  const sibling = parseListLine(lines[sib])!;
  const newIndent = sibling.contentCol;
  let num = 1;
  for (let k = sib + 1; k < i; k++) {
    const q = parseListLine(lines[k]);
    if (q && q.indent === newIndent && q.ordered) num = q.num + 1;
  }
  const end = subtreeEnd(lines, i, cur.indent);
  const marker = markerText(cur, num);
  lines[i] = build(newIndent, marker, cur.rest);
  shift(lines, i + 1, end, newIndent + marker.length + 1 - cur.contentCol);
  return renumberBlock(lines, i);
}

/** Shift+Tab:变成父项后面的兄弟;标记跟随父项那一层(有序则接着父项编号) */
export function outdentItem(input: string[], i: number): string[] | null {
  const lines = input.slice();
  const cur = parseListLine(lines[i]);
  if (!cur || cur.indent === 0) return null;
  let parent: ListLine | null = null;
  for (let j = i - 1; j >= 0; j--) {
    if (blank(lines[j])) continue;
    const ind = lead(lines[j]);
    if (ind < cur.indent) {
      parent = parseListLine(lines[j]);
      if (!parent) return null;
      break;
    }
  }
  if (!parent) return null;
  const end = subtreeEnd(lines, i, cur.indent);
  const marker = parent.ordered ? `${parent.num + 1}${parent.mark}` : parent.mark;
  lines[i] = build(parent.indent, marker, cur.rest);
  shift(lines, i + 1, end, parent.indent + marker.length + 1 - cur.contentCol);
  return renumberBlock(lines, i);
}

/** 包含第 i 行的整个列表块:相邻的列表项、缩进的续行和其中的空行 */
export function listBlock(lines: string[], i: number): [number, number] {
  const inList = (k: number) => !!parseListLine(lines[k]) || (lead(lines[k]) > 0 && !blank(lines[k]));
  let a = i;
  while (a > 0 && (inList(a - 1) || (blank(lines[a - 1]) && a - 2 >= 0 && inList(a - 2)))) a--;
  let b = i;
  while (b < lines.length - 1 && (inList(b + 1) || (blank(lines[b + 1]) && b + 2 < lines.length && inList(b + 2)))) b++;
  return [a, b];
}

/**
 * 重新编号列表块里的有序列表:每一层按顺序递增。最外层保留第一项原来的起始号(比如故意从 3 开始),
 * 嵌套的子列表一律从 1 开始。
 * 一层里前两项号码相同(1. 1. 1. 这种「懒编号」写法)时,这一层保持不动。
 */
export function renumberBlock(input: string[], i: number): string[] {
  const lines = input.slice();
  const [a, b] = listBlock(lines, i);
  interface Level {
    indent: number;
    ordered: boolean;
    first: number;
    /** 第一项原来写的号,用来识别懒编号 */
    firstOrig: number;
    next: number;
    count: number;
    lazy: boolean;
    mark: string;
  }
  const stack: Level[] = [];
  for (let k = a; k <= b; k++) {
    if (blank(lines[k])) continue;
    const p = parseListLine(lines[k]);
    const ind = p ? p.indent : lead(lines[k]);
    while (stack.length && stack[stack.length - 1].indent > ind) stack.pop();
    if (!p) continue;
    let top = stack[stack.length - 1];
    if (top && top.indent === p.indent && top.ordered !== p.ordered) {
      stack.pop();
      top = stack[stack.length - 1];
    }
    if (!top || top.indent !== p.indent) {
      const nested = stack.length > 0;
      const first = p.ordered && nested ? 1 : p.num;
      if (p.ordered && first !== p.num) lines[k] = renum(lines[k], p, first);
      stack.push({ indent: p.indent, ordered: p.ordered, first, firstOrig: p.num, next: first + 1, count: 1, lazy: false, mark: p.mark });
      continue;
    }
    if (!p.ordered) continue;
    top.count++;
    if (top.count === 2 && p.num === top.firstOrig) top.lazy = true;
    if (top.lazy) continue;
    if (p.num !== top.next) lines[k] = renum(lines[k], p, top.next);
    top.next++;
  }
  return lines;
}

function renum(line: string, p: ListLine, n: number): string {
  return " ".repeat(p.indent) + `${n}${p.mark}` + line.replace(/\t/g, "    ").slice(p.indent + String(p.num).length + 1);
}
