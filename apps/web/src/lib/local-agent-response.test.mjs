import { expect, test } from "bun:test";
import { appendLocalAgentText } from "./local-agent-response.ts";

test("moves earlier Codex messages into the process when the final message starts", () => {
  let turn = { response: "", reasoning: "Thought summary", adapterId: "codex" };
  turn = appendLocalAgentText(turn, "I will read", "commentary", true);
  turn = appendLocalAgentText(turn, " the note.", "commentary", true);
  turn = appendLocalAgentText(turn, "Translated", "final", true);
  turn = appendLocalAgentText(turn, " text.", "final", true);
  expect(turn.reasoning).toBe("Thought summary\n\nI will read the note.");
  expect(turn.response).toBe("Translated text.");
});

test("keeps a single Codex message as the answer", () => {
  const turn = appendLocalAgentText({ response: "", reasoning: "" }, "Only answer", "final", true);
  expect(turn.response).toBe("Only answer");
  expect(turn.reasoning).toBe("");
});

test("preserves the old behavior without a Codex message boundary", () => {
  const initial = { response: "First", reasoning: "" };
  expect(appendLocalAgentText(initial, " second", "other", false).response).toBe("First second");
  expect(appendLocalAgentText(initial, " second", undefined, true).response).toBe("First second");
});
