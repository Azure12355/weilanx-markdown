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

/** 把 CSS 变量(可能是 color-mix 表达式)解析成浏览器算好的 rgb 颜色 */
function cssColor(expr: string): string {
  const probe = document.createElement("span");
  probe.style.color = expr;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return toHex(c);
}

/** 浏览器给出的 rgb() / color(srgb …) 统一转成 #rrggbb(Mermaid 只认常见格式) */
function toHex(c: string): string {
  const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c);
  if (srgb) return "#" + [srgb[1], srgb[2], srgb[3]].map((v) => hex(Number(v) * 255)).join("");
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(c);
  if (rgb) return "#" + [rgb[1], rgb[2], rgb[3]].map((v) => hex(Number(v))).join("");
  return c;
}

/** Mermaid 的配色跟随编辑器主题:节点用淡强调色、连线用辅助色 */
function mermaidTheme() {
  const v = {
    background: cssColor("var(--bg)"),
    primaryColor: cssColor("color-mix(in srgb, var(--accent) 12%, var(--bg))"),
    primaryBorderColor: cssColor("color-mix(in srgb, var(--accent) 55%, var(--bg))"),
    primaryTextColor: cssColor("var(--heading)"),
    secondaryColor: cssColor("color-mix(in srgb, #2da44e 12%, var(--bg))"),
    tertiaryColor: cssColor("var(--surface)"),
    lineColor: cssColor("var(--muted)"),
    textColor: cssColor("var(--text)"),
    edgeLabelBackground: cssColor("var(--bg)"),
    clusterBkg: cssColor("var(--surface)"),
    clusterBorder: cssColor("var(--line)"),
    noteBkgColor: cssColor("color-mix(in srgb, #d4a72c 14%, var(--bg))"),
    noteBorderColor: cssColor("color-mix(in srgb, #d4a72c 50%, var(--bg))"),
    noteTextColor: cssColor("var(--text)"),
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--md-font") || "sans-serif",
    fontSize: "14px",
    darkMode: isDark(),
  };
  return v;
}

export async function renderMermaid(code: string): Promise<string> {
  const themeVariables = mermaidTheme();
  const key = JSON.stringify(themeVariables) + "\u0000" + code;
  const hit = mermaidCache.get(key);
  if (hit) return hit;
  const mermaid = await loadMermaid();
  mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables, securityLevel: "strict", flowchart: { curve: "basis", padding: 14 } });
  const { svg } = await mermaid.render(`wmd-mermaid-${++seq}`, code);
  mermaidCache.set(key, svg);
  return svg;
}

/**
 * 块级部件外面再包一层,用 padding 留出上下间距。
 * CodeMirror 量高度时不算 margin,块上有 margin 会让后面每一行的点击位置都偏掉
 */
function padded(el: HTMLElement, cls: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `wmd-block-pad ${cls}`;
  wrap.appendChild(el);
  return wrap;
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
    return padded(el, "wmd-pad-mermaid");
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

export class NumberWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(o: NumberWidget) {
    return o.text === this.text;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "wmd-number";
    el.textContent = this.text;
    return el;
  }
}

const CALLOUTS: Record<string, { zh: string; en: string; icon: string }> = {
  note: { zh: "说明", en: "Note", icon: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2V11M8 5V5.1"/>' },
  tip: { zh: "提示", en: "Tip", icon: '<path d="M6 12.5h4M6.5 14.5h3M8 1.8a4.3 4.3 0 0 0-2.6 7.7c.5.4.8 1 .8 1.6V11h3.6v-.1c0-.6.3-1.2.8-1.6A4.3 4.3 0 0 0 8 1.8z"/>' },
  important: { zh: "重要", en: "Important", icon: '<path d="M2.5 3.5h11v7.5H6l-3.5 2.8z"/><path d="M8 5.5V8M8 9.8v.1"/>' },
  warning: { zh: "注意", en: "Warning", icon: '<path d="M8 2.2L14.2 13H1.8z"/><path d="M8 6.5V9.3M8 11v.1"/>' },
  caution: { zh: "警告", en: "Caution", icon: '<path d="M5.4 1.8h5.2l3.6 3.6v5.2l-3.6 3.6H5.4L1.8 10.6V5.4z"/><path d="M8 5v3.5M8 10.6v.1"/>' },
};

export class CalloutTitleWidget extends WidgetType {
  constructor(readonly kind: string) {
    super();
  }
  eq(o: CalloutTitleWidget) {
    return o.kind === this.kind;
  }
  toDOM() {
    const def = CALLOUTS[this.kind] ?? CALLOUTS.note;
    const el = document.createElement("span");
    el.className = "wmd-callout-title";
    const zh = (env.config?.lang ?? "zh").toLowerCase().startsWith("zh");
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${def.icon}</svg><span>${zh ? def.zh : def.en}</span>`;
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
      if (view.state.readOnly) return;
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
    return padded(el, "wmd-pad-frontmatter");
  }
  ignoreEvent() {
    return false;
  }
}

