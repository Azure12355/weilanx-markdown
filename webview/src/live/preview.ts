// 实时预览:光标所在的行(多行块为整个块)显示源码,其余位置隐藏标记、渲染成最终效果。
// 只加装饰,不改文档 —— 文件内容永远等于用户敲进去的字符。
// 块级部件(图片、表格、公式、Mermaid)会改变行高,必须由 StateField 提供装饰。
import { EditorState, Facet, Range, RangeSet, StateEffect, StateField, Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { SyntaxNode, Tree } from "@lezer/common";
import { frontMatterRange } from "../../../src/core/outline";
import {
  BulletWidget,
  CheckboxWidget,
  CodeHeaderWidget,
  EmptyWidget,
  FrontMatterWidget,
  HrWidget,
  ImageWidget,
  MathWidget,
  MermaidWidget,
  TableWidget,
} from "./widgets";

/** 编辑器是否有焦点:失焦时整篇都显示渲染效果 */
export const setFocused = StateEffect.define<boolean>();
const focusField = StateField.define<boolean>({
  create: () => false,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setFocused)) v = e.value;
    return v;
  },
});

/** 阅读(锁定)模式:任何位置都不显示源码 */
export const readingMode = Facet.define<boolean, boolean>({ combine: (v) => v.some(Boolean) });

/** 光标覆盖到的行号集合 */
function activeLines(state: EditorState, focused: boolean): Set<number> {
  const s = new Set<number>();
  if (!focused || state.facet(readingMode)) return s;
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let i = a; i <= b; i++) s.add(i);
  }
  return s;
}

const hide = Decoration.replace({});
const line = (cls: string) => Decoration.line({ class: cls });
const mark = (cls: string) => Decoration.mark({ class: cls });

interface Ctx {
  doc: Text;
  active: Set<number>;
  out: Range<Decoration>[];
  fm: { from: number; to: number } | null;
}

function isActive(c: Ctx, from: number, to: number): boolean {
  if (!c.active.size) return false;
  const a = c.doc.lineAt(from).number;
  const b = c.doc.lineAt(Math.max(from, to)).number;
  for (let i = a; i <= b; i++) if (c.active.has(i)) return true;
  return false;
}

function add(c: Ctx, from: number, to: number, d: Decoration) {
  if (to < from) return;
  c.out.push(d.range(from, to));
}

function lineDeco(c: Ctx, pos: number, cls: string) {
  const l = c.doc.lineAt(pos);
  c.out.push(line(cls).range(l.from));
}

/** 隐藏一个标记,并顺带吃掉紧跟的一个空格(标题的「# 」、引用的「> 」) */
function hideWithSpace(c: Ctx, from: number, to: number) {
  const next = c.doc.sliceString(to, to + 1);
  add(c, from, next === " " ? to + 1 : to, hide);
}

function childrenOf(n: SyntaxNode, name: string): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let ch = n.firstChild; ch; ch = ch.nextSibling) if (ch.name === name) out.push(ch);
  return out;
}

function listDepth(n: SyntaxNode): number {
  let d = 0;
  for (let p = n.parent; p; p = p.parent) if (p.name === "BulletList" || p.name === "OrderedList") d++;
  return Math.max(0, d - 1);
}

/** 从块的第一行行首到最后一行行尾 */
function fullLines(c: Ctx, from: number, to: number) {
  return { from: c.doc.lineAt(from).from, to: c.doc.lineAt(to).to };
}

function decorateNode(c: Ctx, n: SyntaxNode): boolean | void {
  const { doc } = c;
  // front matter 区域由单独的逻辑处理,里面的节点(被误解析成分割线 / 标题)全部跳过
  if (c.fm && n.from < c.fm.to && n.name !== "Document") return false;
  const name = n.name;

  if (/^ATXHeading[1-6]$/.test(name)) {
    const lvl = name.slice(-1);
    lineDeco(c, n.from, `wmd-h wmd-h${lvl}`);
    if (!isActive(c, n.from, n.to)) {
      const marks = childrenOf(n, "HeaderMark");
      if (marks[0]) hideWithSpace(c, marks[0].from, marks[0].to);
      if (marks[1]) add(c, Math.max(n.from, marks[1].from - 1), marks[1].to, hide);
    }
    return;
  }

  if (name === "SetextHeading1" || name === "SetextHeading2") {
    const markNode = n.getChild("HeaderMark");
    const textEnd = markNode ? doc.lineAt(markNode.from).from - 1 : n.to;
    for (let pos = n.from; pos <= textEnd; ) {
      const l = doc.lineAt(pos);
      c.out.push(line(`wmd-h wmd-h${name.endsWith("1") ? 1 : 2}`).range(l.from));
      pos = l.to + 1;
    }
    if (markNode && !isActive(c, n.from, n.to)) {
      const ml = doc.lineAt(markNode.from);
      c.out.push(line("wmd-collapsed").range(ml.from));
      add(c, ml.from, ml.to, hide);
    }
    return;
  }

  if (name === "Emphasis" || name === "StrongEmphasis" || name === "Strikethrough") {
    if (name === "Strikethrough") add(c, n.from, n.to, mark("wmd-strike"));
    if (!isActive(c, n.from, n.to)) {
      const markName = name === "Strikethrough" ? "StrikethroughMark" : "EmphasisMark";
      for (const m of childrenOf(n, markName)) add(c, m.from, m.to, hide);
    }
    return;
  }

  if (name === "InlineCode") {
    add(c, n.from, n.to, mark("wmd-inline-code"));
    if (!isActive(c, n.from, n.to)) for (const m of childrenOf(n, "CodeMark")) add(c, m.from, m.to, hide);
    return false;
  }

  if (name === "Link") {
    const marks = childrenOf(n, "LinkMark");
    const url = n.getChild("URL");
    const active = isActive(c, n.from, n.to);
    // [文字](url):第一、二个 LinkMark 包着文字
    if (marks.length >= 2 && !active) {
      add(c, marks[0].from, marks[0].to, hide);
      add(c, marks[0].to, marks[1].from, Decoration.mark({ class: "wmd-link", attributes: { "data-href": url ? doc.sliceString(url.from, url.to) : "" } }));
      add(c, marks[1].from, n.to, hide);
    } else {
      add(c, n.from, n.to, mark("wmd-link-src"));
    }
    return false;
  }

  if (name === "Autolink" || (name === "URL" && n.parent?.name !== "Link" && n.parent?.name !== "Image")) {
    const url = name === "Autolink" ? doc.sliceString(n.from, n.to).replace(/^<|>$/g, "") : doc.sliceString(n.from, n.to);
    add(c, n.from, n.to, Decoration.mark({ class: "wmd-link", attributes: { "data-href": url } }));
    return false;
  }

  if (name === "Image") {
    const text = doc.sliceString(n.from, n.to);
    const m = /^!\[([^\]]*)\]\(\s*(<[^>]*>|[^\s)]*)/.exec(text);
    const alt = m?.[1] ?? "";
    const src = m?.[2] ?? "";
    if (!isActive(c, n.from, n.to)) {
      add(c, n.from, n.to, Decoration.replace({ widget: new ImageWidget(src, alt, n.from, n.to, false) }));
    } else {
      add(c, n.from, n.to, mark("wmd-link-src"));
      const l = doc.lineAt(n.to);
      c.out.push(Decoration.widget({ widget: new ImageWidget(src, alt, n.from, n.to, true), block: true, side: 1 }).range(l.to));
    }
    return false;
  }

  if (name === "FencedCode") {
    const info = n.getChild("CodeInfo");
    const lang = info ? doc.sliceString(info.from, info.to).trim().split(/\s+/)[0].toLowerCase() : "";
    const codeText = n.getChild("CodeText");
    const code = codeText ? doc.sliceString(codeText.from, codeText.to) : "";
    const active = isActive(c, n.from, n.to);
    const { from, to } = fullLines(c, n.from, n.to);
    if (lang === "mermaid") {
      if (!active) {
        add(c, from, to, Decoration.replace({ widget: new MermaidWidget(code, from), block: true }));
        return false;
      }
      c.out.push(Decoration.widget({ widget: new MermaidWidget(code, from), block: true, side: 1 }).range(to));
    }
    const first = doc.lineAt(from);
    const last = doc.lineAt(to);
    const marks = childrenOf(n, "CodeMark");
    const closed = marks.length >= 2;
    for (let pos = first.from; pos <= last.from; ) {
      const l = doc.lineAt(pos);
      let cls = "wmd-code";
      if (l.number === first.number) cls += " wmd-code-first";
      if (l.number === last.number && closed) cls += " wmd-code-last";
      c.out.push(line(cls).range(l.from));
      pos = l.to + 1;
    }
    if (!active) {
      add(c, first.from, first.to, Decoration.replace({ widget: new CodeHeaderWidget(lang, code) }));
      if (closed && last.number !== first.number) {
        c.out.push(line("wmd-code-fence-hidden").range(last.from));
        add(c, last.from, last.to, Decoration.replace({ widget: new EmptyWidget() }));
      }
    }
    return false;
  }

  if (name === "BlockMath") {
    const { from, to } = fullLines(c, n.from, n.to);
    const tex = doc.sliceString(n.from, n.to).replace(/^\s*\$\$/, "").replace(/\$\$\s*$/, "").trim();
    if (!isActive(c, n.from, n.to)) {
      add(c, from, to, Decoration.replace({ widget: new MathWidget(tex, true, from), block: true }));
    } else {
      for (let pos = from; pos <= to; ) {
        const l = doc.lineAt(pos);
        c.out.push(line("wmd-math-src").range(l.from));
        pos = l.to + 1;
      }
      c.out.push(Decoration.widget({ widget: new MathWidget(tex, true, from), block: true, side: 1 }).range(to));
    }
    return false;
  }

  if (name === "InlineMath") {
    if (!isActive(c, n.from, n.to)) {
      const tex = doc.sliceString(n.from + 1, n.to - 1);
      add(c, n.from, n.to, Decoration.replace({ widget: new MathWidget(tex, false, n.from) }));
    } else add(c, n.from, n.to, mark("wmd-math-src"));
    return false;
  }

  if (name === "Table") {
    const { from, to } = fullLines(c, n.from, n.to);
    if (!isActive(c, from, to)) {
      add(c, from, to, Decoration.replace({ widget: new TableWidget(doc.sliceString(from, to), from), block: true }));
    } else {
      for (let pos = from; pos <= to; ) {
        const l = doc.lineAt(pos);
        c.out.push(line("wmd-table-src").range(l.from));
        pos = l.to + 1;
      }
    }
    return false;
  }

  if (name === "Blockquote") {
    for (let pos = n.from; pos <= n.to; ) {
      const l = doc.lineAt(pos);
      c.out.push(line("wmd-quote").range(l.from));
      pos = l.to + 1;
    }
    return;
  }

  if (name === "QuoteMark") {
    if (!isActive(c, n.from, n.to)) hideWithSpace(c, n.from, n.to);
    return;
  }

  if (name === "HorizontalRule") {
    if (!isActive(c, n.from, n.to)) add(c, n.from, n.to, Decoration.replace({ widget: new HrWidget() }));
    return;
  }

  if (name === "ListItem") {
    const task = n.getChild("Task");
    const listMark = n.getChild("ListMark");
    const active = isActive(c, n.from, n.from);
    if (task) {
      const tm = task.getChild("TaskMarker");
      if (tm) {
        const checked = /x/i.test(doc.sliceString(tm.from, tm.to));
        if (checked) add(c, tm.to, doc.lineAt(tm.from).to, mark("wmd-task-done"));
        if (!active && listMark) {
          const end = doc.sliceString(tm.to, tm.to + 1) === " " ? tm.to + 1 : tm.to;
          add(c, listMark.from, end, Decoration.replace({ widget: new CheckboxWidget(checked, tm.from) }));
          return;
        }
      }
    }
    if (listMark && !active && n.parent?.name === "BulletList") {
      add(c, listMark.from, listMark.to, Decoration.replace({ widget: new BulletWidget(listDepth(n)) }));
    } else if (listMark && n.parent?.name === "OrderedList") {
      add(c, listMark.from, listMark.to, mark("wmd-ol-mark"));
    }
    return;
  }

  if (name === "HTMLBlock" || name === "CommentBlock" || name === "Comment") {
    add(c, n.from, n.to, mark("wmd-html"));
    return false;
  }
}

function build(state: EditorState, focused: boolean): DecorationSet {
  const tree: Tree = ensureSyntaxTree(state, state.doc.length, 300) ?? syntaxTree(state);
  const doc = state.doc;
  const c: Ctx = { doc, active: activeLines(state, focused), out: [], fm: frontMatterRange(doc.sliceString(0, Math.min(doc.length, 20000))) };

  if (c.fm) {
    const { from, to } = { from: 0, to: doc.lineAt(c.fm.to).to };
    if (!isActive(c, from, to)) {
      const body = doc.sliceString(doc.line(2).from, doc.lineAt(to).from).replace(/\n$/, "");
      add(c, from, to, Decoration.replace({ widget: new FrontMatterWidget(body, from), block: true }));
    } else {
      for (let pos = from; pos <= to; ) {
        const l = doc.lineAt(pos);
        c.out.push(line("wmd-fm-src").range(l.from));
        pos = l.to + 1;
      }
    }
  }

  tree.iterate({ enter: (ref) => decorateNode(c, ref.node) });

  // 段落之间的空行:单独控制高度(段落间距)
  const codeRanges: [number, number][] = [];
  tree.iterate({
    enter: (ref) => {
      if (ref.name === "FencedCode" || ref.name === "BlockMath") {
        codeRanges.push([ref.from, ref.to]);
        return false;
      }
    },
  });
  for (let i = 1; i <= doc.lines; i++) {
    const l = doc.line(i);
    if (l.length === 0 && !codeRanges.some(([a, b]) => l.from > a && l.from < b) && !(c.fm && l.from <= c.fm.to)) c.out.push(line("wmd-blank").range(l.from));
  }

  return RangeSet.of(c.out, true);
}

const previewField = StateField.define<{ deco: DecorationSet; key: string }>({
  create(state) {
    return { deco: build(state, false), key: "" };
  },
  update(value, tr) {
    const focused = tr.state.field(focusField);
    const key = focused ? [...activeLines(tr.state, true)].join(",") : "";
    const focusChanged = tr.effects.some((e) => e.is(setFocused)) || tr.startState.facet(readingMode) !== tr.state.facet(readingMode);
    // 文档、语法树或光标所在行变化时才重算
    if (!tr.docChanged && !focusChanged && key === value.key && syntaxTree(tr.state) === syntaxTree(tr.startState)) return value;
    return { deco: build(tr.state, focused), key };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

export function livePreview(reading = false) {
  return [
    readingMode.of(reading),
    focusField,
    previewField,
    EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing)),
  ];
}
