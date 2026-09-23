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
const form = readFileSync(new URL("../../src/components/cv/CvForm.tsx", import.meta.url), "utf8");

describe("CV photo defaults and frame", () => {
  test("fresh CV photo placement is freely adjustable while legacy auto stays valid", () => {
    expect(DEFAULT_CV_PHOTO_PLACEMENT.mode).toBe("frei");
    expect(normalizeCvPhotoPlacement().mode).toBe("frei");
    expect(normalizeCvPhotoPlacement({ mode: "auto" }).mode).toBe("auto");
    expect(form).toContain('setCvPhotoPlacement({ mode: "frei", xMm, yMm: place.yMm })');
    expect(form).not.toContain("Frei platzieren aktivieren");
    expect(form).not.toContain('["left", "Links"]');
    expect(form).not.toContain('["right", "Rechts"]');
  });

  test("photo frame is drawn inside the crop so clipped edges stay even", () => {
    expect(layoutCss).toContain("[data-cv-photo]::after");
    expect(layoutCss).toContain("box-sizing: border-box");
    expect(layoutCss).toContain("border: var(--cv-photo-border-width, 0.3mm) solid");
    expect(layoutCss).not.toContain("box-shadow: inset 0 0 0 var(--cv-photo-border-width, 0.3mm)");
    expect(layoutCss).toContain("border-radius: inherit");
    expect(layoutCss).toContain('[data-dossier-template="freundlich"]');
  });
});
