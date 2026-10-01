import { describe, expect, test } from "bun:test";
import {
  LOCAL_AGENT_THREAD_LIMIT,
  chatThreadsFromTurns,
  localAgentTranscript,
  parseLocalAgentTurns,
  resolveLocalAgentThreadId,
  saveLocalAgentTurns,
  serializeLocalAgentTurns,
} from "./local-agent-threads.ts";

const threadA = "11111111-1111-4111-8111-111111111111";
const threadB = "22222222-2222-4222-8222-222222222222";
const turnA = "33333333-3333-4333-8333-333333333333";
const turnB = "44444444-4444-4444-8444-444444444444";

const turn = (overrides = {}) => ({
  id: turnA,
  threadId: threadA,
  message: "总结这篇笔记",
  response: "这是一份摘要",
  reasoning: "先看标题",
  tools: [{ id: "tool-1", name: "search", status: "done", title: "Search notes" }],
  attachments: [{ id: "file-1", filename: "notes.txt", mediaType: "text/plain", byteLength: 12 }],
  images: [{ id: "img-1", mediaType: "image/png", base64: "AAAA" }],
  status: "completed",
  createdAt: "2026-09-02T00:00:00.000Z",
  ...overrides,
});

describe("local agent threads", () => {
  test("keeps the chat text and drops generated image bytes", () => {
    const stored = JSON.parse(serializeLocalAgentTurns([turn()]));
    expect(stored.version).toBe(1);
    expect(stored.turns).toEqual([{
      id: turnA,
      threadId: threadA,
      message: "总结这篇笔记",
      response: "这是一份摘要",
      reasoning: "先看标题",
      tools: [{ id: "tool-1", name: "search", status: "done", title: "Search notes" }],
      attachments: [{ id: "file-1", filename: "notes.txt", mediaType: "text/plain", byteLength: 12 }],
      status: "completed",
      createdAt: "2026-09-02T00:00:00.000Z",
    }]);
    expect(JSON.stringify(stored)).not.toContain("AAAA");
    expect(parseLocalAgentTurns(JSON.stringify(stored))).toEqual(stored.turns);
  });

  test("cancels a turn that was still running when the transcript was saved", () => {
    const raw = serializeLocalAgentTurns([turn({ status: "running", response: "" })]);
    expect(JSON.parse(raw).turns[0].status).toBe("running");
    expect(parseLocalAgentTurns(raw)[0].status).toBe("cancelled");
  });

  test("drops malformed transcripts and unknown store versions", () => {
    expect(parseLocalAgentTurns("not json")).toEqual([]);
    expect(parseLocalAgentTurns(JSON.stringify({ version: 2, turns: [turn()] }))).toEqual([]);
    expect(parseLocalAgentTurns(JSON.stringify({
      version: 1,
      turns: [turn({ id: "nope" }), turn({ message: "   " }), null],
    }))).toEqual([]);
  });

  test("keeps the newest chats when the transcript exceeds the thread cap", () => {
    const turns = Array.from({ length: LOCAL_AGENT_THREAD_LIMIT + 2 }, (_, index) => turn({
      id: `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`,
      threadId: `66666666-6666-4666-8666-${String(index).padStart(12, "0")}`,
      message: `chat ${index}`,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }));
    const stored = parseLocalAgentTurns(serializeLocalAgentTurns(turns));
    expect(stored).toHaveLength(LOCAL_AGENT_THREAD_LIMIT);
    expect(stored.some((item) => item.message === "chat 0")).toBe(false);
    expect(stored.some((item) => item.message === `chat ${LOCAL_AGENT_THREAD_LIMIT + 1}`)).toBe(true);
  });

  test("names a chat from its first message and orders newer chats first", () => {
    const threads = chatThreadsFromTurns([
      turn({ message: "第二句", createdAt: "2026-09-03T00:00:00.000Z" }),
      turn({ id: turnB, message: "第一句，后面还有", createdAt: "2026-09-01T00:00:00.000Z" }),
      turn({
        id: turnB,
        threadId: threadB,
        message: "另一段会话",
        createdAt: "2026-09-04T00:00:00.000Z",
      }),
    ]);
    expect(threads.map((item) => item.title)).toEqual(["另一段会话", "第一句，后面还有"]);
  });

  test("continues only the selected chat and skips a running turn", () => {
    const transcript = localAgentTranscript([
      turn({ message: "第一问", response: "第一答", createdAt: "2026-09-01T00:00:00.000Z" }),
      turn({
        id: turnB,
        message: "正在问",
        response: "",
        status: "running",
        createdAt: "2026-09-03T00:00:00.000Z",
      }),
      turn({
        id: turnB,
        threadId: threadB,
        message: "别带上这段",
        response: "另一会话",
        createdAt: "2026-09-04T00:00:00.000Z",
      }),
    ], threadA);
    expect(transcript).toContain("User: 第一问");
    expect(transcript).toContain("Assistant: 第一答");
    expect(transcript).not.toContain("正在问");
    expect(transcript).not.toContain("别带上这段");
  });

  test("keeps a stored thread id and otherwise opens the latest chat", () => {
    const turns = [
      turn({ createdAt: "2026-09-01T00:00:00.000Z" }),
      turn({ id: turnB, threadId: threadB, createdAt: "2026-09-05T00:00:00.000Z" }),
    ];
    expect(resolveLocalAgentThreadId(threadA, turns)).toBe(threadA);
    expect(resolveLocalAgentThreadId("nope", turns)).toBe(threadB);
    expect(resolveLocalAgentThreadId(null, [])).toBeNull();
  });

  test("drops the oldest chat when storage rejects the full transcript", () => {
    const saved = [];
    const storage = {
      setItem(_key, value) {
        if (value.includes("old chat")) throw new Error("quota");
        saved.push(value);
      },
    };
    saveLocalAgentTurns(storage, "threads", [
      turn({ message: "old chat", createdAt: "2026-09-01T00:00:00.000Z" }),
      turn({
        id: turnB,
        threadId: threadB,
        message: "new chat",
        createdAt: "2026-09-02T00:00:00.000Z",
      }),
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toContain("new chat");
    expect(saved[0]).not.toContain("old chat");
  });
});
