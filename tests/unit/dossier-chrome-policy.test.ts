import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chrome = readFileSync(
  new URL("../../src/components/dossier/DossierHeaderFooterChrome.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../../src/components/dossier/chrome-policy.css", import.meta.url),
  "utf8",
);
const cvCanvas = readFileSync(
  new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url),
  "utf8",
);

describe("global quiet chrome policy", () => {
  test("shared chrome loads the global policy", () => {
    expect(chrome).toContain('import "./chrome-policy.css";');
  });

  test("detached Fresh header micro-rules are suppressed centrally", () => {
    for (const motif of [
      "edge-rule",
      "glow-rule",
      "mono-bottom-rule",
      "top-rule",
      "rail-rule",
      "clay-rule",
      "cool-rule",
      "warm-rule",
    ]) {
      expect(css).toContain(`[data-letter-motif="${motif}"]`);
    }
    expect(css).toContain('[data-dossier-sheet-background="horizon"] > div:nth-child(2)');
    expect(css).toContain('[data-dossier-sheet-background="violetPulse"] > div:nth-child(2)');
    expect(css).toContain('[data-dossier-sheet-background="orbit"] > div:nth-child(3)');
    expect(css).toContain("display: none !important;");
  });

  test("Edge CV contact text clears its template-owned top signature", () => {
    expect(css).toContain('[data-cv-template="edge"] [data-dossier-integrated-contact]');
    expect(css).toContain("top: 9mm !important;");
  });

  test("template contrast colors yield to explicit header and footer colors", () => {
    for (const template of ["citrus", "cove", "edel"]) {
      expect(css).toContain(
        `[data-dossier-template-chrome="${template}"][data-dossier-header-custom-surface="false"][data-dossier-header-text-color="automatic"]`,
      );
    }
    expect(css).toContain(
      '[data-cv-template="edge"]\n  [data-dossier-header-text-color="automatic"]\n  [data-dossier-integrated-contact]',
    );
    expect(css).toContain(
      '[data-dossier-template-chrome="edel"][data-dossier-footer-custom-surface="false"][data-dossier-footer-text-color="automatic"]',
    );
  });

  test("Ribbon eyebrow stays readable across the sidebar seam", () => {
    expect(css).toContain(
      'html[data-dossier-template="ribbon"] [data-dossier-document="cover"] [data-block-id="eyebrow"]',
    );
    expect(css).toContain("width: 44mm !important;");
    expect(css).toContain("background: var(--cover-ink) !important;");
  });

  test("Neon and Verlauf hero clearance only applies to contact headers", () => {
    expect(cvCanvas).toContain("data-cv-header-mode={chromeOptions.headerMode}");
    expect(css).toContain('[data-cv-template="neon"][data-cv-header-mode="contact"]');
    expect(css).toContain('[data-cv-template="verlauf"][data-cv-header-mode="contact"]');
    expect(css).not.toContain(
      '[data-cv-template="neon"] :is([data-cv-page="0"], [data-cv-measure-page])',
    );
  });
});
