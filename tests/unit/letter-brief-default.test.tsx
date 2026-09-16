import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LetterCanvas } from "../../src/components/letter/LetterCanvas";
import {
  DEMO_LETTER,
  emptyLetterDesign,
  normalizeLetterDesign,
} from "../../src/components/letter/types";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";

describe("plain letter default", () => {
  test("fresh Brief template renders without shared header or footer chrome", () => {
    const design = emptyLetterDesign();
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
      }),
    );

    expect(design.template).toBe("brief");
    expect(design.headerMode).toBe("none");
    expect(design.footerMode).toBe("none");
    expect(markup).toContain('data-letter-template="brief"');
    expect(markup).toContain('data-letter-header-mode="none"');
    expect(markup).toContain('data-letter-footer-mode="none"');
  });

  test("an un-normalized fresh Brief design cannot re-invent legacy chrome in SSR", () => {
    const design = { ...emptyLetterDesign(), headerMode: undefined, footerMode: undefined };
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
      }),
    );

    expect(markup).toContain('data-letter-header-mode="none"');
    expect(markup).toContain('data-letter-footer-mode="none"');
  });

  test("an explicitly selected shared contact header still renders on the Brief template", () => {
    const design = emptyLetterDesign();
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
