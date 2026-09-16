import type { CompanionSource } from "@edgeever/shared";
import { createMemoLinkHref, parseMemoLinkHref } from "@edgeever/shared";
import { marked } from "marked";
import { useMemo, type MouseEvent } from "react";

const NOTE_TOKEN = /\[note:([^\]]+)\]/g;

const toMarkdown = (text: string, sources: CompanionSource[]) => {
  const byId = new Map(sources.map(source => [source.id, source]));
  return text.replace(NOTE_TOKEN, (_match, id: string) => {
    const title = (byId.get(id)?.title || id).replace(/[[\]]/g, "");
    return `[${title}](${createMemoLinkHref(id)})`;
  });
};

export function CompanionNoteText({
  text,
  sources,
  onOpenNote,
}: {
  text: string;
  sources: CompanionSource[];
  onOpenNote: (id: string, notebookId: string) => void;
}) {
  const byId = useMemo(() => new Map(sources.map(source => [source.id, source])), [sources]);
  const html = useMemo(
    () => marked.parse(toMarkdown(text, sources), { async: false, gfm: true, breaks: true }) as string,
    [text, sources],
  );

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a");
    if (!link) return;
    const memoId = parseMemoLinkHref(link.getAttribute("href"));
    if (!memoId) return;
    event.preventDefault();
    onOpenNote(memoId, byId.get(memoId)?.notebookId ?? "");
  };

  return <div
    className="companion-markdown markdown-content max-w-none"
    dangerouslySetInnerHTML={{ __html: html }}
    onClick={handleClick}
  />;
}
