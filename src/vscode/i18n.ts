import * as vscode from "vscode";

const zh = {
  altPrompt: "图片的替代文字(alt)",
  imageFailed: "图片保存失败:{0}",
  linkNotFound: "找不到链接的文件:{0}",
  savedUser: "已保存到用户设置",
  savedWorkspace: "已保存到当前工作区设置",
  noBrowser: "没有找到 Chrome / Edge,无法导出 PDF。可以在设置 weilanxMarkdown.export.browserPath 里指定浏览器路径。",
  exportHtmlInstead: "改为导出 HTML",
  exportingPdf: "正在导出 PDF…",
  exported: "已导出到 {0}",
  exportFailed: "导出失败:{0}",
  reveal: "在访达中显示",
  copied: "已复制图片路径",
  delete: "删除",
  confirmDelete: "把「{0}」移到废纸篓,并删除文中的这张图片?",
  agentNoSelection: "先选中一段文字",
  agentCopied: "$(check) 引用已复制",
  agentSent: "$(check) 已发送到 {0}，没出现的话在输入框里按 ⌘V",
  agentMissing: "没有安装 {0} 插件",
  agentFocusFailed: "打不开 {0} 的对话框，引用已复制，可以手动粘贴",
};

const en: typeof zh = {
  altPrompt: "Alt text for the image",
  imageFailed: "Failed to save image: {0}",
  linkNotFound: "Linked file not found: {0}",
  savedUser: "Saved to user settings",
  savedWorkspace: "Saved to workspace settings",
  noBrowser: "Chrome / Edge not found, so PDF export isn't available. Set weilanxMarkdown.export.browserPath to a browser executable.",
  exportHtmlInstead: "Export HTML instead",
  exportingPdf: "Exporting PDF…",
  exported: "Exported to {0}",
  exportFailed: "Export failed: {0}",
  reveal: "Reveal in File Explorer",
  copied: "Image path copied",
  delete: "Delete",
  confirmDelete: "Move “{0}” to the trash and remove the image from this note?",
  agentNoSelection: "Select some text first",
  agentCopied: "$(check) Quote copied",
  agentSent: "$(check) Sent to {0}. If it doesn't appear, press Cmd+V in the chat box",
  agentMissing: "The {0} extension isn't installed",
  agentFocusFailed: "Couldn't open the {0} chat. The quote is on your clipboard, paste it there",
};

export function t(key: keyof typeof zh, ...args: string[]): string {
  const dict = vscode.env.language.toLowerCase().startsWith("zh") ? zh : en;
  return dict[key].replace(/\{(\d)\}/g, (_m, i) => args[Number(i)] ?? "");
}
