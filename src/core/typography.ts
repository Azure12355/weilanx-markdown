// 字体与排版:设置项 → 实际的字体栈和数值。扩展端(导出)和 webview(编辑器)共用

export interface TypographySettings {
  /** 0 = 跟随 editor.fontSize */
  size: number;
  /** sans | serif | mono | editor | 自定义字体栈 */
  family: string;
  /** 空 = 同正文 */
  headingFamily: string;
  /** editor = 跟随 editor.fontFamily */
  codeFamily: string;
  lineHeight: number;
  /** px,0 = 铺满 */
  maxWidth: number;
  /** 段落间距(em) */
  paragraphSpacing: number;
}

export interface EditorFont {
  fontSize: number;
  fontFamily: string;
}

export interface ResolvedTypography {
  fontSize: number;
  fontFamily: string;
  headingFamily: string;
  codeFamily: string;
  lineHeight: number;
  maxWidth: number;
  paragraphSpacing: number;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  size: 0,
  family: "sans",
  headingFamily: "",
  codeFamily: "editor",
  lineHeight: 1.75,
  maxWidth: 860,
  paragraphSpacing: 0.8,
};

const CJK_SANS = `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC"`;
const CJK_SERIF = `"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", SimSun`;

export const PRESETS: Record<string, string> = {
  sans: `-apple-system, BlinkMacSystemFont, ${CJK_SANS}, Inter, "Segoe UI", system-ui, sans-serif`,
  serif: `${CJK_SERIF}, Georgia, "Times New Roman", serif`,
};

function monoStack(editorFamily: string): string {
  return `${editorFamily || "Menlo, Consolas, monospace"}, ${CJK_SANS}, monospace`;
}

function familyOf(value: string, editor: EditorFont, fallback: string): string {
  const v = value.trim();
  if (!v) return fallback;
  if (v === "sans" || v === "serif") return PRESETS[v];
  if (v === "mono") return monoStack(editor.fontFamily);
  if (v === "editor") return `${editor.fontFamily}, ${CJK_SANS}`;
  return `${v}, ${CJK_SANS}, sans-serif`;
}

const clamp = (n: number, a: number, b: number, d: number) => (Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d);

export function resolveTypography(s: TypographySettings, editor: EditorFont): ResolvedTypography {
  const body = familyOf(s.family, editor, PRESETS.sans);
  return {
    fontSize: s.size > 0 ? clamp(s.size, 8, 48, 15) : clamp(editor.fontSize, 8, 48, 15),
    fontFamily: body,
    headingFamily: familyOf(s.headingFamily, editor, body),
    codeFamily: s.codeFamily.trim() === "editor" || !s.codeFamily.trim() ? monoStack(editor.fontFamily) : familyOf(s.codeFamily, editor, monoStack(editor.fontFamily)),
    lineHeight: clamp(s.lineHeight, 1, 3, 1.75),
    maxWidth: s.maxWidth > 0 ? clamp(s.maxWidth, 400, 3000, 860) : 0,
    paragraphSpacing: clamp(s.paragraphSpacing, 0, 3, 0.8),
  };
}
