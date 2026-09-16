import { docToMarkdown, markdownToDoc, type TiptapDoc } from "@edgeever/shared";
import type { MemoDocumentAction } from "@/lib/app-helpers";
import type { Editor } from "@tiptap/react";
import { isEditorReady } from "./editor-pane-helpers";

export type EditorExportContent = {
  document: TiptapDoc;
  markdown: string;
};

export const resolveEditorExportContent = ({
  editor,
  getMobilePlainTextValue,
  markdownSource,
  useMarkdownSourceEditor,
  useMobilePlainTextEditor,
}: {
  editor: Editor | null;
  getMobilePlainTextValue: () => string;
  markdownSource: string;
  useMarkdownSourceEditor: boolean;
  useMobilePlainTextEditor: boolean;
}): EditorExportContent | null => {
  if (!isEditorReady(editor)) {
    return null;
  }

  if (useMobilePlainTextEditor) {
    const markdown = getMobilePlainTextValue();
    return { markdown, document: markdownToDoc(markdown) };
  }

  if (useMarkdownSourceEditor) {
    return { markdown: markdownSource, document: markdownToDoc(markdownSource) };
  }

  const document = editor.getJSON() as TiptapDoc;
  return { markdown: docToMarkdown(document), document };
};

export const dispatchMemoDocumentAction = (
  action: MemoDocumentAction,
  handlers: {
    exportHtml: () => void;
    exportMarkdown: () => void;
    exportPdf: (printWindow?: Window | null) => void;
    saveAsTemplate: () => void;
    share: () => void;
    shareImage: () => void;
  },
  printWindow?: Window | null,
) => {
  switch (action) {
    case "share":
      handlers.share();
      break;
    case "export-markdown":
      handlers.exportMarkdown();
      break;
    case "export-html":
      handlers.exportHtml();
      break;
    case "export-pdf":
      handlers.exportPdf(printWindow);
      break;
    case "share-image":
      handlers.shareImage();
      break;
    case "save-as-template":
      handlers.saveAsTemplate();
      break;
  }
};
