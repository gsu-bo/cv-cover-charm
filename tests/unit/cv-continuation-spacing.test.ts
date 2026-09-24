import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  cvContentBox,
  cvContinuationContentTopMm,
  cvFrameFor,
  cvPageReserves,
} from "../../src/components/cv/archetype";
import {
  CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM,
  CV_CONTINUATION_TOP_MARGIN_MAX_MM,
  CV_CONTINUATION_TOP_MARGIN_MIN_MM,
  normalizeCvContinuationTopMarginMm,
} from "../../src/components/cv/layout";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierHeaderVisualHeightMmForOptions,
} from "../../src/lib/dossier-chrome";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("CV continuation page top margin", () => {
  test("page 2 owns one independent top margin instead of inheriting the page-1 gap", () => {
    const chrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "compact" as const,
      headerDifferentFirstPage: true,
      headerGapMm: 12,
    };
    const frame = cvFrameFor("brief");

    expect(cvPageReserves(chrome, 0).headerGapMm).toBe(12);
    expect(cvPageReserves(chrome, 1).headerGapMm).toBe(0);
    expect(cvContentBox(frame, 1, "classic", undefined, chrome).top).toBe(
      CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM,
    );
  });

  test("allows a true 0 mm start when no continuation header or frame needs protection", () => {
    const chrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "none" as const,
      headerDifferentFirstPage: true,
      headerGapMm: 0,
    };

    expect(cvContinuationContentTopMm(cvFrameFor("brief"), 0, chrome, 1)).toBe(0);
    expect(cvContinuationContentTopMm(cvFrameFor("brief"), 40, chrome, 1)).toBe(40);
  });

  test("allows 0–40 mm while keeping visible continuation chrome protected", () => {
    expect(CV_CONTINUATION_TOP_MARGIN_MIN_MM).toBe(0);
    expect(CV_CONTINUATION_TOP_MARGIN_MAX_MM).toBe(40);
    expect(CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM).toBe(10);
    expect(normalizeCvContinuationTopMarginMm(-4)).toBe(0);
    expect(normalizeCvContinuationTopMarginMm(7.26)).toBe(7.5);
    expect(normalizeCvContinuationTopMarginMm(99)).toBe(40);

    const chrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerDifferentFirstPage: true,
      headerContinuationMode: "contact" as const,
      headerGapMm: 0,
    };
    const headerHeight = dossierHeaderVisualHeightMmForOptions(chrome, 1);
    expect(cvContinuationContentTopMm(cvFrameFor("brief"), 0, chrome, 1)).toBe(headerHeight);
  });

  test("keeps structural card and framed-template interiors as safety floors", () => {
    expect(cvContinuationContentTopMm(cvFrameFor("citrus"), 0)).toBe(23);
    expect(cvContinuationContentTopMm(cvFrameFor("klassisch"), 0)).toBe(17);
  });

  test("exposes one clear page-2 top-margin control and persists it portably", () => {
    const control = read("src/components/cv/CvPageMarginsControl.tsx");
    const portable = read("src/components/cv/portable-state.ts");

    expect(control).toContain("Oberer Rand ab Seite 2");
    expect(control).toContain("data-cv-continuation-top-margin-control");
    expect(control).toContain('scope="cv"');
    expect(control).toContain("Standardrand (10 mm)");
    expect(portable).toContain("continuationTopMarginMm");
    expect(portable).toContain("CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY");
    expect(portable).toContain("continuationGapMm");
  });
});
