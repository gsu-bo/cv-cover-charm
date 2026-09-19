import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CV_PHOTO_PLACEMENT,
  normalizeCvPhotoPlacement,
} from "../../src/components/cv/photo-place";

const layoutCss = readFileSync(
  new URL("../../src/components/cv/layout-options.css", import.meta.url),
  "utf8",
);

describe("CV photo defaults and frame", () => {
  test("fresh CV photo placement defaults to the right while legacy auto stays valid", () => {
    expect(DEFAULT_CV_PHOTO_PLACEMENT.mode).toBe("right");
    expect(normalizeCvPhotoPlacement().mode).toBe("right");
    expect(normalizeCvPhotoPlacement({ mode: "auto" }).mode).toBe("auto");
  });

  test("photo frame is drawn inside the crop so clipped edges stay even", () => {
    expect(layoutCss).toContain("[data-cv-photo]::after");
    expect(layoutCss).toContain("box-shadow: inset 0 0 0 var(--cv-photo-border-width, 0.3mm)");
    expect(layoutCss).toContain("border-radius: inherit");
    expect(layoutCss).toContain('[data-dossier-template="freundlich"]');
  });
});
