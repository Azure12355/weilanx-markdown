import * as vscode from "vscode";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ToHost, ToView, ViewConfig, UploadItem } from "../core/protocol";
import { DEFAULT_TYPOGRAPHY, resolveTypography, TypographySettings } from "../core/typography";
import { exportCss, inlineImages, wrapDocument } from "../core/exportHtml";
import { imageSettings, resolveLocal, saveBytes, useFile, useRemote } from "./images";
import { readClipboardImage } from "./clipboard";
import { findBrowser, printToPdf, siblingPath } from "./exportPdf";
import { t } from "./i18n";
import { StatsBar } from "./statusBar";

export type ViewCommand = Extract<ToView, { type: "command" }>["command"];

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "weilanxMarkdown.editor";

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(MarkdownEditorProvider.viewType, new MarkdownEditorProvider(context), {
      webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true },
      supportsMultipleEditorsPerDocument: true,
    });
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    new MarkdownController(this.context, document, panel);
  }
}

export function typographySettings(uri: vscode.Uri): TypographySettings {
  const c = vscode.workspace.getConfiguration("weilanxMarkdown", uri);
  return {
    size: c.get<number>("font.size", DEFAULT_TYPOGRAPHY.size),
    family: c.get<string>("font.family", DEFAULT_TYPOGRAPHY.family),
    headingFamily: c.get<string>("font.headingFamily", DEFAULT_TYPOGRAPHY.headingFamily),
    codeFamily: c.get<string>("font.codeFamily", DEFAULT_TYPOGRAPHY.codeFamily),
    lineHeight: c.get<number>("layout.lineHeight", DEFAULT_TYPOGRAPHY.lineHeight),
    maxWidth: c.get<number>("layout.maxWidth", DEFAULT_TYPOGRAPHY.maxWidth),
    paragraphSpacing: c.get<number>("layout.paragraphSpacing", DEFAULT_TYPOGRAPHY.paragraphSpacing),
  };
}

const TYPO_KEYS: Record<keyof TypographySettings, string> = {
  size: "font.size",
  family: "font.family",
  headingFamily: "font.headingFamily",
  codeFamily: "font.codeFamily",
  lineHeight: "layout.lineHeight",
  maxWidth: "layout.maxWidth",
  paragraphSpacing: "layout.paragraphSpacing",
};

function editorFont(uri: vscode.Uri) {
  const e = vscode.workspace.getConfiguration("editor", uri);
  return { fontSize: e.get<number>("fontSize", 14), fontFamily: e.get<string>("fontFamily", "Menlo, Monaco, 'Courier New', monospace") };
}

export class MarkdownController {
  /** 当前激活的编辑器,快捷键命令转发给它 */
  static active: MarkdownController | undefined;

  /** 正在应用 webview 发来的修改:期间收到的文档变化是自己引起的,不回推 */
  private applyingOwn = false;
  /** webview 里的选区(字符偏移),给底栏字数统计用 */
  private selections: [number, number][] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel
  ) {
    const docDir = path.dirname(document.uri.fsPath);
    panel.webview.options = {
      enableScripts: true,
      // 图片可能引用工作区外的相对路径(../),放开到磁盘根目录
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "out", "webview")), vscode.Uri.file(path.parse(docDir).root)],
    };
    panel.webview.html = this.getHtml();

    const subs: vscode.Disposable[] = [];
    panel.webview.onDidReceiveMessage((m: ToHost) => this.onMessage(m), null, subs);

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() !== document.uri.toString() || !e.contentChanges.length) return;
        if (this.applyingOwn) return;
        const changes = [...e.contentChanges]
          .sort((a, b) => b.rangeOffset - a.rangeOffset)
          .map((c) => ({ offset: c.rangeOffset, length: c.rangeLength, text: c.text }));
        this.post({ type: "external", changes, length: document.getText().length });
      },
      null,
      subs
    );
    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration("weilanxMarkdown", document.uri) || e.affectsConfiguration("editor.fontSize") || e.affectsConfiguration("editor.fontFamily")) {
          this.post({ type: "config", config: this.viewConfig() });
        }
      },
      null,
      subs
    );

    const activate = () => {
      MarkdownController.active = this;
      StatsBar.instance?.setCustomSource(() => (MarkdownController.active === this ? { document, selections: this.selections } : null));
    };
    const deactivate = () => {
      if (MarkdownController.active !== this) return;
      MarkdownController.active = undefined;
      StatsBar.instance?.setCustomSource(null);
    };
    if (panel.active) activate();
    panel.onDidChangeViewState((e) => (e.webviewPanel.active ? activate() : deactivate()), null, subs);
    panel.onDidDispose(() => {
      deactivate();
      subs.forEach((d) => d.dispose());
    });
  }

  runCommand(command: ViewCommand) {
    this.post({ type: "command", command });
  }

  private post(m: ToView) {
    void this.panel.webview.postMessage(m);
  }

  private viewConfig(): ViewConfig {
    const uri = this.document.uri;
    const docDir = vscode.Uri.file(path.dirname(uri.fsPath));
    const ws = vscode.workspace.getWorkspaceFolder(uri)?.uri ?? docDir;
    const img = imageSettings(uri);
    return {
      typography: typographySettings(uri),
      editor: editorFont(uri),
      docBase: this.panel.webview.asWebviewUri(docDir).toString() + "/",
      rootBase: this.panel.webview.asWebviewUri(ws).toString() + "/",
      lang: vscode.env.language,
      altText: img.altText,
      downloadRemote: img.downloadRemote,
      docName: path.basename(uri.fsPath, path.extname(uri.fsPath)),
      defaultMode: vscode.workspace.getConfiguration("weilanxMarkdown", uri).get<"read" | "live" | "source">("defaultMode", "live"),
    };
  }

  private onMessage(m: ToHost) {
    switch (m.type) {
      case "ready":
        this.post({ type: "init", text: this.document.getText(), config: this.viewConfig() });
        return;
      case "changes":
        this.queue = this.queue.then(() => this.applyChanges(m.baseLength, m.changes)).catch(() => undefined);
        return;
      case "upload":
        void this.handleUpload(m.items, m.alt);
        return;
      case "clipboardFallback":
        void this.handleClipboard(m.id, m.alt);
        return;
      case "openLink":
        void this.openLink(m.href);
        return;
      case "saveTypography":
        void this.saveTypography(m.target, m.values);
        return;
      case "export":
        void this.handleExport(m.format, m.body, m.title);
        return;
      case "imageAction":
        void this.imageAction(m.action, m.src, m.from, m.to);
        return;
      case "notify":
        vscode.window.showInformationMessage(m.message);
        return;
      case "selection":
        this.selections = m.ranges;
        StatsBar.instance?.schedule();
        return;
    }
  }

  /** 把 webview 的增量修改应用到文档;长度对不上说明两边已不同步,推全文重置 */
  private async applyChanges(baseLength: number, changes: [number, number, string][]) {
    const doc = this.document;
    if (doc.getText().length !== baseLength) {
      this.post({ type: "reset", text: doc.getText() });
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    for (const [from, to, insert] of changes) {
      edit.replace(doc.uri, new vscode.Range(doc.positionAt(from), doc.positionAt(to)), insert);
    }
    this.applyingOwn = true;
    try {
      const ok = await vscode.workspace.applyEdit(edit);
      if (!ok) this.post({ type: "reset", text: doc.getText() });
    } finally {
      this.applyingOwn = false;
    }
  }

  private async askAlt(suggestion: string): Promise<string | undefined> {
    return vscode.window.showInputBox({ prompt: t("altPrompt"), value: suggestion });
  }

  private async handleUpload(items: UploadItem[], altHint: string) {
    const s = imageSettings(this.document.uri);
    let alt: string | undefined;
    if (s.altText === "prompt") {
      alt = await this.askAlt(altHint || items[0]?.name?.replace(/\.[^.]+$/, "") || "");
      if (alt === undefined) {
        for (const it of items) this.post({ type: "uploaded", id: it.id });
        return;
      }
    } else if (s.altText === "empty") alt = "";
    for (const it of items) {
      try {
        let md: string;
        if (it.data !== undefined) md = saveBytes(this.document, Buffer.from(it.data, "base64"), it.mime, it.name, alt);
        else if (it.uri) md = useFile(this.document, vscode.Uri.parse(it.uri).fsPath, alt);
        else if (it.url) md = await useRemote(this.document, it.url, alt);
        else throw new Error("empty");
        this.post({ type: "uploaded", id: it.id, markdown: md });
      } catch (err) {
        const msg = (err as Error).message;
        this.post({ type: "uploaded", id: it.id, error: msg });
        vscode.window.showErrorMessage(t("imageFailed", msg));
      }
    }
  }

  private async handleClipboard(id: string, altHint: string) {
    const clip = await readClipboardImage();
    if (!clip) {
      this.post({ type: "uploaded", id });
      return;
    }
    const s = imageSettings(this.document.uri);
    let alt: string | undefined = s.altText === "empty" ? "" : undefined;
    if (s.altText === "prompt") {
      alt = await this.askAlt(altHint);
      if (alt === undefined) return this.post({ type: "uploaded", id });
    }
    try {
      let md: string;
      if (clip.kind === "bitmap") {
        md = saveBytes(this.document, fs.readFileSync(clip.file), "image/png", undefined, alt);
        fs.rmSync(clip.file, { force: true });
      } else {
        const images = clip.files.filter((f) => /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|avif|ico)$/i.test(f));
        if (!images.length) return this.post({ type: "uploaded", id });
        // 访达里复制的文件:始终复制一份到图片目录,和「复制粘贴」的直觉一致
        md = images.map((f) => useFile(this.document, f, alt, true)).join("\n");
      }
      this.post({ type: "uploaded", id, markdown: md });
    } catch (err) {
      const msg = (err as Error).message;
      this.post({ type: "uploaded", id, error: msg });
      vscode.window.showErrorMessage(t("imageFailed", msg));
    }
  }

  private async openLink(href: string) {
    if (/^(https?|mailto|vscode):/i.test(href)) {
      await vscode.env.openExternal(vscode.Uri.parse(href));
      return;
    }
    if (href.startsWith("#")) return;
    let target = href.replace(/^<|>$/g, "").split("#")[0];
    try {
      target = decodeURIComponent(target);
    } catch {
      /* 保持原样 */
    }
    const ws = vscode.workspace.getWorkspaceFolder(this.document.uri)?.uri.fsPath;
    const abs = target.startsWith("/") && ws ? path.join(ws, target) : path.resolve(path.dirname(this.document.uri.fsPath), target);
    if (!fs.existsSync(abs)) {
      vscode.window.showWarningMessage(t("linkNotFound", href));
      return;
    }
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
  }

  private async saveTypography(target: "user" | "workspace", values: Partial<TypographySettings>) {
    const c = vscode.workspace.getConfiguration("weilanxMarkdown", this.document.uri);
    const t0 = target === "workspace" && vscode.workspace.workspaceFolders?.length ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    for (const [k, v] of Object.entries(values) as [keyof TypographySettings, unknown][]) {
      await c.update(TYPO_KEYS[k], v, t0);
    }
    vscode.window.setStatusBarMessage(t0 === vscode.ConfigurationTarget.Global ? t("savedUser") : t("savedWorkspace"), 2500);
  }

  private buildHtml(body: string, title: string): string {
    const typo = resolveTypography(typographySettings(this.document.uri), editorFont(this.document.uri));
    const inlined = inlineImages(body, (src) => {
      const abs = resolveLocal(this.document, src);
      if (!abs) return null;
      const ext = path.extname(abs).slice(1).toLowerCase();
      const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      return { mime, base64: fs.readFileSync(abs).toString("base64") };
    });
    return wrapDocument(inlined, title, exportCss({ ...typo, fontSize: Math.max(typo.fontSize, 15) }));
  }

  private async handleExport(format: "html" | "pdf", body: string, title: string) {
    const html = this.buildHtml(body, title);
    const docPath = this.document.uri.fsPath;
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(siblingPath(docPath, format === "html" ? ".html" : ".pdf")),
      filters: format === "html" ? { HTML: ["html"] } : { PDF: ["pdf"] },
    });
    if (!target) return;
    try {
      if (format === "html") {
        fs.writeFileSync(target.fsPath, html);
      } else {
        const browser = findBrowser(vscode.workspace.getConfiguration("weilanxMarkdown").get<string>("export.browserPath") || undefined);
        if (!browser) {
          const pick = await vscode.window.showWarningMessage(t("noBrowser"), t("exportHtmlInstead"));
          if (pick) {
            const htmlTarget = target.fsPath.replace(/\.pdf$/i, ".html");
            fs.writeFileSync(htmlTarget, html);
            vscode.window.showInformationMessage(t("exported", path.basename(htmlTarget)));
          }
          return;
        }
        const tmp = path.join(os.tmpdir(), `wmd-export-${Date.now()}.html`);
        fs.writeFileSync(tmp, html);
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t("exportingPdf") }, () => printToPdf(browser, tmp, target.fsPath));
        fs.rmSync(tmp, { force: true });
      }
      const reveal = t("reveal");
      const pick = await vscode.window.showInformationMessage(t("exported", path.basename(target.fsPath)), reveal);
      if (pick === reveal) vscode.commands.executeCommand("revealFileInOS", target);
    } catch (err) {
      vscode.window.showErrorMessage(t("exportFailed", (err as Error).message));
    }
  }

  private async imageAction(action: "reveal" | "copyPath" | "delete", src: string, from: number, to: number) {
    const abs = resolveLocal(this.document, src);
    if (action === "copyPath") {
      await vscode.env.clipboard.writeText(abs ?? src);
      vscode.window.setStatusBarMessage(t("copied"), 2000);
      return;
    }
    if (!abs) {
      vscode.window.showWarningMessage(t("linkNotFound", src));
      return;
    }
    if (action === "reveal") {
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(abs));
      return;
    }
    const yes = t("delete");
    const pick = await vscode.window.showWarningMessage(t("confirmDelete", path.basename(abs)), { modal: true }, yes);
    if (pick !== yes) return;
    await vscode.workspace.fs.delete(vscode.Uri.file(abs), { useTrash: true });
    const edit = new vscode.WorkspaceEdit();
    // 连同图片所在的整行一起删掉(这一行只有这张图时)
    const doc = this.document;
    const start = doc.positionAt(from);
    const end = doc.positionAt(to);
    const line = doc.lineAt(start.line);
    const onlyImage = line.text.trim() === doc.getText(new vscode.Range(start, end)).trim();
    edit.delete(doc.uri, onlyImage ? line.rangeIncludingLineBreak : new vscode.Range(start, end));
    await vscode.workspace.applyEdit(edit);
  }

  private getHtml(): string {
    const dist = path.join(this.context.extensionPath, "out", "webview");
    const indexPath = path.join(dist, "index.html");
    if (!fs.existsSync(indexPath)) {
      return `<html><body style="font-family:sans-serif;padding:2rem">Webview not built. Run <code>npm run build:web</code>.</body></html>`;
    }
    let html = fs.readFileSync(indexPath, "utf8");
    const webview = this.panel.webview;
    html = html.replace(/(href|src)="(\.\/[^"]+)"/g, (_all, attr, rel) => `${attr}="${webview.asWebviewUri(vscode.Uri.file(path.join(dist, rel)))}"`);
    return html;
  }
}
