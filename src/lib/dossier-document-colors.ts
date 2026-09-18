export const COVER_DOCUMENT_COLOR_KEYS = ["coverPaper", "coverInk"] as const;
export const CV_DOCUMENT_COLOR_KEYS = ["cvInk", "cvMuted", "cvHeading"] as const;

export type DocumentColorKey =
  | (typeof COVER_DOCUMENT_COLOR_KEYS)[number]
  | (typeof CV_DOCUMENT_COLOR_KEYS)[number];

/**
 * Extract only explicit semantic document colors. Empty strings mean
 * "Automatisch" and therefore must not override the next template.
 */
export function documentColorOverrides(
  colors: Record<string, string> | undefined,
  keys: readonly string[],
): Record<string, string> {
  if (!colors) return {};
  return Object.fromEntries(
    keys
      .map((key) => [key, colors[key]?.trim()] as const)
      .filter((entry): entry is readonly [string, string] => !!entry[1]),
  );
}

/**
 * Template palettes own accents and decorative colors. Semantic document
 * colors are explicit user choices and therefore win when a template changes
 * or its palette is reset.
 */
export function preserveDocumentColors(
  nextTemplateColors: Record<string, string>,
  currentColors: Record<string, string> | undefined,
  keys: readonly string[],
): Record<string, string> {
  return {
    ...nextTemplateColors,
    ...documentColorOverrides(currentColors, keys),
  };
}
