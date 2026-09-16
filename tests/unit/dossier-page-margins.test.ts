import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cvContentBox, cvDefaultContentBox, cvFrameFor } from "@/components/cv/archetype";
import {
  DOSSIER_PAGE_MARGIN_MAX_MM,
  DOSSIER_PAGE_MARGIN_MIN_MM,
  normalizeDossierPageMargins,
  normalizeDossierPageMarginsState,
} from "@/lib/dossier-page-margins";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const control = read("src/components/dossier/DossierPageMarginsControl.tsx");
const css = read("src/components/dossier/page-margins.css");
const cvPortal = read("src/components/cv/CvTextAlignmentPortal.tsx");
const cvCanvas = read("src/components/cv/CvCanvas.tsx");
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
    expect(css).toContain('[data-letter-page] [data-letter-text-layer]');
    expect(css).toContain("--letter-page-margin-top");
  });

  test("page margins travel with the dossier project without changing v1 compatibility", () => {
    expect(project).toContain("pageMargins?: DossierPageMarginsState");
    expect(project).toContain("readPortableDossierPageMarginsState");
    expect(project).toContain("applyPortableDossierPageMarginsState");
    expect(project).toContain("clearDossierPageMargins");
    expect(project).toContain("DOSSIER_PROJECT_VERSION = 1");
  });
});
