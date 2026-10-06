// 字体与排版:设置 → CSS 变量;「Aa」面板实时调整,可以保存到用户 / 工作区设置
import { DEFAULT_TYPOGRAPHY, resolveTypography, type EditorFont, type TypographySettings } from "../../src/core/typography";
import { env } from "./env";
import { t } from "./i18n";

let current: TypographySettings = { ...DEFAULT_TYPOGRAPHY };
let editorFont: EditorFont = { fontSize: 14, fontFamily: "Menlo, monospace" };
/** ⌘⌥= / ⌘⌥- 的临时缩放(px),不写设置 */
let zoom = 0;
let onApplied: () => void = () => {};

export function initTypography(settings: TypographySettings, editor: EditorFont, applied: () => void) {
  current = { ...settings };
  editorFont = editor;
  onApplied = applied;
  apply();
}

export function zoomBy(delta: number | null) {
  zoom = delta === null ? 0 : Math.max(-8, Math.min(24, zoom + delta));
  apply();
}

function apply() {
  const r = resolveTypography(current, editorFont);
  const s = document.documentElement.style;
  s.setProperty("--md-font-size", `${r.fontSize + zoom}px`);
  s.setProperty("--md-font", r.fontFamily);
  s.setProperty("--md-heading-font", r.headingFamily);
  s.setProperty("--md-code-font", r.codeFamily);
  s.setProperty("--md-line-height", String(r.lineHeight));
  s.setProperty("--md-max-width", r.maxWidth ? `${r.maxWidth}px` : "none");
  s.setProperty("--md-blank", `${r.paragraphSpacing}em`);
  onApplied();
  syncPanel();
}

// ---------- 面板 ----------

let panel: HTMLElement | null = null;

const FAMILIES = ["sans", "serif", "mono", "editor"] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function row(label: string, ...children: HTMLElement[]) {
  const r = el("div", "wmd-p-row");
  r.append(el("label", "wmd-p-label", label), ...children);
  return r;
}

function slider(min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) {
  const wrap = el("div", "wmd-p-slider");
  const input = el("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const val = el("span", "wmd-p-val");
  input.oninput = () => {
    set(Number(input.value));
    apply();
  };
  wrap.append(input, val);
  return Object.assign(wrap, {
    sync: () => {
      input.value = String(get());
      val.textContent = fmt(get());
    },
  });
}

function fontPicker(get: () => string, set: (v: string) => void, allowSame: boolean) {
  const wrap = el("div", "wmd-p-font");
  const seg = el("div", "wmd-p-seg");
  const opts: [string, string][] = [...(allowSame ? ([["", t("sameAsBody")]] as [string, string][]) : []), ["sans", t("sans")], ["serif", t("serif")], ["mono", t("mono")], ["editor", t("editorFont")]];
  const buttons = opts.map(([v, label]) => {
    const b = el("button", "", label);
    b.type = "button";
    b.onclick = () => {
      set(v);
      apply();
    };
    seg.appendChild(b);
    return [v, b] as const;
  });
  const custom = el("input", "wmd-p-input");
  custom.placeholder = t("customPrompt");
  custom.onchange = () => {
    const v = custom.value.trim();
    if (v) {
      set(v);
      apply();
    }
  };
  wrap.append(seg, custom);
  return Object.assign(wrap, {
    sync: () => {
      const v = get();
      for (const [k, b] of buttons) b.classList.toggle("on", k === v);
      const isPreset = opts.some(([k]) => k === v);
      if (document.activeElement !== custom) custom.value = isPreset ? "" : v;
      custom.classList.toggle("on", !isPreset);
    },
  });
}

let syncers: (() => void)[] = [];

function syncPanel() {
  for (const s of syncers) s();
}

function buildPanel(): HTMLElement {
  const p = el("div", "wmd-panel");
  p.addEventListener("mousedown", (e) => e.stopPropagation());
  p.appendChild(el("div", "wmd-p-title", t("typography")));

  // 字号:跟随编辑器 / 自定义
  const sizeWrap = el("div", "wmd-p-size");
  const minus = el("button", "", "−");
  const plus = el("button", "", "+");
  const sizeVal = el("span", "wmd-p-val");
  const follow = el("label", "wmd-p-check");
  const followBox = el("input");
  followBox.type = "checkbox";
  follow.append(followBox, document.createTextNode(t("followEditor")));
  const effective = () => (current.size > 0 ? current.size : editorFont.fontSize);
  minus.onclick = () => {
    current.size = Math.max(10, effective() - 1);
    apply();
  };
  plus.onclick = () => {
    current.size = Math.min(40, effective() + 1);
    apply();
  };
  followBox.onchange = () => {
    current.size = followBox.checked ? 0 : effective();
    apply();
  };
  sizeWrap.append(minus, sizeVal, plus, follow);
  syncers.push(() => {
    sizeVal.textContent = `${effective()}px`;
    followBox.checked = current.size === 0;
  });
  p.appendChild(row(t("fontSize"), sizeWrap));

  const body = fontPicker(() => current.family, (v) => (current.family = v || "sans"), false);
  const heading = fontPicker(() => current.headingFamily, (v) => (current.headingFamily = v), true);
  const lh = slider(1.2, 2.4, 0.05, () => current.lineHeight, (v) => (current.lineHeight = v), (v) => v.toFixed(2));
  const width = slider(0, 1600, 20, () => current.maxWidth, (v) => (current.maxWidth = v < 480 ? 0 : v), (v) => (v < 480 ? t("full") : `${v}px`));
  const gap = slider(0, 2, 0.1, () => current.paragraphSpacing, (v) => (current.paragraphSpacing = v), (v) => `${v.toFixed(1)}em`);
  syncers.push(body.sync, heading.sync, lh.sync, width.sync, gap.sync);
  p.append(row(t("font"), body), row(t("headingFont"), heading), row(t("lineHeight"), lh), row(t("width"), width), row(t("spacing"), gap));

  const actions = el("div", "wmd-p-actions");
  const reset = el("button", "wmd-p-ghost", t("reset"));
  reset.onclick = () => {
    current = { ...DEFAULT_TYPOGRAPHY };
    apply();
  };
  const saveWs = el("button", "wmd-p-ghost", t("saveWorkspace"));
  saveWs.onclick = () => env.post({ type: "saveTypography", target: "workspace", values: { ...current } });
  const saveUser = el("button", "wmd-p-primary", t("saveUser"));
  saveUser.onclick = () => env.post({ type: "saveTypography", target: "user", values: { ...current } });
  actions.append(reset, saveWs, saveUser);
  p.appendChild(actions);
  return p;
}

export function togglePanel(anchor: HTMLElement) {
  if (panel) {
    closePanel();
    return;
  }
  syncers = [];
  panel = buildPanel();
  document.body.appendChild(panel);
  const r = anchor.getBoundingClientRect();
  panel.style.top = `${r.bottom + 6}px`;
  panel.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  syncPanel();
  setTimeout(() => document.addEventListener("mousedown", outside), 0);
}

function outside(e: MouseEvent) {
  if (panel && !panel.contains(e.target as Node)) closePanel();
}

export function closePanel() {
  panel?.remove();
  panel = null;
  document.removeEventListener("mousedown", outside);
}


