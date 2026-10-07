// Weilanx Markdown 官网:双语切换、纸面编辑器演示、章节滚动配图、排版试验台、实时字数条
(() => {
  document.documentElement.classList.add("js");

  const DICT = {
    en: {
      "mast.issue": "Vol. 01 · An editor for writers",
      "nav.fidelity": "Fidelity",
      "nav.contents": "Contents",
      "nav.playground": "Typography",
      "nav.install": "Install",
      "hero.kicker": "A live-preview Markdown editor for VS Code",
      "hero.title": "Write in Markdown.<br /><em>Read it as prose.</em>",
      "hero.lede": "Wherever the cursor isn't, the hashes and asterisks fold away and you see a typeset page. The file keeps exactly what you typed — nothing more.",
      "hero.meta2": "MIT · free · offline",
      "cta.install": "Install free",
      "cta.github": "Source on GitHub",
      "demo.h1": "On writing well",
      "demo.p1a": "Good prose is ",
      "demo.p1b": "clear",
      "demo.p1c": ", not clever. Cut every word that ",
      "demo.p1d": "doesn't",
      "demo.p1e": " earn its place.",
      "demo.q": "Write drunk, edit sober.",
      "demo.li1": "Read it out loud",
      "demo.li2": "See the ",
      "demo.li2b": "style guide",
      "demo.code": "lives in the status bar.",
      "demo.status": "📖 35 words · 157 chars · 🎙 0:14 · <1 min read",
      "cap.read": "Locked — read-only, everything rendered, links open on a click.",
      "cap.live": "Edit — the line under your cursor shows its source.",
      "cap.source": "Source — every character in plain sight.",
      "fid.quote": "Rendering is a sheet of paper on top.<br /><em>Underneath, every character is yours.</em>",
      "fid.text": "Most WYSIWYG editors rebuild your file from a document model when they save — lists get new markers, blank lines collapse, characters get escaped. Weilanx Markdown only decorates; it never re-serializes. Open a file, fix a typo, and git shows exactly one changed line.",
      "fid.other": "A typical WYSIWYG editor, after fixing one typo",
      "fid.ours": "Weilanx Markdown, same edit",
      "toc.title": "Contents",
      "sb.sel": "⬚ 128 of 3,427 words · 160 chars · 🎙 0:30 · <1 min read",
      "sb.t1": "Words",
      "sb.t2": "Characters",
      "sb.t3": "Speaking time",
      "sb.t4": "Paragraphs",
      "sb.t6": "✓ Xiaohongshu title",
      "ch1.t": "Paste a screenshot. That's it.",
      "ch1.d": "⌘V a screenshot, a copied file, or drag one in. It lands in a folder you choose — assets/${fileName}/${date}-${time}.png by default, per workspace if you like — and never overwrites anything. If the webview can't see the image, the extension reads the system clipboard instead.",
      "ch2.t": "Three ways to look at a page",
      "ch2.d": "Locked for reading, Edit for writing with live preview, Source when you want every character in plain sight. One switch at the top right, or ⌘⌥M.",
      "ch3.t": "Your fonts, your measure",
      "ch3.d": "Text size follows VS Code. Body, heading and code fonts, line height, column width and paragraph spacing are one click away in the Aa panel — and save to user or workspace settings.",
      "ch4.t": "Counted the way editors count",
      "ch4.d": "Words (Chinese by character, English by word), characters, speaking time for voice-overs and reading time — in the status bar, for the whole file or just your selection. Hover to check limits for Xiaohongshu, X and WeChat.",
      "ch5.t": "An outline, and the dark",
      "ch5.d": "A sidebar outline that follows you down the page. Every color comes from your VS Code theme, light or dark.",
      "ch6.t": "Tables, code, math, diagrams",
      "ch6.d": "Rounded tables with zebra rows, highlighted code, KaTeX, Mermaid, GitHub alerts and task lists — then export to HTML or PDF.",
      "pg.title": "Set the type yourself",
      "pg.sub": "These are the same controls as the Aa panel inside the editor. Try them.",
      "pg.font": "Body font",
      "pg.sans": "Sans",
      "pg.serif": "Serif",
      "pg.mono": "Mono",
      "pg.size": "Size",
      "pg.lh": "Line height",
      "pg.width": "Measure",
      "pg.h": "The last line of a paragraph",
      "pg.p1": "A good measure sits somewhere between forty-five and seventy-five characters. Too narrow and the eye jumps back too often; too wide and it loses its place on the way back.",
      "pg.p2": "Line height does the rest. Body text breathes at around one and three quarters; headings can sit tighter.",
      "ct.title": "Type, and watch the status bar",
      "ct.sample": "# A note for the voice-over\n\nGood prose is **clear**, not clever. Select part of this text and the bar counts only your selection — the same rules the extension uses.",
      "in.title": "Install",
      "in.s1": "Run the installer, or download the .vsix",
      "in.s1n": "Installs into every VS Code based editor it finds. Or grab <a href=\"https://github.com/Azure12355/weilanx-markdown/releases/latest/download/weilanx-markdown.vsix\">weilanx-markdown.vsix</a> and choose <i>Install from VSIX…</i>",
      "in.s2": "Make it your default Markdown editor (optional)",
      "in.s3": "Or let your agent do it",
      "in.prompt": "Install Weilanx Markdown for me. Follow https://github.com/Azure12355/weilanx-markdown/blob/main/docs/install-for-agents.md and verify the install.",
      copy: "Copy",
      copied: "Copied",
      "ft.colophon": "Colophon",
      "ft.fonts": "Set in Instrument Serif and Noto Serif SC, with Inter and JetBrains Mono. Edited in Weilanx Markdown.",
      "ft.links": "Links",
      "ft.releases": "Releases",
      "ft.issues": "Feedback",
      "ft.family": "Also by Weilanx",
    },
    zh: {
      "mast.issue": "第 01 期 · 写给写作者的编辑器",
      "nav.fidelity": "原文忠实",
      "nav.contents": "目录",
      "nav.playground": "排版",
      "nav.install": "安装",
      "hero.kicker": "VS Code 里的所见即所得 Markdown 编辑器",
      "hero.title": "用 Markdown 写，<br /><em>像读书一样看。</em>",
      "hero.lede": "光标不在的地方，# 和 ** 自动收起，眼前是一页排好版的文章。文件里存的，永远只是你敲下的那些字。",
      "hero.meta2": "MIT 开源 · 免费 · 离线可用",
      "cta.install": "免费安装",
      "cta.github": "GitHub 源码",
      "demo.h1": "关于好好写作",
      "demo.p1a": "好的文字",
      "demo.p1b": "清楚",
      "demo.p1c": "比漂亮更重要。每一个",
      "demo.p1d": "没用",
      "demo.p1e": "的字都删掉。",
      "demo.q": "初稿随性写，改稿冷静改。",
      "demo.li1": "写完大声念一遍",
      "demo.li2": "参考",
      "demo.li2b": "写作指南",
      "demo.code": "就在底栏里。",
      "demo.status": "📖 57 字 · 72 字符 · 🎙 0:13 · 阅读 <1 分钟",
      "cap.read": "锁定：只读，全部渲染，单击即可打开链接。",
      "cap.live": "编辑：光标所在的那一行显示源码。",
      "cap.source": "源码：每一个字符都摆在明面上。",
      "fid.quote": "渲染只是盖在上面的一张纸，<br /><em>纸下面的每个字都是你的。</em>",
      "fid.text": "很多所见即所得编辑器保存时，会从文档模型把整个文件重新生成一遍：列表符号被换掉，空行被合并，特殊字符被转义。Weilanx Markdown 只做装饰，从不重新序列化。打开文件改一个错字，git 里就只有那一行变化。",
      "fid.other": "常见的所见即所得编辑器，改了一个错字之后",
      "fid.ours": "Weilanx Markdown，同样的修改",
      "toc.title": "目录",
      "sb.sel": "⬚ 已选 128 / 3,427 字 · 160 字符 · 🎙 0:30 · 阅读 <1 分钟",
      "sb.t1": "字数",
      "sb.t2": "字符数",
      "sb.t3": "口播时长",
      "sb.t4": "段落",
      "sb.t6": "✓ 小红书标题",
      "ch1.t": "截图，⌘V，完事",
      "ch1.d": "截图、访达里复制的文件、直接拖进来都行。图片存到你指定的目录，默认是 assets/${fileName}/${date}-${time}.png，每个工作区可以单独配置，重名自动加序号，绝不覆盖。webview 读不到剪贴板图片时，插件会改读系统剪贴板兜底。",
      "ch2.t": "一页文章，三种看法",
      "ch2.d": "锁定模式用来读，编辑模式边写边预览，源码模式让每个字符都看得见。右上角一键切换，或者按 ⌘⌥M。",
      "ch3.t": "字体和版心，你说了算",
      "ch3.d": "字号默认跟随 VS Code。正文、标题、代码字体，行高、正文宽度、段落间距，都在 Aa 面板里一键调整，还能保存到用户或工作区设置。",
      "ch4.t": "按编辑的口径数字数",
      "ch4.d": "字数（中文按字、英文按词）、字符数、口播时长、阅读时长，全部显示在底栏；选中一段就只统计选中的部分。鼠标悬停，还能对照小红书、X、公众号的字数上限。",
      "ch5.t": "大纲，和暗色",
      "ch5.d": "侧栏大纲跟着你往下滚动。所有配色都取自 VS Code 主题，亮色暗色都协调。",
      "ch6.t": "表格、代码、公式、图表",
      "ch6.d": "圆角斑马纹表格、代码高亮、KaTeX 公式、Mermaid 图表、GitHub 提示块、任务列表，写完还能导出 HTML 或 PDF。",
      "pg.title": "自己动手排一排",
      "pg.sub": "这就是编辑器里 Aa 面板的那几个控件，试试看。",
      "pg.font": "正文字体",
      "pg.sans": "无衬线",
      "pg.serif": "衬线",
      "pg.mono": "等宽",
      "pg.size": "字号",
      "pg.lh": "行高",
      "pg.width": "版心宽度",
      "pg.h": "段落的最后一行",
      "pg.p1": "一行中文放三十到四十个字最舒服。太窄，眼睛来回跳得太勤；太宽，读完一行往回找下一行时容易串行。",
      "pg.p2": "剩下的交给行高。正文行高在 1.75 左右最透气，标题可以排得紧一些。",
      "ct.title": "打几个字，看看底栏",
      "ct.sample": "# 一段口播稿\n\n今天聊聊我最近在用的 **Markdown 编辑器**。选中其中一段，底栏就只统计你选中的部分，规则和插件里完全一样。",
      "in.title": "安装",
      "in.s1": "运行安装脚本，或者下载 .vsix",
      "in.s1n": "会自动装进本机所有基于 VS Code 的编辑器。也可以下载 <a href=\"https://github.com/Azure12355/weilanx-markdown/releases/latest/download/weilanx-markdown.vsix\">weilanx-markdown.vsix</a>，在扩展面板选 <i>从 VSIX 安装…</i>",
      "in.s2": "设为默认的 Markdown 编辑器（可选）",
      "in.s3": "或者交给你的 Agent",
      "in.prompt": "按照 https://github.com/Azure12355/weilanx-markdown/blob/main/docs/install-for-agents.md 帮我安装 Weilanx Markdown，装完校验。",
      copy: "复制",
      copied: "已复制",
      "ft.colophon": "版权页",
      "ft.fonts": "标题用 Instrument Serif 和思源宋体，正文用 Inter 和 JetBrains Mono。本页文案在 Weilanx Markdown 里写成。",
      "ft.links": "链接",
      "ft.releases": "版本下载",
      "ft.issues": "问题反馈",
      "ft.family": "同系列作品",
    },
  };

  // ---------- 语言 ----------
  const params = new URLSearchParams(location.search);
  let lang = params.get("lang") || localStorage.getItem("wmd-lang") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
  if (lang !== "zh") lang = "en";
  const t = (k) => DICT[lang][k] ?? DICT.en[k] ?? k;

  function applyLang() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    document.getElementById("lang-toggle").textContent = lang === "zh" ? "EN" : "中文";
    document.title = lang === "zh" ? "Weilanx Markdown · 用 Markdown 写，像读书一样看" : "Weilanx Markdown · Write in Markdown, read it as prose";
    setMode(mode, false);
    resetCounter();
  }
  document.getElementById("lang-toggle").addEventListener("click", () => {
    lang = lang === "zh" ? "en" : "zh";
    localStorage.setItem("wmd-lang", lang);
    applyLang();
  });

  // ---------- 纸面编辑器:三种模式自动轮播,点击后停止 ----------
  const paper = document.getElementById("paper");
  const caption = document.getElementById("paper-caption");
  const MODES = ["live", "read", "source"];
  let mode = "live";
  let auto = true;
  function setMode(m) {
    mode = m;
    paper.dataset.mode = m;
    paper.querySelectorAll(".modes button").forEach((b) => {
      b.classList.toggle("on", b.dataset.mode === m);
      b.setAttribute("aria-checked", String(b.dataset.mode === m));
    });
    caption.textContent = t("cap." + m);
  }
  paper.querySelectorAll(".modes button").forEach((b) =>
    b.addEventListener("click", () => {
      auto = false;
      setMode(b.dataset.mode);
    }),
  );
  setInterval(() => {
    if (auto && !document.hidden) setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  }, 3200);

  // ---------- 目录:章节进入视口时切换左侧配图 ----------
  const plates = document.querySelectorAll(".plate-img");
  const chapters = document.querySelectorAll(".chapter");
  function showChapter(ch) {
    plates.forEach((p) => p.classList.toggle("active", p.dataset.ch === ch));
    chapters.forEach((c) => c.classList.toggle("active", c.dataset.ch === ch));
  }
  showChapter("1");
  const chObs = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && showChapter(e.target.dataset.ch)),
    { rootMargin: "-45% 0px -45% 0px" },
  );
  chapters.forEach((c) => chObs.observe(c));

  // ---------- 排版试验台 ----------
  const sample = document.getElementById("pg-sample");
  const FONTS = {
    sans: 'Inter, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    serif: '"Instrument Serif", "Noto Serif SC", "Songti SC", Georgia, serif',
    mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
  };
  document.querySelectorAll("#pg-font button").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll("#pg-font button").forEach((x) => x.classList.toggle("on", x === b));
      sample.style.fontFamily = FONTS[b.dataset.v];
    }),
  );
  const ranges = [
    ["pg-size", "pg-size-v", (v) => (sample.style.fontSize = v + "px"), (v) => v + "px"],
    ["pg-lh", "pg-lh-v", (v) => (sample.style.lineHeight = v), (v) => Number(v).toFixed(2)],
    ["pg-w", "pg-w-v", (v) => (sample.style.maxWidth = v + "px"), (v) => v + "px"],
  ];
  for (const [id, out, apply, show] of ranges) {
    const input = document.getElementById(id);
    const update = () => {
      apply(input.value);
      document.getElementById(out).textContent = show(input.value);
    };
    input.addEventListener("input", update);
    update();
  }

  // ---------- 实时字数条:与插件 src/core/stats.ts 同一口径 ----------
  const CJK_G = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯\u{20000}-\u{2fa1f}]/gu;
  const LATIN_WORD = /[A-Za-z0-9À-ɏ]+(?:['’.-][A-Za-z0-9À-ɏ]+)*/g;
  function toPlain(md) {
    return md
      .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n {0,3}\1[`~]*[ \t]*(?=\n|$)|$)/gm, "")
      .split("\n")
      .map((l) =>
        l
          .replace(/^\s{0,3}#{1,6}\s+/, "")
          .replace(/^\s*(?:>\s?)+/, "")
          .replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, ""),
      )
      .join("\n")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/(\*\*|__|~~|\*|_|`)/g, "");
  }
  function count(md) {
    const plain = toPlain(md);
    const cjk = (plain.match(CJK_G) || []).length;
    const latin = (plain.replace(CJK_G, " ").match(LATIN_WORD) || []).length;
    const chars = Array.from(plain.replace(/\s/g, "")).length;
    return { words: cjk + latin, cjk, latin, chars };
  }
  const dur = (s, cjkPerMin, wordsPerMin) => Math.round((s.cjk / cjkPerMin + s.latin / wordsPerMin) * 60);
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const mins = (sec) => (sec <= 0 ? "0" : sec < 60 ? "<1" : String(Math.round(sec / 60)));
  const fmt = (n) => n.toLocaleString("en-US");

  const input = document.getElementById("ct-input");
  const bar = document.getElementById("ct-bar");
  function renderBar() {
    const doc = count(input.value);
    const hasSel = input.selectionEnd > input.selectionStart;
    const sel = hasSel ? count(input.value.slice(input.selectionStart, input.selectionEnd)) : null;
    const s = sel || doc;
    const speak = mmss(dur(s, 260, 150));
    const read = mins(dur(s, 400, 230));
    const z = lang === "zh";
    const wordsPart = sel
      ? z ? `已选 ${fmt(sel.words)} / ${fmt(doc.words)} 字` : `${fmt(sel.words)} of ${fmt(doc.words)} words`
      : z ? `${fmt(doc.words)} 字` : `${fmt(doc.words)} words`;
    const charsPart = z ? `${fmt(s.chars)} 字符` : `${fmt(s.chars)} chars`;
    const readPart = z ? `阅读 ${read} 分钟` : `${read} min read`;
    bar.textContent = `${sel ? "⬚" : "📖"} ${wordsPart} · ${charsPart} · 🎙 ${speak} · ${readPart}`;
  }
  let touched = false;
  function resetCounter() {
    if (!touched) input.value = t("ct.sample");
    renderBar();
  }
  input.addEventListener("input", () => {
    touched = true;
    renderBar();
  });
  ["select", "keyup", "mouseup", "focus"].forEach((ev) => input.addEventListener(ev, renderBar));
  document.addEventListener("selectionchange", () => document.activeElement === input && renderBar());

  // ---------- 复制按钮 ----------
  document.querySelectorAll(".copy").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const text = btn.parentElement.querySelector("pre").textContent;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      btn.textContent = t("copied");
      btn.classList.add("done");
      setTimeout(() => {
        btn.textContent = t("copy");
        btn.classList.remove("done");
      }, 1400);
    }),
  );

  // ---------- 进场动画 ----------
  const revealTargets = document.querySelectorAll(".fidelity .col, .diff, .contents-head, .pg-head, .pg, .counter-inner, .steps li");
  revealTargets.forEach((el) => el.classList.add("reveal"));
  const rvObs = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          rvObs.unobserve(e.target);
        }
      }),
    { threshold: 0.12 },
  );
  revealTargets.forEach((el) => rvObs.observe(el));

  applyLang();
})();
