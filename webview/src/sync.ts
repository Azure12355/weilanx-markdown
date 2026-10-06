// 文档同步:本地修改以增量发给扩展端;扩展端推来的外部修改按位置应用(光标、滚动自动映射,不跳)
import { Annotation, ChangeSpec, Transaction } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import type { Change } from "../../src/core/protocol";
import { env } from "./env";

/** 来自扩展端的修改:不再回发 */
export const remote = Annotation.define<boolean>();

let seq = 0;

export function syncListener() {
  return EditorView.updateListener.of((u: ViewUpdate) => {
    if (!u.docChanged) return;
    const local = u.transactions.filter((tr) => tr.docChanged && !tr.annotation(remote));
    if (!local.length) return;
    // 一次更新里可能有多个事务:逐个发,每个都基于它自己之前的文档长度
    for (const tr of local) {
      const changes: Change[] = [];
      tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => changes.push([fromA, toA, inserted.toString()]));
      env.post({ type: "changes", seq: ++seq, baseLength: tr.startState.doc.length, changes });
    }
  });
}

export function applyExternal(view: EditorView, changes: { offset: number; length: number; text: string }[], length: number) {
  const doc = view.state.doc;
  // 外部修改之前两边长度应该一致;对不上就整篇重置
  const before = length - changes.reduce((n, c) => n + c.text.length - c.length, 0);
  if (before !== doc.length) return false;
  const spec: ChangeSpec[] = changes.map((c) => ({ from: c.offset, to: c.offset + c.length, insert: c.text }));
  view.dispatch({ changes: spec, annotations: [remote.of(true), Transaction.addToHistory.of(false)] });
  return true;
}

export function resetDoc(view: EditorView, text: string) {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  const col = head - line.from;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, annotations: [remote.of(true), Transaction.addToHistory.of(false)] });
  // 尽量回到原来的行列
  const doc = view.state.doc;
  const ln = doc.line(Math.min(line.number, doc.lines));
  view.dispatch({ selection: { anchor: Math.min(ln.from + col, ln.to) }, annotations: remote.of(true) });
}
