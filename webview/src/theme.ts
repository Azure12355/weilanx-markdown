// 编辑器的基础样式。CodeMirror 自带的基础主题会给 .cm-scroller 写死 monospace 字体和 1.4 行高,
// 普通 CSS 的优先级不够;用 EditorView.theme 写的规则排在基础主题之后,一定生效。
import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--bg)",
    color: "var(--fg)",
    fontSize: "var(--md-font-size)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--md-font)",
    lineHeight: "var(--md-line-height)",
    overflow: "auto",
  },
  ".cm-content": {
    flex: "1 1 auto",
    width: "100%",
    maxWidth: "var(--md-max-width)",
    margin: "0 auto",
    padding: "56px 56px 40vh",
    caretColor: "var(--cursor)",
  },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--cursor)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--sel) !important",
  },
  // 源码模式:代码字体、紧凑行高
  "&.wmd-source .cm-scroller": { fontFamily: "var(--md-code-font)", lineHeight: "1.65" },
  "&.wmd-source .cm-content": { fontSize: "0.92em" },
});
