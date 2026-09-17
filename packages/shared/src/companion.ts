import { z } from "zod";

export const CompanionIdSchema = z.string().uuid();
export const CompanionMemoryInputSchema = z.object({
  content: z.string().trim().min(1).max(500),
  sourceTurnId: CompanionIdSchema.optional(),
}).strict();
export const CompanionMemoryUpdateSchema = z.object({
  content: z.string().trim().min(1).max(500),
  version: z.number().int().positive(),
}).strict();
export const CompanionTurnFocusSchema = z.object({
  memoId: z.string().trim().min(1).max(100).optional(),
  notebookId: z.string().trim().min(1).max(100).optional(),
  notebookTitle: z.string().trim().max(160).optional(),
  title: z.string().trim().max(160).optional(),
  selectionMarkdown: z.string().max(2000).optional(),
  contentMarkdown: z.string().max(4000).optional(),
  contentTruncated: z.boolean().optional(),
  diagramKind: z.enum(["mind-map", "flowchart", "architecture"]).optional(),
}).strict();
export const CompanionMentionSchema = z.object({
  type: z.enum(["memo", "notebook", "tag"]),
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().max(160).optional(),
}).strict();
export type CompanionMention = z.infer<typeof CompanionMentionSchema>;

export const CompanionTurnInputSchema = z.object({
  id: CompanionIdSchema,
  threadId: CompanionIdSchema,
  message: z.string().trim().min(1).max(4000),
  useMemory: z.boolean().default(true),
  allowNotes: z.boolean().default(false),
  allowWrites: z.boolean().optional(),
  locale: z.enum(["zh-CN", "en-US", "ja"]).default("en-US"),
  focus: CompanionTurnFocusSchema.optional(),
  mentions: z.array(CompanionMentionSchema).max(8).optional(),
}).strict();
export type CompanionTurnInput = z.infer<typeof CompanionTurnInputSchema>;

export const CompanionQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(200),
  inputType: z.enum(["free_text", "single_select", "multi_select"]),
  options: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(80),
  }).strict()).min(2).max(6).optional(),
}).strict();
export type CompanionQuestion = z.infer<typeof CompanionQuestionSchema>;
export const CompanionAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(80),
  optionIds: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
  text: z.string().trim().max(400).optional(),
}).strict();
export type CompanionAnswer = z.infer<typeof CompanionAnswerSchema>;
export const CompanionTurnResumeSchema = z.object({
  answers: z.array(CompanionAnswerSchema).max(3).optional(),
}).strict();
export type CompanionTurnResume = z.infer<typeof CompanionTurnResumeSchema>;
export const CompanionToolExecuteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  input: z.record(z.string(), z.unknown()).default({}),
  callId: z.string().trim().min(1).max(100).optional(),
  response: z.string().max(16000).optional(),
  process: z.string().max(32000).optional(),
}).strict();
export type CompanionToolExecuteInput = z.infer<typeof CompanionToolExecuteSchema>;
export const CompanionTurnCheckpointSchema = z.object({
  response: z.string().max(16000),
  process: z.string().max(32000).optional(),
}).strict();
export type CompanionTurnCheckpointInput = z.infer<typeof CompanionTurnCheckpointSchema>;
export const CompanionTurnCompleteSchema = z.object({
  response: z.string().max(16000),
  process: z.string().max(32000).optional(),
  status: z.enum(["completed", "interrupted", "failed"]),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
}).strict();
export type CompanionTurnCompleteInput = z.infer<typeof CompanionTurnCompleteSchema>;
export type CompanionToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};
export type CompanionPreparedMessage = {
  role: "user" | "assistant";
  content: string;
};
export type CompanionPreparedTurn = {
  turn: CompanionTurn;
  provider: "openai-compatible" | "anthropic" | "google";
  baseUrl: string;
  apiKey: string;
  modelId: string;
  instructions: string;
  messages: CompanionPreparedMessage[];
  tools: CompanionToolDefinition[];
  maxSteps: number;
  maxOutputTokens: number;
};
export type CompanionToolExecuteResult = {
  result: unknown;
  tools: CompanionToolCall[];
  todos: CompanionTodo[];
  questions: CompanionQuestion[];
  pause: boolean;
};
export type CompanionTodoStatus = "pending" | "in_progress" | "completed";
export type CompanionTodo = { id: string; content: string; status: CompanionTodoStatus };
export type CompanionToolEffectKind =
  | "created" | "updated" | "merged" | "moved" | "trashed" | "restored" | "tagged" | "read" | "listed" | "other";
export type CompanionToolEffect = {
  kind: CompanionToolEffectKind;
  memoId?: string;
  notebookId?: string;
  title?: string;
  revision?: number;
  previousRevision?: number;
};
export type CompanionToolCall = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  effects: CompanionToolEffect[];
  error?: string;
};
export type CompanionMemory = {
  id: string;
  content: string;
  sourceTurnId: string | null;
  kind?: "explicit" | "inferred";
  state?: "active" | "candidate" | "conflicted";
  scopeNotebookId?: string | null;
  ruleKey?: string | null;
  scopeNotebookName?: string | null;
  evidence?: { memoId: string; createdAt: string; title?: string; notebookId?: string }[];
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type CompanionSource = { id: string; title: string; revision: number; notebookId?: string };

export const CompanionDiscoverySettingsInputSchema = z.object({
  enabled: z.boolean(),
  learningEnabled: z.boolean().optional(),
  useMemory: z.boolean().optional(),
  version: z.number().int().nonnegative(),
}).strict();
export type CompanionDiscoverySettingsInput = z.infer<typeof CompanionDiscoverySettingsInputSchema>;
export type CompanionDiscoverySettings = CompanionDiscoverySettingsInput & {
  lastCheckAt: string | null;
  lastStatus: "quiet" | "ready" | "failed" | "running";
};
const compactDiscoveryBody = z.string().trim().min(1).max(180).refine(
  value => value.split(/\r?\n/).length <= 3,
  "Discovery body must contain at most 3 lines.",
);
export const CompanionDiscoveryOutputSchema = z.object({
  suggestion: z.object({
    kind: z.enum(["insight", "merge", "append", "move", "tag"]),
    title: z.string().trim().min(1).max(60),
    body: compactDiscoveryBody,
    sourceIds: z.array(z.string().min(1).max(100)).min(1).max(5),
    memoryIds: z.array(z.string().max(100)).max(8).optional(),
    notebookId: z.string().max(100).nullable().optional(),
    tags: z.array(z.string().min(1).max(40)).max(5).optional(),
    targetId: z.string().max(100).nullable(),
  }).nullable(),
});
export type CompanionDiscoveryOutput = z.infer<typeof CompanionDiscoveryOutputSchema>;
export const CompanionDiscoveryCompleteSchema = z.object({
  turnId: CompanionIdSchema,
  output: z.unknown(),
}).strict();
export type CompanionDiscoveryCompleteInput = z.infer<typeof CompanionDiscoveryCompleteSchema>;
export type CompanionPreparedDiscovery = {
  quiet: true;
  items: CompanionDiscoveryItem[];
} | {
  quiet: false;
  turnId: string;
  provider: "openai-compatible" | "anthropic" | "google";
  baseUrl: string;
  apiKey: string;
  modelId: string;
  instructions: string;
  prompt: string;
  maxOutputTokens: number;
};
export type CompanionDiscoveryItem = {
  id: string; kind: "insight" | "merge" | "append" | "move" | "tag"; title: string; body: string;
  sources: (CompanionSource & { notebookId: string })[];
  memories?: CompanionMemory[];
  action: CompanionAction | null; seen: boolean; createdAt: string;
};

const actionReason = z.string().trim().min(1).max(400);
const noteId = z.string().trim().min(1).max(100);
export const CompanionMergePlanSchema = z.object({
  kind: z.literal("merge"),
  memoIds: z.array(noteId).min(2).max(5),
  title: z.string().trim().min(1).max(160),
  reason: actionReason,
}).strict();
export const CompanionTagPlanSchema = z.object({
  kind: z.literal("tag"),
  memoId: noteId,
  tags: z.array(z.string().trim().min(1).max(40)).min(1).max(5),
  reason: actionReason,
}).strict();
export const CompanionToolPlanSchema = z.object({
  kind: z.literal("tool"),
  toolName: z.string().min(1).max(80),
  arguments: z.record(z.string(), z.unknown()),
  reason: actionReason,
}).strict();
export const CompanionActionPlanSchema = z.discriminatedUnion("kind", [CompanionMergePlanSchema, CompanionTagPlanSchema, CompanionToolPlanSchema]);
export type CompanionActionPlan = z.infer<typeof CompanionActionPlanSchema>;
export type CompanionActionNote = CompanionSource & { notebookId: string; updatedAt: string; tags: string[]; excerpt: string };
export type CompanionAction = {
  id: string;
  turnId: string;
  plan: CompanionActionPlan;
  notes: CompanionActionNote[];
  status: "pending" | "applied" | "dismissed" | "unavailable" | "uncertain";
  resultMemoId: string | null;
  resultNotebookId?: string | null;
  result?: unknown;
  preview?: { notebooks: Array<{ id: string; name: string }>; affectedCount?: number };
  createdAt: string;
};
export type CompanionTurn = {
  id: string;
  threadId: string;
  message: string;
  response: string;
  process: string;
  status: "running" | "completed" | "failed" | "cancelled" | "interrupted";
  sources: CompanionSource[];
  tools: CompanionToolCall[];
  todos: CompanionTodo[];
  questions: CompanionQuestion[];
  mentions: CompanionMention[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
};
export type CompanionEvent =
  | { type: "start"; id: string }
  | { type: "text-delta"; text: string }
  | { type: "process"; text: string }
  | { type: "tools"; tools: CompanionToolCall[]; todos: CompanionTodo[]; questions: CompanionQuestion[] }
  | { type: "done"; turn: CompanionTurn }
  | { type: "error"; code: string };

export const sealCompanionProcess = (process: string, response: string) => ({
  process: [process.trim(), response.trim()].filter(Boolean).join("\n\n"),
  response: "",
});

export const parseCompanionMentionQuery = (text: string, cursor: number) => {
  const prefix = text.slice(0, Math.max(0, Math.min(cursor, text.length)));
  const match = prefix.match(/@([^\s@]*)$/);
  if (!match) return null;
  return { query: match[1] ?? "", start: prefix.length - match[0].length, end: cursor };
};

export const CompanionMemoryImportSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  memories: z.array(z.object({ content: z.string().trim().min(1).max(500), kind: z.enum(["explicit", "inferred"]).optional() })).max(50),
  controls: z.object({ useMemory: z.boolean(), learningEnabled: z.boolean() }).optional(),
}).strict();
