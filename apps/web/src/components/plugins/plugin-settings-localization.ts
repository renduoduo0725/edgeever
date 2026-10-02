import type { PluginSettingField } from "@edgeever/plugin-api";

export const localizePluginSettingField = (field: PluginSettingField, locale: string | undefined): PluginSettingField => {
  if (!locale || !field.locales) return field;
  const normalized = locale.trim().replaceAll("_", "-").toLocaleLowerCase();
  const entries = Object.entries(field.locales);
  const exact = entries.find(([candidate]) => candidate.toLocaleLowerCase() === normalized)?.[1];
  const language = normalized.split("-")[0];
  const copy = exact ?? entries.find(([candidate]) => candidate.toLocaleLowerCase().split("-")[0] === language)?.[1];
  if (!copy) return field;
  return {
    ...field,
    label: copy.label ?? field.label,
    description: copy.description ?? field.description,
    ...((field.type === "text" || field.type === "secret") && copy.placeholder ? { placeholder: copy.placeholder } : {}),
    ...(field.type === "select" && copy.options ? {
      options: field.options.map((option) => ({ ...option, label: copy.options?.[option.value] ?? option.label })),
    } : {}),
  } as PluginSettingField;
};
