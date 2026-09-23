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

  test("keeps rubric separator lines visible in every configurable sidebar", () => {
    expect(canvas).toContain('data-cv-section="sidebar"');
    expect(canvas).toContain('data-cv-accent="section"');

    // The central rule must also work in PDF/export contexts where route-level
    // html markers such as data-cv-variant may be absent.
    expect(cvCss).toContain(
      '[data-dossier-document="cv"][data-dossier-document="cv"][data-dossier-document="cv"]\n  [data-cv-accent="section"]',
    );
    expect(cvCss).toContain("display: block !important;");
    expect(cvCss).toContain("flex: 1 0 4mm !important;");

    // Templates may hide decorative header dashes, never actual rubric rules.
    expect(cvCss).not.toContain(
      '[data-cv-section="sidebar"]\n  [data-cv-accent="section"],',
    );
    expect(cvCss).not.toContain(
      'html[data-dossier-template="glow"][data-dossier-template="glow"][data-dossier-template="glow"]\n  [data-dossier-document="cv"]\n  [data-cv-accent="section"]',
    );
  });
});
