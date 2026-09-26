import { AlignHorizontalJustifyCenter, AppWindow, BookOpenText, ChartNoAxesCombined, Image, Keyboard, Languages, MousePointerClick, Palette, Sparkles, SunMoon } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { EditorContentAlignment, ShortcutSettings } from "@/lib/app-helpers";
import {
  EDITOR_LINK_OPEN_MODE_CHANGED_EVENT,
  getStoredEditorLinkOpenMode,
  writeEditorLinkOpenMode,
  type EditorLinkOpenMode,
} from "@/lib/editor-link-click";
import {
  AI_SELECTION_MENU_CHANGED_EVENT,
  readAiSelectionMenuPreference,
  writeAiSelectionMenuPreference,
} from "@/lib/ai-selection-menu-preference";
import {
  AI_SPACE_SHORTCUT_CHANGED_EVENT,
  readAiSpaceShortcutPreference,
  writeAiSpaceShortcutPreference,
} from "@/lib/ai-space-shortcut-preference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SETTINGS_CARD_HEADER_CLASSNAME,
  SETTINGS_CARD_ICON_CLASSNAME,
  SETTINGS_CARD_TITLE_CLASSNAME,
  SETTINGS_ITEM_TITLE_CLASSNAME,
} from "./settings-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  changeAppLocalePreference,
  getAppLocalePreference,
  localeLabels,
  supportedLocales,
  type AppLocalePreference,
} from "@/i18n";
import {
  applyEditorBodyFontPreference,
  getFontChoicePreviewStack,
  readEditorBodyFontPreference,
  writeEditorBodyFontPreference,
  type EditorBodyFontChoice,
  type EditorBodyFontPreference,
} from "@/lib/editor-body-font";
import { applyUiFontPreference, readUiFontPreference, writeUiFontPreference } from "@/lib/ui-font";
import { syncPublishedNoteBodyFont } from "@/lib/published-note-body-font";
import { ShortcutSettingsItem } from "./ShortcutSettingsItem";
import { CustomEditorThemeDialog } from "./CustomEditorThemeDialog";
import {
  MERMAID_THEME_PREFERENCES,
  useAppearanceTheme,
  useEditorTheme,
  useMermaidTheme,
  DEFAULT_CUSTOM_LIGHT_COLORS,
  DEFAULT_CUSTOM_DARK_COLORS,
  localizeStoredCustomThemeName,
  type CustomEditorTheme,
  type ThemePreference,
} from "../ThemeProvider";

const CUSTOM_FONT_SUGGESTIONS = [
  { label: "苹方 (PingFang SC)", family: "PingFang SC" },
  { label: "微软雅黑 (Microsoft YaHei)", family: "Microsoft YaHei" },
  { label: "鸿蒙黑体 (HarmonyOS)", family: "HarmonyOS Sans SC" },
  { label: "冬青黑体 (Hiragino)", family: "Hiragino Sans GB" },
] as const;

const FontChoiceFields = ({
  label,
  preference,
  onChange,
}: {
  label: string;
  preference: EditorBodyFontPreference;
  onChange: (preference: EditorBodyFontPreference) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-80">
      <Select
        value={preference.choice}
        onValueChange={(value) => onChange({ choice: value as EditorBodyFontChoice, customFamily: preference.customFamily })}
      >
        <SelectTrigger aria-label={label} className="h-9 bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">{t("settings.editorBodyFonts.system")}</SelectItem>
          <SelectItem
            value="wenkai"
            style={{ fontFamily: getFontChoicePreviewStack("wenkai") }}
          >
            <span style={{ fontFamily: getFontChoicePreviewStack("wenkai") }}>
              {t("settings.editorBodyFonts.wenkai")}
            </span>
          </SelectItem>
          <SelectItem
            value="wenkai-screen"
            style={{ fontFamily: getFontChoicePreviewStack("wenkai-screen") }}
          >
            <span style={{ fontFamily: getFontChoicePreviewStack("wenkai-screen") }}>
              {t("settings.editorBodyFonts.wenkaiScreen")}
            </span>
          </SelectItem>
          <SelectItem
            value="zhuque"
            style={{ fontFamily: getFontChoicePreviewStack("zhuque") }}
          >
            <span style={{ fontFamily: getFontChoicePreviewStack("zhuque") }}>
              {t("settings.editorBodyFonts.zhuque")}
            </span>
          </SelectItem>
          <SelectItem
            value="source-han-serif"
            style={{ fontFamily: getFontChoicePreviewStack("source-han-serif") }}
          >
            <span style={{ fontFamily: getFontChoicePreviewStack("source-han-serif") }}>
              {t("settings.editorBodyFonts.sourceHanSerif")}
            </span>
          </SelectItem>
          <SelectItem
            value="neo-zhi-song"
            style={{ fontFamily: getFontChoicePreviewStack("neo-zhi-song") }}
          >
            <span style={{ fontFamily: getFontChoicePreviewStack("neo-zhi-song") }}>
              {t("settings.editorBodyFonts.neoZhiSong")}
            </span>
          </SelectItem>
          <SelectItem
            value="source-han-sans"
            style={{ fontFamily: getFontChoicePreviewStack("source-han-sans") }}
          >
            <span style={{ fontFamily: getFontChoicePreviewStack("source-han-sans") }}>
              {t("settings.editorBodyFonts.sourceHanSans")}
            </span>
          </SelectItem>
          <SelectItem
            value="source-serif"
            style={{ fontFamily: getFontChoicePreviewStack("source-serif") }}
          >
            <span style={{ fontFamily: getFontChoicePreviewStack("source-serif") }}>
              {t("settings.editorBodyFonts.sourceSerif")}
            </span>
          </SelectItem>
          <SelectItem value="custom">{t("settings.editorBodyFonts.custom")}</SelectItem>
        </SelectContent>
      </Select>
      {preference.choice === "custom" ? (
        <div className="flex flex-col gap-1.5">
          <Input
            value={preference.customFamily}
            aria-label={t("settings.editorBodyFontCustomLabel")}
            placeholder={t("settings.editorBodyFontCustomPlaceholder")}
            className="h-9"
            maxLength={200}
            onChange={(event) => onChange({ choice: "custom", customFamily: event.target.value })}
          />
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span className="shrink-0 text-slate-400">{t("settings.editorBodyFontSuggestions")}:</span>
            {CUSTOM_FONT_SUGGESTIONS.map((item) => (
              <button
                key={item.family}
                type="button"
                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => onChange({ choice: "custom", customFamily: item.family })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface PreferenceCardProps {
  imageCompressionEnabled: boolean;
  onImageCompressionChange: (enabled: boolean) => void;
  shortcutSettings: ShortcutSettings;
  onShortcutSettingsChange: (settings: ShortcutSettings) => void;
  editorContentAlignment: EditorContentAlignment;
  onEditorContentAlignmentChange: (alignment: EditorContentAlignment) => void;
}

export const PreferenceCard = ({
  imageCompressionEnabled,
  onImageCompressionChange,
  shortcutSettings,
  onShortcutSettingsChange,
  editorContentAlignment,
  onEditorContentAlignmentChange,
}: PreferenceCardProps) => {
  const { t } = useTranslation();
  const {
    editorTheme,
    customEditorThemes,
    setCustomEditorThemes,
    setEditorTheme,
  } = useEditorTheme();
  const { preference: appearancePreference, setPreference: setAppearancePreference } = useAppearanceTheme();
  const { mermaidThemePreference, setMermaidTheme } = useMermaidTheme();
  const [customThemeDialogOpen, setCustomThemeDialogOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomEditorTheme | null>(null);
  const [activeLocalePreference, setActiveLocalePreference] = useState<AppLocalePreference>(() => getAppLocalePreference());
  const [isMobile, setIsMobile] = useState(false);
  const [linkOpenMode, setLinkOpenMode] = useState<EditorLinkOpenMode>(() => getStoredEditorLinkOpenMode());
  const [aiSelectionMenuEnabled, setAiSelectionMenuEnabled] = useState(readAiSelectionMenuPreference);
  const [aiSpaceShortcutEnabled, setAiSpaceShortcutEnabled] = useState(readAiSpaceShortcutPreference);
  const [editorBodyFont, setEditorBodyFont] = useState(readEditorBodyFontPreference);
  const [uiFont, setUiFont] = useState(readUiFontPreference);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const syncPreference = () => setAiSpaceShortcutEnabled(readAiSpaceShortcutPreference());
    const onPreferenceChanged = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") {
        setAiSpaceShortcutEnabled(detail);
        return;
      }
      syncPreference();
    };
    window.addEventListener(AI_SPACE_SHORTCUT_CHANGED_EVENT, onPreferenceChanged);
    window.addEventListener("storage", syncPreference);
    return () => {
      window.removeEventListener(AI_SPACE_SHORTCUT_CHANGED_EVENT, onPreferenceChanged);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  useEffect(() => {
    const syncPreference = () => setAiSelectionMenuEnabled(readAiSelectionMenuPreference());
    const onPreferenceChanged = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") {
        setAiSelectionMenuEnabled(detail);
        return;
      }
      syncPreference();
    };
    window.addEventListener(AI_SELECTION_MENU_CHANGED_EVENT, onPreferenceChanged);
    window.addEventListener("storage", syncPreference);
    return () => {
      window.removeEventListener(AI_SELECTION_MENU_CHANGED_EVENT, onPreferenceChanged);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  useEffect(() => {
    const syncMode = () => setLinkOpenMode(getStoredEditorLinkOpenMode());
    const onPreferenceChanged = (event: Event) => {
      const detail = (event as CustomEvent<EditorLinkOpenMode>).detail;
      if (detail === "click" || detail === "modifier") {
        setLinkOpenMode(detail);
        return;
      }
      syncMode();
    };
    window.addEventListener(EDITOR_LINK_OPEN_MODE_CHANGED_EVENT, onPreferenceChanged);
    window.addEventListener("storage", syncMode);
    return () => {
      window.removeEventListener(EDITOR_LINK_OPEN_MODE_CHANGED_EVENT, onPreferenceChanged);
      window.removeEventListener("storage", syncMode);
    };
  }, []);

  const activeCustom = customEditorThemes.find((t) => t.id === editorTheme);
  const customThemeLabel = (name: string) =>
    localizeStoredCustomThemeName(name, {
      defaultName: t("settings.customEditorTheme.defaultName"),
      newName: (index) => t("settings.customEditorTheme.newName", { n: index }),
    });

  const handleEditClick = () => {
    const target = activeCustom ?? customEditorThemes[0];
    if (target) {
      setEditingTheme({ ...target, name: customThemeLabel(target.name) });
    } else {
      const newTheme: CustomEditorTheme = {
        id: `custom-${Date.now()}`,
        name: t("settings.customEditorTheme.newName", { n: customEditorThemes.length + 1 }),
        light: DEFAULT_CUSTOM_LIGHT_COLORS,
        dark: DEFAULT_CUSTOM_DARK_COLORS,
      };
      setEditingTheme(newTheme);
    }
    setCustomThemeDialogOpen(true);
  };

  const handleSaveTheme = (saved: CustomEditorTheme) => {
    const exists = customEditorThemes.some((t) => t.id === saved.id);
    let nextThemes: CustomEditorTheme[];
    if (exists) {
      nextThemes = customEditorThemes.map((t) => (t.id === saved.id ? saved : t));
    } else {
      nextThemes = [...customEditorThemes, saved];
    }
    setCustomEditorThemes(nextThemes);
    setEditorTheme(saved.id);
  };

  const handleDeleteTheme = (idToDelete: string) => {
    const nextThemes = customEditorThemes.filter((t) => t.id !== idToDelete);
    setCustomEditorThemes(nextThemes);
    if (editorTheme === idToDelete) {
      setEditorTheme("default");
    }
  };

  const handleLocalePreferenceChange = (preference: AppLocalePreference) => {
    setActiveLocalePreference(preference);
    void changeAppLocalePreference(preference);
  };

  const updateEditorBodyFont = (preference: EditorBodyFontPreference) => {
    setEditorBodyFont(preference);
    writeEditorBodyFontPreference(preference);
    applyEditorBodyFontPreference(preference);
    void syncPublishedNoteBodyFont();
  };

  const updateUiFont = (preference: EditorBodyFontPreference) => {
    setUiFont(preference);
    writeUiFontPreference(preference);
    applyUiFontPreference(preference);
  };

  return (
    <Card className="w-full min-w-0 overflow-hidden shadow-none">
      <CardHeader className={SETTINGS_CARD_HEADER_CLASSNAME}>
        <CardTitle className={SETTINGS_CARD_TITLE_CLASSNAME}>
          <Image className={SETTINGS_CARD_ICON_CLASSNAME} />
          {t("settings.preferences")}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100 p-0">
        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Languages className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.languageTitle")}</div>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-80">
            <Select
              value={activeLocalePreference}
              onValueChange={(preference) => handleLocalePreferenceChange(preference as AppLocalePreference)}
            >
              <SelectTrigger aria-label={t("common.language")} className="h-9 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("settings.systemLanguage")}</SelectItem>
                {supportedLocales.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {localeLabels[locale]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <SunMoon className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.themeTitle")}</div>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-80">
            <Select
              value={appearancePreference}
              onValueChange={(value) => setAppearancePreference(value as ThemePreference)}
            >
              <SelectTrigger aria-label={t("settings.themeTitle")} className="h-9 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("settings.themeSystem")}</SelectItem>
                <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
                <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <AppWindow className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.uiFontTitle")}</div>
            </div>
          </div>
          <FontChoiceFields
            label={t("settings.uiFontTitle")}
            preference={uiFont}
            onChange={updateUiFont}
          />
        </div>

        <div className="hidden min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <AlignHorizontalJustifyCenter className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.editorContentAlignmentTitle")}</div>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-80">
            <Select
              value={editorContentAlignment}
              onValueChange={(value) => onEditorContentAlignmentChange(value as EditorContentAlignment)}
            >
              <SelectTrigger aria-label={t("settings.editorContentAlignmentTitle")} className="h-9 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start">{t("settings.editorContentAlignments.start")}</SelectItem>
                <SelectItem value="center">{t("settings.editorContentAlignments.center")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <BookOpenText className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.editorBodyFontTitle")}</div>
            </div>
          </div>
          <FontChoiceFields
            label={t("settings.editorBodyFontTitle")}
            preference={editorBodyFont}
            onChange={updateEditorBodyFont}
          />
        </div>

        {!isMobile && (
          <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Palette className="h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.customEditorTheme.settingsTitle")}</div>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" className="h-9 shrink-0 px-3 text-xs" onClick={handleEditClick}>
                {activeCustom || customEditorThemes.length > 0
                  ? t("settings.customEditorTheme.edit")
                  : t("settings.customEditorTheme.create")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <ChartNoAxesCombined className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.mermaidThemeTitle")}</div>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-80">
            <Select value={mermaidThemePreference} onValueChange={(value) => setMermaidTheme(value as typeof mermaidThemePreference)}>
              <SelectTrigger aria-label={t("settings.mermaidThemeTitle")} className="h-9 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MERMAID_THEME_PREFERENCES.map((theme) => (
                  <SelectItem key={theme} value={theme}>
                    {t(`settings.mermaidThemes.${theme}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.imageCompressionTitle")}</div>
            </div>
          </div>
          <div className="flex w-full shrink-0 justify-start sm:w-44 sm:justify-end">
            <Switch
              checked={imageCompressionEnabled}
              onCheckedChange={onImageCompressionChange}
              aria-label={t("settings.imageCompressionAria")}
            />
          </div>
        </div>

        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.aiSelectionMenuTitle")}</div>
            </div>
          </div>
          <div className="flex w-full shrink-0 justify-start sm:w-44 sm:justify-end">
            <Switch
              checked={aiSelectionMenuEnabled}
              onCheckedChange={(enabled) => {
                writeAiSelectionMenuPreference(enabled);
                setAiSelectionMenuEnabled(enabled);
              }}
              aria-label={t("settings.aiSelectionMenuAria")}
            />
          </div>
        </div>

        <div className="flex min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Keyboard className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.aiSpaceShortcutTitle")}</div>
            </div>
          </div>
          <div className="flex w-full shrink-0 justify-start sm:w-44 sm:justify-end">
            <Switch
              checked={aiSpaceShortcutEnabled}
              onCheckedChange={(enabled) => {
                writeAiSpaceShortcutPreference(enabled);
                setAiSpaceShortcutEnabled(enabled);
              }}
              aria-label={t("settings.aiSpaceShortcutAria")}
            />
          </div>
        </div>

        {/* Desktop only: mobile editors always open links on a plain tap. */}
        <div className="hidden min-h-16 flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <MousePointerClick className="h-4 w-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.linkOpenModifierTitle")}</div>
            </div>
          </div>
          <div className="flex w-full shrink-0 justify-start sm:w-44 sm:justify-end">
            <Switch
              checked={linkOpenMode === "modifier"}
              onCheckedChange={(enabled) => {
                const next: EditorLinkOpenMode = enabled ? "modifier" : "click";
                writeEditorLinkOpenMode(next);
                setLinkOpenMode(next);
              }}
              aria-label={t("settings.linkOpenModifierAria")}
            />
          </div>
        </div>

        <div className="hidden lg:block">
          <ShortcutSettingsItem
            shortcutSettings={shortcutSettings}
            onShortcutSettingsChange={onShortcutSettingsChange}
          />
        </div>
      </CardContent>
      {!isMobile && editingTheme && (
        <CustomEditorThemeDialog
          open={customThemeDialogOpen}
          theme={editingTheme}
          onOpenChange={setCustomThemeDialogOpen}
          onSave={handleSaveTheme}
          onDelete={handleDeleteTheme}
          isDefaultTheme={editingTheme.id === "custom-default"}
        />
      )}
    </Card>
  );
};
