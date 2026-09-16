export const TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export const BODY_TEXT_ALIGNMENTS = ["left", "justify"] as const;

export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];
export type BodyTextAlignment = (typeof BODY_TEXT_ALIGNMENTS)[number];

export function isBodyTextAlignment(value: unknown): value is BodyTextAlignment {
  return typeof value === "string" &&
    (BODY_TEXT_ALIGNMENTS as readonly string[]).includes(value);
}

export function normalizeTextAlignment(
  value: unknown,
  fallback: TextAlignment = "left",
): TextAlignment {
  return typeof value === "string" && (TEXT_ALIGNMENTS as readonly string[]).includes(value)
    ? (value as TextAlignment)
    : fallback;
}
