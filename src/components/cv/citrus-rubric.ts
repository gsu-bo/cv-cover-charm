import type { CvDesign } from "./types";

/**
 * Shared CV rubric controls. The historic citrus-prefixed fields remain readable
 * so an explicitly customised older Citrus CV keeps its user choices.
 */
export type CvRubricDesignFields = {
  sectionTitlePill?: boolean;
  sectionTitleOffsetMm?: number;
  sectionContentIndentMm?: number;

  /** Legacy aliases from the former Citrus-only implementation. */
  citrusRubricPill?: boolean;
  citrusRubricOffsetMm?: number;
  citrusContentIndentMm?: number;
};

export type CvRubricPatch = Partial<CvRubricDesignFields>;

type RubricCvDesign = CvDesign & CvRubricDesignFields;

export const CV_RUBRIC_DEFAULTS = {
  pill: false,
  horizontalMm: 0,
  contentIndentMm: 0,
} as const;

export const CV_RUBRIC_OFFSET_MIN_MM = -6;
export const CV_RUBRIC_OFFSET_MAX_MM = 6;
export const CV_CONTENT_INDENT_MIN_MM = 0;
export const CV_CONTENT_INDENT_MAX_MM = 12;

function finiteMm(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function finiteOverride(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function resolveCvRubricOptions(design: CvDesign) {
  const rubric = design as RubricCvDesign;
  const horizontalSource =
    rubric.sectionTitleOffsetMm !== undefined
      ? rubric.sectionTitleOffsetMm
      : rubric.citrusRubricOffsetMm;
  const indentSource =
    rubric.sectionContentIndentMm !== undefined
      ? rubric.sectionContentIndentMm
      : rubric.citrusContentIndentMm;

  return {
    pill:
      typeof rubric.sectionTitlePill === "boolean"
        ? rubric.sectionTitlePill
        : typeof rubric.citrusRubricPill === "boolean"
          ? rubric.citrusRubricPill
          : CV_RUBRIC_DEFAULTS.pill,
    horizontalMm: finiteMm(
      horizontalSource,
      CV_RUBRIC_DEFAULTS.horizontalMm,
      CV_RUBRIC_OFFSET_MIN_MM,
      CV_RUBRIC_OFFSET_MAX_MM,
    ),
    contentIndentMm: finiteMm(
      indentSource,
      CV_RUBRIC_DEFAULTS.contentIndentMm,
      CV_CONTENT_INDENT_MIN_MM,
      CV_CONTENT_INDENT_MAX_MM,
    ),
    horizontalOverride: finiteOverride(horizontalSource),
    contentIndentOverride: finiteOverride(indentSource),
  };
}
