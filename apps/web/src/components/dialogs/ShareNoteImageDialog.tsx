import type { FontLoadStatus } from "@/lib/font-load-state";
import { useFontPreviewStatus } from "@/lib/use-font-preview-status";
import { FontLoadFeedback } from "@/components/FontLoadFeedback";
import { FONT_CATALOG, FONT_IDS } from "@edgeever/shared/font-catalog";
import { updateNoteImagePreference } from "@edgeever/shared/note-image-preferences";
import { prepareNoteImageAssets } from "@edgeever/shared/note-image-fonts";
import { noteImageAssetUrls } from "@edgeever/shared/note-image-assets";
import { Check, Copy, Download, LoaderCircle, Palette, Share2, Type } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copyImageBlobToClipboard } from "@/lib/clipboard";
import {
  createNoteImage,
  downloadPreparedNoteImage,
  NOTE_IMAGE_CARD_WIDTH_PIXELS,
  type DownloadNoteImageOptions,
  type NoteImageCardWidth,
  type NoteImageFontSize,
  type NoteImageFontStyle,
  type NoteImageTheme,
  type PreparedNoteImage,
} from "@/lib/note-image-export";
import { NOTE_IMAGE_BUNDLED_FONTS, NOTE_IMAGE_TEMPLATE_TYPOGRAPHY, resolveTheme, NOTE_IMAGE_THEME_OPTIONS, buildNoteImageCardMarkup, escapeCardHtml, generateCardCss } from "@edgeever/shared/note-image-card";
import { getHtmlImageEmbedNoticeKind } from "@/lib/note-html-export";
import { readNoteImagePreferences, writeNoteImagePreferences, type NoteImagePreferences } from "@/lib/note-image-preference";
import { cn } from "@/lib/utils";
import { NoteImageFontLabel } from "./NoteImageFontLabel";

export type ShareNoteImageSource = Omit<DownloadNoteImageOptions, "background" | "format">;

const FONT_OPTIONS: Array<{ id: NoteImageFontStyle; labelKey: string }> = [
  { id: "auto", labelKey: "editor.imageShare.fontStyles.auto" },
  { id: "kai", labelKey: "editor.imageShare.fontStyles.kai" },
  { id: "serif", labelKey: "editor.imageShare.fontStyles.serif" },
  { id: "sans", labelKey: "editor.imageShare.fontStyles.sans" },
  { id: "mono", labelKey: "editor.imageShare.fontStyles.mono" },
  ...FONT_IDS.map(id => ({ id, labelKey: FONT_CATALOG[id].labelKey })),

];

const SIZE_OPTIONS: Array<{ id: NoteImageFontSize; labelKey: string }> = [
  { id: "sm", labelKey: "editor.imageShare.fontSizes.sm" },
  { id: "md", labelKey: "editor.imageShare.fontSizes.md" },
  { id: "lg", labelKey: "editor.imageShare.fontSizes.lg" },
];

const WIDTH_OPTIONS: Array<{ id: NoteImageCardWidth; labelKey: string }> = [
  { id: "compact", labelKey: "editor.imageShare.cardWidths.compact" },
  { id: "standard", labelKey: "editor.imageShare.cardWidths.standard" },
  { id: "wide", labelKey: "editor.imageShare.cardWidths.wide" },
];

/** Use the export renderer itself so thumbnails show each theme's actual layout. */
const NoteImageThemePreview = ({
  theme, fontStyle, title, body, quote, retryKey,
}: {
  theme: NoteImageTheme;
  fontStyle: NoteImageFontStyle;
  title: string;
  body: string;
  quote: string;
  retryKey: number;
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(0.24);
  const [assetCss, setAssetCss] = useState("");
  useEffect(() => {
    let active = true;
    setAssetCss("");
    void prepareNoteImageAssets({ theme, fontStyle, text: `${title} ${body} ${quote}`, urls: noteImageAssetUrls })
      .then(assets => {
        if (active) setAssetCss(assets.css);
        void assets.fontsReady?.then(async () => {
          if (!active) return;
          const restored = await prepareNoteImageAssets({ theme, fontStyle, text: `${title} ${body} ${quote}`, urls: noteImageAssetUrls });
          if (active) setAssetCss(restored.css);
        }, () => {}).catch(() => {});
      })
      .catch(() => { /* The full preview reports asset loading errors and offers retry. */ });
    return () => { active = false; };
  }, [theme, fontStyle, title, body, quote, retryKey]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / NOTE_IMAGE_CARD_WIDTH_PIXELS.compact);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const document = useMemo(() => `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; overflow: hidden; }
    ${assetCss}
    ${generateCardCss({ theme, fontStyle, fontSize: "lg", cardWidth: "compact" })}
    .edgeever-image-wrapper { min-height: 600px; }
    </style></head><body>${buildNoteImageCardMarkup({
      theme,
      title,
      bodyHtml: `<p>${escapeCardHtml(body)}</p><blockquote><p>${escapeCardHtml(quote)}</p></blockquote>`,
      showTitle: true,
      showUpdatedAt: false,
      showBranding: false,
    })}</body></html>`, [theme, fontStyle, title, body, quote, assetCss]);
  return (
    <span ref={containerRef} aria-hidden="true" className="pointer-events-none relative block h-28 overflow-hidden rounded-md bg-slate-100">
      <iframe
        aria-hidden="true"
        tabIndex={-1}
        sandbox=""
        srcDoc={document}
        className="absolute left-0 top-0 origin-top-left border-0"
        style={{ width: NOTE_IMAGE_CARD_WIDTH_PIXELS.compact, height: 600, transform: `scale(${scale})` }}
      />
    </span>
  );
};

export const ShareNoteImageDialog = ({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ShareNoteImageSource;
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState(readNoteImagePreferences);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const {
    format, theme, fontStyle, fontSize, cardWidth, showTitle, showNotebook, showTags,
    showUpdatedAt, showReadingTime, showAuthor, author, showBranding,
  } = preferences;
  const setPreference = <K extends keyof NoteImagePreferences>(key: K, value: NoteImagePreferences[K]) => {
    setPreferences(current => updateNoteImagePreference(current, key, value));
  };

  useEffect(() => {
    writeNoteImagePreferences(preferences);
  }, [preferences]);

  const [prepared, setPrepared] = useState<PreparedNoteImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState<false | true | "font">(false);
  const [retry, setRetry] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const [contentFontStatus, setContentFontStatus] = useState<FontLoadStatus>("loading");
  const themeFontLabel = NOTE_IMAGE_TEMPLATE_TYPOGRAPHY[resolveTheme(undefined, theme)].body
    .map(font => t(NOTE_IMAGE_BUNDLED_FONTS[font].labelKey))
    .join(" / ");
  const selectedFontLabel = fontStyle === "auto"
    ? themeFontLabel
    : t(FONT_OPTIONS.find(item => item.id === fontStyle)!.labelKey);
  const fontOptionLabel = (item: (typeof FONT_OPTIONS)[number]) => item.id === "auto"
    ? `${t(item.labelKey)} (${themeFontLabel})`
    : t(item.labelKey);

  const { status: selectedFontStatus, onPreviewStatus } = useFontPreviewStatus(`${fontStyle}:${theme}:${retry}`, contentFontStatus);
  const generationRef = useRef(0);
  const copyAttemptRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const generation = ++generationRef.current;
    copyAttemptRef.current += 1;
    setCopyState("idle");
    setPrepared(null);
    setError(false);
    setContentFontStatus("loading");
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void createNoteImage({
        ...source,
        theme,
        background: theme,
        fontStyle,
        fontSize,
        cardWidth,
        showTitle,
        showNotebook,
        showTags,
        showUpdatedAt,
        branding: showBranding,
        author: showAuthor ? author : "",
        showAuthor,
        showReadingTime,
        format,
        notebook: showNotebook ? source.notebook : "",
        tags: showTags ? source.tags : [],
        updatedAt: showUpdatedAt ? source.updatedAt : "",
        signal: controller.signal,
        onFontLoadStatus: status => { if (generation === generationRef.current) setContentFontStatus(status); },
      })
        .then((result) => {
          if (generation !== generationRef.current) return;
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return URL.createObjectURL(result.blob);
          });
          setPrepared(result);
          // Recovery is scoped to this render, so an older template cannot replace a newer one.
          void result.fontsReady?.then(() => {
            if (generation === generationRef.current) setRetry(value => value + 1);
          }, () => { /* Keep the fallback preview and its retry action. */ });
        })
        .catch((reason: unknown) => {
          if (generation === generationRef.current) setError(reason instanceof Error && reason.message === "NOTE_IMAGE_FONT_UNAVAILABLE" ? "font" : true);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      if (generationRef.current === generation) generationRef.current++;
      controller.abort();
    };
  }, [
    author,
    cardWidth,
    fontSize,
    fontStyle,
    format,
    open,
    retry,
    showAuthor,
    showBranding,
    showNotebook,
    showReadingTime,
    showTags,
    showTitle,
    showUpdatedAt,
    source,
    theme,
  ]);

  useEffect(() => {
    if (!open || contentFontStatus !== "error") return;
    const retryFonts = () => setRetry(value => value + 1);
    window.addEventListener("online", retryFonts);
    return () => window.removeEventListener("online", retryFonts);
  }, [open, contentFontStatus]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shareFile = useMemo(
    () => (prepared ? new File([prepared.blob], prepared.filename, { type: prepared.mimeType }) : null),
    [prepared],
  );
  const canUseSystemShare = Boolean(
    shareFile && navigator.canShare?.({ files: [shareFile] }) && navigator.share,
  );
  const noticeKind = prepared ? getHtmlImageEmbedNoticeKind(prepared.images) : "none";

  const handleCopyImage = async () => {
    if (!prepared || copyState === "copying") return;
    const attempt = ++copyAttemptRef.current;
    setCopyState("copying");
    const success = await copyImageBlobToClipboard(prepared.blob);
    if (attempt !== copyAttemptRef.current) return;
    if (!success) {
      setCopyState("failed");
      return;
    }
    setCopyState("copied");
    window.setTimeout(() => {
      if (attempt !== copyAttemptRef.current) return;
      setCopyState((current) => (current === "copied" ? "idle" : current));
    }, 2000);
  };

  const share = async () => {
    if (!prepared || !shareFile) return;
    try {
      await navigator.share({ files: [shareFile], title: source.title });
      onOpenChange(false);
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError(true);
    }
  };

  const download = () => {
    if (!prepared) return;
    downloadPreparedNoteImage(prepared);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-3.5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-sm leading-6 font-semibold">
            <Share2 className="h-4.5 w-4.5 text-slate-700" />
            {t("editor.imageShare.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("editor.imageShare.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:overflow-hidden md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="relative flex min-h-72 flex-1 flex-col overflow-auto bg-[#e9e9e7] md:max-h-[72vh]">
            <div className="flex min-h-full w-full flex-col items-center justify-start p-4 sm:p-6">
              <FontLoadFeedback template status={contentFontStatus} onRetry={() => setRetry(value => value + 1)} />
              {previewUrl && prepared ? (
                <div className="my-auto flex w-full items-center justify-center">
                  <img
                    alt={t("editor.imageShare.previewAlt")}
                    className="block shadow-lg"
                    style={{
                      width: `${NOTE_IMAGE_CARD_WIDTH_PIXELS[cardWidth] || 800}px`,
                      maxWidth: "100%",
                      height: "auto",
                    }}
                    src={previewUrl}
                  />
                </div>
              ) : error ? (
                <div className="my-auto flex min-h-64 flex-col items-center justify-center gap-3 text-xs leading-5 text-rose-600" role="alert">
                  {t(error === "font" ? "editor.imageShare.remoteFontError" : "editor.imageExport.error")}
                  <Button variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>{t("editor.imageShare.retry")}</Button>
                </div>
              ) : (
                <div className="my-auto flex min-h-64 items-center justify-center gap-2 text-xs leading-5 text-slate-500" role="status">
                  <LoaderCircle className="h-5 w-5 animate-spin text-slate-500" />
                  {t("editor.imageShare.generating")}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto border-t border-slate-200 p-5 md:max-h-[72vh] md:border-l md:border-t-0">
            {/* Theme Selector */}
            <fieldset className="space-y-2.5">
              <legend className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Palette className="h-3.5 w-3.5" />
                {t("editor.imageShare.theme")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {NOTE_IMAGE_THEME_OPTIONS.map((id) => {
                  const isSelected = theme === id;
                  const label = t(`editor.imageShare.themes.${id}`);
                  return (
                    <button
                      key={id}
                      aria-pressed={isSelected}
                      className={cn(
                        "group relative flex flex-col items-stretch gap-2 rounded-lg border p-2 text-left text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                        isSelected
                          ? "border-slate-900 bg-slate-50 text-slate-950 ring-1 ring-slate-900"
                          : "border-slate-200 bg-card text-slate-700 hover:border-slate-300 hover:bg-slate-50/70",
                      )}
                      type="button"
                      onClick={() => setPreference("theme", id)}
                    >
                      <NoteImageThemePreview
                        retryKey={retry}
                        theme={id}
                        fontStyle="auto"
                        title={source.title || label}
                        body={t("editor.imageShare.previewBody")}
                        quote={t("editor.imageShare.previewQuote")}
                      />
                      <span className="flex items-center justify-between gap-1 px-0.5">
                        <span className="truncate">{label}</span>
                        {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Typography and Layout */}
            <fieldset className="space-y-3">
              <legend className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Type className="h-3.5 w-3.5" />
                {t("editor.imageShare.fontStyle")}
              </legend>
              <Select value={fontStyle} onOpenChange={setFontMenuOpen} onValueChange={(value) => setPreference("fontStyle", value as NoteImageFontStyle)}>
                <SelectTrigger aria-label={t("editor.imageShare.fontStyle")} className="h-9 w-full text-xs font-normal">
                  <SelectValue>
                    <NoteImageFontLabel label={selectedFontLabel} fontStyle={fontStyle} theme={theme} enabled={open} status={error === true ? undefined : selectedFontStatus} onStatusChange={onPreviewStatus} retryKey={retry} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {FONT_OPTIONS.map((item) => (
                    <SelectItem key={item.id} value={item.id} textValue={fontOptionLabel(item)}>
                      <NoteImageFontLabel label={fontOptionLabel(item)} fontStyle={item.id} theme={theme} enabled={open && fontMenuOpen} visibleOnly />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error === true ? null : <FontLoadFeedback template={contentFontStatus === "error"} status={selectedFontStatus} onRetry={() => setRetry(value => value + 1)} />}

              {/* Font Size */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-medium text-slate-600">{t("editor.imageShare.fontSize")}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SIZE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={fontSize === item.id}
                      className={cn(
                        "h-7 rounded border text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                        fontSize === item.id
                          ? "border-slate-900 bg-slate-100 text-slate-950 font-semibold"
                          : "border-slate-200 bg-card text-slate-600 hover:bg-slate-50",
                      )}
                      type="button"
                      onClick={() => setPreference("fontSize", item.id)}
                    >
                      {t(item.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Width */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-medium text-slate-600">{t("editor.imageShare.cardWidth")}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {WIDTH_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={cardWidth === item.id}
                      className={cn(
                        "h-7 rounded border text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                        cardWidth === item.id
                          ? "border-slate-900 bg-slate-100 text-slate-950 font-semibold"
                          : "border-slate-200 bg-card text-slate-600 hover:bg-slate-50",
                      )}
                      type="button"
                      onClick={() => setPreference("cardWidth", item.id)}
                    >
                      {t(item.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Metadata / Content Toggles */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("editor.imageShare.metadata")}
              </legend>
              <div className="space-y-2">
                {([
                  ["title", showTitle, "showTitle"],
                  ["notebook", showNotebook, "showNotebook"],
                  ["tags", showTags, "showTags"],
                  ["updatedAt", showUpdatedAt, "showUpdatedAt"],
                  ["readingTime", showReadingTime, "showReadingTime"],
                  ["author", showAuthor, "showAuthor"],
                  ["branding", showBranding, "showBranding"],
                ] as const).map(([key, checked, preferenceKey]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                      <Checkbox checked={checked} onCheckedChange={(value) => {
                        const enabled = value === true;
                        setPreference(preferenceKey, enabled);
                      }} />
                      {t(`editor.imageShare.fields.${key}`)}
                    </label>
                    {key === "author" && showAuthor && (
                      <div className="pl-6">
                        <input
                          type="text"
                          value={author}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreference("author", val);
                          }}
                          placeholder={t("editor.imageShare.authorPlaceholder")}
                          className="h-7 w-full rounded border border-slate-300 px-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                          maxLength={32}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Format Selection */}
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("editor.imageShare.format")}
              <Select value={format} onValueChange={(value) => setPreference("format", value as NoteImagePreferences["format"])}>
                <SelectTrigger className="h-8 text-xs font-normal normal-case tracking-normal text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="text-xs" value="png">
                    PNG · {t("editor.imageShare.pngHint")}
                  </SelectItem>
                  <SelectItem className="text-xs" value="jpeg">
                    JPEG · {t("editor.imageShare.jpegHint")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </label>

            {noticeKind !== "none" ? (
              <p className="text-xs leading-5 text-amber-700">
                {t(
                  noticeKind === "partial"
                    ? "editor.imageExport.imageEmbedPartial"
                    : "editor.imageExport.imageEmbedFailed",
                  prepared?.images,
                )}
              </p>
            ) : null}
          </div>
        </div>

        {copyState === "failed" ? (
          <p className="border-t border-rose-100 bg-rose-50 px-5 py-2 text-xs text-rose-700" role="alert">
            {t("editor.imageShare.copyFailed")}
          </p>
        ) : null}
        <DialogFooter className="shrink-0 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!prepared || copyState === "copying"}
            onClick={() => void handleCopyImage()}
          >
            {copyState === "copied" ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700">{t("editor.imageShare.copied")}</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {t("editor.imageShare.copyImage")}
              </>
            )}
          </Button>
          <Button
            variant={canUseSystemShare ? "outline" : "solid"}
            size="sm"
            disabled={!prepared}
            onClick={download}
          >
            <Download className="h-4 w-4" />
            {t("editor.imageShare.download")}
          </Button>
          {canUseSystemShare ? (
            <Button variant="solid" size="sm" disabled={!prepared} onClick={() => void share()}>
              <Share2 className="h-4 w-4" />
              {t("editor.imageShare.share")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
