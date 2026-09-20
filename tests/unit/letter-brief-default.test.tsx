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
  test("fresh Brief template renders the shared compact header and footer", () => {
    const design = emptyLetterDesign();
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
      }),
    );

    expect(design.template).toBe("brief");
    expect(design.headerMode).toBe("compact");
    expect(design.footerMode).toBe("compact");
    expect(markup).toContain('data-letter-template="brief"');
    expect(markup).toContain('data-letter-header-mode="compact"');
    expect(markup).toContain('data-letter-footer-mode="compact"');
  });

  test("an un-normalized fresh Brief design keeps the compact canonical chrome in SSR", () => {
    const design = { ...emptyLetterDesign(), headerMode: undefined, footerMode: undefined };
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
      }),
    );

    expect(markup).toContain('data-letter-header-mode="compact"');
    expect(markup).toContain('data-letter-footer-mode="compact"');
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

  test("missing saved modes inherit Brief while explicit legacy settings remain supported", () => {
    const normalized = normalizeLetterDesign({ template: "brief", colors: {}, font: "freundlich" });
    expect(normalized.headerMode).toBe("compact");
    expect(
      normalizeLetterDesign({ template: "brief", headerMode: "contact", footerMode: "compact" })
        .headerMode,
    ).toBe("contact");
  });
});
