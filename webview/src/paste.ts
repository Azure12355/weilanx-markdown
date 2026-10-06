// 粘贴 / 拖入图片。
// 「上传中」占位符只是装饰(随编辑自动移动位置),不写进文档;扩展端存好图片后才在占位处插入最终链接。
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { UploadItem } from "../../src/core/protocol";
import { env } from "./env";
import { t } from "./i18n";

class PendingWidget extends WidgetType {
  constructor(readonly id: string) {
    super();
  }
  eq(o: PendingWidget) {
    return o.id === this.id;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "wmd-pending";
    el.textContent = t("uploading");
    return el;
  }
}

const addPending = StateEffect.define<{ id: string; pos: number }>({ map: (v, m) => ({ ...v, pos: m.mapPos(v.pos) }) });
const removePending = StateEffect.define<string>();

const pendingField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, tr) {
    set = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(addPending)) set = set.update({ add: [Decoration.widget({ widget: new PendingWidget(e.value.id), side: 1 }).range(e.value.pos)] });
      if (e.is(removePending)) set = set.update({ filter: (_f, _t, d) => (d.spec.widget as PendingWidget).id !== e.value });
    }
    return set;
  },
  provide: (f) => EditorView.decorations.from(f),
});

let seq = 0;
const newId = () => `p${Date.now().toString(36)}${++seq}`;

function pendingPos(view: EditorView, id: string): number | null {
  let pos: number | null = null;
  view.state.field(pendingField).between(0, view.state.doc.length, (from, _to, d) => {
    if ((d.spec.widget as PendingWidget).id === id) pos = from;
  });
  return pos;
}

/** 扩展端返回结果:在占位处插入链接;前后不在行首行尾时补换行,让图片独占一行 */
export function resolvePending(view: EditorView, id: string, markdown?: string) {
  const pos = pendingPos(view, id);
  if (pos === null) return;
  const effects = removePending.of(id);
  if (!markdown) {
    view.dispatch({ effects });
    return;
  }
  const doc = view.state.doc;
  const line = doc.lineAt(pos);
  const before = pos > line.from && doc.sliceString(pos - 1, pos) !== "\n" ? "\n" : "";
  const after = pos < line.to ? "\n" : "";
  const insert = before + markdown + after;
  view.dispatch({ changes: { from: pos, insert }, effects, selection: { anchor: pos + insert.length - after.length } });
}

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function selectedText(view: EditorView): string {
  const r = view.state.selection.main;
  return view.state.sliceDoc(r.from, r.to);
}

/** 把一批图片挂到当前光标处:每张先放占位符,再交给扩展端 */
async function uploadFiles(view: EditorView, files: File[], pos?: number) {
  const at = pos ?? view.state.selection.main.head;
  const items: UploadItem[] = [];
  const effects = [];
  for (const f of files) {
    const id = newId();
    effects.push(addPending.of({ id, pos: at }));
    items.push({ id, name: f.name || undefined, mime: f.type, data: await readAsBase64(f) });
  }
  view.dispatch({ effects });
  env.post({ type: "upload", items, alt: selectedText(view) });
}

const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|avif|ico)$/i.test(f.name);

/** 剪贴板 HTML 里只有一张网页图片(浏览器「复制图片」常见)时取出它的地址 */
function remoteImage(html: string): string | null {
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs = doc.querySelectorAll("img");
  if (imgs.length !== 1 || doc.body.textContent?.trim()) return null;
  const src = imgs[0].getAttribute("src") ?? "";
  return /^https?:/i.test(src) ? src : null;
}

const URL_RE = /^(https?:\/\/|mailto:)\S+$/i;

export function pasteHandlers() {
  return [
    pendingField,
    EditorView.domEventHandlers({
      paste(e, view) {
        const data = e.clipboardData;
        if (!data) return false;
        const files = [...data.files].filter(isImage);
        if (!files.length) {
          for (const item of data.items) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
              const f = item.getAsFile();
              if (f) files.push(f);
            }
          }
        }
        if (files.length) {
          e.preventDefault();
          void uploadFiles(view, files);
          return true;
        }
        const text = data.getData("text/plain");
        const remote = remoteImage(data.getData("text/html"));
        if (remote && !text.trim().replace(remote, "")) {
          e.preventDefault();
          const id = newId();
          view.dispatch({ effects: addPending.of({ id, pos: view.state.selection.main.head }) });
          env.post({ type: "upload", items: [{ id, url: remote }], alt: "" });
          return true;
        }
        // 选中文字时粘贴网址:变成 [文字](网址)
        const sel = view.state.selection.main;
        if (!sel.empty && URL_RE.test(text.trim())) {
          e.preventDefault();
          const label = view.state.sliceDoc(sel.from, sel.to);
          view.dispatch({ changes: { from: sel.from, to: sel.to, insert: `[${label}](${text.trim()})` } });
          return true;
        }
        // 剪贴板里什么文字都没有:可能是 webview 拿不到的截图 / 复制的文件,让扩展端读系统剪贴板
        if (!text && !data.types.includes("text/html")) {
          e.preventDefault();
          const id = newId();
          view.dispatch({ effects: addPending.of({ id, pos: view.state.selection.main.head }) });
          env.post({ type: "clipboardFallback", id, alt: selectedText(view) });
          return true;
        }
        return false;
      },
      dragover(e) {
        if (e.dataTransfer?.types.some((t) => t === "Files" || t === "text/uri-list" || t === "application/vnd.code.uri-list")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          return true;
        }
        return false;
      },
      drop(e, view) {
        const dt = e.dataTransfer;
        if (!dt) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
        const files = [...dt.files].filter(isImage);
        if (files.length) {
          e.preventDefault();
          view.dispatch({ selection: { anchor: pos } });
          void uploadFiles(view, files, pos);
          return true;
        }
        // 从 VS Code 资源管理器拖入(拖进 webview 需要按住 Shift)
        const uris = (dt.getData("application/vnd.code.uri-list") || dt.getData("text/uri-list"))
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("#"));
        const images = uris.filter((u) => /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|avif|ico)$/i.test(u.split(/[?#]/)[0]));
        if (images.length) {
          e.preventDefault();
          const items: UploadItem[] = [];
          const effects = [];
          for (const uri of images) {
            const id = newId();
            effects.push(addPending.of({ id, pos }));
            items.push(/^https?:/i.test(uri) ? { id, url: uri } : { id, uri });
          }
          view.dispatch({ effects, selection: { anchor: pos } });
          env.post({ type: "upload", items, alt: "" });
          return true;
        }
        return false;
      },
    }),
  ];
}
