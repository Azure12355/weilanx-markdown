// webview 全局环境:宿主给的路径基址、暗色模式、语言
import type { ViewConfig } from "../../src/core/protocol";
import { host } from "./host";

export const env = {
  docBase: "",
  rootBase: "",
  lang: "zh-cn",
  config: null as ViewConfig | null,
  post: host.post,
};

export function isDark(): boolean {
  const c = document.body.classList;
  if (c.contains("vscode-light") || c.contains("vscode-high-contrast-light")) return false;
  if (c.contains("vscode-dark") || c.contains("vscode-high-contrast")) return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Markdown 里的图片地址 → 可在 webview 里加载的 URL */
export function resolveSrc(raw: string): string {
  let src = raw.trim().replace(/^<|>$/g, "");
  if (!src) return "";
  if (/^(https?:|data:|blob:|vscode-)/i.test(src)) return src;
  if (/^file:/i.test(src)) return "";
  try {
    src = decodeURIComponent(src);
  } catch {
    /* 保持原样 */
  }
  const [p, suffix = ""] = src.split(/(?=[?#])/);
  const encoded = p.split("/").map(encodeURIComponent).join("/");
  if (p.startsWith("/")) return env.rootBase + encoded.slice(1) + suffix;
  return env.docBase + encoded + suffix;
}
