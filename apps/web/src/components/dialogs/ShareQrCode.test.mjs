import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

const source = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("share link QR code", () => {
  test("is offered in both share dialogs only for links without a password", () => {
    for (const [dialog, hint] of [["ShareMemoDialog.tsx", "sharing.qrCodeHint"], ["ShareNotebookDialog.tsx", "sharing.qrCodeNotebookHint"]]) {
      const code = source(dialog);
      expect(code).toContain(`{share.passwordProtected ? null : (\n              <ShareQrCode key={\`qr-\${share.token}\`} url={shareUrl} hint={t("${hint}")} />`);
      // A sibling keyed with the bare token (SharePasswordControls) would make React duplicate rows.
      expect(code.match(/key=\{share\.token\}/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  test("renders an accessible SVG with dark modules on white and no native tooltip", () => {
    const component = source("ShareQrCode.tsx");
    expect(component).toContain('bgColor="#ffffff"');
    expect(component).toContain('fgColor="#000000"');
    expect(component).toContain('aria-label={t("sharing.qrCodeLabel")}');
    expect(component).not.toMatch(/\btitle=/);

    const markup = renderToStaticMarkup(createElement(QRCodeSVG, {
      value: "https://notes.example/share/abc",
      size: 176,
      level: "M",
      marginSize: 0,
      role: "img",
      "aria-label": "QR code for the share link",
    }));
    expect(markup).toStartWith("<svg");
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="QR code for the share link"');
    expect(markup).not.toContain("<title");
    expect(markup).toContain("<path");
  });
});
