import { describe, expect, test } from "bun:test";
import {
  letterImagePlacementPatch,
  normalizeLetterImageGeometry,
} from "../../src/components/letter/letter-image-geometry";
import type { LetterFlowImage } from "../../src/components/letter/types";

const image = (patch: Partial<LetterFlowImage> = {}): LetterFlowImage => ({
  id: "img-1",
  src: "data:image/png;base64,AA==",
  side: "right",
  topMm: 8,
  widthMm: 34,
  gapMm: 4,
  ...patch,
});

describe("letter image geometry", () => {
  test("keeps legacy left/right saves in text-flow mode", () => {
    expect(normalizeLetterImageGeometry(image({ side: "left" }), 160)).toMatchObject({
      placement: "left",
      side: "left",
      xMm: 0,
      widthMm: 34,
    });
    expect(normalizeLetterImageGeometry(image({ side: "right" }), 160)).toMatchObject({
      placement: "right",
      side: "right",
      xMm: 126,
      widthMm: 34,
    });
  });

  test("treats an explicit x-coordinate as truly free placement", () => {
    expect(normalizeLetterImageGeometry(image({ xMm: 61.4, topMm: 27.8 }), 160)).toMatchObject({
      placement: "free",
      xMm: 61.4,
      topMm: 27.8,
      widthMm: 34,
    });
  });

  test("switching back to left or right clears the free-position signal", () => {
    const current = image({ xMm: 52, topMm: 31 });
    expect(letterImagePlacementPatch(current, "left", 160)).toEqual({
      side: "left",
      xMm: undefined,
    });
    expect(letterImagePlacementPatch(current, "right", 160)).toEqual({
      side: "right",
      xMm: undefined,
    });
  });
});
