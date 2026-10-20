import { expect, test } from "@playwright/test";

for (const height of [900, 720, 420]) {
  test(`keeps all memo actions reachable in a ${height}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    await page.goto("/");
    const card = page.locator('[data-memo-id="memo_demo_overview"]');
    await card.locator("button").first().click({ button: "right" });

    const menu = page.locator("[data-memo-actions-menu]");
    await expect(menu).toBeVisible();
    await expect.poll(async () => {
      const box = await menu.boundingBox();
      return Boolean(box && box.y >= 12 && box.y + box.height <= height - 12 && box.x >= 12 && box.x + box.width <= 1280 - 12);
    }).toBe(true);

    const sizes = await menu.evaluate(node => ({ client: node.clientHeight, scroll: node.scrollHeight }));
    if (height === 420) expect(sizes.scroll).toBeGreaterThan(sizes.client);
    else expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);

    // End must reveal the last action without invoking a destructive action.
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem").last()).toBeFocused();
    await expect.poll(() => menu.getByRole("menuitem").last().evaluate(node => {
      const item = node.getBoundingClientRect();
      const parent = node.closest("[data-memo-actions-menu]")!.getBoundingClientRect();
      return item.top >= parent.top && item.bottom <= parent.bottom;
    })).toBe(true);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });
}

test("anchors a memo's more-actions menu to its visible trigger", async ({ page }) => {
  await page.goto("/");

  const memoCard = page.locator('[data-memo-id="memo_demo_overview"]');
  const trigger = memoCard.locator("[data-memo-actions-trigger]");
  await memoCard.hover();
  await trigger.click();

  const menu = page.locator("[data-memo-actions-menu]");
  await expect(menu).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();

  expect(Math.abs(menuBox!.x - (triggerBox!.x + triggerBox!.width))).toBeLessThan(24);
  expect(Math.abs(menuBox!.y - (triggerBox!.y + triggerBox!.height))).toBeLessThan(24);
});
