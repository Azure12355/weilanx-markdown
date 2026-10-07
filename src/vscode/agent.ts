// 选中文字 → 发给侧边栏 Agent(Claude Code / Codex)
// 这两个插件的「加入对话」命令都只读 activeTextEditor 的选区,自定义编辑器用不了,
// 所以改成:引用块写进剪贴板 → 聚焦 Agent 输入框 → 执行粘贴(VS Code 会转发给聚焦的 webview)
import * as vscode from "vscode";
import type { AgentId, AgentTarget } from "../core/protocol";
import { buildQuote } from "../core/agentQuote";
import { t } from "./i18n";

const EXTENSIONS: Record<AgentId, string> = {
  claude: "anthropic.claude-code",
  codex: "openai.chatgpt",
};
const NAMES: Record<AgentId, string> = { claude: "Claude Code", codex: "Codex" };

export function installedAgents(): AgentId[] {
  return (Object.keys(EXTENSIONS) as AgentId[]).filter((a) => !!vscode.extensions.getExtension(EXTENSIONS[a]));
}

/** 右键菜单按是否安装显示对应项 */
export function updateAgentContext() {
  const agents = installedAgents();
  void vscode.commands.executeCommand("setContext", "weilanxMarkdown.hasClaude", agents.includes("claude"));
  void vscode.commands.executeCommand("setContext", "weilanxMarkdown.hasCodex", agents.includes("codex"));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryCommand(id: string): Promise<boolean> {
  try {
    await vscode.commands.executeCommand(id);
    return true;
  } catch {
    return false;
  }
}

/** 打开 Agent 面板并把焦点放进输入框 */
async function focusAgent(agent: AgentId): Promise<boolean> {
  if (agent === "claude") {
    // 面板没打开时它会按用户偏好(侧边栏或标签页)打开最近的会话,再聚焦输入框
    return tryCommand("claude-vscode.focus");
  }
  return tryCommand("chatgpt.openSidebar");
}

export async function askAgent(document: vscode.TextDocument, ranges: [number, number][], target: AgentTarget): Promise<void> {
  const c = vscode.workspace.getConfiguration("weilanxMarkdown", document.uri);
  const text = document.getText();
  const quote = buildQuote(text, ranges, {
    path: vscode.workspace.asRelativePath(document.uri),
    maxLines: c.get<number>("agent.maxQuoteLines", 40),
    zh: vscode.env.language.toLowerCase().startsWith("zh"),
  });
  if (!quote) {
    vscode.window.setStatusBarMessage(t("agentNoSelection"), 3000);
    return;
  }
  // 引用块留在剪贴板里:自动粘贴没生效时,用户直接 ⌘V 就行
  await vscode.env.clipboard.writeText(quote);
  if (target === "copy") {
    vscode.window.setStatusBarMessage(t("agentCopied"), 3000);
    return;
  }

  const installed = installedAgents();
  let agent: AgentId = target === "default" ? c.get<AgentId>("agent.default", "claude") : target;
  if (!installed.includes(agent)) {
    if (target !== "default" || !installed.length) {
      vscode.window.showWarningMessage(t("agentMissing", NAMES[agent]));
      return;
    }
    agent = installed[0];
  }

  if (!(await focusAgent(agent))) {
    vscode.window.showWarningMessage(t("agentFocusFailed", NAMES[agent]));
    return;
  }
  // 等面板和输入框就绪再粘贴
  await sleep(350);
  await tryCommand("editor.action.clipboardPasteAction");
  vscode.window.setStatusBarMessage(t("agentSent", NAMES[agent]), 5000);
}
