import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cvCss = readFileSync(
  new URL("../../src/components/cv/full-section-rules.css", import.meta.url),
  "utf8",
);
const letterCss = readFileSync(
  new URL("../../src/components/dossier/edel-stationery.css", import.meta.url),
  "utf8",
);
const refinementsCss = readFileSync(
  new URL("../../src/components/dossier/legacy-template-refinements.css", import.meta.url),
  "utf8",
);
const canvas = readFileSync(
  new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url),
  "utf8",
);
const canvasWrapper = readFileSync(
  new URL("../../src/components/cv/CvCanvas.tsx", import.meta.url),
  "utf8",
);

describe("Kolumne contact rail cleanup", () => {
  test("suppresses the legacy Terracotta contact rail in the CV", () => {
    expect(cvCss).toContain('[data-dossier-sheet-background="terracotta"]');
    expect(cvCss).toContain(".left-\\[6mm\\].top-\\[20mm\\].h-\\[38mm\\].w-\\[1px\\]");
    expect(cvCss).toContain("display: none !important;");
  });

  test("suppresses the same rail in the motivation letter", () => {
    expect(letterCss).toContain('[data-letter-background-variant="quiet-column"]');
    expect(letterCss).toContain('[data-dossier-sheet-background="terracotta"]');
    expect(letterCss).toContain('[data-letter-motif="rail-rule"]');
    expect(letterCss).toContain("display: none !important;");
  });

  test("keeps default rubric titles readable on the configurable dark column", () => {
    expect(canvas).toContain('["--cv-sidebar-section-color" as string]: side.accent');
    expect(refinementsCss).toContain("var(--cv-sidebar-section-color, #fff)");
    expect(refinementsCss).toContain(
      '[data-cv-section-title]:not([data-cv-user-section-color="true"])',
    );
  });

  test("lets an explicit full rubric rule override template suppression without changing colour", () => {
    expect(canvas).toContain('data-cv-section="sidebar"');
    expect(canvas).toContain('data-cv-accent="section"');
    expect(canvas).toContain("background: sectionTitleColor || side.accent");

    // The wrapper distinguishes an explicit user choice from an inherited/default
    // full-width rule. Untouched Neon/Glow styling may therefore stay quiet.
    expect(canvasWrapper).toContain(
      'data-cv-user-heading-rule={props.design.headingRule === "full" ? "full" : undefined}',
    );

    // The explicit-user override is route-independent, so preview and hidden PDF
    // canvases use the same rule even when html[data-cv-variant] is unavailable.
    expect(cvCss).toContain(
      '[data-cv-user-heading-rule="full"][data-cv-heading-rule="full"][data-dossier-template]',
    );
    expect(cvCss).toContain("display: block !important;");
    expect(cvCss).toContain("flex: 1 0 4mm !important;");

    // Template defaults remain intact until the user explicitly asks for the rule.
    expect(cvCss).toContain(
      '[data-cv-section="sidebar"]\n  [data-cv-accent="section"],',
    );
    expect(cvCss).toContain(
      'html[data-dossier-template="glow"][data-dossier-template="glow"][data-dossier-template="glow"]\n  [data-dossier-document="cv"]\n  [data-cv-accent="section"]',
    );
  });
});
