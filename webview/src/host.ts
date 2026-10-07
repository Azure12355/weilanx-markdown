// webview ↔ 扩展端。VS Code 里走 acquireVsCodeApi;浏览器预览(npm run dev:web / 无头测试)时用内存模拟
import type { ToHost, ToView } from "../../src/core/protocol";
import { SAMPLE } from "./sample";

export interface Host {
  kind: "vscode" | "preview";
  post(msg: ToHost): void;
  subscribe(handler: (msg: ToView) => void): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage(msg: unknown): void };
    /** 预览模式的测试钩子 */
    __wmd?: {
      text(): string;
      external(changes: { offset: number; length: number; text: string }[]): void;
      sent: ToHost[];
    };
  }
}

/** 预览模式模拟 VS Code:把主题变量写到 <html> 上,和真实 webview 一致 */
function simulateVsCodeTheme() {
  const dark = new URLSearchParams(location.search).get("dark") === "1";
  document.body.classList.add(dark ? "vscode-dark" : "vscode-light");
  const vars: Record<string, string> = dark
    ? { "editor-background": "#1e1f22", "editor-foreground": "#d4d4d4", "descriptionForeground": "#9da1a6", "textLink-foreground": "#4daafc", "editorWidget-background": "#25262a", "panel-border": "#3a3c42", "textCodeBlock-background": "#2a2c31", "editor-selectionBackground": "#264f78", "focusBorder": "#3794ff" }
    : { "editor-background": "#ffffff", "editor-foreground": "#1f2328", "descriptionForeground": "#6b7079", "textLink-foreground": "#2f6feb", "editorWidget-background": "#ffffff", "panel-border": "#e4e4e7", "textCodeBlock-background": "#f3f4f6", "editor-selectionBackground": "#add6ff", "focusBorder": "#2f7bff" };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(`--vscode-${k}`, v);
}

function previewHost(): Host {
  simulateVsCodeTheme();
  const handlers: ((m: ToView) => void)[] = [];
  const emit = (m: ToView) => setTimeout(() => handlers.forEach((h) => h(m)));
  let text = new URLSearchParams(location.search).has("empty") ? "" : SAMPLE;
  const sent: ToHost[] = [];
  let n = 0;
  const config = () => ({
    typography: { size: 0, family: "sans", headingFamily: "", codeFamily: "editor", lineHeight: 1.75, maxWidth: 860, paragraphSpacing: 0.8 },
    editor: { fontSize: 15, fontFamily: "Menlo, monospace" },
    docBase: location.origin + "/",
    rootBase: location.origin + "/",
    lang: new URLSearchParams(location.search).get("lang") ?? "zh-cn",
    altText: "fileName" as const,
    downloadRemote: false,
    docName: "preview",
    defaultMode: (new URLSearchParams(location.search).get("mode") as "read" | "live" | "source") ?? "live",
    agents: ["claude", "codex"] as ("claude" | "codex")[],
    agentToolbar: true,
  });
  window.__wmd = {
    text: () => text,
    sent,
    external(changes) {
      for (const c of [...changes].sort((a, b) => b.offset - a.offset)) text = text.slice(0, c.offset) + c.text + text.slice(c.offset + c.length);
      emit({ type: "external", changes, length: text.length });
    },
  };
  return {
    kind: "preview",
    post(m) {
      sent.push(m);
      if (m.type === "ready") emit({ type: "init", text, config: config() });
      else if (m.type === "changes") {
        if (m.baseLength !== text.length) return emit({ type: "reset", text });
        let t = text;
        for (const [from, to, insert] of [...m.changes].sort((a, b) => b[0] - a[0])) t = t.slice(0, from) + insert + t.slice(to);
        text = t;
      } else if (m.type === "upload") {
        for (const it of m.items) emit({ type: "uploaded", id: it.id, markdown: `![${it.name?.replace(/\.[^.]+$/, "") ?? "image"}](assets/preview/paste-${++n}.png)` });
      } else if (m.type === "clipboardFallback") {
        emit({ type: "uploaded", id: m.id, markdown: `![clip](assets/preview/clip-${++n}.png)` });
      } else console.log("[preview]", m);
    },
    subscribe: (h) => handlers.push(h),
  };
}

function vscodeHost(): Host {
  const api = window.acquireVsCodeApi!();
  return {
    kind: "vscode",
    post: (m) => api.postMessage(m),
    subscribe: (h) => window.addEventListener("message", (e) => h(e.data as ToView)),
  };
}

export const host: Host = window.acquireVsCodeApi ? vscodeHost() : previewHost();
