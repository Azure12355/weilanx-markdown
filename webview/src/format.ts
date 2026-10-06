// 编辑辅助:加粗 / 斜体 / 链接,格式化表格
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { parseAlign, splitRow } from "./live/widgets";

/** 用标记包住选区;已经包着时去掉 */
export function toggleWrap(view: EditorView, markText: string): boolean {
  const n = markText.length;
  view.dispatch(
    view.state.changeByRange((r) => {
      const doc = view.state.doc;
      const before = doc.sliceString(r.from - n, r.from);
      const after = doc.sliceString(r.to, r.to + n);
      if (before === markText && after === markText) {
        return {
          changes: [
            { from: r.from - n, to: r.from },
            { from: r.to, to: r.to + n },
          ],
          range: EditorSelection.range(r.from - n, r.to - n),
        };
      }
      return {
        changes: [
          { from: r.from, insert: markText },
          { from: r.to, insert: markText },
        ],
        range: EditorSelection.range(r.from + n, r.to + n),
      };
    })
  );
  return true;
}

export function insertLink(view: EditorView): boolean {
  view.dispatch(
    view.state.changeByRange((r) => {
      const label = view.state.sliceDoc(r.from, r.to);
      const insert = `[${label}]()`;
      // 有文字时光标进括号里填网址;没文字时光标进方括号里填文字
      const cursor = label ? r.from + insert.length - 1 : r.from + 1;
      return { changes: { from: r.from, to: r.to, insert }, range: EditorSelection.cursor(cursor) };
    })
  );
  return true;
}

/** 中日韩等宽字符按 2 计宽,让等宽字体下竖线对齐 */
function width(s: string): number {
  let w = 0;
  for (const ch of s) w += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1;
  return w;
}

export function formatTableText(text: string): string {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return text;
  const rows = lines.map(splitRow);
  const aligns = parseAlign(lines[1]);
  const cols = Math.max(...rows.map((r) => r.length));
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const body = rows.filter((_, i) => i !== 1).map((r) => Array.from({ length: cols }, (_, i) => esc(r[i] ?? "")));
  const w = Array.from({ length: cols }, (_, i) => Math.max(3, ...body.map((r) => width(r[i]))));
  const pad = (s: string, n: number, a: string) => {
    const gap = n - width(s);
    if (a === "right") return " ".repeat(gap) + s;
    if (a === "center") return " ".repeat(Math.floor(gap / 2)) + s + " ".repeat(Math.ceil(gap / 2));
    return s + " ".repeat(gap);
  };
  const line = (r: string[]) => "| " + r.map((c, i) => pad(c, w[i], aligns[i] ?? "")).join(" | ") + " |";
  const delim =
    "| " +
    w
      .map((n, i) => {
        const a = aligns[i] ?? "";
        if (a === "center") return ":" + "-".repeat(n - 2) + ":";
        if (a === "right") return "-".repeat(n - 1) + ":";
        if (a === "left") return ":" + "-".repeat(n - 1);
        return "-".repeat(n);
      })
      .join(" | ") +
    " |";
  return [line(body[0]), delim, ...body.slice(1).map(line)].join("\n");
}

export function formatTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  let node = syntaxTree(view.state).resolveInner(pos, -1);
  while (node && node.name !== "Table") node = node.parent!;
  if (!node) return false;
  const from = view.state.doc.lineAt(node.from).from;
  const to = view.state.doc.lineAt(node.to).to;
  const text = view.state.sliceDoc(from, to);
  const next = formatTableText(text);
  if (next !== text) view.dispatch({ changes: { from, to, insert: next } });
  return true;
}
