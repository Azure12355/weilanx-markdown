// 大纲侧栏:按标题生成目录,点击跳转,随滚动高亮当前章节
import { EditorView } from "@codemirror/view";
import { extractHeadings, type Heading } from "../../src/core/outline";
import { t } from "./i18n";

let headings: Heading[] = [];
let listEl: HTMLElement;
let view: EditorView;
let current = -1;

export function initOutline(container: HTMLElement, v: EditorView) {
  view = v;
  container.innerHTML = "";
  const title = document.createElement("div");
  title.className = "wmd-outline-title";
  title.textContent = t("outline");
  listEl = document.createElement("div");
  listEl.className = "wmd-outline-list";
  container.append(title, listEl);
  view.scrollDOM.addEventListener("scroll", () => requestAnimationFrame(highlight), { passive: true });
  refreshOutline();
}

let timer = 0;
export function scheduleOutline() {
  clearTimeout(timer);
  timer = window.setTimeout(refreshOutline, 250);
}

export function refreshOutline() {
  if (!listEl) return;
  headings = extractHeadings(view.state.doc.toString());
  listEl.innerHTML = "";
  if (!headings.length) {
    const empty = document.createElement("div");
    empty.className = "wmd-outline-empty";
    empty.textContent = t("noHeadings");
    listEl.appendChild(empty);
    return;
  }
  const minLevel = Math.min(...headings.map((h) => h.level));
  headings.forEach((h, i) => {
    const a = document.createElement("a");
    a.className = `wmd-outline-item lv${h.level - minLevel + 1}`;
    a.textContent = h.text || "—";
    a.title = h.text;
    a.onclick = () => {
      const line = view.state.doc.line(Math.min(h.line + 1, view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.to }, effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 24 }) });
      view.focus();
    };
    a.dataset.i = String(i);
    listEl.appendChild(a);
  });
  current = -1;
  highlight();
}

function highlight() {
  if (!headings.length) return;
  const top = view.scrollDOM.scrollTop + 40;
  let idx = 0;
  for (let i = 0; i < headings.length; i++) {
    const line = view.state.doc.line(Math.min(headings[i].line + 1, view.state.doc.lines));
    if (view.lineBlockAt(line.from).top <= top) idx = i;
    else break;
  }
  if (idx === current) return;
  current = idx;
  listEl.querySelectorAll(".active").forEach((n) => n.classList.remove("active"));
  const el = listEl.querySelector(`[data-i="${idx}"]`);
  el?.classList.add("active");
  (el as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
}
