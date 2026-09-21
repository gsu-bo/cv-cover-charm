import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../../src/components/cv/layout.ts", import.meta.url), "utf8");
const letter = readFileSync(
  new URL("../../src/components/letter/fresh-letter-system.ts", import.meta.url),
  "utf8",
);
const letterSheet = readFileSync(
  new URL("../../src/components/letter/LetterSheetBackground.tsx", import.meta.url),
  "utf8",
);
const freshCss = readFileSync(
  new URL("../../src/components/cover/fresh-templates.css", import.meta.url),
  "utf8",
);
const coverDefaults = readFileSync(
  new URL("../../src/components/cover/forest-flow-cover-defaults.ts", import.meta.url),
  "utf8",
);
const legacyCss = readFileSync(
  new URL("../../src/components/dossier/legacy-template-refinements.css", import.meta.url),
  "utf8",
);

describe("Fresh dossier rebuild", () => {
  test("unsaved CVs default to Standard with a Sidebar default for Kolumne", () => {
    expect(layout).toContain(
      "const DEFAULT_LAYOUT: CvLayoutId = CANONICAL_DOSSIER_PRESENTATION.cv.layout;",
    );
    expect(layout).toContain('return template === "terracotta" ? "modern" : DEFAULT_LAYOUT;');
    expect(layout).not.toContain('if (template === "terracotta") return "modern";');
    expect(layout).toContain("return valid(saved) ? saved : fallback;");
  });

  test("Kolumne uses the rail instead of accidental horizontal chrome rules", () => {
    expect(letterSheet).toContain('import "@/components/dossier/legacy-template-refinements.css";');
    expect(legacyCss).toContain(
      '[data-letter-page][data-letter-template="terracotta"] [data-dossier-compact-header]',
    );
    expect(legacyCss).toContain(
      '[data-letter-page][data-letter-template="terracotta"] [data-dossier-footer="compact"]',
    );
    expect(legacyCss).toContain("border-bottom: 0 !important;");
    expect(legacyCss).toContain('[data-letter-motif="rail-rule"]');
    expect(legacyCss).toContain("color: var(--cover-ink) !important;");
  });

  test("Edge uses one compact masthead signature across cover, letter and CV", () => {
    const edge = letter.slice(letter.indexOf("  edge: {"), letter.indexOf("  glow: {"));
    expect(edge).toContain('rect("edge-band", 0, 0, 210, 9, "primary")');
    expect(edge).toContain('rect("edge-signal", 0, 0, 4, 9, "secondary")');
    expect(edge).toContain('rect("edge-rule", 25, 15.5, 42, 1.1, "accent"');
    expect(edge).not.toContain('rect("rail"');

    expect(freshCss).toContain("/* 19 EDGE");
    expect(freshCss).toContain('data-dossier-sheet-background="edge"');
    expect(freshCss).toContain("height: 10mm !important;");
    expect(freshCss).toContain("background: transparent !important;");
  });

  test("Edge cover uses a full corner signature and editor-owned content geometry", () => {
    const edgeCss = freshCss.slice(freshCss.indexOf("/* 19 EDGE"), freshCss.indexOf("/* 20 GLOW"));
    expect(edgeCss).toContain("width: 92mm !important;");
    expect(edgeCss).toContain("height: 72mm !important;");
    expect(edgeCss).toContain("clip-path: polygon(");
    expect(edgeCss).not.toContain("width: 52mm !important;");
    expect(edgeCss).not.toContain("translate(-34mm");

    expect(coverDefaults).toContain("const EDGE_COVER_DEFAULTS");
    expect(coverDefaults).toContain("name: {");
    expect(coverDefaults).toContain("x: 20,");
    expect(coverDefaults).toContain("y: 124,");
    expect(coverDefaults).toContain('templateId === "edge"');
  });

  test("Glow is restrained and does not use page-filling blobs or card shadows", () => {
    const glow = letter.slice(letter.indexOf("  glow: {"), letter.indexOf("  monoLuxe: {"));
    expect(glow).toContain("glow-capsule");
    expect(glow).toContain("glow-orb");
    expect(glow).toContain("glow-rule");
    expect(glow).not.toContain("bottom-orb");

    const css = freshCss.slice(freshCss.indexOf("/* 20 GLOW"), freshCss.indexOf("/* 22 MONO LUXE"));
    expect(css).toContain("width: 72mm !important;");
    expect(css).toContain("height: 24mm !important;");
    expect(css).toContain("box-shadow: none !important;");
    expect(css).not.toContain("176mm");
    expect(css).not.toContain("146mm");
  });

  test("Mono Luxe stays typographic and removes the old filled CV card treatment", () => {
    const mono = letter.slice(letter.indexOf("  monoLuxe: {"), letter.indexOf("  horizon: {"));
    expect(mono).toContain("mono-band");
    expect(mono).toContain("mono-gold-rule");
    expect(mono).toContain("mono-mark");

    const css = freshCss.slice(freshCss.indexOf("/* 22 MONO LUXE"));
    expect(css).toContain("font-family: Georgia");
    expect(css).toContain("background: transparent !important;");
    expect(css).toContain("height: 9mm !important;");
  });
});
