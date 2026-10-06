// 集成测试本体:在 VS Code 扩展宿主里运行
import * as vscode from "vscode";
import * as assert from "node:assert/strict";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(fn: () => T, ok: (v: T) => boolean, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  let v = fn();
  while (!ok(v) && Date.now() < end) {
    await sleep(200);
    v = fn();
  }
  return v;
}

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension("weilanx.weilanx-markdown")!;
  const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, "doc.md");
  const results: string[] = [];

  // 1. 实时预览编辑器打开后底栏显示
  await vscode.commands.executeCommand("vscode.openWith", uri, "weilanxMarkdown.editor");
  await ext.activate();
  const api = ext.exports as { stats(): { text: string; visible: boolean }; activeEditor(): boolean };
  const s1 = await waitFor(() => api.stats(), (s) => s.visible);
  results.push(`live preview: visible=${s1.visible} active=${api.activeEditor()} text=${s1.text}`);
  assert.ok(api.activeEditor(), "实时预览编辑器应被识别为当前编辑器");
  assert.ok(s1.visible, "实时预览里底栏应显示");
  assert.match(s1.text, /字|words/);

  // 2. 普通文本编辑器
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  const doc = await vscode.workspace.openTextDocument(uri);
  const ed = await vscode.window.showTextDocument(doc);
  const s2 = await waitFor(() => api.stats(), (s) => s.visible);
  results.push(`text editor: visible=${s2.visible} text=${s2.text}`);
  assert.ok(s2.visible, "普通文本编辑器里底栏应显示");

  // 3. 选中文字
  ed.selection = new vscode.Selection(2, 0, 2, 9);
  const s3 = await waitFor(() => api.stats(), (s) => /已选| of /.test(s.text));
  results.push(`selection: text=${s3.text}`);
  assert.match(s3.text, /已选| of /);

  // 4. 关掉所有编辑器后隐藏
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  const s4 = await waitFor(() => api.stats(), (s) => !s.visible);
  results.push(`closed: visible=${s4.visible}`);
  assert.ok(!s4.visible);

  console.log("\n" + results.join("\n") + "\n");
}
