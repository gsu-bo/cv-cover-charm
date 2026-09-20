import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const layoutVariants = read("src/components/cv/layout-variants.css");
const layoutOptions = read("src/components/cv/layout-options.css");
const paginationDensity = read("src/components/cv/default-pagination-density.css");
const cvGeometryContract = read("src/components/cv/content-geometry-contract.css");
const titleOverride = read("src/components/cv/document-title-user-override.css");
const letterCanvas = read("src/components/letter/LetterCanvas.tsx");

describe("Package 4 dossier content geometry ownership", () => {
  test("layout variants no longer expand the outer CV content box with magic offsets", () => {
    expect(layoutVariants).not.toContain(
      "left: max(0mm, calc(var(--cv-classic-main-left) - 11mm)) !important;",
    );
    expect(layoutVariants).not.toContain("left: 69mm !important;");
    expect(layoutVariants).not.toContain("right: 19mm !important;");
    expect(layoutOptions).not.toContain(
      "right: max(0mm, calc(var(--cv-classic-main-right) - 11mm)) !important;",
    );
  });

  test("Citrus no longer reclaims page-level space above Package 3 geometry", () => {
    expect(paginationDensity).not.toContain(
      "top: max(14mm, calc(var(--cv-main-top) - 9mm)) !important;",
    );
  });

  test("Package 3 remains the vertical CV page authority", () => {
    expect(cvGeometryContract).toContain("top: var(--cv-main-top) !important;");
    expect(cvGeometryContract).toContain("bottom: var(--cv-main-bottom) !important;");
  });

  test("document-title top spacing stays local inside the resolved CV box", () => {
    expect(titleOverride).toContain("margin-top: var(--cv-doc-title-margin-top, 0px) !important;");
  });

  test("Letter outer geometry stays owned by letterPageGeometry while recipient offset stays local", () => {
    expect(letterCanvas).toContain("const geometry = letterPageGeometry(data, effectiveDesign");
    expect(letterCanvas).toContain('left: `${geometry.content.left}mm`');
    expect(letterCanvas).toContain('right: `${geometry.content.right}mm`');
    expect(letterCanvas).toContain('top: `${geometry.content.top}mm`');
    expect(letterCanvas).toContain('bottom: `${geometry.content.bottom}mm`');
    expect(letterCanvas).toContain("chrome.letterRecipientOffsetYMm ?? 0");
  });
});
