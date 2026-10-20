import type { AiProvider, AiDiscoveredModel } from "@edgeever/shared";
const normalizeAiBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");
const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" ? value as Record<string, unknown> : null;
export const discoverAiModels = async (
  config: {
    provider: AiProvider;
    baseUrl: string;
    apiKey: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<AiDiscoveredModel[]> => {
  const url = `${normalizeAiBaseUrl(config.baseUrl)}/models`;
  const headers = new Headers({ Accept: "application/json" });
  if (config.provider === "anthropic") {
    headers.set("x-api-key", config.apiKey);
    headers.set("anthropic-version", "2023-06-01");
    headers.set("anthropic-dangerous-direct-browser-access", "true");
  } else if (config.provider === "google") {
    headers.set("x-goog-api-key", config.apiKey);
  } else {
    headers.set("Authorization", `Bearer ${config.apiKey}`);
  }

  const response = await fetchImpl(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`The model list endpoint responded with HTTP ${response.status}.`);
  }

  const body = asRecord(await response.json());
  const rawModels = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.models)
      ? body.models
      : [];
  const discovered = new Map<string, AiDiscoveredModel>();

  for (const item of rawModels.slice(0, 2_000)) {
    const record = asRecord(item);
    if (!record) continue;
    const rawId = typeof record.id === "string"
      ? record.id
      : typeof record.name === "string"
        ? record.name
        : "";
    const modelId = config.provider === "google" ? rawId.replace(/^models\//, "") : rawId;
    if (!modelId || discovered.has(modelId)) continue;
    const displayName = typeof record.display_name === "string"
      ? record.display_name
      : typeof record.displayName === "string"
        ? record.displayName
        : typeof record.name === "string" && config.provider !== "google"
          ? record.name
          : modelId;
    discovered.set(modelId, { modelId, displayName });
  }

  return Array.from(discovered.values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName));
};

