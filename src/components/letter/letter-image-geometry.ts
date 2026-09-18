import type { LetterFlowImage } from "./types";

export type LetterImagePlacement = "left" | "right" | "free";

export type LetterImageGeometry = {
  placement: LetterImagePlacement;
  side: "left" | "right";
  xMm: number;
  topMm: number;
  widthMm: number;
  gapMm: number;
};

export const LETTER_IMAGE_MIN_WIDTH_MM = 16;
export const LETTER_IMAGE_MAX_WIDTH_MM = 78;
export const LETTER_IMAGE_MAX_TOP_MM = 150;
export const LETTER_IMAGE_DEFAULT_WIDTH_MM = 34;
export const LETTER_IMAGE_DEFAULT_TOP_MM = 8;
export const LETTER_IMAGE_DEFAULT_GAP_MM = 4;

const roundMm = (value: number) => Math.round(value * 10) / 10;
export const clampLetterImageValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function letterImagePlacement(image: LetterFlowImage): LetterImagePlacement {
  return typeof image.xMm === "number" && Number.isFinite(image.xMm) ? "free" : image.side;
}

export function normalizeLetterImageGeometry(
  image: LetterFlowImage,
  contentWidthMm: number,
): LetterImageGeometry {
  const widthLimit = Math.max(
    LETTER_IMAGE_MIN_WIDTH_MM,
    Math.min(LETTER_IMAGE_MAX_WIDTH_MM, contentWidthMm - 12),
  );
  const widthMm = clampLetterImageValue(
    Number(image.widthMm) || LETTER_IMAGE_DEFAULT_WIDTH_MM,
    LETTER_IMAGE_MIN_WIDTH_MM,
    widthLimit,
  );
  const maxX = Math.max(0, contentWidthMm - widthMm);
  const placement = letterImagePlacement(image);
  const storedX = typeof image.xMm === "number" && Number.isFinite(image.xMm) ? image.xMm : null;
  const xMm =
    placement === "left"
      ? 0
      : placement === "right"
        ? maxX
        : clampLetterImageValue(storedX ?? maxX, 0, maxX);
  const side = xMm + widthMm / 2 < contentWidthMm / 2 ? "left" : "right";
  const topMm = clampLetterImageValue(
    Number(image.topMm) || 0,
    0,
    LETTER_IMAGE_MAX_TOP_MM,
  );
  const gapMm = clampLetterImageValue(
    Number(image.gapMm) || LETTER_IMAGE_DEFAULT_GAP_MM,
    0,
    12,
  );
  return {
    placement,
    side,
    xMm: roundMm(xMm),
    topMm: roundMm(topMm),
    widthMm: roundMm(widthMm),
    gapMm: roundMm(gapMm),
  };
}

/**
 * Left/right remain text-wrapping placements. Setting a real x-coordinate is
 * the backwards-compatible signal for genuinely free placement.
 */
export function letterImagePlacementPatch(
  image: LetterFlowImage,
  placement: LetterImagePlacement,
  contentWidthMm: number,
): Partial<LetterFlowImage> {
  const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
  if (placement === "left") return { side: "left", xMm: undefined };
  if (placement === "right") return { side: "right", xMm: undefined };
  return {
    side: geometry.side,
    xMm: geometry.xMm,
    topMm: geometry.topMm,
  };
}
