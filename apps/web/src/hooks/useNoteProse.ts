import { useCallback, useEffect, useRef, useState } from "react";
import {
  noteProseMigrationPatch,
  resolveNoteProse,
  type AccountNoteProse,
  type NoteProsePatch,
  type ResolvedNoteProse,
} from "@edgeever/shared";
import { api } from "@/lib/api";
import { readLocalNoteProseMigration } from "@/lib/note-prose-local";

const EMPTY_ACCOUNT: AccountNoteProse = {
  fontSize: null,
  lineHeight: null,
  palette: null,
  customCss: null,
  customColors: null,
};

export const useNoteProse = () => {
  const [account, setAccount] = useState<AccountNoteProse>(EMPTY_ACCOUNT);
  const [ready, setReady] = useState(false);
  const revision = useRef(0);

  useEffect(() => {
    const request = ++revision.current;
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await api.getNoteProse();
        if (cancelled || request !== revision.current) return;
        const patch = noteProseMigrationPatch(loaded, readLocalNoteProseMigration());
        const next = Object.keys(patch).length > 0 ? await api.updateNoteProse(patch) : loaded;
        if (!cancelled && request === revision.current) setAccount(next);
      } catch {
        if (!cancelled && request === revision.current) setAccount(EMPTY_ACCOUNT);
      } finally {
        if (!cancelled && request === revision.current) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateNoteProse = useCallback(async (patch: NoteProsePatch) => {
    const request = ++revision.current;
    setAccount((current) => ({
      ...current,
      ...patch,
    }));
    try {
      const saved = await api.updateNoteProse(patch);
      if (request === revision.current) setAccount(saved);
    } catch {
      // Keep the optimistic value. The next successful load replaces it.
    }
  }, []);

  return {
    noteProse: resolveNoteProse(account),
    noteProseReady: ready,
    updateNoteProse,
  };
};
