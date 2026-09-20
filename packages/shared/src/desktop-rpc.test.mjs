import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DESKTOP_LOCAL_REVISION_ID_PREFIX,
  DESKTOP_RPC_METHODS,
  DESKTOP_SIDECAR_PROTOCOL_VERSION,
  isDesktopLocalRevisionId,
} from "./desktop-rpc.ts";

const rustRpcSource = readFileSync(
  new URL("../../../crates/desktop-sidecar/src/rpc.rs", import.meta.url),
  "utf8",
);
const rustMemoSource = readFileSync(
  new URL("../../../crates/desktop-sidecar/src/memo.rs", import.meta.url),
  "utf8",
);
const electronRpcSource = readFileSync(
  new URL("../../../apps/desktop/src/main/rpc.mjs", import.meta.url),
  "utf8",
);

describe("desktop sidecar RPC contract", () => {
  test("keeps the TypeScript method registry aligned with the Rust dispatcher", () => {
    const dispatcherStart = rustRpcSource.indexOf("match request.method.as_str()");
    const dispatcherEnd = rustRpcSource.indexOf("\n    }\n}\n\nfn chrono_like_now", dispatcherStart);
    const dispatcher = rustRpcSource.slice(dispatcherStart, dispatcherEnd);
    const rustMethods = [...dispatcher.matchAll(/"([^"]+)"\s*=>/g)]
      .map((match) => match[1])
      .filter((method) => method !== "app.shutdown")
      .sort();

    expect([...DESKTOP_RPC_METHODS].sort()).toEqual(rustMethods);
  });

  test("filters memo.list by an exact tag instead of ignoring the parameter", () => {
    expect(rustMemoSource).toContain("json_each(m.tags_json) AS memo_tag");
    expect(rustMemoSource).toContain("LOWER(TRIM(CAST(memo_tag.value AS TEXT))) = LOWER(?5)");
  });

  test("keeps sidecar local revision ids distinguishable from cached remote revisions", () => {
    expect(rustMemoSource).toContain(`now_id("${DESKTOP_LOCAL_REVISION_ID_PREFIX.slice(0, -1)}")`);
    expect(isDesktopLocalRevisionId("revision_local_1789810000000")).toBe(true);
    expect(isDesktopLocalRevisionId("revision_abc123")).toBe(false);
  });

  test("keeps the native and Electron protocol guards aligned", () => {
    const rustVersion = Number(rustRpcSource.match(/const PROTOCOL_VERSION: i64 = (\d+);/)?.[1]);
    const electronVersion = Number(
      electronRpcSource.match(/SIDECAR_PROTOCOL_VERSION = (\d+);/)?.[1],
    );

    expect(rustVersion).toBe(DESKTOP_SIDECAR_PROTOCOL_VERSION);
    expect(electronVersion).toBe(DESKTOP_SIDECAR_PROTOCOL_VERSION);
  });
});
