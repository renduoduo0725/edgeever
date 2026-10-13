import { expect, test, type Page } from "@playwright/test";

const densityRank = (density: string | null) => ["full", "tags", "compact"].indexOf(density ?? "");

const settleLayout = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
}));

test("includes the visible Back button when choosing editor metadata density", async ({ page }) => {
  test.setTimeout(90_000);
  const notebooksResponse = await page.request.get("/api/v1/notebooks");
  expect(notebooksResponse.ok()).toBe(true);
  const notebooks = await notebooksResponse.json() as { notebooks: Array<{ id: string }> };
  const notebookId = notebooks.notebooks[0]?.id;
  expect(notebookId).toBeTruthy();

  const title = `Metadata density ${"W".repeat(10)} ${Date.now()}`;
  const createResponse = await page.request.post("/api/v1/memos", {
    data: {
      notebookId,
      title,
      contentMarkdown: "Tablet-width editor header density test.",
      tags: ["interaction", "responsive-metadata"],
    },
  });
  expect(createResponse.status(), await createResponse.text()).toBe(201);
  const memoId = (await createResponse.json() as { memo: { id: string } }).memo.id;

  try {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto(process.env.EDGE_EVER_E2E_WEB_URL ?? "/");
    await page.getByPlaceholder("搜索笔记").fill(title);
    await page.locator(`[data-memo-id="${memoId}"]`).locator("button").first().click();

    const leading = page.locator("[data-editor-top-row-leading]").first();
    const backButton = leading.locator("button").first();
    const metadata = page.locator("[data-metadata-density]").first();
    await expect(backButton).toBeVisible();
    await expect(metadata).toBeVisible();

    let responsiveCase: { width: number; withBack: string; withoutBack: string } | null = null;
    for (let width = 640; width <= 1020; width += 12) {
      await page.setViewportSize({ width, height: 800 });
      await settleLayout(page);
      const withBack = await metadata.getAttribute("data-metadata-density");

      await backButton.evaluate((button) => { button.style.display = "none"; });
      await page.setViewportSize({ width: width + 1, height: 800 });
      await settleLayout(page);
      const withoutBack = await metadata.getAttribute("data-metadata-density");
      await backButton.evaluate((button) => { button.style.removeProperty("display"); });

      if (densityRank(withBack) > densityRank(withoutBack)) {
        responsiveCase = { width, withBack: withBack!, withoutBack: withoutBack! };
        break;
      }
    }

    expect(responsiveCase, "the visible Back button and its gap should trigger earlier metadata compaction").not.toBeNull();
    expect(responsiveCase!.width).toBeGreaterThanOrEqual(640);
    expect(responsiveCase!.width).toBeLessThan(1024);
  } finally {
    await page.request.delete(`/api/v1/memos/${memoId}`);
    await page.request.delete(`/api/v1/memos/${memoId}?permanent=1`);
  }
});
