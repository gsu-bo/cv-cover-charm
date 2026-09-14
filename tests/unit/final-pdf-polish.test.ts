import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../src/components/cover/final-pdf-polish.css", import.meta.url),
  "utf8",
);
const loader = readFileSync(
  new URL("../../src/components/cover/fresh-templates.ts", import.meta.url),
  "utf8",
);

describe("final 39-PDF visual polish", () => {
  test("loads the final polish after the established template systems", () => {
    expect(loader).toContain('import "./final-pdf-polish.css";');
    expect(loader.indexOf('import "./final-pdf-polish.css";')).toBeGreaterThan(
      loader.indexOf('import "./dossier-font-contract.css";'),
    );
  });

  test("keeps Horizon contact rows on a full-height colour surface", () => {
    expect(css).toContain(
      '[data-letter-page][data-letter-template="horizon"][data-letter-header-mode="contact"]',
    );
    expect(css).toContain('[data-dossier-sheet-background="horizon"]');
    expect(css).toContain("height: 22mm !important;");
  });

  test("insets Gallery place text without overriding the positioned outer block", () => {
    expect(css).toContain('html[data-dossier-template="gallery"]');
    expect(css).toContain('[data-block-id="ortDatum"]');
    expect(css).toContain("padding-left: 3mm !important;");
    expect(css).not.toContain("transform: translate(24mm, 22mm) !important;");
  });

  test("restores Ribbon hero height for its complete identity stack", () => {
    expect(css).toContain('html[data-dossier-template="ribbon"]');
    expect(css).toContain("top: 28mm !important;");
    expect(css).toContain("height: 58mm !important;");
    expect(css).toContain("border-radius: 0 29mm 29mm 0 !important;");
  });

  test("uses live dossier ink for 34-38 CV headings without defeating user colour", () => {
    for (const template of ["prism", "gallery", "orbit", "ribbon", "cove"]) {
      expect(css).toContain(`[data-dossier-template="${template}"]`);
    }
    expect(css).toContain('[data-dossier-document="cv"]');
    expect(css).toContain(':not([data-cv-user-section-color="true"])');
    expect(css).toContain("color: var(--cover-ink, #1f2937) !important;");
    expect(css).toContain(
      "-webkit-text-fill-color: var(--cover-ink, #1f2937) !important;",
    );
    expect(css).not.toContain("#0000FF");
  });
});
