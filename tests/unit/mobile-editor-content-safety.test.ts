import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const appCss = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const panelCss = readFileSync(
  new URL("../../src/components/dossier/EditorPanelIntro.css", import.meta.url),
  "utf8",
);
const guardCss = readFileSync(
  new URL("../../src/components/dossier/mobile-editor-content-guard.css", import.meta.url),
  "utf8",
);
const root = readFileSync(new URL("../../src/routes/__root.tsx", import.meta.url), "utf8");

describe("mobile editor content safety", () => {
  test("shared panel styling never treats the first child as disposable intro chrome", () => {
    expect(panelCss).not.toContain("> div:last-child > div:first-child");
    expect(panelCss).toContain("Do not infer helper/intro chrome from DOM position");
  });

  test("legacy letter/CV first-child hiding is neutralized after the app stylesheet", () => {
    expect(appCss).toContain(
      'body:has([data-letter-page]) [data-editor-panel] > aside > div > div:first-child',
    );
    expect(appCss).toContain(
      'body:has([data-cv-page]) [data-editor-panel] > aside > div > div:first-child',
    );

    expect(guardCss).toContain(
      'body:has([data-letter-page]) [data-editor-panel] > aside > div > div:first-child',
    );
    expect(guardCss).toContain(
      'body:has([data-cv-page]) [data-editor-panel] > aside > div > div:first-child',
    );
    expect(guardCss).toContain("display: block !important");
    expect(guardCss).toContain("[data-cv-content-editor]");
    expect(guardCss).toContain("display: flex !important");

    expect(root.indexOf("appCss")).toBeGreaterThanOrEqual(0);
    expect(root.indexOf("mobileEditorContentGuardCss")).toBeGreaterThan(root.indexOf("appCss"));
  });
});
