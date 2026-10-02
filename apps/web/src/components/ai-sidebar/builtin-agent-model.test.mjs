import { describe, expect, test } from "bun:test";
import { resolveBuiltinAgentModel } from "./builtin-agent-model.ts";

const provider = (overrides = {}) => ({
  id: "provider-1",
  provider: "openai-compatible",
  displayName: "OpenRouter",
  baseUrl: "https://example.test",
  isEnabled: true,
  hasApiKey: true,
  models: [{
    id: "model-row",
    providerConfigId: "provider-1",
    modelId: "anthropic/claude-sonnet-4",
    displayName: "Claude Sonnet",
  }],
  ...overrides,
});

describe("built-in agent model label", () => {
  test("uses the default model's display name", () => {
    expect(resolveBuiltinAgentModel({
      defaultModelId: "model-row",
      providers: [provider()],
    })).toEqual({
      label: "Claude Sonnet",
      modelId: "anthropic/claude-sonnet-4",
      unavailable: false,
    });
  });

  test("falls back to the model id when the display name is blank", () => {
    expect(resolveBuiltinAgentModel({
      defaultModelId: "model-row",
      providers: [provider({
        models: [{
          id: "model-row",
          providerConfigId: "provider-1",
          modelId: "gpt-5.4",
          displayName: "  ",
        }],
      })],
    })?.label).toBe("gpt-5.4");
  });

  test("marks a model on a disabled service as unavailable", () => {
    expect(resolveBuiltinAgentModel({
      defaultModelId: "model-row",
      providers: [provider({ isEnabled: false })],
    })?.unavailable).toBe(true);
  });

  test("returns null when no default model is selected or the row is gone", () => {
    expect(resolveBuiltinAgentModel(null)).toBeNull();
    expect(resolveBuiltinAgentModel({ defaultModelId: null, providers: [provider()] })).toBeNull();
    expect(resolveBuiltinAgentModel({ defaultModelId: "missing", providers: [provider()] })).toBeNull();
  });
});
