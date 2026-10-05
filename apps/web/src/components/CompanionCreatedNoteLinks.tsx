import { createMemoLinkHref, type CompanionToolCall } from "@edgeever/shared";
import { parseAssistantNoteLinkHref } from "@/lib/assistant-note-links";

export function missingCreatedNoteLinks(response: string, tools: CompanionToolCall[]) {
  const linkedIds = new Set<string>();
  for (const match of response.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
    const memoId = parseAssistantNoteLinkHref(match[1]);
    if (memoId) linkedIds.add(memoId);
  }
  for (const match of response.matchAll(/\[note:([^\]]+)\]/g)) linkedIds.add(match[1]);

  const missing = new Map<string, { memoId: string; notebookId: string; title: string }>();
  for (const tool of tools) {
    if (tool.status !== "done") continue;
    for (const effect of tool.effects) {
      if (effect.kind !== "created" && effect.kind !== "merged") continue;
      if (!effect.memoId || linkedIds.has(effect.memoId)) continue;
      missing.set(effect.memoId, {
        memoId: effect.memoId,
        notebookId: effect.notebookId ?? "",
        title: effect.title || effect.memoId,
      });
    }
  }
  return [...missing.values()];
}

export function CompanionCreatedNoteLinks({
  response, tools, onOpenNote,
}: {
  response: string;
  tools: CompanionToolCall[];
  onOpenNote: (id: string, notebookId: string) => void;
}) {
  const links = missingCreatedNoteLinks(response, tools);
  if (!links.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {links.map(({ memoId, notebookId, title }) => (
        <li key={memoId}>
          <a
            className="wrap-anywhere rounded-sm font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            href={createMemoLinkHref(memoId)}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenNote(memoId, notebookId); }}
          >
            {title}
          </a>
        </li>
      ))}
    </ul>
  );
}
