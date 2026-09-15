import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  clearStoredLocale,
  defaultLocale,
  getBrowserLocale,
  getInitialLocale,
  supportedLocales,
  writeStoredLocale,
  type AppLocalePreference,
  type SupportedLocale,
} from "./locales";
import { enUS } from "./resources/en-US";
import { zhCN } from "./resources/zh-CN";

export {
  defaultLocale,
  getAppLocalePreference,
  localeLabels,
  supportedLocales,
  type AppLocalePreference,
  type SupportedLocale,
} from "./locales";

export const resources = {
  "zh-CN": { translation: zhCN },
  "en-US": { translation: enUS },
} as const;

const ensureLocaleCatalog = async (locale: SupportedLocale) => {
  if (locale !== "ja" || i18n.hasResourceBundle("ja", "translation")) {
    return;
  }

  const { ja } = await import("./resources/ja");
  i18n.addResourceBundle("ja", "translation", ja, true, true);
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLocale() === "ja" ? "en-US" : getInitialLocale(),
  fallbackLng: {
    ja: ["en-US"],
    default: [defaultLocale],
  },
  supportedLngs: supportedLocales,
  partialBundledLanguages: true,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

i18n.on("languageChanged", (locale) => {
  const supported = supportedLocales.find((item) => item === locale);

  if (supported) {
    document.documentElement.lang = supported;
  }
});

document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language ?? defaultLocale;

export const bootstrapI18n = async () => {
  const locale = getInitialLocale();
  if (locale !== "ja") {
    return;
  }

  await ensureLocaleCatalog(locale);
  await i18n.changeLanguage(locale);
};

export const changeAppLocale = async (locale: SupportedLocale) => {
  writeStoredLocale(locale);
  await ensureLocaleCatalog(locale);
  return i18n.changeLanguage(locale);
};

export const changeAppLocalePreference = async (preference: AppLocalePreference) => {
  if (preference === "system") {
    clearStoredLocale();
    const locale = getBrowserLocale() ?? defaultLocale;
    await ensureLocaleCatalog(locale);
    return i18n.changeLanguage(locale);
  }

  return changeAppLocale(preference);
};

export default i18n;
