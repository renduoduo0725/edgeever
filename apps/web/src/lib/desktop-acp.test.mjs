import { expect, test } from "bun:test";
import { aiSidebarAdapterFromStorage, aiSidebarSourceFromStorage, displayedDesktopAcpAdapter } from "./desktop-acp.ts";

test("a checked custom Antigravity executable takes priority over the managed connector status", () => {
  const managed = { id: "antigravity", label: "Antigravity", state: "failed", version: "1.2.1", managed: true };
  const custom = { id: "antigravity", label: "Antigravity", state: "available" };
  const input = { id: "antigravity", path: "/tmp/agy-acp", listed: [managed], probed: custom };
  expect(displayedDesktopAcpAdapter(input)).toBe(custom);
  expect(displayedDesktopAcpAdapter({ ...input, probed: null })).toBeUndefined();
  expect(displayedDesktopAcpAdapter({ ...input, path: "" })).toBe(managed);
});

test("a newly installed managed connector takes priority over an older probe", () => {
  const current = { id: "antigravity", label: "Antigravity", state: "available", version: "1.2.2", managed: true };
  const previous = { id: "antigravity", label: "Antigravity", state: "failed", version: "1.2.1", managed: true };
  expect(displayedDesktopAcpAdapter({ id: "antigravity", path: "", listed: [current], probed: previous })).toBe(current);
});

test("the sidebar follows a stored local agent only when the desktop bridge exists", () => {
  expect(aiSidebarSourceFromStorage("local", true)).toBe("local");
  expect(aiSidebarSourceFromStorage("local", false)).toBe("builtin");
  expect(aiSidebarSourceFromStorage("builtin", true)).toBe("builtin");
  expect(aiSidebarAdapterFromStorage("codex", "/tmp/ignored")).toEqual({ id: "codex" });
  expect(aiSidebarAdapterFromStorage("antigravity", " /tmp/agy ")).toEqual({ id: "antigravity", path: "/tmp/agy" });
  expect(aiSidebarAdapterFromStorage("missing", "")).toBeNull();
});

test("a prompt-time login failure takes priority over an earlier successful session probe", () => {
  const current = { id: "grokBuild", label: "Grok Build", state: "needs_login", authMethods: [{ id: "browser", name: "Browser" }] };
  const earlierProbe = { id: "grokBuild", label: "Grok Build", state: "available" };
  expect(displayedDesktopAcpAdapter({ id: "grokBuild", path: "", listed: [current], probed: earlierProbe })).toBe(current);
});
