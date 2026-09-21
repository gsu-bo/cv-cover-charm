import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cvPdfText = readFileSync("src/lib/cv-pdf-text.ts", "utf8");
const dossierPdf = readFileSync("src/lib/dossier-pdf.ts", "utf8");

describe("PDF visible-text ownership", () => {
  test("keeps the CV raster mask inert and native CV text invisible", () => {
    expect(cvPdfText).toContain('style.textContent = ""');
    expect(cvPdfText).toContain('renderingMode: "invisible"');
    expect(cvPdfText).not.toContain('renderingMode: "fill"');
    expect(cvPdfText).not.toContain('textDecorationLine.includes("underline")');
  });

  test("keeps motivation-letter browser glyphs in the raster", () => {
    expect(dossierPdf).not.toContain(
      'text.style.setProperty("visibility", "hidden", "important")',
    );
    expect(dossierPdf).toContain('renderingMode: "invisible"');
  });

  test("does not install a global jsPDF hook that turns invisible text visible", () => {
    expect(cvPdfText).not.toContain("shouldExposeNativeText");
    expect(cvPdfText).not.toContain(
      '(this as unknown as { text: UnknownFn }).text =',
    );
  });

  test("keeps title-page rendering outside this regression fix", () => {
    expect(dossierPdf).toContain("await addRasterPage(pdf, html2canvas, cover);");
    expect(dossierPdf).not.toContain("addCoverTextLayer");
  });
});
