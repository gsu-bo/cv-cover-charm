import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cssZoomAsTransform } from "../../src/lib/html2canvas-export";

const dossierPdf = readFileSync("src/lib/dossier-pdf.ts", "utf8");
const cvRoute = readFileSync("src/routes/lebenslauf.tsx", "utf8");
const coverRoute = readFileSync("src/routes/titelblatt.tsx", "utf8");

describe("html2canvas CSS zoom normalization", () => {
  test("preserves compact CV zoom as an equivalent transform", () => {
    expect(cssZoomAsTransform(0.895, "none")).toBe("scale(0.895)");
    expect(cssZoomAsTransform(0.9, "matrix(1, 0, 0, 1, 4, 2)")).toBe(
      "scale(0.9) matrix(1, 0, 0, 1, 4, 2)",
    );
  });

  test("normalizes capture clones in combined and standalone PDFs", () => {
    expect(dossierPdf).toContain("normalizeCssZoomForHtml2Canvas(clonedPage");
    expect(cvRoute).toContain("normalizeCssZoomForHtml2Canvas(clonedPage");
    expect(coverRoute).toContain("normalizeCssZoomForHtml2Canvas(clonedPage");
  });
});
