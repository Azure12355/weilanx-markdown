// 图片存储路径:模板展开、重名处理、链接生成。只依赖 node:path,便于单测
import * as path from "node:path";

export interface PathContext {
  /** 当前文档所在工作区根目录(不在工作区里时为空) */
  workspaceFolder?: string;
  /** 当前 .md 所在目录(绝对路径) */
  fileDir: string;
  /** 当前 .md 文件名,不含扩展名 */
  fileName: string;
  /** 图片扩展名,不带点 */
  ext: string;
  /** 复制文件时的原文件名(不含扩展名);位图为 "image" */
  originalName?: string;
  now?: Date;
  uuid?: () => string;
}

export const DEFAULT_TEMPLATE = "assets/${fileName}/${date}-${time}.${ext}";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function shortId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

/** 文件名里不能出现的字符替换掉(模板变量的值里可能带) */
function safe(s: string): string {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-");
}

/** 展开模板里的变量,返回(可能是相对的)路径字符串 */
export function expandTemplate(tpl: string, ctx: PathContext): string {
  const now = ctx.now ?? new Date();
  const vars: Record<string, string> = {
    workspaceFolder: ctx.workspaceFolder ?? ctx.fileDir,
    fileDir: ctx.fileDir,
    fileName: safe(ctx.fileName),
    date: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    time: `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    timestamp: String(now.getTime()),
    uuid: (ctx.uuid ?? shortId)(),
    ext: ctx.ext.replace(/^\./, "").toLowerCase() || "png",
    originalName: safe(ctx.originalName || "image"),
  };
  let out = (tpl.trim() || DEFAULT_TEMPLATE).replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  // 模板里忘了写扩展名时补上
  if (!/\.[a-z0-9]+$/i.test(out)) out += `.${vars.ext}`;
  return out;
}

/** 模板 → 绝对路径:绝对路径(含 ${workspaceFolder} 展开后的)按字面,否则相对于 .md 所在目录 */
export function resolveTarget(tpl: string, ctx: PathContext): string {
  const expanded = expandTemplate(tpl, ctx);
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.join(ctx.fileDir, expanded);
}

/** 已存在时依次尝试 name-1.ext、name-2.ext……,绝不覆盖 */
export function uniquePath(abs: string, exists: (p: string) => boolean): string {
  if (!exists(abs)) return abs;
  const dir = path.dirname(abs);
  const ext = path.extname(abs);
  const stem = path.basename(abs, ext);
  for (let i = 1; ; i++) {
    const p = path.join(dir, `${stem}-${i}${ext}`);
    if (!exists(p)) return p;
  }
}

export type LinkStyle = "relative" | "workspaceRoot";

/** 图片绝对路径 → 写进 Markdown 的链接(统一用 /) */
export function linkFor(absImage: string, ctx: { fileDir: string; workspaceFolder?: string }, style: LinkStyle): string {
  if (style === "workspaceRoot" && ctx.workspaceFolder && isInside(ctx.workspaceFolder, absImage)) {
    return "/" + toPosix(path.relative(ctx.workspaceFolder, absImage));
  }
  return toPosix(path.relative(ctx.fileDir, absImage));
}

export function isInside(dir: string, p: string): boolean {
  const rel = path.relative(dir, p);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** 生成图片语法;路径含空格、括号或非 ASCII 字符时用 <> 包起来 */
export function imageMarkdown(alt: string, link: string): string {
  const cleanAlt = alt.replace(/[[\]]/g, "");
  const needsBrackets = /[\s()<>]|[^\x00-\x7f]/.test(link);
  return `![${cleanAlt}](${needsBrackets ? `<${link}>` : link})`;
}

/** 由文件名生成 alt 文本 */
export function altFromName(name: string): string {
  return path.basename(name, path.extname(name));
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/avif": "avif",
};

export function extFromMime(mime: string | undefined, fallback = "png"): string {
  return (mime && MIME_EXT[mime.toLowerCase()]) || fallback;
}

export const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff", "avif", "ico"]);

export function isImagePath(p: string): boolean {
  return IMAGE_EXTS.has(path.extname(p).slice(1).toLowerCase());
}
