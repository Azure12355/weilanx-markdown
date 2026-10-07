import * as vscode from "vscode";
import { MarkdownController, MarkdownEditorProvider, ViewCommand } from "./editor";
import { StatsBar } from "./statusBar";
import { askAgent, updateAgentContext } from "./agent";
import type { AgentTarget } from "../core/protocol";

export function activate(context: vscode.ExtensionContext) {
  const stats = new StatsBar(context);
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
    "weilanxMarkdown.cycleMode": "cycleMode",
    "weilanxMarkdown.modeRead": "modeRead",
    "weilanxMarkdown.modeLive": "modeLive",
    "weilanxMarkdown.modeSource": "modeSource",
  };
  for (const [id, command] of Object.entries(forward)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, () => MarkdownController.active?.runCommand(command)));
  }

  // 选中文字 → 发给 Agent(快捷键、命令面板、右键菜单)
  updateAgentContext();
  context.subscriptions.push(vscode.extensions.onDidChange(updateAgentContext));
  const ask: Record<string, AgentTarget> = {
    "weilanxMarkdown.askAgent": "default",
    "weilanxMarkdown.askClaude": "claude",
    "weilanxMarkdown.askCodex": "codex",
    "weilanxMarkdown.copyQuote": "copy",
  };
  for (const [id, target] of Object.entries(ask)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => {
        const c = MarkdownController.active;
        if (c) return askAgent(c.document, c.selections, target);
      })
    );
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

  // 给集成测试用的接口
  return {
    stats: () => {
      stats.refreshNow();
      return stats.snapshot();
    },
    activeEditor: () => !!MarkdownController.active,
    ask: (target: AgentTarget, ranges: [number, number][]) => {
      const c = MarkdownController.active;
      return c ? askAgent(c.document, ranges, target) : Promise.resolve();
    },
  };
}

export function deactivate() {}
