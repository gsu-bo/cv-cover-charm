import type { CvDesign } from "./types";

export type CitrusRubricDesignFields = {
  citrusRubricPill?: boolean;
  citrusRubricOffsetMm?: number;
  citrusContentIndentMm?: number;
};

export type CitrusRubricPatch = Partial<CitrusRubricDesignFields>;

type CitrusCvDesign = CvDesign & CitrusRubricDesignFields;

export const CITRUS_RUBRIC_DEFAULTS = {
  pill: true,
  horizontalMm: 0,
  contentIndentMm: 4,
} as const;

export const CITRUS_RUBRIC_OFFSET_MIN_MM = -6;
export const CITRUS_RUBRIC_OFFSET_MAX_MM = 6;
export const CITRUS_CONTENT_INDENT_MIN_MM = 0;
export const CITRUS_CONTENT_INDENT_MAX_MM = 12;

function finiteMm(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function resolveCitrusRubricOptions(design: CvDesign) {
  const citrus = design as CitrusCvDesign;
  return {
    pill: citrus.citrusRubricPill !== false,
    horizontalMm: finiteMm(
      citrus.citrusRubricOffsetMm,
      CITRUS_RUBRIC_DEFAULTS.horizontalMm,
      CITRUS_RUBRIC_OFFSET_MIN_MM,
      CITRUS_RUBRIC_OFFSET_MAX_MM,
    ),
    contentIndentMm: finiteMm(
      citrus.citrusContentIndentMm,
      CITRUS_RUBRIC_DEFAULTS.contentIndentMm,
      CITRUS_CONTENT_INDENT_MIN_MM,
      CITRUS_CONTENT_INDENT_MAX_MM,
    ),
  };
}
