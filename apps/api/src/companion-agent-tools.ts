import { jsonSchema, tool, type ToolSet } from "ai";
import type { CompanionSource, CompanionTurnInput, MemoDetail, MemoSummary } from "@edgeever/shared";
import type { DatabaseAdapter } from "./storage-contract";
import type { AppContext } from "./api-context";
import type { CompanionScope } from "./companion-service";
import { COMPANION_MCP_TOOLS, validateCompanionTool } from "./companion-tool-catalog";
import { companionWorkspaceCursor, proposeCompanionToolAction } from "./companion-tool-actions";
import { executeWorkspaceTool } from "./mcp-tool-executor";
import { getMemoDetail } from "./memo-service";
import { AppError } from "./app-error";

const AUTO_APPLY_WRITES = new Set(["create_memo", "update_memo", "trash_memos"]);

export function createCompanionTools(args: { db: DatabaseAdapter; scope: CompanionScope; input: CompanionTurnInput;
  context?: AppContext; signal: AbortSignal; assertActive: () => Promise<void>; sources: CompanionSource[] }): ToolSet {
  if (!args.input.allowNotes || !args.context) return {};
  let calls = 0;
  let noteRemaining = 12000;
  let metadataRemaining = 12000;
  let cursor: number | undefined;
  const inspected = new Map<string, number>();
  const takeNoteText = (text: string, limit: number) => {
    const result = text.slice(0, Math.min(limit, noteRemaining));
    noteRemaining -= result.length;
    return result;
  };
  const remember = (memo: MemoSummary) => {
    const source = { id: memo.id, title: (memo.title ?? "").slice(0, 200), revision: memo.revision, notebookId: memo.notebookId };
    const index = args.sources.findIndex(item => item.id === memo.id);
    if (index < 0) args.sources.push(source); else args.sources[index] = source;
    return source;
  };
  const catalog = COMPANION_MCP_TOOLS.filter(definition =>
    args.input.allowWrites !== false || definition.annotations.readOnlyHint);
  const toolHints: Record<string, string> = {
    find_notebooks: " Use this whenever the user names a notebook. Notebook names are not IDs.",
    list_notebooks: " Use this to list every notebook name. Do not guess names from the open note.",
    list_memos: " To list a named notebook, call find_notebooks first and pass that id. Without notebookId this lists the whole workspace. If hasMore is true, say the list is incomplete.",
    search_memos: " Searches note titles and bodies, not notebook names. Do not pass notebookId unless find_notebooks or list_notebooks returned it. For notes in a named notebook, find_notebooks then list_memos.",
    list_tags: " Use this when the user names a tag.",
  };
  let notebookNames: Map<string, string> | undefined;
  const notebookName = async (id: string) => {
    try {
      if (!notebookNames) {
        const listed = await executeWorkspaceTool(args.context!, args.context!.get("auth"), "list_notebooks", {}) as { notebooks: { id: string; name: string }[] };
        notebookNames = new Map((listed.notebooks ?? []).map(notebook => [notebook.id, notebook.name]));
      }
      return notebookNames.get(id);
    } catch {
      return undefined;
    }
  };
  return Object.fromEntries(catalog.map(definition => {
    const readOnly = definition.annotations.readOnlyHint;
    const autoApply = AUTO_APPLY_WRITES.has(definition.name);
    return [definition.name, tool({
      description: `${definition.description}${toolHints[definition.name] ?? ""}${readOnly || autoApply ? autoApply ? " This executes immediately. New notes are created in the named notebook. Trashed notes go to the recycle bin; edits keep revision history." : "" : " This only proposes changes; the user must confirm the card. Supply a short _reason."}`,
      inputSchema: jsonSchema<Record<string, unknown>>((readOnly || autoApply ? definition.inputSchema : {
        ...definition.inputSchema, properties: { ...definition.inputSchema.properties, _reason: { type: "string", minLength: 1, maxLength: 400 } },
        required: [...(definition.inputSchema.required ?? []), "_reason"],
      }) as Parameters<typeof jsonSchema>[0]),
      execute: async input => {
        args.signal.throwIfAborted();
        await args.assertActive();
        if (++calls > 16) throw new Error("Tool call limit reached.");
        const { _reason, ...parameters } = input;
        const { args: parameters_ } = validateCompanionTool(definition.name, parameters);
        const current = await companionWorkspaceCursor(args.db, args.scope.workspaceId);
        cursor ??= current;
        if (cursor !== current) return { error: "Notes changed during this request. Start a fresh request." };
        if (!readOnly && !autoApply && parameters_.dryRun !== true) return proposeCompanionToolAction(args.db, args.scope, args.input.id,
          definition.name, parameters_, typeof _reason === "string" ? _reason : definition.title, cursor, inspected);
        if (autoApply && parameters_.dryRun !== true && definition.name === "update_memo") {
          const memo = await getMemoDetail(args.db, args.scope.workspaceId, String(parameters_.memoId));
          if (!memo || inspected.get(memo.id) !== memo.revision) {
            throw new AppError("companion_action_unread", "Read the complete source notes before changing their content.", 400);
          }
        }
        if (definition.name === "get_memo" && inspected.has(String(parameters_.memoId))) {
          // The original full result remains in this run's model messages. Only
          // reuse it after authorization/context/cursor checks, never across runs.
          return { id: parameters_.memoId, revision: inspected.get(String(parameters_.memoId)), alreadyRead: true,
            message: "Use the complete get_memo result already returned in this run." };
        }
        if (definition.name === "search_memos") parameters_.limit = Math.min(Number(parameters_.limit ?? 8), 8);
        if (definition.name === "list_memos") {
          parameters_.limit = Math.min(Number(parameters_.limit ?? 20), 20);
          parameters_.includeContent = false;
        }
        const result = await executeWorkspaceTool(args.context!, args.context!.get("auth"), definition.name, parameters_);
        if (autoApply && parameters_.dryRun !== true) {
          cursor = await companionWorkspaceCursor(args.db, args.scope.workspaceId);
          return { applied: true, ...(typeof result === "object" && result ? result as object : { result }) };
        }
        if (current !== await companionWorkspaceCursor(args.db, args.scope.workspaceId)) return { error: "Notes changed during this read. Start a fresh request." };
        if (definition.name === "get_memo") {
          const memo = (result as { memo: MemoDetail }).memo;
          const content = takeNoteText(memo.contentMarkdown, 8000);
          remember(memo);
          if (content.length === memo.contentMarkdown.length) inspected.set(memo.id, memo.revision); else inspected.delete(memo.id);
          return { id: memo.id, title: memo.title, notebookId: memo.notebookId, tags: memo.tags, revision: memo.revision,
            content, truncated: content.length !== memo.contentMarkdown.length };
        }
        if (definition.name === "search_memos" || definition.name === "list_memos") return {
          ...result as object,
          memos: await Promise.all((result as { memos: MemoSummary[] }).memos.map(async memo => ({
            ...remember(memo),
            notebookId: memo.notebookId,
            notebookName: await notebookName(memo.notebookId),
            tags: memo.tags,
            excerpt: takeNoteText(memo.excerpt, 180),
          }))),
        };
        const serialized = JSON.stringify(result);
        const text = serialized.slice(0, Math.min(8000, metadataRemaining));
        metadataRemaining -= text.length;
        return text.length === serialized.length ? result : { truncated: true, data: text };
      },
    })];
  }));
}
