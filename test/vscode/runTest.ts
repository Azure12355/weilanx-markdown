// 在真实的 VS Code(测试专用实例)里跑集成测试:npm run test:vscode
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { runTests } from "@vscode/test-electron";

async function main() {
  const root = path.resolve(__dirname, "../..");
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "wmd-it-"));
  fs.writeFileSync(path.join(ws, "doc.md"), "# 标题\n\n这是一段中文正文，用来统计字数。Hello world!\n\n- 列表项\n");
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "out/test/suite.js"),
    launchArgs: [ws, "--disable-extensions", "--locale=zh-cn", "--skip-welcome", "--skip-release-notes"],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
