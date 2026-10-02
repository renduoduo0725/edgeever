import { describe, expect, test } from "bun:test";
import { localizePluginSettingField } from "./plugin-settings-localization";

describe("plugin setting localization", () => {
  const field = {
    key: "format", type: "select", label: "Format", default: "text",
    options: [{ value: "text", label: "Text" }, { value: "emoji", label: "Emoji" }],
    locales: {
      "zh-CN": { label: "格式", options: { text: "文本" } },
      ja: { label: "形式", options: { text: "テキスト" } },
    },
  };

  test("uses exact locale, then matching language, then base copy", () => {
    expect(localizePluginSettingField(field, "zh-CN")).toMatchObject({ label: "格式", options: [{ value: "text", label: "文本" }, { value: "emoji", label: "Emoji" }] });
    expect(localizePluginSettingField(field, "ja-JP").label).toBe("形式");
    expect(localizePluginSettingField(field, "fr-FR")).toBe(field);
  });

  test("keeps setting keys and values while translating text", () => {
    const localized = localizePluginSettingField(field, "zh-CN");
    expect(localized.key).toBe(field.key);
    expect(localized.default).toBe(field.default);
    expect(localized.options.map(({ value }) => value)).toEqual(["text", "emoji"]);
    expect(field.label).toBe("Format");
  });
});
