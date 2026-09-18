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

export type LetterImageGeometryPatch = Partial<LetterFlowImage> & {
  /**
   * Explicit placement marker for modern saves. Legacy saves did not have this
   * field, so their `side` remains authoritative even when a stale `xMm` exists.
   */
  placement?: LetterImagePlacement;
};

type LetterFlowImageWithPlacement = LetterFlowImage & {
  placement?: LetterImagePlacement;
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

export function letterImageMmPerPx(contentWidthMm: number, pixelWidth: number): number {
  return pixelWidth > 0 ? contentWidthMm / pixelWidth : 0;
}

/**
 * Modern saves carry an explicit placement marker. Older saves may contain an
 * `xMm` that was written while the image still belonged to the left/right text
 * flow. For those legacy objects the saved side wins; `xMm` alone must never
 * silently opt the user into free positioning.
 */
export function letterImagePlacement(image: LetterFlowImage): LetterImagePlacement {
  const placement = (image as LetterFlowImageWithPlacement).placement;
  if (placement === "left" || placement === "right" || placement === "free") {
    return placement;
  }
  return image.side === "left" ? "left" : "right";
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

export function letterImageFreePositionPatch(
  image: LetterFlowImage,
  xMm: number,
  topMm: number,
  contentWidthMm: number,
): LetterImageGeometryPatch {
  const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
  const maxX = Math.max(0, contentWidthMm - geometry.widthMm);
  const nextX = clampLetterImageValue(xMm, 0, maxX);
  const nextTop = clampLetterImageValue(topMm, 0, LETTER_IMAGE_MAX_TOP_MM);
  return {
    placement: "free",
    xMm: roundMm(nextX),
    topMm: roundMm(nextTop),
    side: nextX + geometry.widthMm / 2 < contentWidthMm / 2 ? "left" : "right",
  };
}

export function letterImageResizePatch(
  image: LetterFlowImage,
  deltaMm: number,
  contentWidthMm: number,
): LetterImageGeometryPatch {
  const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
  const direction = geometry.placement === "right" ? -1 : 1;
  const adjustedDelta = deltaMm * direction;
  const available =
    geometry.placement === "free" ? contentWidthMm - geometry.xMm : contentWidthMm;
  const widthMm = clampLetterImageValue(
    geometry.widthMm + adjustedDelta,
    LETTER_IMAGE_MIN_WIDTH_MM,
    Math.min(LETTER_IMAGE_MAX_WIDTH_MM, available),
  );
  return { widthMm: roundMm(widthMm) };
}

/**
 * Left/right remain text-wrapping placements. Free placement is now explicit,
 * so stale legacy x-coordinates cannot accidentally change a saved layout.
 */
export function letterImagePlacementPatch(
  image: LetterFlowImage,
  placement: LetterImagePlacement,
  contentWidthMm: number,
): LetterImageGeometryPatch {
  const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
  if (placement === "left") return { placement: "left", side: "left", xMm: undefined };
  if (placement === "right") return { placement: "right", side: "right", xMm: undefined };
  return {
    placement: "free",
    side: geometry.side,
    xMm: geometry.xMm,
    topMm: geometry.topMm,
  };
}
