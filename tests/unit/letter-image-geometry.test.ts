import { describe, expect, test } from "bun:test";
import {
  letterImageFreePositionPatch,
  letterImageMmPerPx,
  letterImagePlacementPatch,
  letterImageResizePatch,
  normalizeLetterImageGeometry,
  type LetterImageGeometryPatch,
} from "../../src/components/letter/letter-image-geometry";
import type { LetterFlowImage } from "../../src/components/letter/types";

const image = (
  patch: Partial<LetterFlowImage> & { placement?: "left" | "right" | "free" } = {},
): LetterFlowImage =>
  ({
    id: "img-1",
    src: "data:image/png;base64,AA==",
    side: "right",
    topMm: 8,
    widthMm: 34,
    gapMm: 4,
    ...patch,
  }) as LetterFlowImage;

function withPatch(current: LetterFlowImage, patch: LetterImageGeometryPatch): LetterFlowImage {
  return { ...current, ...patch } as LetterFlowImage;
}

describe("letter image geometry", () => {
  test("keeps legacy left/right saves in text-flow mode even when stale xMm exists", () => {
    expect(normalizeLetterImageGeometry(image({ side: "left", xMm: 42 }), 160)).toMatchObject({
      placement: "left",
      side: "left",
      xMm: 0,
      widthMm: 34,
    });
    expect(normalizeLetterImageGeometry(image({ side: "right", xMm: 18 }), 160)).toMatchObject({
      placement: "right",
      side: "right",
      xMm: 126,
      widthMm: 34,
    });
  });

  test("uses explicit modern placement for true free coordinates", () => {
    expect(
      normalizeLetterImageGeometry(
        image({ placement: "free", xMm: 61.4, topMm: 27.8 }),
        160,
      ),
    ).toMatchObject({
      placement: "free",
      xMm: 61.4,
      topMm: 27.8,
      widthMm: 34,
    });
  });

  test("switching between flow and free placement clears stale coordinates deterministically", () => {
    const right = image({ placement: "right", side: "right" });
    const free = letterImagePlacementPatch(right, "free", 160);
    expect(free).toMatchObject({ placement: "free", side: "right", xMm: 126 });

    const freeImage = withPatch(right, free);
    expect(letterImagePlacementPatch(freeImage, "left", 160)).toEqual({
      placement: "left",
      side: "left",
      xMm: undefined,
    });
    expect(letterImagePlacementPatch(freeImage, "right", 160)).toEqual({
      placement: "right",
      side: "right",
      xMm: undefined,
    });
  });

  test("free dragging is clamped to the letter content box and updates the semantic side", () => {
    const current = image({ placement: "free", xMm: 40, topMm: 20, widthMm: 34 });
    expect(letterImageFreePositionPatch(current, -20, -8, 160)).toMatchObject({
      placement: "free",
      xMm: 0,
      topMm: 0,
      side: "left",
    });
    expect(letterImageFreePositionPatch(current, 999, 999, 160)).toMatchObject({
      placement: "free",
      xMm: 126,
      topMm: 150,
      side: "right",
    });
  });

  test("free and flow resizing share the same width bounds", () => {
    const free = image({ placement: "free", xMm: 100, widthMm: 34 });
    expect(letterImageResizePatch(free, 100, 160)).toEqual({ widthMm: 60 });
    expect(letterImageResizePatch(free, -100, 160)).toEqual({ widthMm: 16 });

    const right = image({ placement: "right", side: "right", widthMm: 34 });
    expect(letterImageResizePatch(right, 10, 160)).toEqual({ widthMm: 24 });
    expect(letterImageResizePatch(right, -100, 160)).toEqual({ widthMm: 78 });
  });

  test("pixel conversion is based only on the measured letter content-box width", () => {
    expect(letterImageMmPerPx(160, 800)).toBe(0.2);
    expect(letterImageMmPerPx(160, 400)).toBe(0.4);
    expect(letterImageMmPerPx(160, 0)).toBe(0);
  });

  test("explicit free placement survives a JSON roundtrip", () => {
    const current = withPatch(
      image({ placement: "right", side: "right" }),
      letterImageFreePositionPatch(image({ placement: "right", side: "right" }), 52.3, 31.7, 160),
    );
    const restored = JSON.parse(JSON.stringify(current)) as LetterFlowImage;
    expect(normalizeLetterImageGeometry(restored, 160)).toMatchObject({
      placement: "free",
      xMm: 52.3,
      topMm: 31.7,
    });
  });
});
