import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  RENDERER_HIBERNATE_BACKGROUND_MS,
  RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS,
  RENDERER_HIBERNATE_MEMORY_BYTES,
  createRendererHibernateController,
  nextHibernateCheckDelayMs,
  shouldHibernateRenderer,
  workingSetBytesFromProcessMemoryInfo,
} from "./renderer-hibernate.mjs";

describe("desktop renderer hibernate policy", () => {
  test("never reloads a focused or loading renderer", () => {
    expect(shouldHibernateRenderer({
      focused: true,
      visible: false,
      backgroundMs: RENDERER_HIBERNATE_BACKGROUND_MS,
      workingSetBytes: RENDERER_HIBERNATE_MEMORY_BYTES * 2,
    })).toBe(false);
    expect(shouldHibernateRenderer({
      focused: false,
      visible: false,
      loading: true,
      backgroundMs: RENDERER_HIBERNATE_BACKGROUND_MS,
    })).toBe(false);
  });

  test("reloads a hidden renderer after the long background delay", () => {
    expect(shouldHibernateRenderer({
      focused: false,
      visible: false,
      backgroundMs: RENDERER_HIBERNATE_BACKGROUND_MS,
    })).toBe(true);
  });

  test("reloads a hidden high-memory renderer after the short delay", () => {
    expect(shouldHibernateRenderer({
      focused: false,
      visible: false,
      backgroundMs: RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS,
      workingSetBytes: RENDERER_HIBERNATE_MEMORY_BYTES,
    })).toBe(true);
    expect(shouldHibernateRenderer({
      focused: false,
      visible: false,
      backgroundMs: RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS - 1,
      workingSetBytes: RENDERER_HIBERNATE_MEMORY_BYTES,
    })).toBe(false);
  });

  test("only reloads a visible unfocused renderer when memory is high", () => {
    expect(shouldHibernateRenderer({
      focused: false,
      visible: true,
      backgroundMs: RENDERER_HIBERNATE_BACKGROUND_MS,
      workingSetBytes: RENDERER_HIBERNATE_MEMORY_BYTES - 1,
    })).toBe(false);
    expect(shouldHibernateRenderer({
      focused: false,
      visible: true,
      backgroundMs: RENDERER_HIBERNATE_BACKGROUND_MS,
      workingSetBytes: RENDERER_HIBERNATE_MEMORY_BYTES,
    })).toBe(true);
  });

  test("converts Chromium process memory info to bytes", () => {
    expect(workingSetBytesFromProcessMemoryInfo({ private: 800 * 1024 })).toBe(800 * 1024 * 1024);
    expect(workingSetBytesFromProcessMemoryInfo({ residentSet: 12 })).toBe(12 * 1024);
    expect(workingSetBytesFromProcessMemoryInfo({})).toBe(0);
  });

  test("checks memory shortly after backgrounding, then the long delay", () => {
    expect(nextHibernateCheckDelayMs(0)).toBe(RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS);
    expect(nextHibernateCheckDelayMs(RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS)).toBe(
      RENDERER_HIBERNATE_BACKGROUND_MS - RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS,
    );
  });
});

describe("desktop renderer hibernate controller", () => {
  test("cancels a pending reload when the window is focused again", async () => {
    const timers = [];
    let now = 0;
    let focused = false;
    let reloaded = 0;
    const controller = createRendererHibernateController({
      now: () => now,
      setTimer: (callback, delay) => {
        const id = timers.length + 1;
        timers.push({ id, callback, delay });
        return id;
      },
      clearTimer: (id) => {
        const index = timers.findIndex((timer) => timer.id === id);
        if (index >= 0) timers.splice(index, 1);
      },
      getBackgroundState: () => ({ focused, visible: false, quitting: false, loading: false }),
      getMemoryBytes: () => 0,
      reloadRenderer: () => {
        reloaded += 1;
      },
    });

    controller.noteBackground();
    expect(timers).toHaveLength(1);
    focused = true;
    const pending = timers.shift();
    await pending.callback();
    expect(reloaded).toBe(0);
    expect(timers).toHaveLength(0);
  });

  test("reloads after the hidden delay and skips prepare if the user came back", async () => {
    const timers = [];
    let now = 0;
    let focused = false;
    const events = [];
    const controller = createRendererHibernateController({
      now: () => now,
      setTimer: (callback, delay) => {
        const id = timers.length + 1;
        timers.push({ id, callback, delay });
        return id;
      },
      clearTimer: (id) => {
        const index = timers.findIndex((timer) => timer.id === id);
        if (index >= 0) timers.splice(index, 1);
      },
      getBackgroundState: () => ({ focused, visible: false, quitting: false, loading: false }),
      getMemoryBytes: () => 0,
      prepareRenderer: async () => {
        events.push("prepare");
      },
      reloadRenderer: () => {
        events.push("reload");
      },
    });

    controller.noteBackground();
    now = RENDERER_HIBERNATE_MEMORY_BACKGROUND_MS;
    await timers.shift().callback();
    expect(events).toEqual([]);
    now = RENDERER_HIBERNATE_BACKGROUND_MS;
    await timers.shift().callback();
    expect(events).toEqual(["prepare", "reload"]);
  });
});

describe("desktop renderer hibernate wiring", () => {
  test("reloads the existing webContents after a background persist handshake", () => {
    const mainSource = readFileSync(new URL("./index.mjs", import.meta.url), "utf8");
    const preloadSource = readFileSync(new URL("../preload/index.cjs", import.meta.url), "utf8");

    expect(mainSource).toContain("createRendererHibernateController");
    expect(mainSource).toContain('webContents.send("desktop:hibernate-prepare")');
    expect(mainSource).toContain("webContents.reload()");
    expect(preloadSource).toContain("onHibernatePrepare");
    expect(preloadSource).toContain('ipcRenderer.send("desktop:hibernate-prepared")');
  });
});
