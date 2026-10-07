// 选中文字后的浮动工具条:问 Claude Code / 问 Codex / 复制引用
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { env } from "./env";
import { t } from "./i18n";
import type { AgentTarget } from "../../src/core/protocol";

const ICONS: Record<string, string> = {
  claude: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.2l1.05 4.1 3.75-1.95-2.3 3.55 4.3.6-4.3.75 2.3 3.5-3.75-1.95L8 13.9l-1.05-4.1L3.2 11.75l2.3-3.5-4.3-.75 4.3-.6-2.3-3.55 3.75 1.95z"/></svg>`,
  codex: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 6L3.5 8l2 2M8.5 10.5h4"/><rect x="1.5" y="2.5" width="13" height="11" rx="2.5"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="5" y="5" width="8.5" height="8.5" rx="1.8"/><path d="M11 5V3.8A1.3 1.3 0 0 0 9.7 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.9A1.3 1.3 0 0 0 3.8 11H5"/></svg>`,
};

let bar: HTMLElement | null = null;
let pointerDown = false;
let lastX: number | null = null;
let timer = 0;

export function hideAgentBar() {
  clearTimeout(timer);
  bar?.remove();
  bar = null;
}

/** 当前非空选区。锁定模式下编辑器不可编辑,CodeMirror 不跟踪选区,改从 DOM 选区换算 */
export function selectedRanges(view: EditorView): [number, number][] {
  const ranges = view.state.selection.ranges.filter((r) => !r.empty).map((r) => [r.from, r.to] as [number, number]);
  if (ranges.length || view.contentDOM.isContentEditable) return ranges;
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || !sel.anchorNode || !sel.focusNode || !view.contentDOM.contains(sel.anchorNode)) return [];
  try {
    const a = view.posAtDOM(sel.anchorNode, sel.anchorOffset);
    const b = view.posAtDOM(sel.focusNode, sel.focusOffset);
    return a === b ? [] : [[Math.min(a, b), Math.max(a, b)]];
  } catch {
    return [];
  }
}

function buttons(): [AgentTarget, string, string][] {
  const agents = env.config?.agents ?? [];
  const out: [AgentTarget, string, string][] = [];
  if (agents.includes("claude")) out.push(["claude", ICONS.claude, "Claude Code"]);
  if (agents.includes("codex")) out.push(["codex", ICONS.codex, "Codex"]);
  out.push(["copy", ICONS.copy, t("copyQuote")]);
  return out;
}

function show(view: EditorView) {
  hideAgentBar();
  if (env.config && !env.config.agentToolbar) return;
  const ranges = selectedRanges(view);
  if (!ranges.length) return;
  const from = Math.min(...ranges.map((r) => r[0]));
  const to = Math.max(...ranges.map((r) => r[1]));
  const a = view.coordsAtPos(from, 1);
  const b = view.coordsAtPos(to, -1);
  if (!a && !b) return;

  bar = document.createElement("div");
  bar.className = "wmd-agentbar";
  bar.setAttribute("role", "toolbar");
  for (const [target, icon, label] of buttons()) {
    const btn = document.createElement("button");
    btn.className = `wmd-agentbar-btn wmd-agent-${target}`;
    btn.innerHTML = `${icon}<span>${label}</span>`;
    if (target !== "copy") btn.title = `${label} · ${t("askAgentHint")}`;
    // 按下时不抢焦点,保住编辑器里的选区
    btn.onmousedown = (e) => e.preventDefault();
    btn.onclick = () => {
      env.post({ type: "askAgent", agent: target, ranges: selectedRanges(view).length ? selectedRanges(view) : ranges });
      hideAgentBar();
    };
    bar.appendChild(btn);
  }
  document.body.appendChild(bar);

  // 放在选区上方;离顶部工具栏太近或起点已滚出视口时放到下方
  const scroller = view.scrollDOM.getBoundingClientRect();
  const w = bar.offsetWidth;
  const h = bar.offsetHeight;
  const sameLine = a && b && Math.abs(a.top - b.top) < 4;
  let x = sameLine ? (a!.left + b!.right) / 2 : (lastX ?? (a ?? b)!.left);
  x = Math.max(scroller.left + 8, Math.min(x - w / 2, scroller.right - w - 8));
  let y = a && a.top - h - 8 >= scroller.top + 56 ? a.top - h - 8 : (b ?? a)!.bottom + 8;
  y = Math.min(y, window.innerHeight - h - 8);
  bar.style.left = `${x}px`;
  bar.style.top = `${y}px`;
}

function schedule(view: EditorView, delay: number) {
  clearTimeout(timer);
  timer = window.setTimeout(() => show(view), delay);
}

export function agentBar(): Extension {
  return [
    EditorView.updateListener.of((u) => {
      if (u.docChanged || u.focusChanged) {
        // 打字时收起;失去焦点但选区还在(比如点了工具条)时保持
        if (u.docChanged) hideAgentBar();
        return;
      }
      if (u.selectionSet && !pointerDown) {
        if (u.state.selection.main.empty) hideAgentBar();
        // 键盘选中(Shift + 方向键):停顿一下再出现,避免连按时闪烁
        else schedule(u.view, 350);
      }
    }),
    EditorView.domEventHandlers({
      mousedown: (e) => {
        if (bar?.contains(e.target as Node)) return false;
        pointerDown = true;
        hideAgentBar();
        return false;
      },
      keydown: (e) => {
        if (e.key === "Escape" && bar) {
          hideAgentBar();
          return true;
        }
        return false;
      },
      scroll: () => {
        hideAgentBar();
        return false;
      },
    }),
  ];
}

/** 鼠标松开(可能在编辑器外)后再判断是否有选区 */
export function initAgentBar(getView: () => EditorView | undefined) {
  document.addEventListener("mouseup", (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    lastX = e.clientX;
    const v = getView();
    if (v) schedule(v, 10);
  });
  document.addEventListener("mousedown", (e) => {
    if (bar && !bar.contains(e.target as Node) && !getView()?.dom.contains(e.target as Node)) hideAgentBar();
  });
  window.addEventListener("blur", () => (pointerDown = false));
}
