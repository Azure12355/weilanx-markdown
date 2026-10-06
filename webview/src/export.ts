// 导出:在 webview 里把 Markdown 渲染成 HTML 正文(公式转 MathML、Mermaid 转 SVG),交给扩展端内嵌图片并写文件
import MarkdownIt from "markdown-it";
import markdownItKatex from "@vscode/markdown-it-katex";
import katex from "katex";
import { frontMatterRange } from "../../src/core/outline";
import { renderMermaid } from "./live/widgets";

// 导出文件里用 MathML:浏览器原生渲染,不需要额外的 CSS 和字体
// markdown-it-katex 自带一份 katex 类型声明,这里用 any 绕开两份声明的细微差异
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mathmlKatex: any = { ...katex, renderToString: (tex: string, opts?: object) => katex.renderToString(tex, { ...(opts as object), output: "mathml" }) };

function createMd() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
  md.use(markdownItKatex, { katex: mathmlKatex, throwOnError: false });
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const tok = tokens[idx];
    if (tok.info.trim().split(/\s+/)[0] === "mermaid") return `<div class="mermaid" data-src="${encodeURIComponent(tok.content)}"></div>\n`;
    return fence(tokens, idx, opts, env, self);
  };
  // 任务列表:- [ ] / - [x] → 复选框
  md.core.ruler.after("inline", "wmd-tasks", (state) => {
    const toks = state.tokens;
    for (let i = 2; i < toks.length; i++) {
      const tk = toks[i];
      if (tk.type !== "inline" || toks[i - 1].type !== "paragraph_open" || toks[i - 2].type !== "list_item_open") continue;
      const m = /^\[([ xX])\]\s/.exec(tk.content);
      if (!m || !tk.children?.length) continue;
      const first = tk.children[0];
      first.content = first.content.replace(/^\[[ xX]\]\s/, "");
      const box = new state.Token("html_inline", "", 0);
      box.content = `<input type="checkbox" disabled${m[1] !== " " ? " checked" : ""}> `;
      tk.children.unshift(box);
      toks[i - 2].attrJoin("class", "task-list-item");
    }
  });
  return md;
}

export async function renderForExport(markdown: string, docName: string): Promise<{ body: string; title: string }> {
  const fm = frontMatterRange(markdown);
  const src = fm ? markdown.slice(fm.to).replace(/^\r?\n/, "") : markdown;
  const md = createMd();
  const holder = document.createElement("div");
  holder.innerHTML = md.render(src);
  for (const el of Array.from(holder.querySelectorAll<HTMLElement>("div.mermaid"))) {
    try {
      el.innerHTML = await renderMermaid(decodeURIComponent(el.dataset.src ?? ""));
    } catch (err) {
      el.textContent = `Mermaid: ${(err as Error).message}`;
    }
    el.removeAttribute("data-src");
  }
  const title = holder.querySelector("h1")?.textContent?.trim() || docName;
  return { body: holder.innerHTML, title };
}
