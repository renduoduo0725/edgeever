import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./NotebookPane.tsx", import.meta.url), "utf8");

test("keeps proactive AI out of primary navigation", () => {
  const primaryNav = source.split('aria-label={t("companion.primaryNavigation")}>')[1]?.split("</nav>")[0];
  expect(primaryNav).toContain('label={t("notebookPane.allMemos")}');
  expect(primaryNav).not.toContain('label={t("companion.navTitle")}');
  expect(primaryNav).not.toContain("onClick={onOpenCompanion}");
});

test("keeps the desktop create-note control compact with one neutral outline", () => {
  expect(source).toContain('rounded-2xl border border-slate-200/90');
  expect(source).toContain('className="group flex h-12');
  expect(source).toContain('className="group relative flex h-12 w-[6.25rem]');
  expect(source).toContain('before:inset-y-2.5');
  expect(source).toContain('data-[state=open]:bg-emerald-50');
  expect(source).toContain('t("diagram.moreTypes")');
  expect(source).toContain('group-data-[state=open]:rotate-180');
  expect(source).not.toContain('focus-visible:ring-inset focus-visible:ring-emerald-500');
  expect(source).not.toContain('title={t("notebookPane.newMemo")}');
});

test("marks diagram note types as beta without labeling regular notes", () => {
  const createTypeMenu = source.split("const CreateMemoTypeItems")[1]?.split("const getSyncStatusLabel")[0];
  const regularNoteItem = createTypeMenu?.split('onSelect={() => onCreateMemo()}>')[1]?.split("</DropdownMenuItem>")[0];
  const betaBadgeCount = createTypeMenu?.match(/<DiagramBetaBadge \/>/g)?.length;

  expect(regularNoteItem).not.toContain("DiagramBetaBadge");
  expect(createTypeMenu).toContain('onCreateMemo("architecture")');
  expect(betaBadgeCount).toBe(3);
});

describe("NotebookPane sidebar collapse", () => {
  test("places a desktop-only collapse control in the footer and keeps an expand control when collapsed", () => {
    const expandedFooter = source.split('pwa.sidebarDownloadsTitle')[1]?.split(") : (")[0] ?? source;
    const profileRow = expandedFooter.split('aria-label={t("notebookPane.profile")}')[1]?.split("</div>")[0];

    expect(source).toContain("SidebarCollapseButton");
    expect(source).toContain('t(collapsed ? "notebookPane.expandSidebar" : "notebookPane.collapseSidebar")');
    expect(source).toContain("aria-controls={NOTEBOOK_SIDEBAR_ID}");
    expect(source).toContain('className="hidden lg:inline-flex"');
    expect(source).toContain('collapsed && "hidden"');
    expect(source).toContain("<ChevronsLeft");
    expect(source).toContain("<ChevronsRight");
    expect(profileRow).toContain("<SidebarCollapseButton");
    expect(profileRow.indexOf('t("notebookPane.profile")')).toBeLessThan(profileRow.indexOf("<SidebarCollapseButton"));
  });

  test("renders an icon rail of primary destinations while the notebook tree is collapsed", () => {
    const rail = source.split('data-notebook-sidebar-rail')[1]?.split(") : (")[0];

    expect(rail).toContain('aria-label={t("notebookPane.newMemo")}');
    expect(rail).toContain("<LayoutGrid");
    expect(rail).toContain('label={t("notebookPane.allMemos")}');
    expect(rail).toContain('label={t("notebookPane.notebooks")}');
    expect(rail).toContain('label={t("mobileSheets.tags")}');
    expect(rail).toContain('label={t("notebookPane.trash")}');
    expect(rail).toContain("<SidebarCollapseButton collapsed");
    expect(rail).toContain('tooltipSide="right"');
  });

  test("wires the desktop workspace grid to a collapsed notebook column", () => {
    const workspace = readFileSync(new URL("./WorkspaceApp.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");

    expect(workspace).toContain("desktopNotebookSidebarCollapsed");
    expect(workspace).toContain("edgeever-workspace-grid--sidebar-collapsed");
    expect(workspace).toContain('id="edgeever-notebook-sidebar"');
    expect(workspace).toContain("collapsed={desktopNotebookSidebarCollapsed}");
    expect(css).toContain(".edgeever-workspace-grid--sidebar-collapsed");
    expect(css).toContain("var(--notebook-sidebar-width)");
    expect(css).toContain("--notebook-sidebar-width: 3.5rem;");
  });
});

describe("NotebookPane client downloads", () => {
  test("keeps macOS, Windows, and Linux downloads visible in the desktop runtime", () => {
    expect(source).toContain('t("pwa.sidebarMac") || "macOS"');
    expect(source).toContain('t("pwa.sidebarWindows") || "Windows"');
    expect(source).toContain('t("pwa.sidebarLinux") || "Linux"');
    expect(source).not.toContain("!window.edgeeverDesktop?.isAvailable");
  });

  test("renders platform icons inline so desktop protocols do not break them", () => {
    expect(source).toContain("<BrandIcon path={APPLE_ICON_PATH}");
    expect(source).toContain("<BrandIcon path={WINDOWS_ICON_PATH}");
    expect(source).toContain('<BrandIcon path={LINUX_ICON_PATH} className="h-4 w-4"');
    expect(source).toContain("<GooglePlayIcon />");
    expect(source).toContain("<AppStoreIcon />");
    expect(source).not.toContain('src="/icons/platforms/');
  });
});
