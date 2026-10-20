import { expect, test, type Page } from "@playwright/test";

const readSource = async (page: Page) =>
  (await page.locator(".cm-content .cm-line").allTextContents()).join("\n");

for (const { platform, modifier } of [
  { platform: "Win32", modifier: "Control" },
  { platform: "MacIntel", modifier: "Meta" },
]) {
  test.describe(`${platform} editor mode shortcut`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        Object.defineProperty(navigator, "platform", { get: () => value });
      }, platform);
    });

    for (const key of ["/", "k"]) {
      test(`round-trips with ${modifier}+${key} without editing the note`, async ({ page }) => {
        if (key !== "/") {
          await page.addInitScript((value) => {
            localStorage.setItem("edgeever.shortcutSettings", JSON.stringify({
              toggleEditorMode: { key: value, ctrlOrMeta: true, shift: false, alt: false },
            }));
          }, key);
        }

        const notebooks = await (await page.request.get("/api/v1/notebooks")).json() as {
          notebooks: Array<{ id: string }>;
        };
        const title = `Editor mode shortcut ${platform} ${key} ${Date.now()}`;
        const response = await page.request.post("/api/v1/memos", {
          data: {
            notebookId: notebooks.notebooks[0]?.id,
            title,
            contentMarkdown: "Keyboard shortcut **regression**.\n\nSecond paragraph.",
          },
        });
        expect(response.status()).toBe(201);
        const { memo } = await response.json() as {
          memo: { id: string; contentMarkdown: string; revision: number };
        };

        try {
          await page.goto("/");
          await page.getByRole("button", { name: "全部笔记", exact: true }).click();
          await page.getByPlaceholder("搜索笔记").fill(title);
          await page.locator(`[data-memo-id="${memo.id}"]`).locator("button").first().click();
          const rich = page.locator(".ProseMirror[contenteditable='true']");
          const source = page.locator(".cm-content");
          await expect(rich).toContainText("Keyboard shortcut regression.");
          await rich.click();

          for (let round = 0; round < 3; round++) {
            await page.keyboard.press(`${modifier}+${key}`);
            await expect(source).toBeFocused();
            expect(await readSource(page)).toBe(memo.contentMarkdown);

            // Holding the shortcut or composing text must neither toggle nor edit.
            for (const guard of [{ repeat: true }, { isComposing: true }]) {
              await source.dispatchEvent("keydown", {
                key,
                ctrlKey: modifier === "Control",
                metaKey: modifier === "Meta",
                bubbles: true,
                cancelable: true,
                ...guard,
              });
              await expect(source).toBeFocused();
              expect(await readSource(page)).toBe(memo.contentMarkdown);
            }

            await page.keyboard.press(`${modifier}+${key}`);
            await expect(rich).toBeFocused();
            await expect(source).toHaveCount(0);
            await expect(rich).toContainText("Keyboard shortcut regression.");
          }

          await page.keyboard.press(`${modifier}+s`);
          await expect(page.getByRole("status", { name: /^已同步/ })).toBeVisible();
          const saved = await (await page.request.get(`/api/v1/memos/${memo.id}`)).json() as {
            memo: { contentMarkdown: string; revision: number };
          };
          expect(saved.memo.contentMarkdown).toBe(memo.contentMarkdown);
          expect(saved.memo.revision).toBe(memo.revision);

          await page.keyboard.press(`${modifier}+${key}`);
          await expect(source).toBeFocused();
          if (key === "/") {
            // Unrelated editor shortcuts still run, and a dialog blocks mode switching.
            await page.keyboard.press(`${modifier}+k`);
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            await page.keyboard.press(`${modifier}+${key}`);
            await expect(dialog).toBeVisible();
            expect(await readSource(page)).toBe(memo.contentMarkdown);
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
          } else {
            // Rebinding mode switching leaves CodeMirror's original comment command available.
            await page.keyboard.press(`${modifier}+/`);
            await expect(source).toContainText("<!--");
            await page.keyboard.press(`${modifier}+z`);
            await expect.poll(() => readSource(page)).toBe(memo.contentMarkdown);
          }
        } finally {
          await page.request.delete(`/api/v1/memos/${memo.id}`);
          await page.request.delete(`/api/v1/memos/${memo.id}?permanent=1`);
        }
      });
    }
  });
}
