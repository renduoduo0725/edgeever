import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasPicGoBridge, readPicGoPreference, writePicGoPreference, type PicGoPreference } from "@/lib/picgo";
import { SETTINGS_ITEM_DESCRIPTION_CLASSNAME, SETTINGS_ITEM_TITLE_CLASSNAME } from "./settings-ui";

export const PicGoSettingsItem = () => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(readPicGoPreference);
  const [draft, setDraft] = useState(saved);
  const [testedEndpoint, setTestedEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const desktopAvailable = hasPicGoBridge();
  const dirty = draft.provider !== saved.provider || draft.endpoint !== saved.endpoint;
  const canSave = dirty && (draft.provider === "edgeever" || (desktopAvailable && testedEndpoint === draft.endpoint));

  const testConnection = async () => {
    setBusy(true);
    setTestedEndpoint(null);
    setStatus("");
    try {
      await window.edgeeverDesktop!.testPicGoConnection(draft.endpoint);
      setTestedEndpoint(draft.endpoint);
      setStatus(t("settings.picgo.connected"));
    } catch {
      setStatus(t("settings.picgo.connectionFailed"));
    } finally { setBusy(false); }
  };
  const save = () => {
    try {
      writePicGoPreference(draft);
      setSaved(draft);
      setStatus(t("settings.picgo.saved"));
    } catch { setStatus(t("settings.picgo.saveFailed")); }
  };

  return (
    <div className="grid gap-3 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Image className="h-4 w-4 shrink-0 text-slate-500" />
          <div className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.picgo.title")}</div>
        </div>
        <Select value={draft.provider} disabled={busy} onValueChange={(provider) => {
          setDraft({ ...draft, provider: provider as PicGoPreference["provider"] });
          setStatus("");
        }}>
          <SelectTrigger className="h-9 w-full sm:w-80" aria-label={t("settings.picgo.title")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="edgeever">{t("settings.picgo.builtin")}</SelectItem>
            <SelectItem value="picgo">{t("settings.picgo.external")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {draft.provider === "picgo" ? (
        <div className="grid gap-2 sm:ml-7">
          {!desktopAvailable ? <p className={SETTINGS_ITEM_DESCRIPTION_CLASSNAME}>{t("settings.picgo.webPreview")}</p> : null}
          <p className={SETTINGS_ITEM_DESCRIPTION_CLASSNAME}>{t("settings.picgo.description")}</p>
          <label htmlFor="picgo-endpoint" className={SETTINGS_ITEM_TITLE_CLASSNAME}>{t("settings.picgo.endpoint")}</label>
          <Input id="picgo-endpoint" value={draft.endpoint} disabled={busy} onChange={(event) => {
            setDraft({ ...draft, endpoint: event.target.value.trim() });
            setTestedEndpoint(null);
            setStatus("");
          }} spellCheck={false} />
          <p className={SETTINGS_ITEM_DESCRIPTION_CLASSNAME}>{t("settings.picgo.externalImages")}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 sm:ml-7">
        {draft.provider === "picgo" ? <Button variant="outline" size="sm" disabled={busy || !desktopAvailable} onClick={() => void testConnection()}>
          {t(busy ? "settings.picgo.testing" : "settings.picgo.test")}
        </Button> : null}
        {dirty ? <Button size="sm" disabled={busy || !canSave} onClick={save}>{t("settings.picgo.save")}</Button> : null}
        <span role="status" className="text-xs text-slate-500">{status}</span>
      </div>
    </div>
  );
};
