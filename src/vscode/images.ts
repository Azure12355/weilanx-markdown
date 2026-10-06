// 图片落盘:按设置的模板计算路径,写入 / 复制 / 下载,返回插入用的 Markdown
import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { altFromName, extFromMime, imageMarkdown, isImagePath, isInside, linkFor, LinkStyle, PathContext, resolveTarget, uniquePath } from "../core/imagePath";

export interface ImageSettings {
  path: string;
  linkStyle: LinkStyle;
  altText: "empty" | "fileName" | "prompt";
  downloadRemote: boolean;
}

export function imageSettings(uri: vscode.Uri): ImageSettings {
  const c = vscode.workspace.getConfiguration("weilanxMarkdown.image", uri);
  return {
    path: c.get<string>("path", "assets/${fileName}/${date}-${time}.${ext}"),
    linkStyle: c.get<LinkStyle>("linkStyle", "relative"),
    altText: c.get<ImageSettings["altText"]>("altText", "fileName"),
    downloadRemote: c.get<boolean>("downloadRemote", false),
  };
}

function contextFor(doc: vscode.TextDocument, ext: string, originalName?: string): PathContext {
  const file = doc.uri.fsPath;
  return {
    workspaceFolder: vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath,
    fileDir: path.dirname(file),
    fileName: path.basename(file, path.extname(file)),
    ext,
    originalName,
  };
}

function finish(doc: vscode.TextDocument, abs: string, alt: string, s: ImageSettings): string {
  const ctx = contextFor(doc, "png");
  return imageMarkdown(alt, linkFor(abs, ctx, s.linkStyle));
}

function altFor(s: ImageSettings, fileName: string, given?: string): string {
  if (given !== undefined) return given;
  return s.altText === "fileName" ? altFromName(fileName) : "";
}

function targetFor(doc: vscode.TextDocument, s: ImageSettings, ext: string, originalName?: string): string {
  const abs = uniquePath(resolveTarget(s.path, contextFor(doc, ext, originalName)), (p) => fs.existsSync(p));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

/** 位图数据(粘贴的截图等) */
export function saveBytes(doc: vscode.TextDocument, bytes: Uint8Array, mime: string | undefined, name: string | undefined, alt?: string): string {
  const s = imageSettings(doc.uri);
  const ext = name && isImagePath(name) ? path.extname(name).slice(1).toLowerCase() : extFromMime(mime);
  const original = name ? altFromName(name) : "image";
  const abs = targetFor(doc, s, ext, original);
  fs.writeFileSync(abs, bytes);
  return finish(doc, abs, altFor(s, path.basename(abs), alt), s);
}

/** 已有的图片文件:工作区内的直接引用,工作区外的复制一份 */
export function useFile(doc: vscode.TextDocument, src: string, alt?: string, forceCopy = false): string {
  if (!isImagePath(src)) throw new Error(`不是图片文件:${path.basename(src)}`);
  const s = imageSettings(doc.uri);
  const ws = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
  if (!forceCopy && ws && isInside(ws, src)) return finish(doc, src, altFor(s, path.basename(src), alt), s);
  const ext = path.extname(src).slice(1).toLowerCase();
  const abs = targetFor(doc, s, ext, altFromName(src));
  fs.copyFileSync(src, abs);
  return finish(doc, abs, altFor(s, path.basename(src), alt), s);
}

/** 远程图片:默认只插入链接;开启 downloadRemote 时下载到本地 */
export async function useRemote(doc: vscode.TextDocument, url: string, alt?: string): Promise<string> {
  const s = imageSettings(doc.uri);
  const nameFromUrl = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "image");
  if (!s.downloadRemote) return imageMarkdown(altFor(s, nameFromUrl, alt), url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败:HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return saveBytes(doc, bytes, res.headers.get("content-type") ?? undefined, isImagePath(nameFromUrl) ? nameFromUrl : undefined, alt);
}

/** Markdown 里的图片地址 → 本地绝对路径(远程或找不到时返回 null) */
export function resolveLocal(doc: vscode.TextDocument, src: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) {
    if (src.startsWith("file:")) return vscode.Uri.parse(src).fsPath;
    return null;
  }
  let p = src.replace(/^<|>$/g, "");
  try {
    p = decodeURIComponent(p);
  } catch {
    /* 保持原样 */
  }
  p = p.split(/[?#]/)[0];
  const ws = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
  const abs = p.startsWith("/") && ws && !fs.existsSync(p) ? path.join(ws, p) : path.isAbsolute(p) ? p : path.join(path.dirname(doc.uri.fsPath), p);
  return fs.existsSync(abs) ? abs : null;
}
