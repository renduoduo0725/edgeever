import type { PluginSettingField, PluginSettingValue } from "@edgeever/plugin-api";

export const pluginSettingLoadSignature = (fields: readonly { key: string; type: string; default?: unknown }[]) =>
  fields.map((field) => `${field.key}\0${field.type}\0${JSON.stringify(field.default ?? null)}`).join("\n");

export type PluginSettingWritePlan =
  | { action: "set"; value: PluginSettingValue }
  | { action: "remove" }
  | { action: "keep"; error: "required" | "invalid" | null };

/** Decide what must be stored for the value currently shown in one setting control. */
export const planPluginSettingWrite = (
  field: PluginSettingField,
  value: PluginSettingValue | "",
): PluginSettingWritePlan => {
  if (field.type === "secret") {
    return typeof value === "string" && value !== "" ? { action: "set", value } : { action: "keep", error: null };
  }
  if (field.type === "boolean") {
    return typeof value === "boolean" ? { action: "set", value } : { action: "keep", error: "invalid" };
  }
  if (field.type === "number") {
    if (value === "") return { action: "keep", error: null };
    if (typeof value !== "number" || !Number.isFinite(value)) return { action: "keep", error: "invalid" };
    if (field.min !== undefined && value < field.min) return { action: "keep", error: "invalid" };
    if (field.max !== undefined && value > field.max) return { action: "keep", error: "invalid" };
    return { action: "set", value };
  }
  if (field.type === "select") {
    if (value === "") return field.required ? { action: "keep", error: "required" } : { action: "remove" };
    if (typeof value !== "string" || !field.options.some((option) => option.value === value)) {
      return { action: "keep", error: "invalid" };
    }
    return { action: "set", value };
  }
  if (typeof value !== "string") return { action: "keep", error: "invalid" };
  if (!value.trim()) return field.required ? { action: "keep", error: "required" } : { action: "remove" };
  return { action: "set", value };
};

export const revertBooleanSettingAfterFailedWrite = (
  current: PluginSettingValue | "",
  attempted: boolean,
): PluginSettingValue | "" => (current === attempted ? !attempted : current);

export const createPluginSettingWriteQueue = () => {
  const tails = new Map<string, Promise<void>>();

  return {
    enqueue(key: string, write: () => Promise<void>): Promise<void> {
      const previous = tails.get(key);
      let run: Promise<void>;
      if (previous) {
        run = previous.then(write, write);
      } else {
        try {
          run = Promise.resolve(write());
        } catch (error) {
          run = Promise.reject(error);
        }
      }
      const tail = run.then(() => undefined, () => undefined);
      tails.set(key, tail);
      void tail.finally(() => {
        if (tails.get(key) === tail) tails.delete(key);
      });
      return run;
    },
  };
};
