export function companionLocale(language?: string): "zh-CN" | "en-US" | "ja" {
  if (language?.startsWith("zh")) return "zh-CN";
  if (language?.startsWith("ja")) return "ja";
  return "en-US";
}
