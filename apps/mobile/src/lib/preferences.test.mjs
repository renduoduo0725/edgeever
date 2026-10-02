import { expect, test } from "bun:test";

// Keep the native module mock out of the other mobile tests' module cache.
test("descendant preference defaults safely when native storage fails", () => {
  const result = Bun.spawnSync([process.execPath, "--eval", `
    import { mock } from "bun:test";
    import { strict as assert } from "node:assert";
    let stored = null;
    let rejects = false;
    mock.module("@react-native-async-storage/async-storage", () => ({ default: {
      getItem: async () => { if (rejects) throw new Error("storage unavailable"); return stored; },
      setItem: async (_key, value) => { stored = value; },
    } }));
    const { readMobileShowDescendantNotes, writeMobileShowDescendantNotes } =
      await import(${JSON.stringify(new URL("./preferences.ts", import.meta.url).href)});
    assert.equal(await readMobileShowDescendantNotes(), true);
    await writeMobileShowDescendantNotes(false);
    assert.equal(await readMobileShowDescendantNotes(), false);
    await writeMobileShowDescendantNotes(true);
    assert.equal(await readMobileShowDescendantNotes(), true);
    rejects = true;
    assert.equal(await readMobileShowDescendantNotes(), true);
  `], { stdout: "pipe", stderr: "pipe" });
  expect({ exitCode: result.exitCode, stderr: result.stderr.toString() }).toEqual({ exitCode: 0, stderr: "" });
});

test("descendant preference keeps the stored value when saving fails", () => {
  const result = Bun.spawnSync([process.execPath, "--eval", `
    import { mock } from "bun:test";
    import { strict as assert } from "node:assert";
    let stored = "false";
    let writesFail = false;
    mock.module("@react-native-async-storage/async-storage", () => ({ default: {
      getItem: async () => stored,
      setItem: async (_key, value) => { if (writesFail) throw new Error("disk full"); stored = value; },
    } }));
    const { readMobileShowDescendantNotes, saveMobileShowDescendantNotes } =
      await import(${JSON.stringify(new URL("./preferences.ts", import.meta.url).href)});
    assert.deepEqual(await saveMobileShowDescendantNotes(true), { value: true, saved: true });
    writesFail = true;
    // The UI must keep showing what the next launch will restore, not the unsaved choice.
    assert.deepEqual(await saveMobileShowDescendantNotes(false), { value: true, saved: false });
    assert.equal(await readMobileShowDescendantNotes(), true);
  `], { stdout: "pipe", stderr: "pipe" });
  expect({ exitCode: result.exitCode, stderr: result.stderr.toString() }).toEqual({ exitCode: 0, stderr: "" });
});
