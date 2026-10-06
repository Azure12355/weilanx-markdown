// 实时预览用到的各种小部件
import { EditorView, WidgetType } from "@codemirror/view";
import katex from "katex";
import { env, isDark, resolveSrc } from "../env";
import { t } from "../i18n";

// ---------- 图片 ----------

export class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string, readonly from: number, readonly to: number, readonly block: boolean) {
    super();
  }
  eq(o: ImageWidget) {
    return o.src === this.src && o.alt === this.alt && o.block === this.block && o.from === this.from && o.to === this.to;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement(this.block ? "div" : "span");
    wrap.className = "wmd-image" + (this.block ? " wmd-image-block" : "");
    wrap.dataset.src = this.src;
    wrap.dataset.from = String(this.from);
    wrap.dataset.to = String(this.to);
    const url = resolveSrc(this.src);
    const img = document.createElement("img");
    img.alt = this.alt;
    img.draggable = false;
    if (url) img.src = url;
    img.onerror = () => {
      wrap.classList.add("wmd-image-broken");
      wrap.textContent = `🖼 ${t("imageMissing")}:${this.src}`;
    };
    img.onload = () => view.requestMeasure();
    wrap.appendChild(img);
    if (!url) img.onerror?.(new Event("error"));
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

// ---------- 代码块标题行 ----------

export class CodeHeaderWidget extends WidgetType {
  constructor(readonly lang: string, readonly code: string) {
    super();
  }
  eq(o: CodeHeaderWidget) {
    return o.lang === this.lang && o.code === this.code;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "wmd-code-header";
    const lang = document.createElement("span");
    lang.className = "wmd-code-lang";
    lang.textContent = this.lang || "text";
    const btn = document.createElement("button");
    btn.className = "wmd-code-copy";
    btn.textContent = t("copy");
    btn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      void navigator.clipboard?.writeText(this.code).then(() => {
        btn.textContent = t("copied");
        setTimeout(() => (btn.textContent = t("copy")), 1200);
      });
    };
    el.append(lang, btn);
    return el;
  }
  ignoreEvent(e: Event) {
    return (e.target as HTMLElement).classList?.contains("wmd-code-copy");
  }
}

/** 隐藏代码块结束围栏时,用一个空部件占位,保持行存在 */
export class EmptyWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "wmd-empty";
    return el;
  }
}

// ---------- 公式 ----------

export class MathWidget extends WidgetType {
  constructor(readonly tex: string, readonly display: boolean, readonly pos: number) {
    super();
  }
  eq(o: MathWidget) {
    return o.tex === this.tex && o.display === this.display && o.pos === this.pos;
  }
  toDOM() {
    const el = document.createElement(this.display ? "div" : "span");
    el.className = this.display ? "wmd-math-block" : "wmd-math-inline";
    el.dataset.pos = String(this.pos);
    try {
      katex.render(this.tex, el, { displayMode: this.display, throwOnError: false, output: "htmlAndMathml" });
    } catch (err) {
      el.textContent = (err as Error).message;
      el.classList.add("wmd-error");
    }
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

// ---------- Mermaid ----------

const mermaidCache = new Map<string, string>();
let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;
let seq = 0;

function loadMermaid() {
  return (mermaidLoader ??= import("mermaid").then((m) => m.default));
}

export async function renderMermaid(code: string): Promise<string> {
  const theme = isDark() ? "dark" : "default";
  const key = theme + "\u0000" + code;
  const hit = mermaidCache.get(key);
  if (hit) return hit;
  const mermaid = await loadMermaid();
  mermaid.initialize({ startOnLoad: false, theme, securityLevel: "strict", fontFamily: "inherit" });
  const { svg } = await mermaid.render(`wmd-mermaid-${++seq}`, code);
  mermaidCache.set(key, svg);
  return svg;
}

export class MermaidWidget extends WidgetType {
  constructor(readonly code: string, readonly pos: number) {
    super();
  }
  eq(o: MermaidWidget) {
    return o.code === this.code && o.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const el = document.createElement("div");
    el.className = "wmd-mermaid";
    el.dataset.pos = String(this.pos);
    el.textContent = t("rendering");
    renderMermaid(this.code)
      .then((svg) => {
        el.innerHTML = svg;
        view.requestMeasure();
      })
      .catch((err) => {
        el.classList.add("wmd-error");
        el.textContent = `Mermaid: ${(err as Error).message ?? err}`;
        document.querySelectorAll('[id^="dwmd-mermaid-"]').forEach((n) => n.remove());
        view.requestMeasure();
      });
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

// ---------- 表格 ----------

export type Align = "left" | "center" | "right" | "";

/** 拆一行表格:去掉首尾竖线,按未转义的 | 分列 */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  let code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (c === "`") {
      code = !code;
      cur += c;
    } else if (c === "|" && !code) {
      cells.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

export function parseAlign(delim: string): Align[] {
  return splitRow(delim).map((c) => {
    const l = c.startsWith(":");
    const r = c.endsWith(":");
    return l && r ? "center" : r ? "right" : l ? "left" : "";
  });
}

/** 表格单元格里的行内 Markdown:只做最常用的几种,够预览用 */
export function inlineHtml(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => `<img alt="${alt}" src="${resolveSrc(src)}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a data-href="$2">$1</a>');
}

export class TableWidget extends WidgetType {
  constructor(readonly source: string, readonly pos: number) {
    super();
  }
  eq(o: TableWidget) {
    return o.source === this.source && o.pos === this.pos;
  }
  toDOM() {
    const lines = this.source.split("\n").filter((l) => l.trim());
    const wrap = document.createElement("div");
    wrap.className = "wmd-table";
    wrap.dataset.pos = String(this.pos);
    const table = document.createElement("table");
    const aligns = lines[1] ? parseAlign(lines[1]) : [];
    const row = (cells: string[], tag: "th" | "td") => {
      const tr = document.createElement("tr");
      cells.forEach((c, i) => {
        const cell = document.createElement(tag);
        if (aligns[i]) cell.style.textAlign = aligns[i];
        cell.innerHTML = inlineHtml(c);
        tr.appendChild(cell);
      });
      return tr;
    };
    const thead = document.createElement("thead");
    thead.appendChild(row(splitRow(lines[0] ?? ""), "th"));
    const tbody = document.createElement("tbody");
    for (const l of lines.slice(2)) tbody.appendChild(row(splitRow(l), "td"));
    table.append(thead, tbody);
    wrap.appendChild(table);
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

// ---------- 列表 / 任务 / 分割线 / front matter ----------

export class BulletWidget extends WidgetType {
  constructor(readonly depth: number) {
    super();
  }
  eq(o: BulletWidget) {
    return o.depth === this.depth;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "wmd-bullet";
    el.textContent = ["•", "◦", "▪"][this.depth % 3];
    return el;
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly markerPos: number) {
    super();
  }
  eq(o: CheckboxWidget) {
    return o.checked === this.checked && o.markerPos === this.markerPos;
  }
  toDOM(view: EditorView) {
    const el = document.createElement("span");
    el.className = "wmd-checkbox" + (this.checked ? " wmd-checked" : "");
    el.setAttribute("role", "checkbox");
    el.setAttribute("aria-checked", String(this.checked));
    el.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 只改方括号里的那个字符,其余原文不动
      view.dispatch({ changes: { from: this.markerPos + 1, to: this.markerPos + 2, insert: this.checked ? " " : "x" } });
    };
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

export class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "wmd-hr";
    return el;
  }
}

export class FrontMatterWidget extends WidgetType {
  constructor(readonly body: string, readonly pos: number) {
    super();
  }
  eq(o: FrontMatterWidget) {
    return o.body === this.body;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "wmd-frontmatter";
    el.dataset.pos = String(this.pos);
    const title = document.createElement("div");
    title.className = "wmd-fm-title";
    title.textContent = t("properties");
    el.appendChild(title);
    for (const line of this.body.split("\n")) {
      const m = /^([\w.-]+)\s*:\s*(.*)$/.exec(line);
      const row = document.createElement("div");
      row.className = "wmd-fm-row";
      if (m) {
        const k = document.createElement("span");
        k.className = "wmd-fm-key";
        k.textContent = m[1];
        const v = document.createElement("span");
        v.className = "wmd-fm-val";
        v.textContent = m[2];
        row.append(k, v);
      } else {
        row.textContent = line;
        row.classList.add("wmd-fm-raw");
      }
      if (line.trim()) el.appendChild(row);
    }
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

