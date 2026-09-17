import { describe, expect, test } from "bun:test";
import { resolveCvInfoPosition } from "../../src/components/cv/layout";
import {
  normalizeCvPhotoPlacement,
  resolveCvPhotoPosition,
} from "../../src/components/cv/photo-place";

describe("Package 1.5 CV top-area state", () => {
  test("explicit photo positions are mutually exclusive and survive normalization", () => {
    expect(normalizeCvPhotoPlacement({ mode: "left" }).mode).toBe("left");
    expect(normalizeCvPhotoPlacement({ mode: "right" }).mode).toBe("right");
    expect(normalizeCvPhotoPlacement({ mode: "frei" }).mode).toBe("frei");
  });

  test("legacy automatic Brief/Standard appearance maps right normally and left mirrored", () => {
    const place = normalizeCvPhotoPlacement({ mode: "auto" });
    expect(
      resolveCvPhotoPosition(place, {
        template: "brief",
        layout: "classic",
        legacyMirrored: false,
      }),
    ).toBe("right");
    expect(
      resolveCvPhotoPosition(place, {
        template: "brief",
        layout: "classic",
        legacyMirrored: true,
      }),
    ).toBe("left");
  });

  test("legacy classic non-Brief and Sidebar mappings preserve their old visual side", () => {
    const place = normalizeCvPhotoPlacement({ mode: "auto" });
    expect(
      resolveCvPhotoPosition(place, {
        template: "freundlich",
        layout: "classic",
        legacyMirrored: false,
      }),
    ).toBe("left");
    expect(
      resolveCvPhotoPosition(place, {
        template: "freundlich",
        layout: "classic",
        legacyMirrored: true,
      }),
    ).toBe("right");
    expect(
      resolveCvPhotoPosition(place, {
        template: "terracotta",
        layout: "modern",
        legacyMirrored: false,
      }),
    ).toBe("left");
    expect(
      resolveCvPhotoPosition(place, {
        template: "terracotta",
        layout: "modern",
        legacyMirrored: true,
      }),
    ).toBe("right");
  });

  test("explicit photo side ignores legacy mirror and free stays free", () => {
    for (const legacyMirrored of [false, true]) {
      expect(
        resolveCvPhotoPosition({ mode: "left" }, {
template: "brief",
          layout: "classic",
          legacyMirrored,
        }),
      ).toBe("left");
      expect(
        resolveCvPhotoPosition({ mode: "right" }, {
          template: "brief",
          layout: "classic",
          legacyMirrored,
        }),
      ).toBe("right");
      expect(
        resolveCvPhotoPosition({ mode: "frei" }, {
          template: "brief",
          layout: "classic",
          legacyMirrored,
        }),
      ).toBe("free");
    }
  });

  test("new info position wins over legacy mirror fallback", () => {
    expect(resolveCvInfoPosition(undefined, false)).toBe("standard");
    expect(resolveCvInfoPosition(undefined, true)).toBe("mirrored");
    expect(resolveCvInfoPosition("standard", true)).toBe("standard");
    expect(resolveCvInfoPosition("mirrored", false)).toBe("mirrored");
  });
});
