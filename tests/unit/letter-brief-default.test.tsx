import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LetterCanvas } from "../../src/components/letter/LetterCanvas";
import { DEMO_LETTER, emptyLetterDesign, normalizeLetterDesign } from "../../src/components/letter/types";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";

describe("plain letter default", () => {
  test("fresh Brief template renders without a header even before shared chrome is customized", () => {
    const design = emptyLetterDesign();
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
        chromeOptions: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
      }),
    );

    expect(design.template).toBe("brief");
    expect(design.headerMode).toBe("none");
    expect(markup).toContain('data-letter-template="brief"');
    expect(markup).toContain('data-letter-header-mode="none"');
  });

  test("an explicitly selected contact header still renders on the Brief template", () => {
    const design = { ...emptyLetterDesign(), headerMode: "contact" as const };
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
        chromeOptions: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode: "contact" },
      }),
    );

    expect(markup).toContain('data-letter-header-mode="contact"');
  });

  test("legacy saved letters without a header mode keep their historical contact header", () => {
    const normalized = normalizeLetterDesign({ template: "brief", colors: {}, font: "freundlich" });
    expect(normalized.headerMode).toBe("contact");
  });
});
