export const TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;

export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

export function normalizeTextAlignment(
  value: unknown,
  fallback: TextAlignment = "left",
): TextAlignment {
  return typeof value === "string" && (TEXT_ALIGNMENTS as readonly string[]).includes(value)
    ? (value as TextAlignment)
    : fallback;
}
