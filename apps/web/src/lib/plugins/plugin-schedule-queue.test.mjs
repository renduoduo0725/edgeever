import { describe, expect, test } from "bun:test";
import { createPluginScheduleQueue } from "./plugin-schedule-queue.ts";

describe("plugin schedule queue", () => {
  test("runs a second upsert only after the first one finishes", async () => {
    const queue = createPluginScheduleQueue();
    const order = [];
    let releaseFirst = () => {};
    const first = queue.enqueue("org.plugin:daily", () => new Promise((resolve) => {
      releaseFirst = () => {
        order.push("first");
        resolve("first");
      };
    }));
    const second = queue.enqueue("org.plugin:daily", async () => {
      order.push("second");
      return "second";
    });

    expect(order).toEqual([]);
    await Promise.resolve();
    await Promise.resolve();
    releaseFirst();
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first", "second"]);
  });

  test("a failed upsert does not block the next one for the same schedule", async () => {
    const queue = createPluginScheduleQueue();
    await expect(queue.enqueue("org.plugin:daily", async () => {
      throw new Error("database is locked");
    })).rejects.toThrow("database is locked");
    await expect(queue.enqueue("org.plugin:daily", async () => "enabled")).resolves.toBe("enabled");
  });

  test("different schedules do not wait for each other", async () => {
    const queue = createPluginScheduleQueue();
    const order = [];
    let releaseA = () => {};
    const a = queue.enqueue("a", () => new Promise((resolve) => {
      releaseA = () => {
        order.push("a");
        resolve("a");
      };
    }));
    const b = queue.enqueue("b", async () => {
      order.push("b");
      return "b";
    });
    await expect(b).resolves.toBe("b");
    expect(order).toEqual(["b"]);
    releaseA();
    await expect(a).resolves.toBe("a");
  });
});
