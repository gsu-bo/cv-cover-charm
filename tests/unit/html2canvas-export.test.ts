import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cssZoomAsTransform } from "../../src/lib/html2canvas-export";

const dossierPdf = readFileSync("src/lib/dossier-pdf.ts", "utf8");
const cvRoute = readFileSync("src/routes/lebenslauf.tsx", "utf8");
const coverRoute = readFileSync("src/routes/titelblatt.tsx", "utf8");
const dossierCanvas = readFileSync("src/components/dossier/DossierPdfCanvas.tsx", "utf8");
const coverCanvas = readFileSync("src/components/cover/CoverCanvas.tsx", "utf8");
const cvCanvas = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");
const html2canvasExport = readFileSync("src/lib/html2canvas-export.ts", "utf8");

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

  test("isolates mixed-template dossier captures from the live html template scope", () => {
    expect(dossierCanvas.match(/manageGlobalTemplateScope=\{false\}/g)?.length).toBe(2);
    expect(coverCanvas).toContain("if (!manageGlobalTemplateScope) return;");
    expect(cvCanvas).toContain("if (!manageGlobalTemplateScope) return;");
    expect(coverCanvas).toContain("data-dossier-template={template}");
    expect(cvCanvas).toContain("data-dossier-template={design.template}");
    expect(dossierCanvas).toContain("data-dossier-template={storedLetter.design.template}");
    expect(html2canvasExport).toContain(
      'root.closest<HTMLElement>("[data-dossier-template]")',
    );
    expect(html2canvasExport).toContain(
      "root.ownerDocument.documentElement.dataset.dossierTemplate = template",
    );
  });
});
