// 系统剪贴板兜底:webview 的 paste 事件拿不到图片时,由扩展端直接读系统剪贴板
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type ClipboardImage = { kind: "bitmap"; file: string } | { kind: "files"; files: string[] } | null;

function run(cmd: string, args: string[], timeout = 8000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? ((err as NodeJS.ErrnoException & { code?: number }).code as unknown as number) || 1 : 0, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function tmpFile(ext: string): string {
  return path.join(os.tmpdir(), `wmd-clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`);
}

function nonEmpty(file: string): boolean {
  try {
    return fs.statSync(file).size > 0;
  } catch {
    return false;
  }
}

async function readMac(): Promise<ClipboardImage> {
  // 1. 复制的文件(访达里 ⌘C)
  const files = await run("osascript", [
    "-e",
    'try\nset l to (the clipboard as «class furl»)\nreturn POSIX path of l\non error\nreturn ""\nend try',
  ]);
  const p = files.stdout.trim();
  if (p && fs.existsSync(p)) return { kind: "files", files: [p] };
  // 2. 位图(截图、复制图片):依次尝试 PNG / TIFF
  for (const [cls, ext] of [
    ["«class PNGf»", "png"],
    ["TIFF picture", "tiff"],
  ] as const) {
    const out = tmpFile(ext);
    const script = `try
set d to (the clipboard as ${cls})
set f to open for access (POSIX file "${out}") with write permission
set eof f to 0
write d to f
close access f
return "ok"
on error
try
close access (POSIX file "${out}")
end try
return ""
end try`;
    const r = await run("osascript", ["-e", script]);
    if (r.stdout.trim() === "ok" && nonEmpty(out)) {
      if (ext === "tiff") {
        // TIFF 转 PNG,浏览器和 Markdown 渲染都更通用
        const png = tmpFile("png");
        const s = await run("sips", ["-s", "format", "png", out, "--out", png]);
        if (s.code === 0 && nonEmpty(png)) return { kind: "bitmap", file: png };
      }
      return { kind: "bitmap", file: out };
    }
  }
  return null;
}

async function readWindows(): Promise<ClipboardImage> {
  const out = tmpFile("png");
  const ps = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing;
$f = [System.Windows.Forms.Clipboard]::GetFileDropList(); if ($f.Count -gt 0) { $f | ForEach-Object { Write-Output ("FILE:" + $_) }; exit 0 }
$img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img -ne $null) { $img.Save('${out.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png); Write-Output "IMG" }`;
  const r = await run("powershell", ["-NoProfile", "-STA", "-Command", ps]);
  const lines = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const files = lines.filter((l) => l.startsWith("FILE:")).map((l) => l.slice(5));
  if (files.length) return { kind: "files", files };
  if (lines.includes("IMG") && nonEmpty(out)) return { kind: "bitmap", file: out };
  return null;
}

async function readLinux(): Promise<ClipboardImage> {
  const out = tmpFile("png");
  const r = await run("sh", ["-c", `xclip -selection clipboard -t image/png -o > '${out}' 2>/dev/null || wl-paste --type image/png > '${out}' 2>/dev/null`]);
  if (r.code === 0 && nonEmpty(out)) return { kind: "bitmap", file: out };
  return null;
}

/** 读取系统剪贴板里的图片或图片文件;没有时返回 null */
export async function readClipboardImage(): Promise<ClipboardImage> {
  try {
    if (process.platform === "darwin") return await readMac();
    if (process.platform === "win32") return await readWindows();
    return await readLinux();
  } catch {
    return null;
  }
}
