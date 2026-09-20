import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cssZoomAsTransform } from "../../src/lib/html2canvas-export";

const dossierPdf = readFileSync("src/lib/dossier-pdf.ts", "utf8");
const cvRoute = readFileSync("src/routes/lebenslauf.tsx", "utf8");
const coverRoute = readFileSync("src/routes/titelblatt.tsx", "utf8");
const cvDensityCss = readFileSync("src/components/cover/verlauf-pill-fix.css", "utf8");

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

  test("keeps Warm compact without exposing its PDF text to CSS zoom", () => {
    const warmRule = cvDensityCss.match(
      /html\[data-dossier-template="freundlich"\][^{]+\{(?<body>[^}]+)\}/,
    );

    expect(warmRule?.groups?.body).toContain("zoom: 1");
    expect(warmRule?.groups?.body).toContain("transform: scale(0.895)");
    expect(warmRule?.groups?.body).toContain("transform-origin: 0 0");
    expect(warmRule?.groups?.body).not.toContain("zoom: 0.895");
  });
});
