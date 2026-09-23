import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cvDefaultContentBox, cvFrameFor } from "../../src/components/cv/archetype";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierHeaderContentTopMmForOptions,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";

const controls = readFileSync(
  new URL("../../src/components/dossier/DossierChromeControls.tsx", import.meta.url),
  "utf8",
);
const cvMargins = readFileSync(
  new URL("../../src/components/cv/CvPageMarginsControl.tsx", import.meta.url),
  "utf8",
);
const letterCanvas = readFileSync(
  new URL("../../src/components/letter/LetterCanvas.tsx", import.meta.url),
  "utf8",
);
const letterLayout = readFileSync(
  new URL("../../src/components/letter/layout-system.ts", import.meta.url),
  "utf8",
);
const cvCanvas = readFileSync(
  new URL("../../src/components/cv/CvCanvas.tsx", import.meta.url),
  "utf8",
);
const cvGeometryContract = readFileSync(
  new URL("../../src/components/cv/content-geometry-contract.css", import.meta.url),
  "utf8",
);

describe("dossier header spacing", () => {
  test("defaults to 12 mm and clamps persisted values to 0–40 mm", () => {
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerGapMm).toBe(12);

    const low = normalizeDossierChromeState({
      shared: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerGapMm: -4 },
    });
    const high = normalizeDossierChromeState({
      shared: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerGapMm: 99 },
    });
    const legacy = normalizeDossierChromeState({
      shared: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerGapMm: undefined },
    });

    expect(low.shared.headerGapMm).toBe(0);
    expect(high.shared.headerGapMm).toBe(40);
    expect(legacy.shared.headerGapMm).toBe(12);
  });

  test("adds the selected whitespace after an enabled header", () => {
    const base = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerGapMm: 0,
    };

    expect(
      dossierHeaderContentTopMmForOptions({ ...base, headerGapMm: 6 }) -
        dossierHeaderContentTopMmForOptions(base),
    ).toBe(6);
    expect(
      dossierHeaderContentTopMmForOptions({ ...base, headerGapMm: 40 }) -
        dossierHeaderContentTopMmForOptions(base),
    ).toBe(40);
  });

  test("moves every formerly overridden CV template by the selected gap", () => {
    const base = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerHeightMm: 22,
      headerGapMm: 0,
    };

    for (const template of [
      "cove",
      "prism",
      "orbit",
      "ledger",
      "studio",
      "warm2",
    ] as const) {
      const frame = cvFrameFor(template);
      const withoutGap = cvDefaultContentBox(frame, 0, "classic", 0.3, base);
      const withGap = cvDefaultContentBox(frame, 0, "classic", 0.3, {
        ...base,
        headerGapMm: 40,
      });
      expect(withGap.top - withoutGap.top).toBe(40);
    }
  });

  test("keeps CV header spacing with page margins and links there from Header & Footer", () => {
    expect(cvMargins).toContain("data-dossier-header-gap-control");
    expect(cvMargins).toContain("Zusätzlicher Abstand nach Header");
    expect(cvMargins).toContain("Wird zusätzlich zum oberen Seitenrand gerechnet.");
    expect(cvMargins).toContain("min={0}");
    expect(cvMargins).toContain("max={40}");

    expect(controls).toContain("data-cv-header-gap-link");
    expect(controls).toContain("Seitenränder &amp; Abstände →");
    expect(controls).toContain("openCvPageSpacing");
    expect(controls).toContain('[data-dossier-page-margins-control=\"cv\"]');
  });

  test("retains the 0–40 mm control in the shared chrome UI for the letter", () => {
    expect(controls).toContain("scope === \"cv\" ?");
    expect(controls).toContain("data-dossier-header-gap-control");
    expect(controls).toContain("<span>Freiraum unter dem Header</span>");
    expect(controls).toContain("headerGapMm: 12");
  });

  test("routes the shared gap through the motivation-letter geometry source of truth", () => {
    expect(letterCanvas).toContain(
      "const geometry = letterPageGeometry(data, effectiveDesign, { chromeOptions: chrome });",
    );
    expect(letterCanvas).not.toContain("const baseGeometry = letterPageGeometry");
    expect(letterLayout).toContain("context.chromeOptions?.headerGapMm ?? context.headerGapMm ?? 0");
    expect(letterLayout).toContain("resolveDossierContentMargins(");
  });

  test("keeps renderer-resolved CV geometry authoritative over every template", () => {
    expect(cvCanvas).toContain('import "./content-geometry-contract.css";');
    expect(cvGeometryContract).toContain('[data-dossier-document="cv"][data-cv-template]');
    expect(cvGeometryContract).toContain(":is([data-cv-page], [data-cv-measure-page])");
    expect(cvGeometryContract).toContain("top: var(--cv-main-top) !important;");
    expect(cvGeometryContract).toContain("bottom: var(--cv-main-bottom) !important;");
  });
});