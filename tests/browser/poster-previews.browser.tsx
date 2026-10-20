// Local fixture for the static gallery: no renderer, fonts or note APIs.
import React from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { enUS } from "../../packages/shared/src/i18n/en-US";
import { PosterTemplatePanel } from "../../apps/web/src/components/poster/PosterTemplatePanel";
import "../../apps/web/src/styles/globals.css";

const i18n = i18next.createInstance();
await i18n.init({ lng: "en", resources: { en: { translation: enUS } }, initAsync: false });
const root = createRoot(document.getElementById("fixture")!);
const applied: string[] = [];
const mount = (zh = true, platformId?: string, show = true) => root.render(
  show ? <I18nextProvider i18n={i18n}>
    <div style={{ width: 300, height: 800, overflow: "auto" }}>
      <PosterTemplatePanel platformId={platformId} zh={zh} disabled={false} onApply={id => applied.push(id)} />
    </div>
  </I18nextProvider> : null,
);
Object.assign(window, { posterPreviewTest: { mount, applied } });
mount();
