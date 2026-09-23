import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cvDefaultContentBox, cvFrameFor, cvPageReserves } from "../../src/components/cv/archetype";
import {
  CV_CONTINUATION_GAP_DEFAULT_MM,
  CV_CONTINUATION_GAP_MAX_MM,
  CV_CONTINUATION_GAP_MIN_MM,
  normalizeCvContinuationGapMm,
} from "../../src/components/cv/layout";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierHeaderContentTopMmForOptions,
} from "../../src/lib/dossier-chrome";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("CV continuation page spacing", () => {
  test("uses a compact 4 mm default only from page 2 onward", () => {
    const chrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "compact" as const,
      headerDifferentFirstPage: true,
      headerGapMm: 12,
    };
    const frame = cvFrameFor("brief");

    const first = cvDefaultContentBox(frame, 0, "classic", undefined, chrome);
    const continuation = cvDefaultContentBox(frame, 1, "classic", undefined, chrome);

    expect(cvPageReserves(chrome, 0).headerGapMm).toBe(12);
    expect(cvPageReserves(chrome, 1).headerGapMm).toBe(CV_CONTINUATION_GAP_DEFAULT_MM);
    expect(first.top).toBe(dossierHeaderContentTopMmForOptions(chrome, 0));
    expect(continuation.top).toBe(
      dossierHeaderContentTopMmForOptions(
        { ...chrome, headerGapMm: CV_CONTINUATION_GAP_DEFAULT_MM },
        1,
      ),
    );
    expect(continuation.top).toBeLessThan(first.top);
  });

  test("normalizes the visible continuation slider to 0-20 mm", () => {
    expect(CV_CONTINUATION_GAP_MIN_MM).toBe(0);
    expect(CV_CONTINUATION_GAP_MAX_MM).toBe(20);
    expect(normalizeCvContinuationGapMm(-4)).toBe(0);
    expect(normalizeCvContinuationGapMm(7.26)).toBe(7.5);
    expect(normalizeCvContinuationGapMm(99)).toBe(20);
  });

  test("exposes the control only through the CV page-layout owner and persists it portably", () => {
    const control = read("src/components/cv/CvPageMarginsControl.tsx");
    const portable = read("src/components/cv/portable-state.ts");

    expect(control).toContain("Abstand oben ab Seite 2");
    expect(control).toContain("data-cv-continuation-gap-control");
    expect(control).toContain('scope="cv"');
    expect(portable).toContain("continuationGapMm");
    expect(portable).toContain("CV_CONTINUATION_GAP_STORAGE_KEY");
  });
});
