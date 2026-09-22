import { describe, expect, test } from "bun:test";
import { resolveCvPdfSelectionGeometry } from "../../src/lib/cv-pdf-text";

const MM_PER_PT = 25.4 / 72;

describe("CV PDF selection geometry", () => {
  test("uses the browser Range height instead of the CSS font-size guess", () => {
    const topMm = 42.5;
    const rectHeightPx = 18;
    const mmY = 297 / 1122;
    const ascentRatio = 0.93;

    const geometry = resolveCvPdfSelectionGeometry(
      topMm,
      rectHeightPx,
      mmY,
      10.5,
      ascentRatio,
    );
    const expectedHeightMm = rectHeightPx * mmY;

    expect(geometry.fontSizePt * MM_PER_PT).toBeCloseTo(expectedHeightMm, 8);
    expect(geometry.baselineMm).toBeCloseTo(
      topMm + expectedHeightMm * ascentRatio,
      8,
    );
  });

  test("keeps a safe fallback when a DOM rectangle cannot be measured", () => {
    const geometry = resolveCvPdfSelectionGeometry(20, 0, 0, 12, Number.NaN);

    expect(geometry.fontSizePt).toBe(12);
    expect(geometry.baselineMm).toBeCloseTo(20 + 12 * MM_PER_PT * 0.8, 8);
  });
});
