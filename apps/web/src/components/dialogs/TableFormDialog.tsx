import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TableField, TableFormFieldSetting, TableFormSettings, TableFormUpdateInput } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, getConfiguredDesktopApiBaseUrl } from "@/lib/api";
import { copyTextToClipboard } from "@/lib/clipboard";

const TEXT_SAVE_MS = 400;

const formUrl = (token: string) => {
  const baseUrl = getConfiguredDesktopApiBaseUrl() || window.location.origin;
  return `${baseUrl.replace(/\/$/, "")}/form/${encodeURIComponent(token)}`;
};

const passwordKey = (memoId: string) => `edgeever.tableFormPassword.${memoId}`;

const readPassword = (memoId: string, token: string) => {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(passwordKey(memoId)) ?? "") as { token?: string; password?: string };
    return parsed.token === token && parsed.password ? parsed.password : "";
  } catch {
    return "";
  }
};

const writePassword = (memoId: string, token: string, password: string) => {
  try {
    window.sessionStorage.setItem(passwordKey(memoId), JSON.stringify({ token, password }));
  } catch {
    // The generated password stays visible for this dialog session.
  }
};

type FormDraft = {
  enabled: boolean;
  passwordProtected: boolean;
  title: string;
  description: string;
  submitLabel: string;
  selected: TableFormFieldSetting[];
};

const draftFromSaved = (saved: TableFormSettings | null, fields: TableField[], memoTitle: string): FormDraft => ({
  enabled: saved?.enabled ?? false,
  passwordProtected: saved?.passwordProtected ?? false,
  title: saved?.title || memoTitle,
  description: saved?.description ?? "",
  submitLabel: saved?.submitLabel ?? "",
  selected: saved?.fields.length
    ? saved.fields.filter((field) => fields.some((item) => item.id === field.fieldId))
    : fields.map((field) => ({ fieldId: field.id, required: false })),
});

const toPayload = (draft: FormDraft, rotatePassword = false): TableFormUpdateInput => ({
  enabled: draft.enabled,
  passwordProtected: draft.passwordProtected,
  rotatePassword,
  title: draft.title.trim(),
  description: draft.description.trim(),
  submitLabel: draft.submitLabel.trim(),
  fields: draft.selected,
});

export const TableFormDialog = ({
  memoId,
  memoTitle,
  fields,
  open,
  onOpenChange,
}: {
  memoId: string;
  memoTitle: string;
  fields: TableField[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["table-form", memoId] as const;
  const formQuery = useQuery({
    queryKey,
    queryFn: () => api.getTableForm(memoId),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const saved = formQuery.data?.form ?? null;
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const draftRef = useRef<FormDraft | null>(null);
  const publishedRef = useRef(false);
  const serverEnabledRef = useRef(false);
  const serverPasswordRef = useRef(false);
  const hydratedFor = useRef("");
  const draftMemoIdRef = useRef(memoId);
  const fieldsRef = useRef(fields);
  const memoTitleRef = useRef(memoTitle);
  const textTimer = useRef<number | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const pendingSaves = useRef(0);
  const saveGeneration = useRef(0);
  const persistRef = useRef<(next: FormDraft, rotatePassword?: boolean) => void>(() => {});
  fieldsRef.current = fields;
  memoTitleRef.current = memoTitle;

  const applyDraft = (next: FormDraft) => {
    draftRef.current = next;
    setDraft(next);
  };

  const persistNow = (next: FormDraft, rotatePassword = false) => {
    if (next.enabled && next.selected.length === 0) {
      setError(t("structuredTable.form.needField"));
      const reverted = { ...next, enabled: false };
      applyDraft(reverted);
      return;
    }
    const targetMemoId = draftMemoIdRef.current;
    const generation = ++saveGeneration.current;
    const key = ["table-form", targetMemoId] as const;
    pendingSaves.current += 1;
    setSaving(true);
    setError(null);
    setConfirmed(false);
    const job = saveQueue.current.then(async () => {
      const data = await api.updateTableForm(targetMemoId, toPayload(next, rotatePassword));
      queryClient.setQueryData(key, { form: { ...data.form, password: undefined } });
      if (targetMemoId !== draftMemoIdRef.current) return;
      publishedRef.current = true;
      serverEnabledRef.current = data.form.enabled;
      serverPasswordRef.current = data.form.passwordProtected;
      if (data.form.password) {
        writePassword(targetMemoId, data.form.token, data.form.password);
        setPassword(data.form.password);
      } else if (!data.form.passwordProtected && generation === saveGeneration.current) {
        setPassword("");
      }
      if (generation === saveGeneration.current && textTimer.current === null) setConfirmed(true);
    });
    saveQueue.current = job.then(() => undefined, () => undefined);
    void job.catch((reason: unknown) => {
      if (generation !== saveGeneration.current || targetMemoId !== draftMemoIdRef.current) return;
      const current = draftRef.current;
      if (!current) return;
      applyDraft({
        ...current,
        enabled: serverEnabledRef.current,
        passwordProtected: serverPasswordRef.current,
      });
      setConfirmed(false);
      setError(reason instanceof Error ? reason.message : t("structuredTable.form.needField"));
    }).finally(() => {
      pendingSaves.current = Math.max(0, pendingSaves.current - 1);
      if (pendingSaves.current === 0) setSaving(false);
    });
  };
  persistRef.current = persistNow;

  const cancelTextTimer = () => {
    if (textTimer.current === null) return;
    window.clearTimeout(textTimer.current);
    textTimer.current = null;
  };

  const flushTextSave = () => {
    if (textTimer.current === null) return;
    cancelTextTimer();
    const current = draftRef.current;
    if (current && (publishedRef.current || current.enabled)) persistRef.current(current);
  };

  const scheduleTextSave = () => {
    cancelTextTimer();
    textTimer.current = window.setTimeout(() => {
      textTimer.current = null;
      const current = draftRef.current;
      if (current && (publishedRef.current || current.enabled)) persistRef.current(current);
    }, TEXT_SAVE_MS);
  };

  useEffect(() => {
    if (!open) {
      flushTextSave();
      return;
    }
    if (hydratedFor.current && hydratedFor.current !== memoId) {
      flushTextSave();
      hydratedFor.current = "";
      draftRef.current = null;
      setDraft(null);
      publishedRef.current = false;
    }
    if (!formQuery.isFetched || hydratedFor.current === memoId) return;
    hydratedFor.current = memoId;
    draftMemoIdRef.current = memoId;
    const nextSaved = formQuery.data?.form ?? null;
    const next = draftFromSaved(nextSaved, fieldsRef.current, memoTitleRef.current);
    publishedRef.current = Boolean(nextSaved);
    serverEnabledRef.current = nextSaved?.enabled ?? false;
    serverPasswordRef.current = nextSaved?.passwordProtected ?? false;
    applyDraft(next);
    setPassword(nextSaved?.token ? readPassword(memoId, nextSaved.token) : "");
    setError(formQuery.error instanceof Error ? formQuery.error.message : null);
    setSaving(pendingSaves.current > 0);
    setConfirmed(false);
    setCopied(false);
  }, [open, formQuery.isFetched, formQuery.data, formQuery.error, memoId]);

  useEffect(() => () => {
    if (textTimer.current === null) return;
    window.clearTimeout(textTimer.current);
    textTimer.current = null;
    const current = draftRef.current;
    if (current && (publishedRef.current || current.enabled)) persistRef.current(current);
  }, []);

  const changeEnabled = (checked: boolean) => {
    const current = draftRef.current;
    if (!current) return;
    if (checked && current.selected.length === 0) {
      setError(t("structuredTable.form.needField"));
      return;
    }
    const next = { ...current, enabled: checked };
    applyDraft(next);
    setError(null);
    if (!checked && !publishedRef.current) return;
    cancelTextTimer();
    persistNow(next);
  };

  const changePassword = (checked: boolean) => {
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, passwordProtected: checked };
    applyDraft(next);
    if (!publishedRef.current && !next.enabled) return;
    cancelTextTimer();
    persistNow(next);
  };

  const changeText = (patch: Partial<Pick<FormDraft, "title" | "description" | "submitLabel">>) => {
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    applyDraft(next);
    setConfirmed(false);
    if (publishedRef.current || next.enabled) scheduleTextSave();
  };

  const toggleField = (fieldId: string, included: boolean) => {
    const current = draftRef.current;
    if (!current) return;
    const selected = included
      ? [...current.selected.filter((field) => field.fieldId !== fieldId), { fieldId, required: false }]
      : current.selected.filter((field) => field.fieldId !== fieldId);
    if (!included && selected.length === 0 && current.enabled) {
      setError(t("structuredTable.form.needField"));
      return;
    }
    const next = { ...current, selected };
    applyDraft(next);
    setError(null);
    if (!publishedRef.current && !next.enabled) return;
    cancelTextTimer();
    persistNow(next);
  };

  const toggleRequired = (fieldId: string, required: boolean) => {
    const current = draftRef.current;
    if (!current) return;
    const next = {
      ...current,
      selected: current.selected.map((field) => field.fieldId === fieldId ? { ...field, required } : field),
    };
    applyDraft(next);
    if (!publishedRef.current && !next.enabled) return;
    cancelTextTimer();
    persistNow(next);
  };

  const link = saved?.token && saved.enabled && draft?.enabled ? formUrl(saved.token) : "";
  const showCreating = Boolean(draft?.enabled && !link && saving);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("structuredTable.form.title")}</DialogTitle>
          <DialogDescription>{t("structuredTable.form.description")}</DialogDescription>
        </DialogHeader>
        {!draft ? (
          <div className="flex min-h-20 items-center justify-center text-slate-500" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("structuredTable.form.enabled")}</span>
              <Switch checked={draft.enabled} onCheckedChange={changeEnabled} aria-label={t("structuredTable.form.enabled")} />
            </label>
            {link ? (
              <div className="space-y-2">
                <span className="text-xs text-slate-500">{t("structuredTable.form.link")}</span>
                <div className="flex gap-2">
                  <Input readOnly value={link} aria-label={t("structuredTable.form.link")} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void copyTextToClipboard(link).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? t("structuredTable.form.copied") : t("structuredTable.form.copy")}
                  </Button>
                </div>
              </div>
            ) : showCreating ? (
              <p className="flex items-center gap-2 text-xs text-slate-500" role="status">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                {t("structuredTable.form.saving")}
              </p>
            ) : null}
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("structuredTable.form.password")}</span>
              <Switch checked={draft.passwordProtected} onCheckedChange={changePassword} aria-label={t("structuredTable.form.password")} />
            </label>
            <p className="text-xs text-slate-500">{t("structuredTable.form.passwordHint")}</p>
            {draft.passwordProtected && password ? <Input readOnly value={password} aria-label={t("structuredTable.form.password")} /> : null}
            {draft.passwordProtected && saved?.passwordProtected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  cancelTextTimer();
                  const current = draftRef.current;
                  if (current) persistNow(current, true);
                }}
                disabled={saving}
              >
                {t("structuredTable.form.regenerate")}
              </Button>
            ) : null}
            <label className="block space-y-1 text-sm">
              <span>{t("structuredTable.form.formTitle")}</span>
              <Input
                value={draft.title}
                onChange={(event) => changeText({ title: event.target.value })}
                aria-label={t("structuredTable.form.formTitle")}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>{t("structuredTable.form.formDescription")}</span>
              <textarea
                className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                value={draft.description}
                onChange={(event) => changeText({ description: event.target.value })}
                aria-label={t("structuredTable.form.formDescription")}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>{t("structuredTable.form.submitLabel")}</span>
              <Input
                value={draft.submitLabel}
                placeholder={t("structuredTable.form.submitDefault")}
                onChange={(event) => changeText({ submitLabel: event.target.value })}
                aria-label={t("structuredTable.form.submitLabel")}
              />
            </label>
            <div className="space-y-2">
              <p className="text-sm">{t("structuredTable.form.fields")}</p>
              {fields.map((field) => {
                const setting = draft.selected.find((item) => item.fieldId === field.id);
                return (
                  <div key={field.id} className="flex items-center justify-between gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(setting)}
                        aria-label={field.name}
                        onChange={(event) => toggleField(field.id, event.target.checked)}
                      />
                      <span>{field.name}</span>
                      <span className="text-xs text-slate-400">{t(`structuredTable.types.${field.type}`)}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={Boolean(setting?.required)}
                        disabled={!setting}
                        aria-label={`${field.name} ${t("structuredTable.form.required")}`}
                        onChange={(event) => toggleRequired(field.id, event.target.checked)}
                      />
                      {t("structuredTable.form.required")}
                    </label>
                  </div>
                );
              })}
            </div>
            {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}
            {!error && saving && link ? <p className="text-sm text-slate-500" role="status">{t("structuredTable.form.saving")}</p> : null}
            {!error && !saving && confirmed ? <p className="text-sm text-emerald-700" role="status">{t("structuredTable.form.saved")}</p> : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
