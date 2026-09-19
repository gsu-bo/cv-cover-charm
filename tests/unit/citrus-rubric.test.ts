import { describe, expect, test } from "bun:test";
import {
  CITRUS_CONTENT_INDENT_MAX_MM,
  CITRUS_RUBRIC_DEFAULTS,
  CITRUS_RUBRIC_OFFSET_MAX_MM,
  CITRUS_RUBRIC_OFFSET_MIN_MM,
  resolveCitrusRubricOptions,
} from "../../src/components/cv/citrus-rubric";
import type { CvDesign } from "../../src/components/cv/types";

const baseDesign: CvDesign = {
  template: "citrus",
  colors: {},
  bgOpacity: 0.25,
  useElements: false,
};

describe("Citrus rubric options", () => {
  test("legacy design without Citrus fields resolves to safe Citrus defaults", () => {
    expect(resolveCitrusRubricOptions(baseDesign)).toEqual(CITRUS_RUBRIC_DEFAULTS);
  });

  test("explicit values are preserved and malformed/out-of-range values are clamped", () => {
    expect(
      resolveCitrusRubricOptions({
        ...baseDesign,
        citrusRubricPill: false,
        citrusRubricOffsetMm: 5,
        citrusContentIndentMm: 10,
      } as CvDesign),
    ).toEqual({ pill: false, horizontalMm: 5, contentIndentMm: 10 });

    expect(
      resolveCitrusRubricOptions({
        ...baseDesign,
        citrusRubricOffsetMm: 999,
        citrusContentIndentMm: 999,
      } as CvDesign),
    ).toEqual({
      pill: true,
      horizontalMm: CITRUS_RUBRIC_OFFSET_MAX_MM,
      contentIndentMm: CITRUS_CONTENT_INDENT_MAX_MM,
    });

    expect(
      resolveCitrusRubricOptions({
        ...baseDesign,
        citrusRubricOffsetMm: -999,
        citrusContentIndentMm: Number.NaN,
      } as CvDesign),
    ).toEqual({
      pill: true,
      horizontalMm: CITRUS_RUBRIC_OFFSET_MIN_MM,
      contentIndentMm: CITRUS_RUBRIC_DEFAULTS.contentIndentMm,
    });
  });
});
