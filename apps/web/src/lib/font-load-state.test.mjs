import { describe, expect, test } from "bun:test";
import { createFontLoadState, combineFontLoadStatus } from "./font-load-state.ts";
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

describe("font loading feedback", () => {
  test("reports loading, failure, and a successful explicit retry", async () => {
    const state = createFontLoadState();
    const events = [];
    const unsubscribe = state.subscribe(() => events.push(state.getSnapshot()));
    const first = deferred();
    const failed = state.run(() => first.promise);
    expect(state.getSnapshot()).toBe("loading");
    first.reject(new Error("offline"));
    await expect(failed).rejects.toThrow("offline");
    expect(state.getSnapshot()).toBe("error");
    await state.run(() => Promise.resolve("cached font"));
    expect(events).toEqual(["loading", "error", "loading", "ready"]);
    unsubscribe();
    state.reset();
    expect(events.length).toBe(4);
  });
  test("late completion from the previous font cannot hide a new failure", async () => {
    const state = createFontLoadState();
    const old = deferred();
    const oldRequest = state.run(() => old.promise);
    await expect(state.run(() => Promise.reject(new Error("new font offline")))).rejects.toThrow();
    old.resolve(); await oldRequest;
    expect(state.getSnapshot()).toBe("error");
  });
  test("late failure cannot overwrite a newer ready font", async () => {
    const state = createFontLoadState();
    const old = deferred();
    const oldRequest = state.run(() => old.promise);
    await state.run(() => Promise.resolve());
    old.reject(new Error("old request"));
    await expect(oldRequest).rejects.toThrow();
    expect(state.getSnapshot()).toBe("ready");
  });
  test("changing to system font invalidates pending remote status", async () => {
    const state = createFontLoadState();
    const old = deferred();
    const request = state.run(() => old.promise);
    state.reset(); old.resolve(); await request;
    expect(state.getSnapshot()).toBe("idle");
  });
  test("a ready name preview never implies the content is ready", () => {
    expect(combineFontLoadStatus("loading", "ready")).toBe("loading");
    expect(combineFontLoadStatus("error", "ready")).toBe("error");
    expect(combineFontLoadStatus("ready", "error")).toBe("error");
    expect(combineFontLoadStatus("ready", "loading")).toBe("loading");
    expect(combineFontLoadStatus("ready", "ready")).toBe("ready");
  });
});
