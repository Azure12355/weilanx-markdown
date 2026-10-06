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
