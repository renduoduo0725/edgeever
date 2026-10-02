import type { AiSettings } from "@edgeever/shared";

export type BuiltinAgentModelView = {
  label: string;
  modelId: string;
  unavailable: boolean;
};

export const resolveBuiltinAgentModel = (
  settings: Pick<AiSettings, "defaultModelId" | "providers"> | null | undefined,
): BuiltinAgentModelView | null => {
  const defaultModelId = settings?.defaultModelId;
  if (!defaultModelId) return null;
  const provider = settings.providers.find((item) => item.models.some((model) => model.id === defaultModelId));
  const model = provider?.models.find((item) => item.id === defaultModelId);
  if (!provider || !model) return null;
  return {
    label: model.displayName.trim() || model.modelId,
    modelId: model.modelId,
    unavailable: !provider.isEnabled,
  };
};
