// 底栏字数统计:字数 · 字符数 · 口播时长 · 阅读时长;选中文字时统计选中部分;悬停显示完整指标和平台字数上限
import * as vscode from "vscode";
import { computeStats, DEFAULT_PLATFORMS, durationSeconds, formatDuration, formatMinutes, PlatformLimit, platformValue, TextStats } from "../core/stats";

export interface StatsSource {
  document: vscode.TextDocument;
  /** 选区(字符偏移),空选区不计 */
  selections: [number, number][];
}

interface Rates {
  speakCjk: number;
  speakWords: number;
  readCjk: number;
  readWords: number;
}

function zh(): boolean {
  return vscode.env.language.toLowerCase().startsWith("zh");
}

const fmt = (n: number) => n.toLocaleString("en-US");

export class StatsBar {
  static instance: StatsBar | undefined;
  private readonly item: vscode.StatusBarItem;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** 当前实时预览编辑器提供的数据源(没有时退回到普通文本编辑器) */
  private custom: (() => StatsSource | null) | null = null;
  private cache: { key: string; stats: TextStats } | null = null;
  private last: { doc: TextStats; sel: TextStats | null; rates: Rates; platforms: PlatformLimit[] } | null = null;

  constructor(context: vscode.ExtensionContext) {
    StatsBar.instance = this;
    this.item = vscode.window.createStatusBarItem("weilanxMarkdown.stats", vscode.StatusBarAlignment.Right, 101);
    this.item.name = zh() ? "Markdown 字数统计" : "Markdown Word Count";
    this.item.command = "weilanxMarkdown.showStats";
    context.subscriptions.push(
      this.item,
      vscode.window.onDidChangeActiveTextEditor(() => this.schedule()),
      vscode.window.onDidChangeTextEditorSelection(() => this.schedule()),
      vscode.workspace.onDidChangeTextDocument(() => this.schedule()),
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration("weilanxMarkdown.stats") && this.schedule()),
      vscode.window.tabGroups.onDidChangeTabs(() => this.schedule()),
      vscode.commands.registerCommand("weilanxMarkdown.showStats", () => this.showDetails())
    );
  }

  /** 实时预览编辑器激活 / 失活时调用 */
  setCustomSource(get: (() => StatsSource | null) | null) {
    this.custom = get;
    this.schedule();
  }

  schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 120);
  }

  private source(): StatsSource | null {
    const c = this.custom?.();
    if (c) return c;
    const ed = vscode.window.activeTextEditor;
    if (ed && ed.document.languageId === "markdown") {
      return { document: ed.document, selections: ed.selections.map((s) => [ed.document.offsetAt(s.start), ed.document.offsetAt(s.end)] as [number, number]) };
    }
    return null;
  }

  private docStats(doc: vscode.TextDocument): TextStats {
    const key = `${doc.uri.toString()}@${doc.version}`;
    if (this.cache?.key !== key) this.cache = { key, stats: computeStats(doc.getText()) };
    return this.cache.stats;
  }

  private refresh() {
    const c = vscode.workspace.getConfiguration("weilanxMarkdown.stats");
    const src = c.get<boolean>("enabled", true) ? this.source() : null;
    if (!src) {
      this.item.hide();
      this.last = null;
      return;
    }
    const rates: Rates = {
      speakCjk: c.get<number>("speakingRate", 260),
      speakWords: c.get<number>("speakingWordsPerMinute", 150),
      readCjk: c.get<number>("readingRate", 400),
      readWords: c.get<number>("readingWordsPerMinute", 230),
    };
    const platforms = c.get<PlatformLimit[]>("platforms", DEFAULT_PLATFORMS) ?? DEFAULT_PLATFORMS;
    const doc = this.docStats(src.document);
    const ranges = src.selections.filter(([a, b]) => b > a);
    const text = src.document.getText();
    const sel = ranges.length ? computeStats(ranges.map(([a, b]) => text.slice(a, b)).join("\n\n")) : null;
    this.last = { doc, sel, rates, platforms };

    const z = zh();
    const s = sel ?? doc;
    const speak = formatDuration(durationSeconds(s, rates.speakCjk, rates.speakWords));
    const read = formatMinutes(durationSeconds(s, rates.readCjk, rates.readWords));
    const wordsPart = sel ? (z ? `已选 ${fmt(sel.words)} / ${fmt(doc.words)} 字` : `${fmt(sel.words)} of ${fmt(doc.words)} words`) : z ? `${fmt(doc.words)} 字` : `${fmt(doc.words)} words`;
    const charsPart = z ? `${fmt(s.chars)} 字符` : `${fmt(s.chars)} chars`;
    const readPart = z ? `阅读 ${read} 分钟` : `${read} min read`;
    this.item.text = `${sel ? "$(selection)" : "$(book)"} ${wordsPart} · ${charsPart} · $(mic) ${speak} · ${readPart}`;
    this.item.tooltip = this.tooltip();
    this.item.show();
  }

  private rows(): [string, string][] {
    if (!this.last) return [];
    const { doc, sel, rates } = this.last;
    const z = zh();
    const both = (f: (t: TextStats) => string) => (sel ? `${f(sel)} / ${f(doc)}` : f(doc));
    const speak = (t: TextStats) => formatDuration(durationSeconds(t, rates.speakCjk, rates.speakWords));
    const read = (t: TextStats) => `${formatMinutes(durationSeconds(t, rates.readCjk, rates.readWords))} ${z ? "分钟" : "min"}`;
    return [
      [z ? "字数" : "Words", both((t) => fmt(t.words))],
      [z ? "　中文字" : "　CJK characters", both((t) => fmt(t.cjk))],
      [z ? "　英文单词" : "　Latin words", both((t) => fmt(t.latinWords))],
      [z ? "字符数(不含空白)" : "Characters (no spaces)", both((t) => fmt(t.chars))],
      [z ? "字符数(含空格)" : "Characters (with spaces)", both((t) => fmt(t.charsWithSpaces))],
      [z ? "段落" : "Paragraphs", both((t) => fmt(t.paragraphs))],
      [z ? "句子" : "Sentences", both((t) => fmt(t.sentences))],
      [z ? "行" : "Lines", both((t) => fmt(t.lines))],
      [z ? "口播时长" : "Speaking time", both(speak)],
      [z ? "阅读时长" : "Reading time", both(read)],
      [z ? "标题" : "Headings", fmt(doc.headings)],
      [z ? "图片" : "Images", fmt(doc.images)],
      [z ? "链接" : "Links", fmt(doc.links)],
      [z ? "代码块" : "Code blocks", fmt(doc.codeBlocks)],
      [z ? "表格" : "Tables", fmt(doc.tables)],
    ];
  }

  private platformRows(): [string, string, boolean][] {
    if (!this.last) return [];
    const { doc, sel, platforms } = this.last;
    const s = sel ?? doc;
    const z = zh();
    const unitName = (u: PlatformLimit["unit"]) => (u === "words" ? (z ? "字" : "words") : u === "x" ? (z ? "字符(加权)" : "weighted chars") : z ? "字符" : "chars");
    return platforms.map((p) => {
      const v = platformValue(s, p.unit);
      return [p.name, `${fmt(v)} / ${fmt(p.limit)} ${unitName(p.unit)}`, v > p.limit];
    });
  }

  private tooltip(): vscode.MarkdownString {
    const z = zh();
    const md = new vscode.MarkdownString(undefined, true);
    const sel = this.last?.sel;
    md.appendMarkdown(`**${z ? (sel ? "选中 / 全文" : "全文统计") : sel ? "Selection / Document" : "Document"}**\n\n`);
    md.appendMarkdown(`| | |\n|:--|--:|\n`);
    for (const [k, v] of this.rows()) md.appendMarkdown(`| ${k} | ${v} |\n`);
    const pr = this.platformRows();
    if (pr.length) {
      md.appendMarkdown(`\n**${z ? (sel ? "平台字数上限(按选中部分)" : "平台字数上限") : sel ? "Platform limits (selection)" : "Platform limits"}**\n\n| | |\n|:--|--:|\n`);
      for (const [name, v, over] of pr) md.appendMarkdown(`| ${over ? "$(warning)" : "$(check)"} ${name} | ${v} |\n`);
    }
    md.appendMarkdown(`\n---\n${z ? "点击查看并复制;口播按每分钟 " : "Click to copy a value. Speaking time assumes "}${this.last?.rates.speakCjk}${z ? " 字估算,可在设置里调整" : " CJK chars / min (configurable)"}`);
    return md;
  }

  private async showDetails() {
    this.refresh();
    if (!this.last) return;
    const z = zh();
    const items: vscode.QuickPickItem[] = this.rows().map(([k, v]) => ({ label: k.trim(), description: v }));
    const pr = this.platformRows();
    if (pr.length) {
      items.push({ label: z ? "平台字数上限" : "Platform limits", kind: vscode.QuickPickItemKind.Separator });
      for (const [name, v, over] of pr) items.push({ label: `${over ? "$(warning)" : "$(check)"} ${name}`, description: v });
    }
    const pick = await vscode.window.showQuickPick(items, { placeHolder: z ? "选择一项复制它的数值" : "Pick a metric to copy its value" });
    if (pick?.description) {
      await vscode.env.clipboard.writeText(pick.description.split(" / ")[0]);
      vscode.window.setStatusBarMessage(z ? "已复制" : "Copied", 1500);
    }
  }
}
