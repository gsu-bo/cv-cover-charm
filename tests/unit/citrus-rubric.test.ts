import { describe, expect, test } from "bun:test";
import {
  CV_CONTENT_INDENT_MAX_MM,
  CV_RUBRIC_DEFAULTS,
  CV_RUBRIC_OFFSET_MAX_MM,
  CV_RUBRIC_OFFSET_MIN_MM,
  resolveCvRubricOptions,
} from "../../src/components/cv/citrus-rubric";
import type { CvDesign } from "../../src/components/cv/types";
import { cvPdfDocumentFromSaved } from "../../src/lib/dossier-pdf-document";

const baseDesign: CvDesign = {
  template: "verlauf",
  colors: {},
  bgOpacity: 0.25,
  useElements: false,
};

describe("shared CV rubric options", () => {
  test("an untouched CV resolves to neutral defaults", () => {
    expect(resolveCvRubricOptions(baseDesign)).toEqual({
      ...CV_RUBRIC_DEFAULTS,
      horizontalOverride: false,
      contentIndentOverride: false,
    });
  });

  test("generic values are preserved and malformed/out-of-range values are clamped", () => {
    expect(
      resolveCvRubricOptions({
        ...baseDesign,
        sectionTitlePill: true,
        sectionTitleOffsetMm: 5,
        sectionContentIndentMm: 10,
      } as CvDesign),
    ).toEqual({
      pill: true,
      horizontalMm: 5,
      contentIndentMm: 10,
      horizontalOverride: true,
      contentIndentOverride: true,
    });

    expect(
      resolveCvRubricOptions({
        ...baseDesign,
        sectionTitleOffsetMm: 999,
        sectionContentIndentMm: 999,
      } as CvDesign),
    ).toEqual({
      pill: false,
      horizontalMm: CV_RUBRIC_OFFSET_MAX_MM,
      contentIndentMm: CV_CONTENT_INDENT_MAX_MM,
      horizontalOverride: true,
      contentIndentOverride: true,
    });

    expect(
      resolveCvRubricOptions({
        ...baseDesign,
        sectionTitleOffsetMm: -999,
        sectionContentIndentMm: Number.NaN,
      } as CvDesign),
    ).toEqual({
      pill: false,
      horizontalMm: CV_RUBRIC_OFFSET_MIN_MM,
      contentIndentMm: CV_RUBRIC_DEFAULTS.contentIndentMm,
      horizontalOverride: true,
      contentIndentOverride: false,
    });
  });

  test("explicit values from older Citrus saves remain readable", () => {
    expect(
      resolveCvRubricOptions({
        ...baseDesign,
        template: "citrus",
        citrusRubricPill: true,
        citrusRubricOffsetMm: -3,
        citrusContentIndentMm: 7,
      } as CvDesign),
    ).toEqual({
      pill: true,
      horizontalMm: -3,
      contentIndentMm: 7,
      horizontalOverride: true,
      contentIndentOverride: true,
    });
  });

  test("stored generic and legacy rubric settings survive the dossier export adapter", () => {
    const generic = cvPdfDocumentFromSaved({
      data: {},
      design: {
        ...baseDesign,
        sectionTitlePill: true,
        sectionTitleOffsetMm: 5,
        sectionContentIndentMm: 10,
      },
    });
    expect(resolveCvRubricOptions(generic!.design)).toMatchObject({
      pill: true,
      horizontalMm: 5,
      contentIndentMm: 10,
    });

    const legacy = cvPdfDocumentFromSaved({
      data: {},
      design: {
        ...baseDesign,
        template: "citrus",
        citrusRubricPill: true,
        citrusRubricOffsetMm: -3,
        citrusContentIndentMm: 7,
      },
    });
    expect(resolveCvRubricOptions(legacy!.design)).toMatchObject({
      pill: true,
      horizontalMm: -3,
      contentIndentMm: 7,
    });
  });
});
