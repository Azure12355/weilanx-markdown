// 扩展端 ↔ webview 的消息
import type { EditorFont, TypographySettings } from "./typography";

/** [from, to, insert]:基于修改前的文档坐标,与 CodeMirror ChangeSet / WorkspaceEdit 的语义一致 */
export type Change = [number, number, string];

export interface ViewConfig {
  typography: TypographySettings;
  editor: EditorFont;
  /** 当前文档目录、工作区根目录对应的 webview 资源地址,用来显示相对路径图片 */
  docBase: string;
  rootBase: string;
  lang: string;
  altText: "empty" | "fileName" | "prompt";
  downloadRemote: boolean;
  docName: string;
  /** 打开时的模式:锁定 / 编辑 / 源码 */
  defaultMode: "read" | "live" | "source";
}

export interface UploadItem {
  /** 占位符 id */
  id: string;
  name?: string;
  mime?: string;
  /** base64 */
  data?: string;
  /** 已有文件的 URI(从 VS Code 资源管理器拖入) */
  uri?: string;
  /** 远程图片地址 */
  url?: string;
}

export type ToHost =
  | { type: "ready" }
  | { type: "changes"; seq: number; baseLength: number; changes: Change[] }
  | { type: "upload"; items: UploadItem[]; alt: string }
  | { type: "clipboardFallback"; id: string; alt: string }
  | { type: "openLink"; href: string }
  | { type: "saveTypography"; target: "user" | "workspace"; values: Partial<TypographySettings> }
  | { type: "export"; format: "html" | "pdf"; body: string; title: string }
  | { type: "imageAction"; action: "reveal" | "copyPath" | "delete"; src: string; from: number; to: number }
  | { type: "notify"; message: string }
  | { type: "selection"; ranges: [number, number][] };

export type ToView =
  | { type: "init"; text: string; config: ViewConfig }
  | { type: "config"; config: ViewConfig }
  | { type: "external"; changes: { offset: number; length: number; text: string }[]; length: number }
  | { type: "reset"; text: string }
  | { type: "uploaded"; id: string; markdown?: string; error?: string }
  | { type: "command"; command: "undo" | "redo" | "bold" | "italic" | "link" | "zoomIn" | "zoomOut" | "zoomReset" | "export-html" | "export-pdf" | "toggleOutline" | "formatTable" | "cycleMode" | "modeRead" | "modeLive" | "modeSource" };
