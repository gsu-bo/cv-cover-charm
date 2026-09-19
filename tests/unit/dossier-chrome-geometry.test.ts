import { describe, expect, test } from "bun:test";
import { cvContentBox, cvFrameFor, cvSurface } from "../../src/components/cv/archetype";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierFooterContentBottomMmForOptions,
  dossierHeaderContentTopMmForOptions,
  dossierHeaderVisualHeightMmForOptions,
  normalizeDossierChromeState,
  type DossierChromeOptions,
} from "../../src/lib/dossier-chrome";

// Release guard: CV layout geometry must be reproducible from an explicit chrome snapshot.
const contact: DossierChromeOptions = {
  ...DEFAULT_DOSSIER_CHROME_OPTIONS,
  headerMode: "contact",
  footerMode: "details",
};
const none: DossierChromeOptions = {
  ...DEFAULT_DOSSIER_CHROME_OPTIONS,
  headerMode: "none",
  footerMode: "none",
};

describe("pure dossier chrome geometry", () => {
  test("option helpers need no browser/store state", () => {
    expect(dossierHeaderVisualHeightMmForOptions(contact, 0)).toBe(32);
    expect(dossierHeaderContentTopMmForOptions(contact, 0)).toBe(53);
    expect(dossierHeaderContentTopMmForOptions(none, 0)).toBe(18);
    expect(dossierFooterContentBottomMmForOptions(contact)).toBe(20);
    expect(dossierFooterContentBottomMmForOptions(none)).toBe(10);
  });

  test("CV geometry follows the explicit chrome snapshot", () => {
    const frame = cvFrameFor("modern");
    expect(cvContentBox(frame, 0, "classic", 0.3, contact)).toMatchObject({ top: 53, bottom: 20 });
    expect(cvContentBox(frame, 0, "classic", 0.3, none)).toMatchObject({ top: 18, bottom: 10 });
    expect(cvSurface(frame, 0, "classic", 0.3, contact)).toMatchObject({ top: 32, bottom: 10 });
    expect(cvSurface(frame, 0, "classic", 0.3, none)).toMatchObject({ top: 0, bottom: 0 });
  });

  test("explicit contact height still overrides the 32 mm default", () => {
    expect(dossierHeaderVisualHeightMmForOptions({ ...contact, headerHeightMm: 47 })).toBe(47);
  });

  test("stacked contact headers use the visible slider range through 80 mm", () => {
    const warmTall: DossierChromeOptions = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact",
      headerTextLayout: "stacked",
      headerHeightMm: 80,
      headerGapMm: 4,
    };
    const staleTooSmall: DossierChromeOptions = {
      ...warmTall,
      headerHeightMm: 10,
    };

    expect(dossierHeaderVisualHeightMmForOptions(warmTall)).toBe(80);
    expect(dossierHeaderContentTopMmForOptions(warmTall)).toBe(93);
    expect(cvSurface(cvFrameFor("freundlich"), 0, "classic", 0.3, warmTall).top).toBe(80);
    expect(dossierHeaderVisualHeightMmForOptions(staleTooSmall)).toBe(18);
  });

  test("persisted header heights are normalized to the new 80 mm ceiling", () => {
    const state = normalizeDossierChromeState({
      sync: true,
      shared: {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerHeightMm: 120,
      },
    });

    expect(state.shared.headerHeightMm).toBe(80);
  });
});
