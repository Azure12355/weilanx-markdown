// Lezer Markdown 扩展:行内公式 $…$ 与块级公式 $$…$$
import type { MarkdownConfig } from "@lezer/markdown";

const DOLLAR = 36;
const BACKSLASH = 92;
const SPACE = 32;

export const mathExtension: MarkdownConfig = {
  defineNodes: [{ name: "InlineMath" }, { name: "InlineMathMark" }, { name: "BlockMath", block: true }, { name: "BlockMathMark" }],
  parseInline: [
    {
      name: "InlineMath",
      before: "Emphasis",
      parse(cx, next, pos) {
        if (next !== DOLLAR || cx.char(pos + 1) === DOLLAR) return -1;
        // $ 后不能紧跟空格(避免把「$5 和 $10」当成公式)
        if (cx.char(pos + 1) === SPACE || pos + 1 >= cx.end) return -1;
        let end = pos + 1;
        for (; end < cx.end; end++) {
          const c = cx.char(end);
          if (c === BACKSLASH) {
            end++;
            continue;
          }
          if (c === DOLLAR) break;
        }
        if (end >= cx.end || cx.char(end - 1) === SPACE) return -1;
        // 结尾 $ 后面紧跟数字时不算公式(「$5 to $10」)
        const after = cx.char(end + 1);
        if (after >= 48 && after <= 57) return -1;
        return cx.addElement(cx.elt("InlineMath", pos, end + 1, [cx.elt("InlineMathMark", pos, pos + 1), cx.elt("InlineMathMark", end, end + 1)]));
      },
    },
  ],
  parseBlock: [
    {
      name: "BlockMath",
      before: "FencedCode",
      parse(cx, line) {
        if (line.next !== DOLLAR || line.text.charCodeAt(line.pos + 1) !== DOLLAR) return false;
        const from = cx.lineStart + line.pos;
        const marks = [cx.elt("BlockMathMark", from, from + 2)];
        // 同一行闭合:$$ x $$
        const rest = line.text.slice(line.pos + 2);
        const close = rest.indexOf("$$");
        if (close >= 0) {
          const s = from + 2 + close;
          marks.push(cx.elt("BlockMathMark", s, s + 2));
          const end = cx.lineStart + line.text.length;
          cx.nextLine();
          cx.addElement(cx.elt("BlockMath", from, end, marks));
          return true;
        }
        let end = cx.lineStart + line.text.length;
        while (cx.nextLine()) {
          const idx = line.text.indexOf("$$");
          end = cx.lineStart + line.text.length;
          if (idx >= 0) {
            const s = cx.lineStart + idx;
            marks.push(cx.elt("BlockMathMark", s, s + 2));
            cx.nextLine();
            break;
          }
        }
        cx.addElement(cx.elt("BlockMath", from, end, marks));
        return true;
      },
      endLeaf: (_cx, line) => line.next === DOLLAR && line.text.charCodeAt(line.pos + 1) === DOLLAR,
    },
  ],
};
