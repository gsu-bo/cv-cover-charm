import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import {
  EMPTY_LETTER,
  emptyLetterDesign,
  normalizeLetterDesign,
} from "../../src/components/letter/types";
import { letterPageGeometry } from "../../src/components/letter/layout-system";
import {
  CANONICAL_DOSSIER_CHROME_OPTIONS,
  dossierHeaderVisualHeightMmForOptions,
  effectiveDossierHeaderModeForOptions,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";
import {
  defaultFooterModeForTemplate,
  defaultHeaderModeForTemplate,
  resolveTemplateChromeOptions,
} from "../../src/lib/template-chrome";

const contact = {
  name: "Header Name",
  address: "Header Street",
  place: "Header Place",
  phone: "Header Phone",
  email: "header@example.ch",
};

describe("header/footer semantic precedence", () => {
  test("partial options inherit neutral footer, including an empty shared object", () => {
    for (const shared of [{}, { headerMode: "contact" }]) {
      const state = normalizeDossierChromeState({ shared });
      expect(state.shared.footerMode).toBe("none");
    }
  });

  test("missing design modes use template defaults, but every explicit mode survives", () => {
    for (const template of [
      "brief",
      "freundlich",
      "terracotta",
      "neon",
      "studio",
      "horizon",
      "cove",
    ] as const) {
      const missing = normalizeLetterDesign({ template });
      expect(missing.headerMode).toBe(defaultHeaderModeForTemplate(template));
      expect(missing.footerMode).toBe(defaultFooterModeForTemplate(template));
      for (const headerMode of ["none", "compact", "contact"] as const) {
        for (const footerMode of ["none", "compact", "details"] as const) {
          const options = { ...CANONICAL_DOSSIER_CHROME_OPTIONS, headerMode, footerMode };
          const resolved = resolveTemplateChromeOptions(template, {}, options);
          expect(resolved.headerMode).toBe(headerMode);
          expect(resolved.footerMode).toBe(footerMode);
        }
      }
    }
  });

  test("different-first-page false reserves the full contact header on letter continuation", () => {
    for (const headerDifferentFirstPage of [false, true]) {
      const options = {
        ...CANONICAL_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact" as const,
        headerDifferentFirstPage,
      };
      const design = { ...emptyLetterDesign(), ...options, footerMode: "none" as const };
      const first = letterPageGeometry(EMPTY_LETTER, design, { pageIndex: 0 });
      const next = letterPageGeometry(EMPTY_LETTER, design, { pageIndex: 1 });
      expect(effectiveDossierHeaderModeForOptions(options, 1)).toBe("contact");
      expect(dossierHeaderVisualHeightMmForOptions(options, 1)).toBe(
        headerDifferentFirstPage ? 8 : 22,
      );
      if (!headerDifferentFirstPage) expect(next.content.top).toBe(first.content.top);
      else expect(next.content.top).toBeLessThan(first.content.top);
    }
  });

  test("contact visibility applies to first and continuation chrome, with address controlling place", () => {
    for (const pageIndex of [0, 1]) {
      for (const headerDifferentFirstPage of [false, true]) {
        const html = renderToStaticMarkup(
          createElement(DossierHeaderFooterChrome, {
            scope: "letter",
            template: "brief",
            colors: {},
            contact,
            pageIndex,
            options: {
              ...CANONICAL_DOSSIER_CHROME_OPTIONS,
              headerMode: "contact",
              headerDifferentFirstPage,
              headerShowName: false,
              headerShowAddress: false,
              headerShowPhone: false,
              headerShowEmail: true,
            },
          }),
        );
        expect(html).toContain(contact.email);
        for (const value of [contact.name, contact.address, contact.place, contact.phone])
          expect(html).not.toContain(value);
      }
    }
  });
});
