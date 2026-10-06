// 导出 PDF:把导出的 HTML 交给系统里的 Chrome / Edge / Chromium 无头打印,不打包浏览器
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const CANDIDATES: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Arc.app/Contents/MacOS/Arc",
  ],
  win32: [
    `${process.env["PROGRAMFILES"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env["PROGRAMFILES"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge", "/snap/bin/chromium"],
};

export function findBrowser(custom?: string): string | null {
  if (custom && fs.existsSync(custom)) return custom;
  for (const p of CANDIDATES[process.platform] ?? CANDIDATES.linux) if (p && fs.existsSync(p)) return p;
  return null;
}

export function printToPdf(browser: string, htmlFile: string, pdfFile: string): Promise<void> {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=5000",
    `--print-to-pdf=${pdfFile}`,
    pathToFileURL(htmlFile).href,
  ];
  return new Promise((resolve, reject) => {
    execFile(browser, args, { timeout: 60000 }, (err, _out, stderr) => {
      if (fs.existsSync(pdfFile) && fs.statSync(pdfFile).size > 0) return resolve();
      reject(new Error(err ? `${err.message}\n${stderr}`.trim() : "浏览器没有生成 PDF"));
    });
  });
}

export function siblingPath(docPath: string, ext: string): string {
  return path.join(path.dirname(docPath), path.basename(docPath, path.extname(docPath)) + ext);
}
