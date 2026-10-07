# 选中文字 → 问 Agent

## 目标

在 Weilanx Markdown 里选中一段文字，一键把「文件路径 + 行号 + 所在章节 + 原文」封装成引用块，送进侧边栏 Agent（Claude Code、Codex）的输入框，用户接着写 prompt。

## 约束（调研结论）

- Claude Code 的 `claude-vscode.insertAtMention`、Codex 的 `chatgpt.addToThread` 都不收参数，只读 `activeTextEditor` 的选区；自定义编辑器不是 TextEditor，无法直接调用。
- 因此走「剪贴板 + 聚焦输入框 + 粘贴」：VS Code 会把 `editor.action.clipboardPasteAction` 转发给当前聚焦的 webview。

## 交互

- 浮动工具条：选区非空且鼠标松开（或用键盘选中）后，在选区上方居中弹出；离顶部太近时放到下方。按钮：Claude Code、Codex（只显示已安装的）、复制引用。打字、Esc、点击别处、滚动时消失。
- 快捷键 `⌘⌥L`：发给默认 Agent（`weilanxMarkdown.agent.default`）。
- webview 右键菜单（`webview/context`）也有这三项。

## 引用块格式

```
> 📄 相对路径.md · 第 12–15 行 · 章节：一、先搞懂…
>
> 选中的原文（保留 Markdown 原样）

```

- 路径相对工作区；没有工作区时用绝对路径。
- 章节：选区起点之前最近的标题（跳过代码块里的 `#`）。
- 超过 `weilanxMarkdown.agent.maxQuoteLines`（默认 40）行时，保留开头和结尾各一半，中间写省略说明。
- 中英文随 VS Code 语言。

## 发送流程（扩展端）

1. 生成引用块，写入剪贴板（保留在剪贴板里，作为自动粘贴失败时的兜底）。
2. 聚焦输入框：Claude Code 先 `claudeVSCodeSidebarSecondary.focus`（失败则 `claudeVSCodeSidebar.focus`）再 `claude-vscode.focus`；Codex 调 `chatgpt.openSidebar`。
3. 短暂等待后执行 `editor.action.clipboardPasteAction`。
4. 状态栏提示「已发送到 Claude Code，没出现就按 ⌘V」。

## 设置

- `weilanxMarkdown.agent.default`：`claude` / `codex`
- `weilanxMarkdown.agent.toolbar`：是否显示浮动工具条
- `weilanxMarkdown.agent.maxQuoteLines`：长选区截断行数

## 测试

- `src/core/agentQuote.ts` 纯函数单测：行号、章节、截断、代码块里的 `#`、多段选区。
- 浮动条在浏览器预览里用 playwright-cli 验证。
- 自动粘贴在真实 VS Code 里实测。
