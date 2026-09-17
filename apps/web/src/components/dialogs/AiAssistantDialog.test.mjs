import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("AI assistant modes", () => {
  test("keeps a floating panel with instruction and a single ask chat", () => {
    const source = readFileSync(new URL("./AiAssistantDialog.tsx", import.meta.url), "utf8");
    const editor = readFileSync(new URL("../EditorPane.tsx", import.meta.url), "utf8");
    expect(source).toContain('useState<AiAssistantMode>("instruction")');
    expect(source).toContain('(["instruction", "ask"] as const)');
    expect(source).not.toContain('"organize"');
    expect(source).not.toContain("inset-y-3 right-3");
    expect(source).toContain("<CompanionChat");
    expect(editor).toContain("companionAvailable={companionAvailable}");
    expect(editor).toContain("beforeCompanionApply={beforeCompanionApply}");
  });

  test("agent mode opens a fresh thread and only resumes last chat on request", () => {
    const chat = readFileSync(new URL("../CompanionChat.tsx", import.meta.url), "utf8");
    expect(chat).toContain("useState<string>(() => crypto.randomUUID())");
    expect(chat).toContain('t("aiAssistant.modes.resumeLast")');
    expect(chat).not.toContain("sessionStorage.getItem");
    expect(chat).not.toContain("edgeever.assistant.threadId");
    expect(chat).toContain('event.key !== "Enter"');
    expect(chat).toContain("requestSubmit()");
    expect(chat).toContain("useMemory");
    expect(chat).not.toContain("useMemory: false");
    expect(chat).toContain("parseCompanionMentionQuery");
    expect(chat).toContain("resumeCompanionTurn");
  });
});
