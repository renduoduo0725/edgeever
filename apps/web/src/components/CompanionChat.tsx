import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle } from "lucide-react";
import type { CompanionAction, CompanionTurn, CompanionTurnInput } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api";
import { companionLocale } from "@/lib/companion-locale";
import { CompanionActionCard } from "./CompanionActionCard";
import { CompanionNoteText } from "./CompanionNoteText";

export type CompanionChatFocus = {
  memoId?: string;
  notebookId?: string;
  notebookTitle?: string;
  title?: string;
  selectionMarkdown?: string | null;
};

type CompanionChatProps = {
  available: boolean;
  focus?: CompanionChatFocus;
  placeholder?: string;
  beforeApply: () => Promise<void>;
  onNotesChanged: () => Promise<void>;
  onOpenNote: (id: string, notebookId: string) => void;
};

export function CompanionChat({
  available,
  focus,
  placeholder,
  beforeApply,
  onNotesChanged,
  onOpenNote,
}: CompanionChatProps) {
  const { t, i18n } = useTranslation();
  const [turns, setTurns] = useState<CompanionTurn[]>([]);
  const [actions, setActions] = useState<CompanionAction[]>([]);
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<{ id: string; controller: AbortController } | null>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pinToBottom = useRef(true);

  const explainError = (cause: unknown) => {
    const code = cause instanceof ApiRequestError ? cause.code : "";
    if (code === "ai_not_configured") return t("companion.configureModel");
    if (code === "companion_memory_conflict") return t("companion.conflict");
    if (code === "companion_history_full") return t("companion.historyFull");
    if (code === "companion_action_conflict") return t("companion.actions.conflict");
    if (code === "companion_action_unsynced") return t("companion.actions.unsynced");
    if (code === "companion_action_uncertain") return t("companion.actions.status.uncertain");
    if (cause instanceof ApiRequestError && cause.status === 403) return t("companion.unavailable");
    return t("companion.failed");
  };
  const reload = async () => {
    const [turnResult, actionResult] = await Promise.all([
      api.listCompanionTurns(),
      api.listCompanionActions(),
    ]);
    if (!alive.current) return;
    setTurns(turnResult.turns);
    setActions(actionResult.actions);
  };

  useEffect(() => {
    alive.current = true;
    if (!available) {
      setLoading(false);
      return () => { alive.current = false; active.current?.controller.abort(); };
    }
    void reload().catch(cause => { if (alive.current) setError(explainError(cause)); })
      .finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; active.current?.controller.abort(); };
    // This workspace owns ephemeral account-scoped state, discarded on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

  const perform = async (work: () => Promise<unknown>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setError(null);
    try { await work(); await reload(); }
    catch (cause) { if (alive.current) setError(explainError(cause)); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || locked.current) return;
    pinToBottom.current = true;
    void perform(async () => {
      const id = crypto.randomUUID();
      const controller = new AbortController();
      active.current = { id, controller };
      setMessage("");
      setTurns(previous => [{ id, threadId, message: text, response: "", status: "running", sources: [], model: "",
        inputTokens: null, outputTokens: null, createdAt: new Date().toISOString() }, ...previous]);
      let completed = false;
      const payload: CompanionTurnInput = {
        id, threadId, message: text, useMemory: false,
        allowNotes: true,
        allowWrites: true,
        locale: companionLocale(i18n.resolvedLanguage),
        ...(focus?.memoId || focus?.selectionMarkdown?.trim()
          ? { focus: {
            ...(focus.memoId ? { memoId: focus.memoId } : {}),
            ...(focus.notebookId ? { notebookId: focus.notebookId } : {}),
            ...(focus.notebookTitle ? { notebookTitle: focus.notebookTitle } : {}),
            ...(focus.title ? { title: focus.title } : {}),
            ...(focus.selectionMarkdown?.trim() ? { selectionMarkdown: focus.selectionMarkdown.trim().slice(0, 2000) } : {}),
          } }
          : {}),
      };
      try {
        await api.streamCompanion(payload, {
          signal: controller.signal,
          onEvent: event => {
            if (!alive.current) return;
            if (event.type === "text-delta") setTurns(previous => previous.map(turn => turn.id === id ? { ...turn, response: turn.response + event.text } : turn));
            if (event.type === "done") {
              completed = true;
              setTurns(previous => previous.map(turn => turn.id === id ? event.turn : turn));
            }
            if (event.type === "error") setError(t("companion.failed"));
          },
        });
        if (!completed && alive.current) setError(t("companion.recovered"));
      } catch (cause) {
        if (alive.current) setError(controller.signal.aborted ? t("companion.recovered") : explainError(cause));
      } finally {
        active.current = null;
        if (alive.current) {
          try {
            const { turn } = await api.getCompanionTurn(id);
            setTurns(previous => previous.map(item => item.id === id ? turn : item));
          } catch {
            setTurns(previous => previous.filter(item => item.id !== id));
            setMessage(text);
          }
          await onNotesChanged().catch(() => {});
        }
      }
    });
  };
  const stop = async (id: string) => {
    try { await api.cancelCompanionTurn(id); active.current?.controller.abort(); await reload(); }
    catch (cause) { if (alive.current) setError(explainError(cause)); }
  };
  const applyAction = (action: CompanionAction) => void perform(async () => {
    await beforeApply();
    try {
      const result = await api.applyCompanionAction(action.id);
      if (alive.current) setActions(previous => previous.map(item => item.id === action.id ? result.action : item));
      try { await onNotesChanged(); }
      catch { if (alive.current) setError(t(result.action.status === "applied" ? "companion.actions.syncFailed" : "companion.actions.status.uncertain")); }
    } finally {
      await reload().catch(() => {});
    }
  });

  const threads = [...new Map(turns.map(turn => [turn.threadId, turn])).values()];
  const running = turns.find(turn => turn.status === "running");
  const threadTurns = turns.filter(turn => turn.threadId === threadId).reverse();
  const previousThread = threads.find(thread => thread.threadId !== threadId);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !pinToBottom.current) return;
    node.scrollTop = node.scrollHeight;
  }, [turns, threadId, actions]);

  if (!available) {
    return <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center">
      <MessageCircle aria-hidden="true" className="h-9 w-9 text-emerald-600" />
      <p className="max-w-md text-sm leading-relaxed text-slate-600">{t("companion.unavailableHelp")}</p>
    </div>;
  }

  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    {loading ? <p role="status">{t("common.loading")}</p> : null}
    <div
      ref={scroller}
      className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
      onScroll={event => {
        const node = event.currentTarget;
        pinToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
      }}
    >
      {!loading && !threadTurns.length && previousThread ? <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{previousThread.message}</p>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { pinToBottom.current = true; setThreadId(previousThread.threadId); }}>
          {t("aiAssistant.modes.resumeLast")}
        </Button>
      </div> : null}
      {threadTurns.map(turn => <article key={turn.id} className="space-y-2 rounded-lg border p-3 text-sm">
        <p className="whitespace-pre-wrap break-words font-medium">{turn.message}</p>
        {turn.response ? <CompanionNoteText text={turn.response} sources={turn.sources} onOpenNote={onOpenNote} /> : null}
        {turn.status === "running" ? (
          <p role="status" className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden="true" />
            <span className="sr-only">{t("companion.status.running")}</span>
          </p>
        ) : turn.status !== "completed" ? (
          <p className="text-xs text-slate-500">{t(`companion.status.${turn.status}`)}</p>
        ) : null}
        {actions.filter(action => action.turnId === turn.id).map(action => <CompanionActionCard key={action.id} action={action}
          busy={busy || Boolean(running)} onApply={applyAction} onDismiss={item => void perform(() => api.dismissCompanionAction(item.id))} onOpenNote={onOpenNote} />)}
      </article>)}
    </div>
    <form onSubmit={send} className="border-t pt-3">
      <p id="companion-ask-hint" className="sr-only">{t("aiAssistant.modes.askHint")}</p>
      <label className="sr-only" htmlFor="companion-message">{t("companion.message")}</label>
      <div className="flex items-end gap-2">
        <textarea
          id="companion-message"
          rows={2}
          aria-describedby="companion-ask-hint"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm leading-5 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
          maxLength={4000}
          value={message}
          disabled={busy}
          placeholder={placeholder || t("companion.message")}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={event => {
            if (
              event.key !== "Enter"
              || event.shiftKey
              || event.nativeEvent.isComposing
              || busy
              || loading
              || Boolean(running)
              || !message.trim()
            ) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
        />
        {running ? (
          <Button type="button" variant="outline" onClick={() => void stop(running.id)}>{t("companion.stop")}</Button>
        ) : (
          <Button type="submit" variant="solid" disabled={busy || loading || !message.trim()}>
            {busy ? t("common.processing") : t("companion.send")}
            {!busy ? <kbd aria-hidden="true" className="ml-1 rounded bg-card/10 px-1 py-0.5 text-[10px] font-medium leading-none text-white/70">↵</kbd> : null}
          </Button>
        )}
      </div>
    </form>
  </div>;
}
