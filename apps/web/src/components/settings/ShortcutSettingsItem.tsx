import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ShortcutAction, ShortcutBinding, ShortcutSettings } from "@/lib/app-helpers";
import {
  DEFAULT_SHORTCUT_SETTINGS,
  formatShortcutBinding,
  getShortcutActionOptions,
  shortcutBindingFromKeyboardEvent,
  shortcutBindingsEqual,
} from "@/lib/app-helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SETTINGS_ITEM_TITLE_CLASSNAME } from "./settings-ui";

interface ShortcutSettingsItemProps {
  shortcutSettings: ShortcutSettings;
  onShortcutSettingsChange: (settings: ShortcutSettings) => void;
}

const getConflictAction = (
  action: ShortcutAction,
  binding: ShortcutBinding,
  settings: ShortcutSettings,
  shortcutActionOptions: ReturnType<typeof getShortcutActionOptions>
) => shortcutActionOptions.find((item) => item.value !== action && shortcutBindingsEqual(settings[item.value], binding));

export const ShortcutSettingsItem = ({ shortcutSettings, onShortcutSettingsChange }: ShortcutSettingsItemProps) => {
  const { t } = useTranslation();
  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);
  const [captureMessage, setCaptureMessage] = useState("");
  const captureButtonRef = useRef<HTMLButtonElement | null>(null);
  const shortcutActionOptions = useMemo(() => getShortcutActionOptions(t), [t]);

  useEffect(() => {
    if (!recordingAction) {
      return;
    }

    captureButtonRef.current?.focus();
  }, [recordingAction]);

  useEffect(() => {
    if (!recordingAction) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setRecordingAction(null);
        setCaptureMessage("");
        return;
      }

      const nextBinding = shortcutBindingFromKeyboardEvent(event);
      if (!nextBinding) {
        setCaptureMessage(t("shortcuts.requireModifier"));
        return;
      }

      const conflictAction = getConflictAction(recordingAction, nextBinding, shortcutSettings, shortcutActionOptions);
      if (conflictAction) {
        setCaptureMessage(t("shortcuts.conflict", { label: conflictAction.label }));
        return;
      }

      onShortcutSettingsChange({
        ...shortcutSettings,
        [recordingAction]: nextBinding,
      });
      setRecordingAction(null);
      setCaptureMessage("");
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onShortcutSettingsChange, recordingAction, shortcutActionOptions, shortcutSettings, t]);

  const handleResetShortcuts = () => {
    onShortcutSettingsChange(DEFAULT_SHORTCUT_SETTINGS);
    setRecordingAction(null);
    setCaptureMessage("");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-card">
      <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
        {shortcutActionOptions.map((item, index) => {
          const recording = recordingAction === item.value;
          const lastAlone = index === shortcutActionOptions.length - 1 && shortcutActionOptions.length % 2 === 1;

          return (
            <div
              key={item.value}
              className={cn(
                "flex h-12 items-center justify-between gap-3 bg-card px-4",
                lastAlone && "sm:col-span-2",
              )}
            >
              <div className={cn("min-w-0 truncate", SETTINGS_ITEM_TITLE_CLASSNAME)}>{item.label}</div>
              <Button
                ref={recording ? captureButtonRef : null}
                type="button"
                variant={recording ? "solid" : "outline"}
                className={cn("h-8 min-w-24 shrink-0 px-3 font-mono text-xs font-normal", !recording && "bg-card")}
                onClick={() => {
                  setRecordingAction(item.value);
                  setCaptureMessage("");
                }}
              >
                {recording ? t("shortcuts.recording") : formatShortcutBinding(shortcutSettings[item.value])}
              </Button>
            </div>
          );
        })}
      </div>
      {captureMessage ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">
          {captureMessage}
        </div>
      ) : null}
      <div className="flex justify-end border-t border-slate-100 px-4 py-3">
        <Button type="button" variant="outline" className="h-9 px-3 text-xs font-normal" onClick={handleResetShortcuts}>
          <RotateCcw className="h-4 w-4" />
          {t("shortcuts.reset")}
        </Button>
      </div>
    </div>
  );
};
