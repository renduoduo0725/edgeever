import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  BLOCK_MATH_NODE_TYPE,
  edgeEverBlockMathMarkdownTokenizer,
  edgeEverInlineMathMarkdownTokenizer,
  INLINE_MATH_NODE_TYPE,
} from "./mathematics-markdown";

export {
  BLOCK_MATH_NODE_TYPE,
  INLINE_MATH_NODE_TYPE,
} from "./mathematics-markdown";

export type EdgeEverMathematicsClickHandler = (node: ProseMirrorNode, pos: number) => void;

export type CreateEdgeEverMathematicsOptions = {
  onInlineClick?: EdgeEverMathematicsClickHandler;
  onBlockClick?: EdgeEverMathematicsClickHandler;
};

const EdgeEverInlineMath = InlineMath.extend({
  markdownTokenizer: edgeEverInlineMathMarkdownTokenizer,
});

const EdgeEverBlockMath = BlockMath.extend({
  markdownTokenizer: edgeEverBlockMathMarkdownTokenizer,
});

const katexOptions = {
  throwOnError: false,
  strict: "warn" as const,
  trust: false,
};

/** Fresh extension instances for each TipTap editor or Markdown manager. */
export const createEdgeEverMathematics = (options: CreateEdgeEverMathematicsOptions = {}) => [
  EdgeEverBlockMath.configure({ katexOptions, onClick: options.onBlockClick }),
  EdgeEverInlineMath.configure({ katexOptions, onClick: options.onInlineClick }),
];
