import { expect, test } from "@playwright/test";

const NOTEBOOK_SIDEBAR_WIDTH_STORAGE_KEY = "edgeever.notebookSidebarWidth";
const E2E_WEB_URL = process.env.EDGE_EVER_E2E_WEB_URL ?? "/";

test("resizes the notebook pane from a fully clickable drag handle", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(E2E_WEB_URL);
  await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), NOTEBOOK_SIDEBAR_WIDTH_STORAGE_KEY);
  await page.reload();

  const sidebar = page.locator("#edgeever-notebook-sidebar");
  const handle = page.getByRole("separator", { name: "调整笔记本栏宽度" });
  await expect(sidebar).toBeVisible();
  await expect(handle).toBeVisible();
  await expect(handle).toHaveCSS("touch-action", "none");

  const sidebarBox = await sidebar.boundingBox();
  const handleBox = await handle.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(handleBox).not.toBeNull();
  expect(handleBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x);
  expect(handleBox!.x + handleBox!.width).toBeLessThanOrEqual(sidebarBox!.x + sidebarBox!.width + 0.5);

  const initialWidth = Number(await handle.getAttribute("aria-valuenow"));
  const dragDistance = 64;
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + dragDistance, handleBox!.y + handleBox!.height / 2, { steps: 4 });
  await page.mouse.up();

  const resizedWidth = initialWidth + dragDistance;
  await expect(handle).toHaveAttribute("aria-valuenow", String(resizedWidth));
  expect(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), NOTEBOOK_SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(resizedWidth));

  await page.reload();
  await expect(page.getByRole("separator", { name: "调整笔记本栏宽度" })).toHaveAttribute("aria-valuenow", String(resizedWidth));
});

test("keyboard resizing starts from the displayed notebook pane width", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(E2E_WEB_URL);
  await page.evaluate(
    ([storageKey, width]) => window.localStorage.setItem(storageKey, width),
    [NOTEBOOK_SIDEBAR_WIDTH_STORAGE_KEY, "420"],
  );
  await page.reload();

  const handle = page.getByRole("separator", { name: "调整笔记本栏宽度" });
  await expect(handle).toHaveAttribute("aria-valuenow", "204");
  await handle.focus();
  await page.keyboard.press("ArrowLeft");

  await expect(handle).toHaveAttribute("aria-valuenow", "188");
  expect(await page.evaluate(
    (storageKey) => window.localStorage.getItem(storageKey),
    NOTEBOOK_SIDEBAR_WIDTH_STORAGE_KEY,
  )).toBe("188");
});
