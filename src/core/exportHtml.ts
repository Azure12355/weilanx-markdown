// 导出 HTML:把正文里的本地图片换成 base64,并包成一个独立的 HTML 文件

/** 把 <img src="..."> 里的本地路径换成 data URI;resolve 返回 null 时保留原样 */
export function inlineImages(html: string, resolve: (src: string) => { mime: string; base64: string } | null): string {
  return html.replace(/(<img\b[^>]*?\ssrc=)(["'])(.*?)\2/gi, (all, head: string, q: string, src: string) => {
    if (/^(data:|https?:|vscode-)/i.test(src)) return all;
    const r = resolve(decodeHtmlAttr(src));
    return r ? `${head}${q}data:${r.mime};base64,${r.base64}${q}` : all;
  });
}

function decodeHtmlAttr(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ExportStyle {
  fontFamily: string;
  headingFamily: string;
  codeFamily: string;
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
}

/** 导出用的固定浅色样式(打印和分享时不依赖编辑器主题) */
export function exportCss(s: ExportStyle): string {
  const width = s.maxWidth > 0 ? `${s.maxWidth}px` : "none";
  return `
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#1f2328;font-family:${s.fontFamily};font-size:${s.fontSize}px;line-height:${s.lineHeight}}
main{max-width:${width};margin:0 auto;padding:48px 32px 80px}
h1,h2,h3,h4,h5,h6{font-family:${s.headingFamily};line-height:1.3;margin:1.6em 0 .6em;font-weight:700}
h1{font-size:2em}h2{font-size:1.6em;padding-bottom:.25em;border-bottom:1px solid #eaecef}h3{font-size:1.3em}h4{font-size:1.1em}
p,ul,ol,blockquote,pre,table{margin:0 0 1em}
a{color:#2f6feb;text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;border-radius:6px}
code{font-family:${s.codeFamily};font-size:.88em;background:#f2f3f5;padding:.15em .4em;border-radius:5px}
pre{background:#f6f8fa;padding:14px 16px;border-radius:10px;overflow:auto}
pre code{background:none;padding:0;font-size:.86em}
blockquote{margin-left:0;padding:.2em 1em;border-left:4px solid #d0d7de;color:#57606a}
table{border-collapse:collapse}th,td{border:1px solid #d0d7de;padding:6px 12px}th{background:#f6f8fa}
hr{border:none;border-top:1px solid #d0d7de;margin:2em 0}
.task-list-item{list-style:none}.task-list-item input{margin-right:.5em}
.mermaid svg{max-width:100%;height:auto}
@media print{main{padding:0;max-width:none}a{color:inherit}}
`;
}

export function wrapDocument(body: string, title: string, css: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}
