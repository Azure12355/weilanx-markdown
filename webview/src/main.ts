// webview 入口:CodeMirror 6 编辑器 + 实时预览 + 粘贴图片 + 字体 + 大纲 + 导出
import { EditorState } from "@codemirror/state";
import { EditorView, KeyBinding, keymap, drawSelection, dropCursor, rectangularSelection, highlightSpecialChars } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { syntaxHighlighting, indentOnInput, bracketMatching } from "@codemirror/language";
import { markdown, markdownLanguage, markdownKeymap } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { classHighlighter } from "@lezer/highlight";
import "katex/dist/katex.min.css";
import "./style.css";
import { host } from "./host";
import { env } from "./env";
import { setLang, t } from "./i18n";
import { livePreview } from "./live/preview";
import { mathExtension } from "./live/math";
import { pasteHandlers, resolvePending } from "./paste";
import { applyExternal, resetDoc, syncListener } from "./sync";
import { formatTable, insertLink, toggleWrap } from "./format";
import { initTypography, togglePanel, zoomBy } from "./typography";
import { initOutline, refreshOutline, scheduleOutline } from "./outline";
import { renderForExport } from "./export";
import type { ToView } from "../../src/core/protocol";

const app = document.getElementById("app")!;
app.className = "wmd-root";
app.innerHTML = `
  <aside class="wmd-outline" id="outline"></aside>
  <div class="wmd-main">
    <div class="wmd-toolbar">
      <button id="btn-outline" class="wmd-tb" title=""><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 3.5H4M6.5 3.5H13.5M4.5 8H6M8.5 8H13.5M4.5 12.5H6M8.5 12.5H13.5"/></svg></button>
      <button id="btn-type" class="wmd-tb wmd-tb-aa" title="">Aa</button>
      <button id="btn-export" class="wmd-tb" title=""><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2V10M5 5L8 2L11 5M3 9V13.5H13V9"/></svg></button>
    </div>
    <div class="wmd-editor" id="editor"></div>
  </div>`;

const inVsCode = host.kind === "vscode";

// VS Code 会把撤销、加粗等按键先交给自己的快捷键处理(扩展注册了同名命令再转发回来),
// 所以在 VS Code 里这些键不能再由编辑器处理一次,否则会执行两遍
const hostKeys: KeyBinding[] = inVsCode
  ? []
  : [
      { key: "Mod-b", run: (v) => toggleWrap(v, "**") },
      { key: "Mod-i", run: (v) => toggleWrap(v, "*") },
      { key: "Mod-k", run: insertLink },
      { key: "Mod-Alt-=", run: () => (zoomBy(1), true) },
      { key: "Mod-Alt--", run: () => (zoomBy(-1), true) },
      { key: "Mod-Alt-0", run: () => (zoomBy(null), true) },
      ...historyKeymap,
    ];

let view: EditorView;

function createView(text: string) {
  view?.destroy();
  view = new EditorView({
    parent: document.getElementById("editor")!,
    state: EditorState.create({
      doc: text,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        highlightSpecialChars(),
        indentOnInput(),
        bracketMatching(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages: languages, extensions: [mathExtension] }),
        syntaxHighlighting(classHighlighter),
        keymap.of([...hostKeys, ...markdownKeymap, indentWithTab, ...defaultKeymap]),
        livePreview(),
        pasteHandlers(),
        syncListener(),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) scheduleOutline();
        }),
        EditorView.domEventHandlers({
          mousedown: onMouseDown,
          contextmenu: onContextMenu,
        }),
        EditorView.contentAttributes.of({ spellcheck: "false" }),
      ],
    }),
  });
  initOutline(document.getElementById("outline")!, view);
  // 浏览器预览模式下给测试脚本用
  if (!inVsCode) Object.assign(window, { __wmdView: view, __wmdUndo: () => undo(view) });
}

/** ⌘ / Ctrl + 点击链接打开;点击渲染好的块(表格、公式、图表)时把光标放进源码 */
function onMouseDown(e: MouseEvent, v: EditorView): boolean {
  const target = e.target as HTMLElement;
  const link = target.closest<HTMLElement>("[data-href]");
  if (link && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    const href = link.dataset.href ?? "";
    if (href) env.post({ type: "openLink", href });
    return true;
  }
  const block = target.closest<HTMLElement>(".wmd-table, .wmd-math-block, .wmd-mermaid, .wmd-frontmatter, .wmd-math-inline");
  if (block?.dataset.pos && e.button === 0) {
    e.preventDefault();
    const pos = Number(block.dataset.pos);
    const line = v.state.doc.lineAt(pos);
    v.dispatch({ selection: { anchor: block.classList.contains("wmd-math-inline") ? pos + 1 : line.to } });
    v.focus();
    return true;
  }
  const img = target.closest<HTMLElement>(".wmd-image:not(.wmd-image-block)");
  if (img?.dataset.from && e.button === 0) {
    e.preventDefault();
    v.dispatch({ selection: { anchor: Number(img.dataset.to) } });
    v.focus();
    return true;
  }
  return false;
}

// ---------- 图片右键菜单 ----------

let menu: HTMLElement | null = null;
function closeMenu() {
  menu?.remove();
  menu = null;
}
function onContextMenu(e: MouseEvent): boolean {
  const img = (e.target as HTMLElement).closest<HTMLElement>(".wmd-image");
  if (!img?.dataset.src) return false;
  e.preventDefault();
  closeMenu();
  menu = document.createElement("div");
  menu.className = "wmd-menu";
  const src = img.dataset.src;
  const from = Number(img.dataset.from);
  const to = Number(img.dataset.to);
  const items: [string, "reveal" | "copyPath" | "delete"][] = [
    [t("revealImage"), "reveal"],
    [t("copyImagePath"), "copyPath"],
    [t("deleteImage"), "delete"],
  ];
  for (const [label, action] of items) {
    const b = document.createElement("button");
    b.textContent = label;
    if (action === "delete") b.className = "danger";
    b.onclick = () => {
      env.post({ type: "imageAction", action, src, from, to });
      closeMenu();
    };
    menu.appendChild(b);
  }
  menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
  menu.style.top = `${Math.min(e.clientY, window.innerHeight - 120)}px`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener("mousedown", (ev) => !menu?.contains(ev.target as Node) && closeMenu(), { once: true }));
  return true;
}

// ---------- 导出菜单 ----------

async function doExport(format: "html" | "pdf") {
  const { body, title } = await renderForExport(view.state.doc.toString(), env.config?.docName ?? "document");
  env.post({ type: "export", format, body, title });
}

function toggleExportMenu(anchor: HTMLElement) {
  if (menu) return closeMenu();
  menu = document.createElement("div");
  menu.className = "wmd-menu";
  for (const [label, f] of [
    [t("exportHtml"), "html"],
    [t("exportPdf"), "pdf"],
  ] as const) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      closeMenu();
      void doExport(f);
    };
    menu.appendChild(b);
  }
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.left = `${Math.max(8, r.right - 180)}px`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener("mousedown", (ev) => !menu?.contains(ev.target as Node) && closeMenu(), { once: true }));
}

function toggleOutline() {
  app.classList.toggle("wmd-outline-open");
  localStorage.setItem("wmd-outline", app.classList.contains("wmd-outline-open") ? "1" : "0");
  requestAnimationFrame(() => view?.requestMeasure());
}

// ---------- 工具栏 ----------

const btnOutline = document.getElementById("btn-outline")!;
const btnType = document.getElementById("btn-type")!;
const btnExport = document.getElementById("btn-export")!;
btnOutline.onclick = toggleOutline;
btnType.onclick = () => togglePanel(btnType);
btnExport.onclick = () => toggleExportMenu(btnExport);
if (localStorage.getItem("wmd-outline") !== "0") app.classList.add("wmd-outline-open");

function applyConfig(cfg: NonNullable<typeof env.config>) {
  env.config = cfg;
  env.docBase = cfg.docBase;
  env.rootBase = cfg.rootBase;
  setLang(cfg.lang);
  btnOutline.title = t("outline");
  btnType.title = t("typography");
  btnExport.title = t("export");
  initTypography(cfg.typography, cfg.editor, () => view?.requestMeasure());
}

// ---------- 宿主消息 ----------

host.subscribe((m: ToView) => {
  switch (m.type) {
    case "init":
      applyConfig(m.config);
      createView(m.text);
      refreshOutline();
      break;
    case "config":
      applyConfig(m.config);
      break;
    case "external":
      if (!applyExternal(view, m.changes, m.length)) host.post({ type: "ready" });
      break;
    case "reset":
      resetDoc(view, m.text);
      break;
    case "uploaded":
      resolvePending(view, m.id, m.markdown);
      break;
    case "command":
      runCommand(m.command);
      break;
  }
});

function runCommand(c: Extract<ToView, { type: "command" }>["command"]) {
  if (!view) return;
  switch (c) {
    case "undo":
      undo(view);
      break;
    case "redo":
      redo(view);
      break;
    case "bold":
      toggleWrap(view, "**");
      break;
    case "italic":
      toggleWrap(view, "*");
      break;
    case "link":
      insertLink(view);
      break;
    case "zoomIn":
      zoomBy(1);
      break;
    case "zoomOut":
      zoomBy(-1);
      break;
    case "zoomReset":
      zoomBy(null);
      break;
    case "export-html":
      void doExport("html");
      break;
    case "export-pdf":
      void doExport("pdf");
      break;
    case "toggleOutline":
      toggleOutline();
      break;
    case "formatTable":
      formatTable(view);
      break;
  }
}

// 主题切换(VS Code 改 body class)时重绘 Mermaid 等依赖暗色的部件
new MutationObserver(() => view?.dispatch({})).observe(document.body, { attributes: true, attributeFilter: ["class"] });

host.post({ type: "ready" });
