import type { Editor } from "@tiptap/core";
import {
  BLOCK_MATH_NODE_TYPE,
  INLINE_MATH_NODE_TYPE,
} from "@edgeever/shared/mathematics";

export type MathFormulaKind = "inline" | "block";

export type MathFormulaTarget = {
  kind: MathFormulaKind;
  latex: string;
  pos: number;
};

export type MathFormulaDraft = {
  kind: MathFormulaKind;
  latex: string;
  pos?: number;
  from?: number;
  to?: number;
};

export const selectedTextAsLatex = (editor: Editor) =>
  editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ").trim();

export const resolveMathFormulaTarget = (editor: Editor, pos?: number): MathFormulaTarget | null => {
  const documentPos = pos ?? editor.state.selection.from;
  const node = editor.state.doc.nodeAt(documentPos);
  if (!node) return null;
  if (node.type.name === INLINE_MATH_NODE_TYPE) {
    return { kind: "inline", pos: documentPos, latex: String(node.attrs.latex ?? "") };
  }
  if (node.type.name === BLOCK_MATH_NODE_TYPE) {
    return { kind: "block", pos: documentPos, latex: String(node.attrs.latex ?? "") };
  }
  return null;
};

export const applyMathFormula = (editor: Editor, draft: MathFormulaDraft) => {
  const latex = draft.latex.trim();
  if (!latex) return false;

  if (typeof draft.pos === "number") {
    return draft.kind === "inline"
      ? editor.commands.updateInlineMath({ latex, pos: draft.pos })
      : editor.commands.updateBlockMath({ latex, pos: draft.pos });
  }

  const from = draft.from ?? editor.state.selection.from;
  const to = draft.to ?? from;
  const content = draft.kind === "inline"
    ? { type: INLINE_MATH_NODE_TYPE, attrs: { latex } }
    : { type: BLOCK_MATH_NODE_TYPE, attrs: { latex } };

  return editor.chain().insertContentAt(from === to ? from : { from, to }, content).run();
};

export const deleteMathFormula = (editor: Editor, target: Pick<MathFormulaTarget, "kind" | "pos">) => {
  return target.kind === "inline"
    ? editor.commands.deleteInlineMath({ pos: target.pos })
    : editor.commands.deleteBlockMath({ pos: target.pos });
};
