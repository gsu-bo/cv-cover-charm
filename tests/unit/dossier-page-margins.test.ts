import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cvContentBox, cvDefaultContentBox, cvFrameFor } from "@/components/cv/archetype";
import { letterPageGeometry } from "@/components/letter/layout-system";
import { DEMO_LETTER, emptyLetterDesign } from "@/components/letter/types";
import {
  DOSSIER_PAGE_MARGIN_MAX_MM,
  DOSSIER_PAGE_MARGIN_MIN_MM,
  clearDossierPageMargins,
  normalizeDossierPageMargins,
  normalizeDossierPageMarginsState,
  setDossierPageMargins,
} from "@/lib/dossier-page-margins";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const control = read("src/components/dossier/DossierPageMarginsControl.tsx");
const css = read("src/components/dossier/page-margins.css");
const cvPortal = read("src/components/cv/CvTextAlignmentPortal.tsx");
const cvCanvas = read("src/components/cv/CvCanvas.tsx");
const letterCanvas = read("src/components/letter/LetterCanvas.tsx");
const letterControls = read("src/components/letter/LetterLayoutControls.tsx");
const letterLayout = read("src/components/letter/layout-system.ts");
const project = read("src/lib/dossier-project.ts");

describe("configurable CV and motivation-letter page margins", () => {
  test("normalizes four safe millimetre values without inventing a default override", () => {
    expect(normalizeDossierPageMargins(null)).toBeNull();
    expect(normalizeDossierPageMargins({ top: 14.24, right: 999, bottom: 4, left: 22.76 })).toEqual({
      top: 14,
      right: DOSSIER_PAGE_MARGIN_MAX_MM,
      bottom: DOSSIER_PAGE_MARGIN_MIN_MM,
      left: 23,
    });
    expect(normalizeDossierPageMarginsState({})).toEqual({});
  });

  test("CV keeps the exact template geometry while no custom margin exists", () => {
    const frame = cvFrameFor("klassisch");
    const expected = cvDefaultContentBox(frame, 0, "classic");
    expect(cvContentBox(frame, 0, "classic")).toEqual(expected);
  });

  test("both editors expose the same secondary collapsed control", () => {
    expect(control).toContain("<details");
    expect(control).toContain("Seitenränder");
    expect(control).toContain("Vorlage wiederherstellen");
    for (const label of ["Oben", "Rechts", "Unten", "Links"]) expect(control).toContain(label);
    expect(control).toContain("borderLeftColor: accentColor");
    expect(cvPortal).toContain('<DossierPageMarginsControl\n          scope="cv"');
    expect(letterControls).toContain('<DossierPageMarginsControl\n        scope="letter"');
  });

  test("the margin override changes content geometry, not template artwork", () => {
    expect(cvCanvas).toContain("subscribeDossierPageMargins");
    expect(letterLayout).toContain('getDossierPageMargins("letter")');
    expect(read("src/components/cv/archetype.ts")).toContain(
      "const box = cvDefaultContentBox(frame, pageIndex, layout, sidebarPct, chrome);",
    );
    expect(letterCanvas).toContain("const geometry = letterPageGeometry(data, effectiveDesign, {");
    expect(letterCanvas).not.toContain("const baseGeometry = letterPageGeometry");
    expect(control).not.toContain('import "./page-margins.css"');
    expect(css).not.toContain('[data-letter-page] [data-letter-text-layer]');
    expect(css).not.toContain("!important");
  });

  test("letter custom top margin is final and never receives the header gap twice", () => {
    clearDossierPageMargins();
    const design = { ...emptyLetterDesign(), headerMode: "compact" as const };
    const withoutGap = letterPageGeometry(DEMO_LETTER, design, { headerGapMm: 0 });
    const withTemplateGap = letterPageGeometry(DEMO_LETTER, design, { headerGapMm: 12 });
    expect(withTemplateGap.content.top).toBe(withoutGap.content.top + 12);

    setDossierPageMargins("letter", { top: 30, right: 23, bottom: 17, left: 24 });
    const custom = letterPageGeometry(DEMO_LETTER, design, { headerGapMm: 12 });
    expect(custom.content).toEqual({
      top: 30,
      right: 23,
      bottom: 17,
      left: 24,
      width: 163,
      height: 250,
    });
    clearDossierPageMargins();
  });

  test("page margins travel with the dossier project without changing v1 compatibility", () => {
    expect(project).toContain("pageMargins?: DossierPageMarginsState");
    expect(project).toContain("readPortableDossierPageMarginsState");
    expect(project).toContain("applyPortableDossierPageMarginsState");
    expect(project).toContain("clearDossierPageMargins");
    expect(project).toContain("DOSSIER_PROJECT_VERSION = 1");
  });
});
