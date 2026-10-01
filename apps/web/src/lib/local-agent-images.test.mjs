import { describe, expect, test } from "bun:test";
import { indexedDB } from "fake-indexeddb";
import { LocalAgentImageStore } from "./local-agent-images.ts";
import { parseLocalAgentTurns, serializeLocalAgentTurns } from "./local-agent-threads.ts";

globalThis.indexedDB = indexedDB;

const threadId = "11111111-1111-4111-8111-111111111111";
const turnId = "22222222-2222-4222-8222-222222222222";

describe("local agent generated images", () => {
  test("restores an image beside an existing text-only transcript, even after interruption", async () => {
    const legacy = serializeLocalAgentTurns([{
      id: turnId,
      threadId,
      message: "画一只猫",
      response: "",
      reasoning: "",
      tools: [],
      images: [{ id: "cat", mediaType: "image/png", base64: "AAAA" }],
      attachments: [],
      status: "running",
      createdAt: "2026-09-30T00:00:00.000Z",
    }]);
    expect(legacy).not.toContain("AAAA");

    const first = new LocalAgentImageStore();
    await first.put({ turnId, id: "cat", mediaType: "image/png", base64: "AAAA" });
    await first.put({ turnId, id: "cat", mediaType: "image/png", base64: "BBBB" });
    await first.put({ turnId: threadId, id: "orphan", mediaType: "image/png", base64: "CCCC" });

    const restoredTurn = parseLocalAgentTurns(legacy)[0];
    const reopened = new LocalAgentImageStore();
    expect(restoredTurn.status).toBe("cancelled");
    expect(await reopened.list([restoredTurn.id])).toEqual([
      { turnId, id: "cat", mediaType: "image/png", base64: "BBBB" },
    ]);
    const failedTurn = parseLocalAgentTurns(legacy.replace('"status":"running"', '"status":"failed"'))[0];
    expect(failedTurn.status).toBe("failed");
    expect(await reopened.list([failedTurn.id])).toHaveLength(1);

    await reopened.prune([restoredTurn.id]);
    expect(await reopened.list([threadId])).toEqual([]);
    expect(await reopened.list([turnId])).toHaveLength(1);
  });
});
