import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cvContentBox, cvDefaultContentBox, cvFrameFor } from "@/components/cv/archetype";
import { letterPageGeometry } from "@/components/letter/layout-system";
import { DEMO_LETTER, emptyLetterDesign } from "@/components/letter/types";
import { patchDossierDocxPageMarginsXml } from "@/lib/dossier-docx-page-margins";
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
const docxExport = read("src/lib/dossier-docx-export.ts");

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

  test("DOCX mirrors only letter and CV margins and leaves the cover section untouched", () => {
    const section = (top: number, right: number, bottom: number, left: number) =>
      `<w:sectPr><w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="454" w:footer="454" w:gutter="0"/></w:sectPr>`;
    const source = `${section(1, 2, 3, 4)}${section(5, 6, 7, 8)}${section(9, 10, 11, 12)}`;
    const patched = patchDossierDocxPageMarginsXml(source, {
      letter: { top: 20, right: 21, bottom: 22, left: 23 },
      cv: { top: 24, right: 25, bottom: 26, left: 27 },
    });

    expect(patched).toContain(section(1, 2, 3, 4));
    expect(patched).toContain('w:top="1134" w:right="1191" w:bottom="1247" w:left="1304"');
    expect(patched).toContain('w:top="1361" w:right="1417" w:bottom="1474" w:left="1531"');
    expect(docxExport).toContain("applyDossierPageMarginsToDocx(hyphenated)");
  });
});
