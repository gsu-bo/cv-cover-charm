import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierHeaderContentTopMmForOptions,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";

const controls = readFileSync(
  new URL("../../src/components/dossier/DossierChromeControls.tsx", import.meta.url),
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

  test("exposes a 0–40 mm range control in the shared chrome UI", () => {
    expect(controls).toContain("data-dossier-header-gap-control");
    expect(controls).toContain("<span>Freiraum unter dem Header</span>");
    expect(controls).toContain("min={0}");
    expect(controls).toContain("max={40}");
    expect(controls).toContain("headerGapMm: 12");
  });

  test("routes the shared gap through the motivation-letter geometry source of truth", () => {
    expect(letterCanvas).toContain("headerGapMm: chrome.headerGapMm ?? 12");
    expect(letterCanvas).not.toContain("const baseGeometry = letterPageGeometry");
    expect(letterLayout).toContain("context.headerGapMm ?? 0");
    expect(letterLayout).toContain("defaultTop + headerGapMm");
  });
});
