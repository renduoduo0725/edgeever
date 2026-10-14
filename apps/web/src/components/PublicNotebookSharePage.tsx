import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { isSharePasswordError, PublicSharePasswordForm, PublicShareArticle } from "./PublicSharePage";
import { PublicNotebookSite } from "./PublicNotebookSite";
import { withEnvironmentTitlePrefix } from "@/lib/environment-title";

export const PublicNotebookSharePage = () => {
  const { t } = useTranslation();
  const { token = "", memoId } = useParams();
  const directory = useQuery({
    queryKey: ["public-notebook-share", token],
    queryFn: () => api.getPublicNotebookShare(token),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });
  const memo = useQuery({
    queryKey: ["public-notebook-memo", token, memoId],
    queryFn: () => api.getPublicNotebookMemo(token, memoId!),
    enabled: Boolean(memoId) && directory.isSuccess,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });
  const share = directory.isError ? undefined : directory.data?.share;
  const note = memo.isError ? undefined : memo.data?.share;
  const access = useMemo(
    () => ({
      resourceBasePath: `/api/public/notebook-shares/${encodeURIComponent(token)}/resources`,
      memoUrls: memo.data?.memoUrls ?? {},
    }),
    [token, memo.data?.memoUrls],
  );
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";
    document.head.appendChild(robots);
    const previous = document.title;
    document.title = withEnvironmentTitlePrefix(
      `${note?.title?.trim() || share?.name || t("sharing.notebookTitle")} · EdgeEver`,
      {
        development: import.meta.env.DEV,
        profile: __EDGEEVER_DEVELOPMENT_PROFILE__,
      },
    );
    return () => {
      robots.remove();
      document.title = previous;
    };
  }, [note?.title, share?.name, t]);
  if (directory.isPending)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <LoaderCircle
          className="h-6 w-6 animate-spin"
          aria-label={t("sharing.publicLoading")}
        />
      </main>
    );
  if (isSharePasswordError(directory.error, "share_password_required") || isSharePasswordError(memo.error, "share_password_required"))
    return <PublicSharePasswordForm
      key={token}
      token={token}
      unlock={(password) => api.unlockPublicNotebookShare(token, password)}
      onUnlocked={async () => {
        await directory.refetch();
        if (memoId) await memo.refetch();
      }}
    />;
  if (!share)
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">
          {t("sharing.notebookUnavailable")}
        </h1>
        <p>{t("sharing.notebookUnavailableHint")}</p>
        <Button variant="outline" onClick={() => void directory.refetch()}>
          {t("sharing.retry")}
        </Button>
      </main>
    );
  return (
    <PublicNotebookSite
      key={token}
      share={share}
      token={token}
      selectedId={memoId}
    >
      {memoId &&
        (memo.isPending ? (
          <div className="flex min-h-60 items-center justify-center">
            <LoaderCircle
              className="h-6 w-6 animate-spin"
              aria-label={t("sharing.publicLoading")}
            />
          </div>
        ) : note && share.memos.some((item) => item.id === memoId) ? (
          <PublicShareArticle
            key={memoId}
            share={note}
            token={token}
            access={access}
            layout="site"
          />
        ) : (
          <section className="mx-auto max-w-4xl space-y-4 px-5 py-12 sm:px-10">
            <h1 className="text-xl font-semibold">
              {t("sharing.publicUnavailable")}
            </h1>
            <p className="text-slate-500">
              {t("sharing.notebookNoteUnavailableHint")}
            </p>
            <Button variant="outline" onClick={() => void memo.refetch()}>
              {t("sharing.retry")}
            </Button>
          </section>
        ))}
    </PublicNotebookSite>
  );
};
