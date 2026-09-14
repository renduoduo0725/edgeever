import type {
  AiAction,
  AiPromptParameterKind,
  AiPromptResultMode,
} from "./ai-assistant";

export type AiPromptSeedKey = Exclude<AiAction, "custom">;
export type AiPromptSeedLocale = "zh-CN" | "en-US";

export type AiPromptSeedTranslation = {
  name: string;
  description: string;
  instruction: string;
};

/** Factory prompt metadata. The top-level text is the Simplified Chinese fallback for legacy callers. */
export type AiPromptSeed = AiPromptSeedTranslation & {
  key: AiPromptSeedKey;
  action: AiPromptSeedKey;
  parameterKind: AiPromptParameterKind;
  resultMode: AiPromptResultMode;
  translations: Record<AiPromptSeedLocale, AiPromptSeedTranslation>;
};

const seed = (
  metadata: Omit<AiPromptSeed, keyof AiPromptSeedTranslation | "translations">,
  zhCN: AiPromptSeedTranslation,
  enUS: AiPromptSeedTranslation,
): AiPromptSeed => ({
  ...metadata,
  ...zhCN,
  translations: { "zh-CN": zhCN, "en-US": enUS },
});

export const normalizeAiPromptSeedLocale = (locale: string | null | undefined): AiPromptSeedLocale =>
  locale?.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";

export const localizeAiPromptSeed = (
  promptSeed: AiPromptSeed,
  locale: string | null | undefined,
): AiPromptSeedTranslation => promptSeed.translations[normalizeAiPromptSeedLocale(locale)];

/** Deterministic id for a seeded default prompt in a workspace. */
export const defaultAiPromptId = (workspaceId: string, seedKey: string) =>
  `${workspaceId}_aiprompt_${seedKey}`;

/** Parse legacy deterministic ids. New code should use the persisted seedKey field instead. */
export const parseDefaultAiPromptKey = (promptId: string): AiPromptSeedKey | null => {
  const match = /_aiprompt_([a-z0-9-]+)$/i.exec(promptId);
  if (!match) return null;
  const key = match[1] as AiPromptSeedKey;
  return DEFAULT_AI_PROMPT_SEEDS.some((item) => item.key === key) ? key : null;
};

/**
 * Single application catalog for default prompt behavior and localized copy.
 * Persisted rows only contain user overrides; untouched defaults are materialized from this catalog.
 */
export const DEFAULT_AI_PROMPT_SEEDS: readonly AiPromptSeed[] = [
  seed(
    { key: "summarize", action: "summarize", parameterKind: "none", resultMode: "append" },
    {
      name: "精简总结",
      description: "压缩全文，提炼主题、结论与可执行结果",
      instruction: [
        "对笔记做真正的精简总结，不要逐句改写、同义复述或回声式重写。",
        "识别中心主题、主要主张、关键结论与可执行结果。",
        "省略重复、修辞、举例、引语和次要细节，除非它们对理解关键结论必不可少。",
        "较长笔记目标约为原文 20–30% 篇幅，用 3–7 条简洁 Markdown 要点；短笔记用 1–3 句即可。",
        "不要大段照搬原文，也不要添加原文没有的信息。",
        "保持笔记原语言，只返回 Markdown 总结。",
      ].join(""),
    },
    {
      name: "Summarize",
      description: "Condense the note into its topic, conclusions, and actionable outcomes",
      instruction: [
        "Create a genuinely condensed summary of the note rather than rewriting, paraphrasing line by line, or echoing it. ",
        "Identify the central topic, main claims, essential conclusions, and actionable outcomes. ",
        "Omit repetition, rhetorical phrasing, examples, quotations, and minor details unless necessary to understand a key conclusion. ",
        "For a substantial note, target roughly 20–30% of the source length and use 3–7 concise Markdown bullet points; for a short note, use 1–3 concise sentences. ",
        "Do not reproduce long passages verbatim or add facts that are not present in the source. ",
        "Preserve the note's language and return only the summary in Markdown.",
      ].join(""),
    },
  ),
  seed(
    { key: "translate", action: "translate", parameterKind: "target-language", resultMode: "both" },
    {
      name: "全文翻译",
      description: "翻译为指定目标语言，保留结构与格式",
      instruction: "将完整笔记翻译成用户指定的目标语言。保留原意、Markdown 结构、链接与代码块。只返回译文，不要评论。",
    },
    {
      name: "Translate",
      description: "Translate into a selected language while preserving formatting",
      instruction: "Translate the complete note into the target language specified by the user. Preserve its meaning, Markdown structure, links, and code blocks. Return only the translated note without commentary.",
    },
  ),
  seed(
    { key: "improve-writing", action: "improve-writing", parameterKind: "none", resultMode: "both" },
    {
      name: "润色表达",
      description: "校正语言并提升文字的清晰度与流畅度",
      instruction: "润色内容，修正错别字、语法与标点，改善用词、句式、清晰度和流畅度，但不要改变原意或刻意缩短内容。保持原语言与有用的 Markdown 格式。只返回润色后的内容。",
    },
    {
      name: "Polish",
      description: "Correct the language and improve clarity and flow",
      instruction: "Polish the content by correcting spelling, grammar, and punctuation and improving word choice, sentence structure, clarity, and flow. Do not change its meaning or deliberately shorten it. Preserve its language and useful Markdown formatting. Return only the polished content.",
    },
  ),
  seed(
    { key: "make-shorter", action: "make-shorter", parameterKind: "none", resultMode: "both" },
    {
      name: "精炼表达",
      description: "删去重复与冗余，让表达更简洁有力",
      instruction: "精炼内容，删除重复、空话和不必要的修饰，合并可以合并的句子，使表达简洁、清晰、有力。保留所有关键事实、观点与原意，不要添加新信息。保持原语言与有用的 Markdown 格式。只返回精炼后的内容。",
    },
    {
      name: "Make concise",
      description: "Remove repetition and make the writing concise and direct",
      instruction: "Refine the content by removing repetition, filler, and unnecessary modifiers and by combining sentences where useful. Make it concise, clear, and direct while preserving every key fact, claim, and the original meaning. Do not add new information. Preserve its language and useful Markdown formatting. Return only the refined content.",
    },
  ),
  seed(
    { key: "extract-todos", action: "extract-todos", parameterKind: "none", resultMode: "append" },
    {
      name: "提取待办",
      description: "识别可执行任务，生成任务清单",
      instruction: "从笔记中提取明确或隐含的可执行任务，用 Markdown 任务列表（- [ ]）输出。保持原语言，不要编造任务。若没有可执行事项，用原文语言简短说明。",
    },
    {
      name: "Extract tasks",
      description: "Identify actionable work and produce a task list",
      instruction: "Extract explicit or implied actionable tasks from the note as a Markdown task list using '- [ ]'. Preserve its language and do not invent tasks. If there are no actionable tasks, say so briefly in the note's language.",
    },
  ),
  seed(
    { key: "continue-writing", action: "continue-writing", parameterKind: "none", resultMode: "append" },
    {
      name: "继续写作",
      description: "从笔记末尾自然续写",
      instruction: "从笔记结束处自然续写。只返回新增续写内容，不要重复原文。保持原语言与 Markdown 风格。",
    },
    {
      name: "Continue writing",
      description: "Continue naturally from the end of the note",
      instruction: "Continue writing naturally from where the note ends. Return only the new continuation, not the original content. Preserve its language and Markdown style.",
    },
  ),
];

export const getDefaultAiPromptSeed = (key: string) =>
  DEFAULT_AI_PROMPT_SEEDS.find((item) => item.key === key) ?? null;
