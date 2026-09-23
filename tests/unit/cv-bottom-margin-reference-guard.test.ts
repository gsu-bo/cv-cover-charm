import { describe, expect, test } from "bun:test";
import type { TemplateId } from "../../src/components/cover/types";
import {
  cvDefaultPageMargins,
  cvFrameFor,
  cvPageReserves,
  cvSafePageMarginMinimums,
} from "../../src/components/cv/archetype";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import { resolveDossierContentMargins } from "../../src/lib/dossier-page-geometry";
import {
  CV_PAGE_MARGIN_BOTTOM_MM,
  clampDossierPageMarginsToMinimums,
  normalizeDossierPageMarginsState,
} from "../../src/lib/dossier-page-margins";

describe("CV bottom-margin reference guard", () => {
  test("migrates every stored CV bottom margin to 1 mm without changing the letter", () => {
    const state = normalizeDossierPageMarginsState({
      cv: { top: 12, right: 14, bottom: 35, left: 16 },
      letter: { top: 12, right: 14, bottom: 22, left: 16 },
    });

    expect(state.cv).toEqual({ top: 12, right: 14, bottom: 1, left: 16 });
    expect(state.letter).toEqual({ top: 12, right: 14, bottom: 22, left: 16 });
  });

  test("keeps 1 mm as a valid hard CV bottom floor", () => {
    expect(
      clampDossierPageMarginsToMinimums(
        { top: 10, right: 10, bottom: 1, left: 10 },
        { top: 5, right: 5, bottom: 1, left: 5 },
      ),
    ).toEqual({ top: 10, right: 10, bottom: 1, left: 10 });
  });

  test("all CV archetypes override their physical bottom margin to 1 mm", () => {
    const templates: TemplateId[] = ["brief", "studio", "citrus", "klassisch", "edel"];

    for (const template of templates) {
      const frame = cvFrameFor(template);
      expect(
        cvSafePageMarginMinimums(frame, 0, "classic", undefined, DEFAULT_DOSSIER_CHROME_OPTIONS)
          .bottom,
      ).toBe(CV_PAGE_MARGIN_BOTTOM_MM);
      expect(
        cvDefaultPageMargins(frame, 0, "classic", undefined, DEFAULT_DOSSIER_CHROME_OPTIONS)
          .bottom,
      ).toBe(CV_PAGE_MARGIN_BOTTOM_MM);
    }
  });

  test("footer reserve stays separate from the forced 1 mm physical margin", () => {
    const frame = cvFrameFor("brief");
    const margins = cvDefaultPageMargins(
      frame,
      0,
      "classic",
      undefined,
      DEFAULT_DOSSIER_CHROME_OPTIONS,
    );
    const minimums = cvSafePageMarginMinimums(
      frame,
      0,
      "classic",
      undefined,
      DEFAULT_DOSSIER_CHROME_OPTIONS,
    );
    const reserves = cvPageReserves(DEFAULT_DOSSIER_CHROME_OPTIONS, 0);
    const content = resolveDossierContentMargins(margins, minimums, reserves);

    expect(content).not.toBeNull();
    expect(content?.bottom).toBe(CV_PAGE_MARGIN_BOTTOM_MM + reserves.footerReserveMm);
  });
});
