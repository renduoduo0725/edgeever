type LocalAgentResponse = {
  response: string;
  reasoning: string;
  responseMessageId?: string;
};

// Codex ACP sends commentary and the final answer as separate agent messages.
// Standard ACP has no phase field, but Codex keeps a stable ID for each message.
export function appendLocalAgentText<T extends LocalAgentResponse>(
  turn: T,
  text: string,
  messageId?: string,
  separateMessages = false,
): T {
  if (!separateMessages || !messageId) return { ...turn, response: turn.response + text };
  if (turn.responseMessageId && turn.responseMessageId !== messageId && turn.response) {
    return {
      ...turn,
      reasoning: turn.reasoning ? `${turn.reasoning.trimEnd()}\n\n${turn.response}` : turn.response,
      response: text,
      responseMessageId: messageId,
    };
  }
  return { ...turn, response: turn.response + text, responseMessageId: messageId };
}
