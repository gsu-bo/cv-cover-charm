import { describe, expect, test } from "bun:test";
import { clampBlockDragPosition } from "../../src/components/cover/drag-bounds";

describe("cover decoration drag bounds", () => {
  test("keeps ordinary content completely inside the A4 page", () => {
    expect(
      clampBlockDragPosition({
        id: "name",
        x: -25,
        y: 280,
        width: 80,
        height: 30,
      }),
    ).toEqual({ x: 0, y: 267 });
  });

  test("allows a decoration to be dragged halfway beyond every paper edge", () => {
    expect(
      clampBlockDragPosition({
        id: "decor-small-circle",
        x: -25,
        y: 60,
        width: 80,
        height: 80,
      }),
    ).toEqual({ x: -25, y: 60 });

    expect(
      clampBlockDragPosition({
        id: "decor-small-circle",
        x: -500,
        y: 500,
        width: 80,
        height: 80,
      }),
    ).toEqual({ x: -40, y: 257 });
  });

  test("preserves the intentional overflow of the friendly template circles", () => {
    expect(
      clampBlockDragPosition({
        id: "decor-large-circle",
        x: 90,
        y: -40,
        width: 160,
        height: 160,
      }),
    ).toEqual({ x: 90, y: -40 });
  });
});
