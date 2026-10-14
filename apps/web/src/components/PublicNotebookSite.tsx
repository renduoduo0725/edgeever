import type { PublicNotebookShare } from "@edgeever/shared";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Notebook = PublicNotebookShare["notebooks"][number];
type Memo = PublicNotebookShare["memos"][number];
type Section = { notebook: Notebook; path: Notebook[]; memos: Memo[] };

const linkClass =
  "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2";

const NavigationNotes = ({
  memos,
  selectedId,
  href,
  onNavigate,
}: {
  memos: Memo[];
  selectedId?: string;
  href: (id: string) => string;
  onNavigate: () => void;
}) => {
  const { t } = useTranslation();
  const selected = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  return (
    <ul className="space-y-0.5">
      {memos.map((memo) => {
        const title = memo.title?.trim() || t("common.untitledMemo");
        return (
          <li key={memo.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  ref={selectedId === memo.id ? selected : undefined}
                  to={href(memo.id)}
                  onClick={onNavigate}
                  aria-current={selectedId === memo.id ? "page" : undefined}
                  className={cn(
                    linkClass,
                    "block px-3 py-2 text-[13px] leading-5 transition-colors",
                    selectedId === memo.id
                      ? "bg-slate-100 font-medium text-slate-950"
                      : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-900",
                  )}
                >
                  <span className="line-clamp-2 break-words">{title}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-72 break-words">
                {title}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
};

const NavigationSection = ({
  section,
  selectedId,
  containsSelection,
  href,
  onNavigate,
}: {
  section: Section;
  selectedId?: string;
  containsSelection: boolean;
  href: (id: string) => string;
  onNavigate: () => void;
}) => {
  const [open, setOpen] = useState(containsSelection);
  useEffect(() => {
    if (containsSelection) setOpen(true);
  }, [selectedId, containsSelection]);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-5">
      <CollapsibleTrigger
        className={cn(
          linkClass,
          "group flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] font-semibold text-slate-900 hover:bg-slate-100/70",
        )}
      >
        <span className="min-w-0 break-words">
          {section.path
            .slice(1)
            .map((item) => item.name)
            .join(" / ")}
        </span>
        <ChevronRight className="size-3.5 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        <NavigationNotes
          memos={section.memos}
          selectedId={selectedId}
          href={href}
          onNavigate={onNavigate}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

const NoteTitle = ({ memo }: { memo: Memo }) => {
  const { t } = useTranslation();
  return (
    <span className="min-w-0 break-words">
      {memo.title?.trim() || t("common.untitledMemo")}
    </span>
  );
};

const HomepageContents = ({
  sections,
  matchingIds,
  filtering,
  href,
  onNavigate,
}: {
  sections: Section[];
  matchingIds: ReadonlySet<string>;
  filtering: boolean;
  href: (id: string) => string;
  onNavigate: () => void;
}) => {
  const { t } = useTranslation();
  const { children, visibleSections } = useMemo(() => {
    const children = new Map<string, Section[]>();
    const visibleSections = new Set<string>();
    for (const section of sections) {
      const parent = section.path.at(-2);
      if (parent) {
        const siblings = children.get(parent.id) ?? [];
        siblings.push(section);
        children.set(parent.id, siblings);
      }
      if (
        !filtering ||
        section.memos.some((memo) => matchingIds.has(memo.id))
      ) {
        for (const ancestor of section.path) visibleSections.add(ancestor.id);
      }
    }
    return { children, visibleSections };
  }, [sections, matchingIds, filtering]);
  const renderContents = (section: Section, nested: boolean): ReactNode => (
    <ul
      className={cn(
        "space-y-2 pl-6",
        nested ? "mt-2 list-[circle]" : "list-disc",
      )}
    >
      {section.memos
        .filter((memo) => matchingIds.has(memo.id))
        .map((memo) => (
          <li key={memo.id} className="pl-1 marker:text-slate-400">
            <Link
              to={href(memo.id)}
              onClick={onNavigate}
              className={cn(
                linkClass,
                "break-words text-slate-700 underline decoration-slate-400 decoration-1 underline-offset-4 transition-colors hover:text-slate-950 hover:decoration-slate-900 focus-visible:text-slate-950 focus-visible:decoration-slate-900",
              )}
            >
              <NoteTitle memo={memo} />
            </Link>
          </li>
        ))}
      {(children.get(section.notebook.id) ?? [])
        .filter((child) => visibleSections.has(child.notebook.id))
        .map((child) => (
          <li
            key={child.notebook.id}
            id={`section-${child.notebook.id}`}
            className="scroll-mt-24 pt-3 pl-1 marker:text-slate-400"
          >
            <span className="break-words font-semibold text-slate-900">
              {child.notebook.name}
            </span>
            {(child.memos.some((memo) => matchingIds.has(memo.id)) ||
              children
                .get(child.notebook.id)
                ?.some((item) => visibleSections.has(item.notebook.id))) &&
              renderContents(child, true)}
          </li>
        ))}
    </ul>
  );
  return (
    <nav
      aria-label={t("sharing.notebookContents")}
      id={`section-${sections[0]?.notebook.id}`}
      className="mt-9 scroll-mt-24 text-base leading-7 sm:text-[17px] sm:leading-8"
    >
      <h2 className="mb-6 border-b border-slate-200 pb-4 text-2xl font-semibold tracking-tight">
        {t("sharing.notebookContents")}
      </h2>
      {sections[0] && renderContents(sections[0], false)}
    </nav>
  );
};

export const PublicNotebookSite = ({
  share,
  token,
  selectedId,
  children,
}: {
  share: PublicNotebookShare;
  token: string;
  selectedId?: string;
  children?: ReactNode;
}) => {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const root = `/share/notebook/${encodeURIComponent(token)}`;
  const href = (id: string) => `${root}/${encodeURIComponent(id)}`;
  const sections = useMemo(() => {
    const result: Section[] = [];
    const notebooks = new Map(share.notebooks.map((item) => [item.id, item]));
    const children = new Map<string, Notebook[]>();
    const memos = new Map<string, Memo[]>();
    for (const notebook of share.notebooks) {
      if (!notebook.parentId) continue;
      const siblings = children.get(notebook.parentId) ?? [];
      siblings.push(notebook);
      children.set(notebook.parentId, siblings);
    }
    for (const memo of share.memos) {
      const siblings = memos.get(memo.notebookId) ?? [];
      siblings.push(memo);
      memos.set(memo.notebookId, siblings);
    }
    const visited = new Set<string>();
    const visit = (notebook: Notebook, path: Notebook[]) => {
      if (visited.has(notebook.id)) return;
      visited.add(notebook.id);
      const nextPath = [...path, notebook];
      result.push({
        notebook,
        path: nextPath,
        memos: memos.get(notebook.id) ?? [],
      });
      for (const child of children.get(notebook.id) ?? [])
        visit(child, nextPath);
    };
    visit(
      notebooks.get(share.notebookId) ?? {
        id: share.notebookId,
        parentId: null,
        name: share.name,
      },
      [],
    );
    return result;
  }, [share]);
  const notes = useMemo(
    () =>
      sections.flatMap((section) =>
        section.memos.map((memo) => ({ memo, section })),
      ),
    [sections],
  );
  const query = search.trim().toLocaleLowerCase();
  const matches = useMemo(
    () =>
      notes.filter(({ memo }) =>
        (memo.title?.trim() || t("common.untitledMemo"))
          .toLocaleLowerCase()
          .includes(query),
      ),
    [notes, query, t],
  );
  const matchingIds = useMemo(
    () => new Set(matches.map(({ memo }) => memo.id)),
    [matches],
  );
  const index = notes.findIndex(({ memo }) => memo.id === selectedId);
  const current = notes[index];
  const navigate = () => {
    setMobileOpen(false);
    setSearch("");
  };
  useEffect(() => {
    // Reset reading position only on navigation, never on the periodic content refresh.
    if (!selectedId && hash) {
      try {
        document
          .getElementById(decodeURIComponent(hash.slice(1)))
          ?.scrollIntoView({ block: "start", behavior: "instant" });
      } catch {
        // A malformed fragment must not prevent the site from rendering.
      }
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [selectedId, token, hash]);
  const contents = (
    <TooltipProvider delayDuration={400}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("sharing.siteSearch")}
              aria-label={t("sharing.siteSearch")}
              className="h-9 border-transparent bg-slate-100/70 pl-9 pr-9 text-xs focus-visible:border-slate-300"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-1.5 top-1"
                aria-label={t("sharing.siteClearSearch")}
                onClick={() => setSearch("")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <nav
          aria-label={t("sharing.notebookContents")}
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-6"
        >
          <Link
            to={root}
            onClick={navigate}
            aria-current={!selectedId ? "page" : undefined}
            className={cn(
              linkClass,
              "block px-3 py-2 text-[13px] font-medium",
              !selectedId
                ? "text-slate-900"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t("sharing.siteHome")}
          </Link>
          {query ? (
            <>
              <p className="px-2 py-2 text-xs text-slate-500" role="status">
                {t("sharing.siteResults", { count: matches.length })}
              </p>
              <ul>
                {matches.map(({ memo, section }) => (
                  <li key={memo.id}>
                    <Link
                      to={href(memo.id)}
                      onClick={navigate}
                      className={cn(
                        linkClass,
                        "block px-3 py-2 text-[13px] leading-5 text-slate-600 hover:bg-slate-100/70",
                      )}
                    >
                      <NoteTitle memo={memo} />
                      <span className="mt-1 block text-xs text-slate-400">
                        {section.path.map((item) => item.name).join(" / ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {!matches.length && (
                <p className="px-2 py-4 text-sm text-slate-500">
                  {t("sharing.siteNoResults")}
                </p>
              )}
            </>
          ) : (
            <>
              {sections[0] && (
                <NavigationNotes
                  memos={sections[0].memos}
                  selectedId={selectedId}
                  href={href}
                  onNavigate={navigate}
                />
              )}
              {sections
                .slice(1)
                .filter((section) => section.memos.length)
                .map((section) => (
                  <NavigationSection
                    key={section.notebook.id}
                    section={section}
                    selectedId={selectedId}
                    containsSelection={
                      current?.section.notebook.id === section.notebook.id
                    }
                    href={href}
                    onNavigate={navigate}
                  />
                ))}
            </>
          )}
        </nav>
        <div className="px-8 py-5 text-[11px] text-slate-400">
          {t("sharing.sitePoweredBy")}
        </div>
      </div>
    </TooltipProvider>
  );
  return (
    <div
      data-site-theme="default"
      className="min-h-[100dvh] bg-card text-slate-900"
    >
      <a
        href="#notebook-site-content"
        className="sr-only z-[60] rounded-md bg-card p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("sharing.siteSkipToContent")}
      </a>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-card/95 px-4 backdrop-blur sm:px-6">
        <Link
          to={root}
          onClick={navigate}
          className={cn(
            linkClass,
            "flex min-w-0 items-center gap-3 font-semibold",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <BookOpen className="size-5" />
          </span>
          <span className="truncate">{share.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={t(
              sidebarOpen
                ? "sharing.siteHideContents"
                : "sharing.siteShowContents",
            )}
            title={t(
              sidebarOpen
                ? "sharing.siteHideContents"
                : "sharing.siteShowContents",
            )}
            aria-expanded={sidebarOpen}
            aria-controls="notebook-site-sidebar"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
          <span className="hidden text-xs text-slate-500 sm:block">
            {t("sharing.readOnly")}
          </span>
          <Drawer
            open={mobileOpen}
            onOpenChange={setMobileOpen}
            shouldScaleBackground={false}
          >
            <DrawerTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <Menu className="size-4" />
                {t("sharing.notebookContents")}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[85dvh] bg-card">
              <DrawerHeader className="relative pr-12">
                <DrawerClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("common.close")}
                    className="absolute right-3 top-2"
                  >
                    <X className="size-4" />
                  </Button>
                </DrawerClose>
                <DrawerTitle>{share.name}</DrawerTitle>
                <DrawerDescription>
                  {t("sharing.siteNoteCount", { count: notes.length })}
                </DrawerDescription>
              </DrawerHeader>
              {contents}
            </DrawerContent>
          </Drawer>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px] items-start">
        <aside
          id="notebook-site-sidebar"
          className={cn(
            "sticky top-16 hidden h-[calc(100dvh-4rem)] w-72 shrink-0 flex-col border-r border-slate-200/70 bg-card pt-6",
            sidebarOpen && "lg:flex",
          )}
        >
          {contents}
        </aside>
        <main
          id="notebook-site-content"
          tabIndex={-1}
          className="min-w-0 flex-1 outline-none"
        >
          {!selectedId ? (
            <div className="mx-auto max-w-5xl px-5 py-10 sm:px-10 sm:py-14">
              <p className="mb-4 text-sm font-medium text-slate-500">
                {t("sharing.siteNoteCount", { count: notes.length })}
              </p>
              <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
                {share.name}
              </h1>
              {!notes.length && (
                <p className="mt-4 text-sm text-slate-500">
                  {t("sharing.notebookEmpty")}
                </p>
              )}
              {query && (
                <p className="mt-6 text-sm text-slate-500" role="status">
                  {t("sharing.siteResults", { count: matches.length })}
                </p>
              )}
              {(!query || matches.length > 0) && (
                <HomepageContents
                  sections={sections}
                  matchingIds={matchingIds}
                  filtering={Boolean(query)}
                  href={href}
                  onNavigate={navigate}
                />
              )}
              {query && !matches.length && (
                <p className="py-10 text-sm text-slate-500">
                  {t("sharing.siteNoResults")}
                </p>
              )}
            </div>
          ) : (
            <>
              <nav
                aria-label={t("sharing.siteBreadcrumb")}
                className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-5 pt-7 text-xs leading-6 text-slate-500 sm:px-10"
              >
                <Link
                  to={root}
                  onClick={navigate}
                  className={cn(linkClass, "hover:text-slate-900")}
                >
                  {t("sharing.siteHome")}
                </Link>
                {current?.section.path.map((notebook) => (
                  <span key={notebook.id} className="contents">
                    <ChevronRight className="size-3 shrink-0" />
                    <Link
                      to={`${root}#section-${notebook.id}`}
                      onClick={navigate}
                      className={cn(
                        linkClass,
                        "break-words hover:text-slate-900",
                      )}
                    >
                      {notebook.name}
                    </Link>
                  </span>
                ))}
                {current && (
                  <>
                    <ChevronRight className="size-3 shrink-0" />
                    <span
                      aria-current="page"
                      className="break-words text-slate-700"
                    >
                      <NoteTitle memo={current.memo} />
                    </span>
                  </>
                )}
              </nav>
              {children}
              {current && (
                <nav
                  aria-label={t("sharing.siteReadingNavigation")}
                  className="mx-auto grid max-w-4xl grid-cols-2 gap-4 border-t border-slate-200 px-5 py-8 sm:px-10"
                >
                  {notes[index - 1] ? (
                    <Link
                      to={href(notes[index - 1].memo.id)}
                      onClick={navigate}
                      className={cn(linkClass, "min-w-0 p-3 hover:bg-slate-50")}
                    >
                      <span className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                        <ArrowLeft className="size-3.5" />
                        {t("sharing.sitePrevious")}
                      </span>
                      <span className="text-sm font-medium">
                        <NoteTitle memo={notes[index - 1].memo} />
                      </span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {notes[index + 1] && (
                    <Link
                      to={href(notes[index + 1].memo.id)}
                      onClick={navigate}
                      className={cn(
                        linkClass,
                        "min-w-0 p-3 text-right hover:bg-slate-50",
                      )}
                    >
                      <span className="mb-2 flex items-center justify-end gap-2 text-xs text-slate-500">
                        {t("sharing.siteNext")}
                        <ArrowRight className="size-3.5" />
                      </span>
                      <span className="text-sm font-medium">
                        <NoteTitle memo={notes[index + 1].memo} />
                      </span>
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
