import { isStepCount, jsonSchema, tool, ToolLoopAgent, type LanguageModel } from "ai";
import type {
  CompanionAnswer, CompanionMemory, CompanionSource, CompanionTurnInput,
} from "@edgeever/shared";
import type { DatabaseAdapter } from "./storage-contract";
import type { CompanionScope, TurnRow } from "./companion-service";
import type { AppContext } from "./api-context";
import { companionToolDefinitions, createCompanionTools } from "./companion-agent-tools";
import {
  companionAgentInstructions,
  companionExecutionReceipts,
  companionResumeMessages,
  COMPANION_MAX_OUTPUT_TOKENS,
  COMPANION_MAX_STEPS,
  type CompanionRunState,
} from "./companion-prepare";

export {
  COMPANION_IDENTITY_VERSION,
  COMPANION_INSTRUCTIONS,
  COMPANION_MAX_OUTPUT_TOKENS,
  COMPANION_MAX_STEPS,
  companionAgentInstructions,
  companionExecutionReceipts,
  companionMessages,
  companionResumeMessages,
  companionTurnInstructions,
  companionUserContent,
  prepareCompanionTurn,
  selectCompanionMemories,
  type CompanionRunState,
} from "./companion-prepare";

export const streamCompanion = async (args: {
  db: DatabaseAdapter; scope: CompanionScope; input: CompanionTurnInput; model: LanguageModel;
  memories: CompanionMemory[]; history: TurnRow[]; revision: number; signal: AbortSignal;
  sources: CompanionSource[]; assertActive: () => Promise<void>;
  context?: AppContext; run?: CompanionRunState; resume?: { response?: string; answers?: CompanionAnswer[] };
}) => {
  const run = args.run ?? { tools: [], todos: [], questions: [], pause: { ask: false } };
  const executors = createCompanionTools({ ...args, run });
  const tools = Object.fromEntries(
    companionToolDefinitions(args.input).map((definition) => [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema<Record<string, unknown>>(
          definition.inputSchema as Parameters<typeof jsonSchema>[0],
        ),
        execute: (input: Record<string, unknown>) => {
          const selected = executors[definition.name];
          if (!selected) throw new Error(`Missing companion tool: ${definition.name}`);
          return selected.execute(input);
        },
      }),
    ]),
  );
  const receipts = args.input.allowNotes ? await companionExecutionReceipts(args.db, args.scope, args.input, args.revision, run.tools) : [];
  const agent = new ToolLoopAgent({
    model: args.model,
    instructions: companionAgentInstructions(args.input, args.memories, receipts),
    tools,
    stopWhen: [isStepCount(COMPANION_MAX_STEPS), () => run.pause.ask],
    maxOutputTokens: COMPANION_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
  });
  return agent.stream({ messages: companionResumeMessages(args.input, args.history, args.revision, args.resume), abortSignal: args.signal });
};
