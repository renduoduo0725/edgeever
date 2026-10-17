import { useFontPreviewStatus } from "@/lib/use-font-preview-status";
import type { FontLoadStatus } from "@/lib/font-load-state";
import { FontLoadFeedback } from "@/components/FontLoadFeedback";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { findCatalogFont } from "@edgeever/shared/font-catalog";
import { FontLabel } from "@/components/FontLabel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POSTER_FONTS, loadPosterFont } from "@/lib/poster-design/fonts";

const PosterFontName = ({ family, label, enabled, visibleOnly = false, status, onStatusChange, retryKey }: {
  family: string; label: string; enabled: boolean; visibleOnly?: boolean; status?: FontLoadStatus; onStatusChange?: (status: FontLoadStatus) => void; retryKey?: number;
}) => {
  const loadFont = useCallback((text: string) => loadPosterFont(family, text), [family]);
  return <FontLabel onStatusChange={onStatusChange} status={status} retryKey={retryKey} label={label} fontId={findCatalogFont(family)} registrationFamily={family} fontFamily={["sans-serif", "serif", "monospace"].includes(family) ? family : `"${family}", sans-serif`} enabled={enabled} visibleOnly={visibleOnly} loadFont={loadFont} />;
};

export const PosterFontPicker = ({ value, disabled, zh, onChange, status, onRetry }: {
  status: FontLoadStatus; onRetry: () => void;
  value: string; disabled: boolean; zh: boolean; onChange: (family: string) => void;
}) => {
  const { t } = useTranslation();
  const [retryKey, setRetryKey] = useState(0);
  const { status: selectedStatus, onPreviewStatus } = useFontPreviewStatus(`${value}:${retryKey}`, status);
  const [open, setOpen] = useState(false);
  const choices = [
    { family: "sans-serif", label: t("poster.sans") },
    { family: "serif", label: t("poster.serif") },
    { family: "monospace", label: t("poster.mono") },
    ...POSTER_FONTS.map(font => ({ family: font.family, label: zh ? font.zh : font.en })),
  ];
  return <div className="space-y-1"><Select value={value} disabled={disabled} onOpenChange={setOpen} onValueChange={onChange}>
    <SelectTrigger aria-label={t("poster.fontFamily")} className="h-9 w-full">
      <SelectValue><PosterFontName family={value} label={choices.find(font => font.family === value)?.label ?? value} enabled onStatusChange={onPreviewStatus} status={selectedStatus} retryKey={retryKey} /></SelectValue>
    </SelectTrigger>
    <SelectContent className="max-h-80">
      {choices.map(font => <SelectItem key={font.family} value={font.family} textValue={font.label}>
        <PosterFontName family={font.family} label={font.label} enabled={open} visibleOnly />
      </SelectItem>)}
    </SelectContent>
  </Select><FontLoadFeedback status={selectedStatus} onRetry={() => { setRetryKey(value => value + 1); onRetry(); }} /></div>;
};
