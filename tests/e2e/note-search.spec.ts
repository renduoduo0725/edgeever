import { expect, test, type Page } from "@playwright/test";

const createMemo = async (page: Page, contentMarkdown: string) => {
  const notebooks = await (await page.request.get("/api/v1/notebooks")).json() as { notebooks: Array<{ id: string }> };
  const title = `Note search regression ${Date.now()}`;
  const response = await page.request.post("/api/v1/memos", {
    data: { notebookId: notebooks.notebooks[0]?.id, title, contentMarkdown },
  });
  expect(response.status()).toBe(201);
  const { memo } = await response.json() as { memo: { id: string } };
  await page.goto("/");
  await expect(page.locator("[data-memo-id]").first()).toBeVisible();
  await page.getByRole("button", { name: "全部笔记", exact: true }).click();
  await page.getByPlaceholder("搜索笔记").fill(title);
  await page.locator(`[data-memo-id="${memo.id}"]`).locator("button").first().click();
  await expect(page.getByPlaceholder("无标题笔记")).toHaveValue(title);
  return { ...memo, title };
};

const deleteMemo = async (page: Page, id: string) => {
  await page.request.delete(`/api/v1/memos/${id}`);
  await page.request.delete(`/api/v1/memos/${id}?permanent=1`);
};

const ensureSourceMode = async (page: Page) => {
  const toggle = page.getByRole("button", { name: "切换到 Markdown 源码", exact: true });
  if (await toggle.count()) await toggle.click();
  await expect(page.locator(".cm-content")).toBeVisible();
};

const openReplace = async (page: Page, selector: string) => {
  await page.locator(selector).click();
  await page.keyboard.press("ControlOrMeta+h");
  await expect(page.getByPlaceholder("替换为", { exact: true })).toBeVisible();
};

const searchQuery = (page: Page) => page.getByPlaceholder("在当前笔记内搜索", { exact: true });
const replaceAll = (page: Page) => page.getByRole("button", { name: "全部替换", exact: true });
const readSource = async (page: Page) => (await page.locator(".cm-content .cm-line").allTextContents()).join("\n");

test("source search replaces literal escapes with empty text, supports undo, and persists the result", async ({ page }) => {
  const memo = await createMemo(page, "# Search regression\n\n**bold** \\\\alpha \\[literal\\] $& \\\\beta\n\nspace  end");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await ensureSourceMode(page);
    const original = await readSource(page);
    await openReplace(page, ".cm-content");
    await searchQuery(page).fill("\\");
    await expect(page.locator(".cm-content .edgeever-search-match")).toHaveCount(6);
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: "1/6" })).toBeVisible();
    await page.getByRole("button", { name: "下一个搜索结果", exact: true }).click();
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: "2/6" })).toBeVisible();
    await expect(page.locator(".cm-search")).toHaveCount(0);
    await replaceAll(page).click();
    await expect.poll(() => readSource(page)).toBe(original.replaceAll("\\", ""));
    await page.getByRole("button", { name: "关闭搜索", exact: true }).click();
    await expect(page.locator(".cm-content")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => readSource(page)).toBe(original);

    await openReplace(page, ".cm-content");
    await searchQuery(page).fill("\\");
    await page.getByPlaceholder("替换为", { exact: true }).fill("$1\\n");
    await replaceAll(page).click();
    const expected = original.replaceAll("\\", "$1\\n");
    await expect.poll(() => readSource(page)).toBe(expected);
    await page.keyboard.press("ControlOrMeta+s");
    await expect.poll(async () => {
      const result = await (await page.request.get(`/api/v1/memos/${memo.id}`)).json() as { memo: { contentMarkdown: string } };
      return result.memo.contentMarkdown;
    }, { timeout: 20000 }).toBe(expected);
    await page.reload();
    await expect(page.locator("[data-memo-id]").first()).toBeVisible();
    await page.getByRole("button", { name: "全部笔记", exact: true }).click();
    await page.getByPlaceholder("搜索笔记").fill(memo.title);
    await page.locator(`[data-memo-id="${memo.id}"]`).locator("button").first().click();
    await expect(page.getByPlaceholder("无标题笔记")).toHaveValue(memo.title);
    await ensureSourceMode(page);
    await expect.poll(() => readSource(page)).toBe(expected);
    expect(errors).toEqual([]);
  } finally {
    await deleteMemo(page, memo.id);
  }
});

test("search follows the active mode and rich text supports whitespace deletion without moving focus into the body", async ({ page }) => {
  const memo = await createMemo(page, "**bold** alpha  beta");
  try {
    await ensureSourceMode(page);
    await openReplace(page, ".cm-content");
    await searchQuery(page).fill("**");
    await expect(replaceAll(page)).toBeEnabled();
    await page.getByRole("button", { name: "切换到富文本编辑", exact: true }).click();
    await expect(replaceAll(page)).toBeDisabled();
    await searchQuery(page).fill(" ");
    const rich = page.locator(".ProseMirror[contenteditable='true']");
    await expect(rich.locator(".edgeever-search-match")).toHaveCount(3);
    await rich.evaluate((element) => {
      element.setAttribute("data-search-focus-count", "0");
      element.addEventListener("focus", () => {
        element.setAttribute("data-search-focus-count", String(Number(element.getAttribute("data-search-focus-count")) + 1));
      });
    });
    await page.getByPlaceholder("替换为", { exact: true }).press("Enter");
    await expect(rich).toHaveText("boldalphabeta");
    await expect(rich).toHaveAttribute("data-search-focus-count", "0");
    await expect(page.getByPlaceholder("替换为", { exact: true })).toBeFocused();
  } finally {
    await deleteMemo(page, memo.id);
  }
});
