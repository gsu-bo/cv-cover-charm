import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  cvContentBox,
  cvDefaultContentBox,
  cvFrameFor,
  cvPageReserves,
  cvSafePageMarginMinimums,
} from "@/components/cv/archetype";
import {
  letterPageGeometry,
  letterSafePageMarginMinimums,
} from "@/components/letter/layout-system";
import { DEMO_LETTER, emptyLetterDesign } from "@/components/letter/types";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "@/lib/dossier-chrome";
import { patchDossierDocxPageMarginsXml } from "@/lib/dossier-docx-page-margins";
import {
  CV_PAGE_MARGIN_BOTTOM_MM,
  DOSSIER_PAGE_MARGIN_HARD_MAX_MM,
  DOSSIER_PAGE_MARGIN_MAX_MM,
  DOSSIER_PAGE_MARGIN_MIN_MM,
  clampDossierPageMarginsToMinimums,
  clearDossierPageMargins,
  normalizeDossierPageMargins,
  normalizeDossierPageMarginsState,
  setDossierPageMargins,
} from "@/lib/dossier-page-margins";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const control = read("src/components/dossier/DossierPageMarginsControl.tsx");
const cvPortal = read("src/components/cv/CvTextAlignmentPortal.tsx");
const cvMargins = read("src/components/cv/CvPageMarginsControl.tsx");
const cvCanvas = read("src/components/cv/CvCanvas.tsx");
const cvCanvasBase = read("src/components/cv/CvCanvasBase.tsx");
const cvLayoutState = read("src/components/cv/layout.ts");
const cvLayoutVariants = read("src/components/cv/layout-variants.css");
const cvLayoutOptions = read("src/components/cv/layout-options.css");
const letterCanvas = read("src/components/letter/LetterCanvas.tsx");
const letterControls = read("src/components/letter/LetterLayoutControls.tsx");
const letterLayout = read("src/components/letter/layout-system.ts");
const letterRoute = read("src/routes/anschreiben.tsx");
const project = read("src/lib/dossier-project.ts");
const docxExport = read("src/lib/dossier-docx-export.ts");
const docxMargins = read("src/lib/dossier-docx-page-margins.ts");
const pageMarginsStore = read("src/lib/dossier-page-margins.ts");

afterEach(() => clearDossierPageMargins());

describe("configurable CV and motivation-letter page margins", () => {
  test("normalizes four safe millimetre values without inventing a default override", () => {
    expect(normalizeDossierPageMargins(null)).toBeNull();
    expect(normalizeDossierPageMargins({ top: 14.24, right: 999, bottom: 4, left: 22.76 })).toEqual(
      {
        top: 14,
        right: DOSSIER_PAGE_MARGIN_MAX_MM,
        bottom: DOSSIER_PAGE_MARGIN_MIN_MM,
        left: 23,
      },
    );
    expect(normalizeDossierPageMarginsState({})).toEqual({});
  });

  test("CV keeps template top/side geometry while the global bottom margin stays at 1 mm", () => {
    const frame = cvFrameFor("klassisch");
    const expected = cvDefaultContentBox(frame, 0, "classic");
    const footerReserveMm = cvPageReserves().footerReserveMm;
    expect(cvContentBox(frame, 0, "classic")).toEqual({
      ...expected,
      bottom: CV_PAGE_MARGIN_BOTTOM_MM + footerReserveMm,
    });
  });

  test("CV renderer owns the resolved page-margin edges while variants stay internal", () => {
    expect(cvCanvas).toContain('"--cv-classic-main-left"');
    expect(cvCanvas).toContain('"--cv-classic-main-right"');
    expect(cvCanvasBase).toContain('left: `${firstBox.left}mm`');
    expect(cvCanvasBase).toContain('right: `${firstBox.right}mm`');
    expect(cvCanvasBase).toContain('left: `${box.left}mm`');
    expect(cvCanvasBase).toContain('right: `${box.right}mm`');
    expect(cvLayoutVariants).not.toContain(
      "left: max(0mm, calc(var(--cv-classic-main-left) - 11mm)) !important;",
    );
    expect(cvLayoutOptions).not.toContain(
      "right: max(0mm, calc(var(--cv-classic-main-right) - 11mm)) !important;",
    );
    expect(cvLayoutVariants).toContain("padding-left: 11mm;");
    expect(cvLayoutOptions).toContain("padding-right: 11mm !important;");
    for (const staleRule of [
      "left: 24mm !important;",
      "left: 30mm !important;",
      "right: 22mm !important;",
    ]) {
      expect(cvLayoutVariants).not.toContain(staleRule);
    }
  });

  test("Luftig keeps Standard's reading direction and adds only moderate measured spacing", () => {
    const airyStart = cvLayoutVariants.indexOf("/* Luftig");
    const timelineStart = cvLayoutVariants.indexOf("/* Timeline", airyStart);
    const airy = cvLayoutVariants.slice(airyStart, timelineStart);

    expect(airy).toContain(":is([data-cv-page], [data-cv-measure-page])");
    expect(airy).toContain("margin-top: 5.2mm !important;");
    expect(airy).toContain("margin-bottom: 2.5mm !important;");
    expect(airy).not.toContain("grid-template-columns");
    expect(airy).not.toContain("text-align: right");
    expect(airy).not.toContain("margin-left");
  });

  test("mirror uses physical geometry, shared state and identical measurement geometry", () => {
    expect(cvLayoutVariants).not.toContain("scaleX(-1)");
    expect(cvCanvasBase).toContain("legacyMirrored: infoMirrored");
    expect(cvCanvasBase).toContain("data-cv-sidebar-side={sidebarPhysicalSide}");
    expect(cvCanvasBase).toContain("left: logicalBox.right, right: logicalBox.left");
    expect(cvLayoutOptions).toContain("left: var(--cv-modern-main-right) !important;");
    expect(cvLayoutOptions).toContain("right: var(--cv-modern-main-left) !important;");
    expect(cvLayoutOptions).toContain(":is([data-cv-page], [data-cv-measure-page])");

    const legacySetter = cvLayoutState.slice(
      cvLayoutState.indexOf("export function setCvLayoutMirror"),
      cvLayoutState.indexOf("export function setCvInfoPosition"),
    );
    const explicitSetter = cvLayoutState.slice(
      cvLayoutState.indexOf("export function setCvInfoPosition"),
      cvLayoutState.indexOf("export function setCvSectionGapMm"),
    );
    expect(legacySetter).toContain("CV_INFO_POSITION_STORAGE_KEY");
    expect(explicitSetter).toContain("MIRROR_STORAGE_KEY");
  });

  test("CV custom margins respect template structure while chrome reserve stays separate", () => {
    clearDossierPageMargins();
    const frame = cvFrameFor("studio");
    const minimums = cvSafePageMarginMinimums(
      frame,
      0,
      "classic",
      undefined,
      DEFAULT_DOSSIER_CHROME_OPTIONS,
    );
    expect(minimums).toEqual({ top: 5, right: 5, bottom: 1, left: 80 });
    expect(
      clampDossierPageMarginsToMinimums({ top: 5, right: 5, bottom: 5, left: 5 }, minimums),
    ).toEqual({ top: 5, right: 5, bottom: 5, left: 80 });

    setDossierPageMargins("cv", { top: 5, right: 5, bottom: 5, left: 5 });
    expect(cvContentBox(frame, 0, "classic", undefined, DEFAULT_DOSSIER_CHROME_OPTIONS)).toEqual({
      top: 21,
      right: 5,
      bottom: 5,
      left: 80,
    });
    clearDossierPageMargins();
  });

  test("card and framed CV templates retain side/top structure but share the 1 mm bottom rule", () => {
    expect(
      cvSafePageMarginMinimums(
        cvFrameFor("citrus"),
        0,
        "classic",
        undefined,
        DEFAULT_DOSSIER_CHROME_OPTIONS,
      ),
    ).toEqual({ top: 5, right: 19, bottom: 1, left: 19 });
    expect(
      cvSafePageMarginMinimums(
        cvFrameFor("klassisch"),
        0,
        "classic",
        undefined,
        DEFAULT_DOSSIER_CHROME_OPTIONS,
      ),
    ).toEqual({ top: 5, right: 15, bottom: 1, left: 15 });
  });

  test("Neon first-page headroom stays shared by default and custom-margin geometry", () => {
    const noChrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "none" as const,
      footerMode: "none" as const,
    };
    const frame = cvFrameFor("neon");

    expect(cvDefaultContentBox(frame, 0, "classic", undefined, noChrome).top).toBe(15);
    expect(cvDefaultContentBox(frame, 1, "classic", undefined, noChrome).top).toBe(23);
    expect(cvSafePageMarginMinimums(frame, 0, "classic", undefined, noChrome).top).toBe(15);
  });

  test("wide structural sidebars clamp custom margins to their safe minimum", () => {
    const minimums = cvSafePageMarginMinimums(
      cvFrameFor("klassisch"),
      0,
      "modern",
      0.5,
      DEFAULT_DOSSIER_CHROME_OPTIONS,
    );
    expect(minimums.left).toBe(113);
    expect(DOSSIER_PAGE_MARGIN_HARD_MAX_MM).toBe(120);
    expect(
      clampDossierPageMarginsToMinimums({ top: 30, right: 20, bottom: 20, left: 110 }, minimums)
        ?.left,
    ).toBe(113);
  });

  test("motivation-letter custom margins compose with header and footer reserve", () => {
    clearDossierPageMargins();
    const design = {
      ...emptyLetterDesign(),
      headerMode: "contact" as const,
      footerMode: "compact" as const,
    };
    const minimums = letterSafePageMarginMinimums(DEMO_LETTER, design);
    expect(minimums).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });

    setDossierPageMargins("letter", { top: 5, right: 5, bottom: 5, left: 5 });
    const content = letterPageGeometry(DEMO_LETTER, design).content;
    expect({
      top: content.top,
      right: content.right,
      bottom: content.bottom,
      left: content.left,
    }).toEqual({ top: 37, right: 5, bottom: 9, left: 5 });
    clearDossierPageMargins();
  });

  test("Warm compact masthead is a shared reserve, not a second page-margin minimum", () => {
    const design = {
      ...emptyLetterDesign(),
      template: "freundlich" as const,
      headerMode: "compact" as const,
    };
    expect(letterSafePageMarginMinimums(DEMO_LETTER, design).top).toBe(5);

    setDossierPageMargins("letter", { top: 5, right: 20, bottom: 10, left: 20 });
    expect(letterPageGeometry(DEMO_LETTER, design).content.top).toBe(57);
    clearDossierPageMargins();
  });

  test("letter controls use pure geometry defaults from current data and chrome", () => {
    expect(letterControls).toContain("data: LetterData");
    expect(letterControls).toContain("letterDefaultPageMargins(data, design, geometryContext)");
    expect(letterControls).toContain("letterSafePageMarginMinimums(data, design, geometryContext)");
    expect(letterControls).toContain("const geometryContext = { chromeOptions }");
    expect(letterControls).not.toContain("currentLetterDefaultMargins");
    expect(letterControls).not.toContain("DEMO_LETTER");
    expect(letterRoute).toContain("<LetterLayoutControls\n                data={data}");
  });

  test("both editors expose the same secondary collapsed control through their current owners", () => {
    expect(control).toContain("<details");
    expect(control).toContain("Seitenränder");
    expect(control).toContain("Vorlage wiederherstellen");
    for (const label of ["Oben", "Rechts", "Unten", "Links"]) expect(control).toContain(label);
    expect(control).toContain("borderLeftColor: accentColor");
    expect(control).toContain('scope === "cv" && key === "bottom"');
    expect(control).toContain("fest auf 1 mm gesetzt");
    expect(cvMargins).toContain("<DossierPageMarginsControl");
    expect(cvMargins).toContain('scope="cv"');
    expect(cvMargins).toContain("minimumMargins={minimumMargins}");
    expect(cvMargins).toContain("defaultMargins={defaultMargins}");
    expect(cvPortal).not.toContain("DossierPageMarginsControl");
    expect(letterControls).toContain('<DossierPageMarginsControl\n        scope="letter"');
    expect(letterControls).toContain("minimumMargins={minimumMargins}");
  });

  test("margin inputs keep a draft while typing and commit on blur or Enter", () => {
    expect(control).toContain("useState");
    expect(control).toContain("value={draft[key]}");
    expect(control).toContain("onBlur={() => commit(key)}");
    expect(control).toContain('event.key === "Enter"');
    expect(control).toContain("event.target.value");
  });

  test("page-margin getters are pure reads; DOM mirroring is explicit", () => {
    const start = pageMarginsStore.indexOf("export function getDossierPageMargins(scope");
    const end = pageMarginsStore.indexOf("\n}\n", start) + 3;
    const getter = pageMarginsStore.slice(start, end);
    expect(getter).toContain("stateFromSnapshot()[scope]");
    expect(getter).not.toContain("applyDossierPageMarginsToDocument");
    expect(control).toContain("applyDossierPageMarginsToDocument();");
  });

  test("the margin override changes content geometry, not template artwork", () => {
    expect(cvCanvas).toContain("subscribeDossierPageMargins");
    expect(letterLayout).toContain('getDossierPageMargins("letter")');
    expect(letterLayout).toContain("letterSafePageMarginMinimums(data, design, context)");
    expect(read("src/components/cv/archetype.ts")).toContain(
      "const box = cvDefaultContentBox(frame, pageIndex, layout, sidebarPct, chrome);",
    );
    expect(letterCanvas).toContain(
      "const geometry = letterPageGeometry(data, effectiveDesign, { chromeOptions: chrome });",
    );
    expect(letterCanvas).not.toContain("const baseGeometry = letterPageGeometry");
    expect(control).not.toContain('import "./page-margins.css"');
  });

  test("letter custom top margin receives the header reserve and configured gap exactly once", () => {
    clearDossierPageMargins();
    const design = { ...emptyLetterDesign(), headerMode: "compact" as const };
    const withoutGap = letterPageGeometry(DEMO_LETTER, design, { headerGapMm: 0 });
    const withTemplateGap = letterPageGeometry(DEMO_LETTER, design, { headerGapMm: 12 });
    expect(withTemplateGap.content.top).toBe(withoutGap.content.top + 12);

    setDossierPageMargins("letter", { top: 30, right: 23, bottom: 17, left: 24 });
    const custom = letterPageGeometry(DEMO_LETTER, design, { headerGapMm: 12 });
    expect(custom.content).toEqual({
      top: 46,
      right: 23,
      bottom: 21,
      left: 24,
      width: 163,
      height: 230,
    });
    clearDossierPageMargins();
  });

  test("CV custom margins receive shared header and footer reserve exactly once", () => {
    clearDossierPageMargins();
    const frame = cvFrameFor("klassisch");
    const chrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerHeightMm: 22,
      headerGapMm: 40,
    };

    setDossierPageMargins("cv", { top: 72, right: 23, bottom: 17, left: 24 });
    expect(cvContentBox(frame, 0, "classic", 0.3, chrome)).toEqual({
      top: 134,
      right: 23,
      bottom: 5,
      left: 24,
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

  test("DOCX patches the final letter/CV sections robustly and leaves every cover section untouched", () => {
    const coverOne =
      '<w:sectPr w:rsidR="cover-a"><w:pgMar w:top="1" w:right="2" w:bottom="3" w:left="4" w:header="454" w:footer="454" w:gutter="0"/></w:sectPr>';
    const coverTwo =
      '<w:sectPr w:rsidR="cover-b"><w:pgMar w:top="5" w:right="6" w:bottom="7" w:left="8"/></w:sectPr>';
    const letter =
      '<w:sectPr w:rsidR="letter"><w:pgMar w:top="9" w:right="10" w:bottom="11" w:left="12" w:header="455" w:footer="456" w:gutter="7"></w:pgMar></w:sectPr>';
    const cv = '<w:sectPr w:rsidR="cv"><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>';
    const source = `${coverOne}${coverTwo}${letter}${cv}`;
    const patched = patchDossierDocxPageMarginsXml(source, {
      letter: { top: 20, right: 21, bottom: 22, left: 23 },
      cv: { top: 24, right: 25, bottom: 26, left: 27 },
    });

    expect(patched).toContain(coverOne);
    expect(patched).toContain(coverTwo);
    expect(patched).toContain('w:rsidR="letter"');
    expect(patched).toContain('w:top="1134"');
    expect(patched).toContain('w:right="1191"');
    expect(patched).toContain('w:bottom="1247"');
    expect(patched).toContain('w:left="1304"');
    expect(patched).toContain('w:header="455" w:footer="456" w:gutter="7"');
    expect(patched).toContain("</w:pgMar>");
    expect(patched).toContain('w:rsidR="cv"><w:pgSz w:w="11906" w:h="16838"/><w:pgMar');
    expect(patched).toContain('w:top="1361"');
    expect(patched).toContain('w:right="1417"');
    expect(patched).toContain('w:bottom="1474"');
    expect(patched).toContain('w:left="1531"');

    const incomplete = `${coverOne}${letter}`;
    expect(
      patchDossierDocxPageMarginsXml(incomplete, {
        letter: { top: 20, right: 21, bottom: 22, left: 23 },
      }),
    ).toBe(incomplete);

    expect(docxMargins).toContain("resolveSafeDossierDocxPageMargins");
    expect(docxMargins).toContain("sectionCount - 2");
    expect(docxMargins).toContain("sectionCount - 1");
    expect(docxMargins).toContain("clampDossierPageMarginsToMinimums(state.letter, minimums)");
    expect(docxMargins).toContain("clampDossierPageMarginsToMinimums(state.cv, minimums)");
    expect(docxMargins).toContain("letterSafePageMarginMinimums");
    expect(docxMargins).toContain("cvSafePageMarginMinimums");
    expect(docxExport).toContain("applyDossierPageMarginsToDocx(hyphenated, letter, cv, {");
  });
});
