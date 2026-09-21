import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../src/components/cover/templatefix-24-25.css", import.meta.url),
  "utf8",
);
const forestDefaults = readFileSync(
  new URL("../../src/components/cover/forest-flow-cover-defaults.ts", import.meta.url),
  "utf8",
);
const chromePolicy = readFileSync(
  new URL("../../src/components/dossier/chrome-policy.css", import.meta.url),
  "utf8",
);
const acceptanceCss = readFileSync(
  new URL("../../src/components/cover/fresh-cover-visual-cleanup.css", import.meta.url),
  "utf8",
);
const gradientCss = readFileSync(
  new URL("../../src/components/cover/gradient-templates.css", import.meta.url),
  "utf8",
);
const freshTemplates = readFileSync(
  new URL("../../src/components/cover/fresh-templates.ts", import.meta.url),
  "utf8",
);
const letterBackground = readFileSync(
  new URL("../../src/components/letter/LetterSheetBackground.tsx", import.meta.url),
  "utf8",
);

describe("templateFIX Sunrise + Forest Flow", () => {
  test("Sunrise orphan-rule suppression is global, not a local template patch", () => {
    expect(css).not.toContain('[data-letter-template="sunrise"] [data-letter-motif="top-rule"]');
    expect(css).not.toContain(
      '[data-letter-fresh-template="sunrise"] [data-letter-motif="top-rule"]',
    );
    expect(chromePolicy).toContain('[data-letter-motif="top-rule"]');
  });

  test("Forest Flow has one final vertical-grove geometry owner", () => {
    expect(css).toContain('html[data-dossier-template="forestFlow"]');
    expect(css).toContain("width: 52mm !important;");
    expect(css).toContain('[data-letter-motif="rail"]');
    expect(css).toContain("width: 12mm !important;");
    expect(css).toContain("height: 297mm !important;");
    expect(css).not.toContain(
      '[data-letter-fresh-template="forestFlow"] [data-letter-motif="rail-rule"]',
    );
    expect(chromePolicy).toContain('[data-letter-motif="rail-rule"]');

    // Older stylesheets must not reintroduce another Forest Flow geometry owner.
    expect(acceptanceCss).not.toContain('[data-fresh-cover-background="forestFlow"]');
    expect(acceptanceCss).not.toContain('data-dossier-template="forestFlow"');
    expect(gradientCss).not.toContain('data-dossier-template="forestFlow"');
  });

  test("Forest Flow cover keeps its deliberate grid without pinning editable blocks in CSS", () => {
    expect(forestDefaults).toContain("name: { x: 72, y: 111, w: 112");
    expect(forestDefaults).toContain("kontakt: {");
    expect(forestDefaults).toContain("y: 203,");
    expect(forestDefaults).toContain("foto: { x: 143, y: 27");
    expect(css).toContain('data-block-id="name"');
    expect(css).toContain('data-block-id="kontakt"');
    expect(css).not.toContain("left: 72mm !important;");
    expect(css).not.toContain("left: 7mm !important;");
    expect(css).not.toContain("translate(-34mm");
  });

  test("Forest Flow CV owns only its two strong direct signature siblings", () => {
    expect(css).toContain('[data-dossier-sheet-background="forestFlow"]\n  > div:nth-child(1)');
    expect(css).toContain('[data-dossier-sheet-background="forestFlow"]\n  > div:nth-child(2)');
    expect(css).not.toContain('[data-dossier-sheet-background="forestFlow"]\n  > div:nth-child(3)');
    expect(chromePolicy).toContain(
      '[data-dossier-sheet-background="forestFlow"] > div:nth-child(3)',
    );
  });

  test("Forest Flow CV is a quiet vertical-grove family and does not force layout", () => {
    expect(css).toContain('[data-dossier-document="cv"]');
    expect(css).toContain("height: 297mm !important;");
    expect(css).toContain("background: transparent !important;");
    expect(css).toContain("[data-cv-accent]");
    expect(css).not.toContain('data-cv-layout="modern"');
  });

  test("override stylesheet loads in cover/CV and letter render paths", () => {
    expect(freshTemplates).toContain('import "./templatefix-24-25.css";');
    expect(letterBackground).toContain('import "@/components/cover/templatefix-24-25.css";');
  });
});
