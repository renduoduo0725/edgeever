import { AppError } from "./app-error";

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

export type JsonRpcId = string | number | null;

export type JsonRpcHandlerResult = {
  body: unknown;
  status: number;
};

export const jsonRpcResult = (id: JsonRpcId, result: unknown) => ({
  jsonrpc: "2.0",
  id,
  result,
});

export const jsonRpcError = (id: JsonRpcId, code: number, message: string, data?: unknown) => ({
  jsonrpc: "2.0",
  id,
  error: {
    code,
    message,
    ...(data === undefined ? {} : { data }),
  },
});

export const getJsonRpcId = (request: unknown): JsonRpcId => {
  if (!request || typeof request !== "object" || !("id" in request)) {
    return null;
  }

  const id = (request as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" || id === null ? id : null;
};

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const getOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const getRequiredString = (value: unknown, name: string) => {
  const parsed = getOptionalString(value);

  if (!parsed) {
    throw new AppError("invalid_params", `${name} is required`, 400);
  }

  return parsed;
};

export const getOptionalStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const getRequiredStringArray = (value: unknown, name: string) => {
  const items = getOptionalStringArray(value);

  if (items.length === 0) {
    throw new AppError("invalid_params", `${name} must include at least one item`, 400);
  }

  return items;
};

export const encodeBase64Data = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 4096) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 4096)));
  return btoa(chunks.join(""));
};

export const decodeBase64Data = async (value: string) => {
  const [, dataUrlPayload] = value.match(/^data:[^;]+;base64,(.+)$/i) ?? [];
  const base64 = (dataUrlPayload ?? value).replace(/\s/g, "");

  if (!base64) {
    throw new AppError("invalid_params", "dataBase64 is required", 400);
  }

  try {
    const response = await fetch("data:application/octet-stream;base64," + base64);
    if (!response.ok) {
      throw new Error("failed to decode base64");
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw new AppError("invalid_params", "dataBase64 must be valid base64 data: " + (error as Error).message, 400);
  }
};

export const escapeMarkdownImageAlt = (value: string) => value.replace(/[\\[\]]/g, "\\$&");
export const escapeMarkdownLinkLabel = (value: string) => value.replace(/[\\[\]]/g, "\\$&");

export const mapMcpToolError = (error: unknown) => {
  if (error instanceof AppError) {
    const rpcCode =
      error.status === 401
        ? -32001
        : error.status === 403
          ? -32003
          : error.status === 404
            ? -32004
            : error.status === 409
              ? -32009
              : -32602;

    return {
      rpcCode,
      status: error.status,
      message: error.message,
      data: {
        code: error.code,
      },
    };
  }

  return {
    rpcCode: -32000,
    status: 400,
    message: error instanceof Error ? error.message : "Tool call failed",
    data: undefined,
  };
};
