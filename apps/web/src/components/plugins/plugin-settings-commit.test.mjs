import { describe, expect, test } from "bun:test";
import {
  createPluginSettingWriteQueue,
  planPluginSettingWrite,
  pluginSettingLoadSignature,
  revertBooleanSettingAfterFailedWrite,
} from "./plugin-settings-commit.ts";

describe("plugin setting commits", () => {
  test("stores an idle switch write before the click handler continues", () => {
    const queue = createPluginSettingWriteQueue();
    const stored = [];
    queue.enqueue("digest.auto-enabled", () => {
      stored.push(true);
      return Promise.resolve();
    });
    expect(stored).toEqual([true]);
  });

  test("keeps an older switch write from landing after a newer one", async () => {
    const queue = createPluginSettingWriteQueue();
    const stored = [];
    let releaseOlder = () => {};
    const older = queue.enqueue("digest.auto-enabled", () => new Promise((resolve) => {
      releaseOlder = () => {
        stored.push(false);
        resolve();
      };
    }));
    const newer = queue.enqueue("digest.auto-enabled", async () => {
      stored.push(true);
    });

    expect(stored).toEqual([]);
    releaseOlder();
    await older;
    await newer;
    expect(stored).toEqual([false, true]);
  });

  test("a failed write does not block the next switch position", async () => {
    const queue = createPluginSettingWriteQueue();
    const stored = [];
    await expect(queue.enqueue("digest.auto-enabled", async () => {
      throw new Error("storage unavailable");
    })).rejects.toThrow("storage unavailable");
    await queue.enqueue("digest.auto-enabled", async () => {
      stored.push(true);
    });
    expect(stored).toEqual([true]);
  });

  test("a failed write only snaps the switch back when the user has not moved it", () => {
    expect(revertBooleanSettingAfterFailedWrite(true, true)).toBe(false);
    expect(revertBooleanSettingAfterFailedWrite(false, false)).toBe(true);
    expect(revertBooleanSettingAfterFailedWrite(false, true)).toBe(false);
    expect(revertBooleanSettingAfterFailedWrite(true, false)).toBe(true);
  });

  test("stores every finished plugin setting and holds incomplete values", () => {
    const expectPlan = (field, value) => planPluginSettingWrite(field, value);
    expect(expectPlan({ type: "boolean", key: "digest.auto-enabled", label: "Digest" }, true)).toEqual({ action: "set", value: true });
    expect(expectPlan({ type: "boolean", key: "digest.auto-enabled", label: "Digest" }, false)).toEqual({ action: "set", value: false });
    expect(expectPlan({
      type: "select", key: "digest.generation-time", label: "Time", required: true, options: [{ value: "09:00", label: "09:00" }],
    }, "09:00")).toEqual({ action: "set", value: "09:00" });
    expect(expectPlan({
      type: "select", key: "digest.generation-time", label: "Time", required: true, options: [{ value: "09:00", label: "09:00" }],
    }, "")).toEqual({ action: "keep", error: "required" });
    expect(expectPlan({
      type: "select", key: "optional", label: "Optional", options: [{ value: "a", label: "A" }],
    }, "")).toEqual({ action: "remove" });
    expect(expectPlan({ type: "number", key: "digest.window-hours", label: "Hours", min: 1, max: 168 }, 12)).toEqual({ action: "set", value: 12 });
    expect(expectPlan({ type: "number", key: "digest.window-hours", label: "Hours", min: 1, max: 168 }, "")).toEqual({ action: "keep", error: null });
    expect(expectPlan({ type: "number", key: "digest.window-hours", label: "Hours", min: 1, max: 168 }, 200)).toEqual({ action: "keep", error: "invalid" });
    expect(expectPlan({ type: "text", key: "note", label: "Note" }, "hello")).toEqual({ action: "set", value: "hello" });
    expect(expectPlan({ type: "text", key: "note", label: "Note" }, "")).toEqual({ action: "remove" });
    expect(expectPlan({ type: "text", key: "note", label: "Note", required: true }, "  ")).toEqual({ action: "keep", error: "required" });
    expect(expectPlan({ type: "secret", key: "token", label: "Token" }, "")).toEqual({ action: "keep", error: null });
    expect(expectPlan({ type: "secret", key: "token", label: "Token" }, "secret")).toEqual({ action: "set", value: "secret" });
  });

  test("reloads stored values when fields change, not when the manifest object is copied", () => {
    const fields = [
      { key: "digest.auto-enabled", type: "boolean", default: false },
      { key: "digest.generation-time", type: "select", default: "08:00" },
    ];
    expect(pluginSettingLoadSignature(fields)).toBe(pluginSettingLoadSignature(fields.map((field) => ({ ...field }))));
    expect(pluginSettingLoadSignature(fields)).not.toBe(pluginSettingLoadSignature([
      ...fields,
      { key: "digest.window-hours", type: "number", default: 24 },
    ]));
  });
});
