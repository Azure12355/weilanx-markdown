import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { expandTemplate, resolveTarget, uniquePath, linkFor, imageMarkdown, extFromMime, isImagePath } from "../src/core/imagePath";
import { extractHeadings, frontMatterRange, plainHeading } from "../src/core/outline";
import { inlineImages, wrapDocument } from "../src/core/exportHtml";

const now = new Date(2026, 9, 6, 21, 30, 5);
const ctx = { fileDir: "/w/blog/posts", workspaceFolder: "/w/blog", fileName: "我的 文章", ext: "PNG", now, uuid: () => "abcd1234" };

test("模板:变量展开", () => {
  assert.equal(expandTemplate("assets/${fileName}/${date}-${time}.${ext}", ctx), "assets/我的 文章/20261006-213005.png");
  assert.equal(expandTemplate("${workspaceFolder}/img/${uuid}.${ext}", ctx), "/w/blog/img/abcd1234.png");
  assert.equal(expandTemplate("img/${originalName}", { ...ctx, originalName: "a/b:c" }), "img/a-b-c.png");
  assert.equal(expandTemplate("", ctx), "assets/我的 文章/20261006-213005.png");
  assert.equal(expandTemplate("x/${unknown}.${ext}", ctx), "x/${unknown}.png");
});

test("模板:相对路径基于 .md 目录,绝对路径按字面", () => {
  assert.equal(resolveTarget("assets/a.png", ctx), path.join("/w/blog/posts", "assets/a.png"));
  assert.equal(resolveTarget("${workspaceFolder}/static/a.png", ctx), "/w/blog/static/a.png");
  assert.equal(resolveTarget("../shared/a.png", ctx), "/w/blog/shared/a.png");
});

test("重名:加序号,不覆盖", () => {
  const taken = new Set(["/a/x.png", "/a/x-1.png"]);
  assert.equal(uniquePath("/a/x.png", (p) => taken.has(p)), "/a/x-2.png");
  assert.equal(uniquePath("/a/y.png", (p) => taken.has(p)), "/a/y.png");
});

test("链接:相对 / 工作区根", () => {
  assert.equal(linkFor("/w/blog/posts/assets/a.png", ctx, "relative"), "assets/a.png");
  assert.equal(linkFor("/w/blog/static/a.png", ctx, "relative"), "../static/a.png");
  assert.equal(linkFor("/w/blog/static/a.png", ctx, "workspaceRoot"), "/static/a.png");
  assert.equal(linkFor("/other/a.png", ctx, "workspaceRoot"), "../../../other/a.png");
});

test("图片语法:空格、中文、括号用尖括号", () => {
  assert.equal(imageMarkdown("a", "assets/a.png"), "![a](assets/a.png)");
  assert.equal(imageMarkdown("a", "assets/我的 图.png"), "![a](<assets/我的 图.png>)");
  assert.equal(imageMarkdown("[x]", "a(1).png"), "![x](<a(1).png>)");
  assert.equal(extFromMime("image/jpeg"), "jpg");
  assert.equal(extFromMime("application/x"), "png");
  assert.ok(isImagePath("/a/b.WEBP"));
  assert.ok(!isImagePath("/a/b.pdf"));
});

test("大纲:ATX、Setext,跳过代码块和 front matter", () => {
  const md = "---\ntitle: x\n# not\n---\n# 一、**标题**\n\n```\n# 代码\n```\n\n二级\n---\n\n### [链接](u) ###\n- 列表\n---\n";
  const hs = extractHeadings(md);
  assert.deepEqual(
    hs.map((h) => [h.level, h.text, h.line]),
    [
      [1, "一、标题", 4],
      [2, "二级", 10],
      [3, "链接", 13],
    ]
  );
  assert.equal(plainHeading("`code` and *em* ##"), "code and em");
  const fm = frontMatterRange("---\na: 1\n---\nbody");
  assert.deepEqual(fm, { from: 0, to: 12 });
  assert.equal(frontMatterRange("# hi"), null);
});

test("导出:内嵌本地图片,保留远程图片", () => {
  const html = '<p><img src="assets/a.png" alt=""><img src="https://x/y.png"></p>';
  const out = inlineImages(html, (src) => (src === "assets/a.png" ? { mime: "image/png", base64: "AAA" } : null));
  assert.match(out, /src="data:image\/png;base64,AAA"/);
  assert.match(out, /src="https:\/\/x\/y.png"/);
  assert.match(wrapDocument("<p>x</p>", "<T>", "body{}"), /<title>&lt;T&gt;<\/title>/);
});

import { indentItem, outdentItem, renumberBlock, parseListLine } from "../src/core/lists";

test("列表:Tab 缩进后从 1 开始,原来这一层后面的重新编号", () => {
  const lines = ["1. 在编辑器里", "2. 没有字号", "3. 确定", "4. 确定呀", "5. 测试", "", "段落"];
  const r = indentItem(lines, 3)!;
  assert.deepEqual(r.slice(0, 5), ["1. 在编辑器里", "2. 没有字号", "3. 确定", "   1. 确定呀", "4. 测试"]);
  // 再缩进一项:接着子层编号
  const r2 = indentItem(r, 4)!;
  assert.deepEqual(r2.slice(2, 5), ["3. 确定", "   1. 确定呀", "   2. 测试"]);
});

test("列表:Shift+Tab 反缩进接在父项后面编号", () => {
  const lines = ["1. a", "2. b", "   1. c", "   2. d", "3. e"];
  const r = outdentItem(lines, 2)!;
  assert.deepEqual(r, ["1. a", "2. b", "3. c", "   1. d", "4. e"]);
});

test("列表:第一项不能缩进;子内容随之移动;无序列表保持符号", () => {
  assert.equal(indentItem(["1. a", "2. b"], 0), null);
  const r = indentItem(["- a", "- b", "  续行", "- c"], 1)!;
  assert.deepEqual(r, ["- a", "  - b", "    续行", "- c"]);
  assert.equal(parseListLine("10) x")!.contentCol, 4);
});

test("列表:重新编号保留起始号,懒编号不动", () => {
  assert.deepEqual(renumberBlock(["3. a", "7. b", "1. c"], 0), ["3. a", "4. b", "5. c"]);
  assert.deepEqual(renumberBlock(["1. a", "1. b", "1. c"], 0), ["1. a", "1. b", "1. c"]);
  assert.deepEqual(renumberBlock(["1. a", "", "段落", "", "5. b"], 4), ["1. a", "", "段落", "", "5. b"]);
});

import { computeStats, countText, durationSeconds, formatDuration, toPlain } from "../src/core/stats";

test("统计:中文按字、英文按词,去掉 Markdown 标记和代码块", () => {
  const md = "---\ntitle: x\n---\n# 我封了 5 个 Claude 号\n\n不是因为**我**干了什么。[链接文字](https://a.com)\n\n```js\nconst a = 1;\n```\n\n![图](a.png)\n\n- 列表 item one\n";
  const s = computeStats(md);
  // 中文:我封了个号 5 + 不是因为我干了什么 9 + 链接文字 4 + 列表 2 = 20;英文:5 Claude item one = 4
  assert.equal(s.cjk, 20);
  assert.equal(s.latinWords, 4);
  assert.equal(s.words, 24);
  assert.equal(s.headings, 1);
  assert.equal(s.codeBlocks, 1);
  assert.equal(s.images, 1);
  assert.equal(s.links, 1);
  assert.equal(s.paragraphs, 3);
  assert.doesNotMatch(toPlain(md).text, /const|https|\*\*|#|title/);
});

test("统计:字符数、句子数、X 加权、表格", () => {
  const c = countText("你好 world。Hi!");
  // 你好(2) + world(5) + 。(1) + Hi(2) + !(1)
  assert.equal(c.chars, 11);
  assert.equal(c.charsWithSpaces, 12);
  assert.equal(c.sentences, 2);
  // X 计数:中文和全角标点各 2,其余 1
  assert.equal(c.xWeighted, 2 + 2 + 1 + 5 + 2 + 2 + 1);
  const t = computeStats("| 功能 | 状态 |\n| --- | --- |\n| 粘贴 | 完成 |\n");
  assert.equal(t.tables, 1);
  assert.equal(t.cjk, 8);
});

test("统计:时长估算与格式", () => {
  assert.equal(durationSeconds({ cjk: 260, latinWords: 0 }, 260, 150), 60);
  assert.equal(durationSeconds({ cjk: 0, latinWords: 75 }, 260, 150), 30);
  assert.equal(formatDuration(90), "1:30");
  assert.equal(formatDuration(3725), "1:02:05");
});
