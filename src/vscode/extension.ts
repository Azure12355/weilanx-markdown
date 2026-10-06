import * as vscode from "vscode";
import { MarkdownController, MarkdownEditorProvider, ViewCommand } from "./editor";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(MarkdownEditorProvider.register(context));

  // 编辑器内的快捷键和命令:VS Code 会先按自己的快捷键处理按键,所以注册成命令再转发给编辑器
  const forward: Record<string, ViewCommand> = {
    "weilanxMarkdown.undo": "undo",
    "weilanxMarkdown.redo": "redo",
    "weilanxMarkdown.bold": "bold",
    "weilanxMarkdown.italic": "italic",
    "weilanxMarkdown.link": "link",
    "weilanxMarkdown.zoomIn": "zoomIn",
    "weilanxMarkdown.zoomOut": "zoomOut",
    "weilanxMarkdown.zoomReset": "zoomReset",
    "weilanxMarkdown.exportHtml": "export-html",
    "weilanxMarkdown.exportPdf": "export-pdf",
    "weilanxMarkdown.toggleOutline": "toggleOutline",
    "weilanxMarkdown.formatTable": "formatTable",
  };
  for (const [id, command] of Object.entries(forward)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, () => MarkdownController.active?.runCommand(command)));
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("weilanxMarkdown.openAsText", async (uri?: vscode.Uri) => {
      const target = uri ?? (vscode.window.tabGroups.activeTabGroup.activeTab?.input as { uri?: vscode.Uri } | undefined)?.uri;
      if (target) await vscode.commands.executeCommand("vscode.openWith", target, "default");
    }),
    vscode.commands.registerCommand("weilanxMarkdown.openAsLivePreview", async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (target) await vscode.commands.executeCommand("vscode.openWith", target, MarkdownEditorProvider.viewType);
    })
  );
}

export function deactivate() {}
