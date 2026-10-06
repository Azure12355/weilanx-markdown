// 浏览器预览用的示例文档,覆盖各种需要实时预览的元素
export const SAMPLE = `---
title: Weilanx Markdown 示例
tags: [markdown, preview]
---

# 一、实时预览

光标不在的行会隐藏 **加粗**、*斜体*、~~删除线~~ 和 \`行内代码\` 的符号，[链接](https://github.com) 只显示文字。

## 二、图片

![logo](logo.png)

> 引用块左边有一条竖线。
> 第二行引用。

- 无序列表第一项
- 第二项
  - 嵌套一项

1. 有序列表
2. 第二项

- [ ] 没做完的任务
- [x] 做完的任务

---

## 三、代码

\`\`\`ts
const greet = (name: string) => \`hello \${name}\`;
console.log(greet("weilanx"));
\`\`\`

## 四、表格

| 功能 | 状态 | 说明 |
| :--- | :---: | ---: |
| 粘贴图片 | 完成 | 路径可配 |
| 字体设置 | 完成 | 跟随 VS Code |

## 五、公式与 Mermaid

行内公式 $E = mc^2$，下面是块级公式：

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

\`\`\`mermaid
graph LR
  A[粘贴截图] --> B{有位图?}
  B -->|有| C[保存到 assets]
  B -->|没有| D[读系统剪贴板]
\`\`\`

最后一段正文。
`;
