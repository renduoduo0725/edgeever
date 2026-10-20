import { isAiCorsFailure } from "./ai-direct-stream";

/** Retry only a failed initial fetch. A readable HTTP error or an interrupted
 * response stream must never start a second model request. */
export const fetchAiWithServerFallback = async (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  directFetch: typeof fetch,
  relay: (request: Request) => Promise<Response>,
): Promise<Response> => {
  const directInit: RequestInit = { ...init, credentials: "omit", redirect: "error" };
  const backupInput = input instanceof Request ? input.clone() : input;
  const backup = new Request(backupInput as ConstructorParameters<typeof Request>[0], directInit);
  try {
    return await directFetch(input, directInit);
  } catch (error) {
    if (backup.signal.aborted || !isAiCorsFailure(error)) throw error;
    return relay(backup);
  }
};
