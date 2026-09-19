import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";

const contact = {
  name: "Lea Müller",
  address: "Dorfstrasse 12",
  place: "4535 Hubersdorf",
  phone: "079 123 45 67",
  email: "lea.mueller@example.ch",
};

const colors = {
  primary: "#0f766e",
  secondary: "#f59e0b",
  accent: "#f59e0b",
};

describe("Warm contact header", () => {
  test("keeps stacked contact details and gold decoration together", () => {
    const markup = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "cv",
        template: "freundlich",
        colors,
        contact,
        options: {
          ...DEFAULT_DOSSIER_CHROME_OPTIONS,
          headerMode: "contact",
          headerTextLayout: "stacked",
          headerGapMm: 4,
        },
      }),
    );

    expect(markup).toContain('data-dossier-header-text-layout="stacked"');
    expect(markup).toContain("data-dossier-integrated-contact");
    expect(markup).toContain("data-warm-contact-gold-orb");
    expect(markup).toContain("data-warm-contact-gold-dot");
    expect(markup).toContain(contact.name);
    expect(markup).toContain(contact.email);
  });

  test("does not force Warm decoration into compact, none or continuation headers", () => {
    for (const headerMode of ["compact", "none"] as const) {
      const markup = renderToStaticMarkup(
        createElement(DossierHeaderFooterChrome, {
          scope: "cv",
          template: "freundlich",
          colors,
          contact,
          options: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode },
        }),
      );
      expect(markup).not.toContain("data-warm-contact-gold-orb");
    }

    const continuation = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "cv",
        template: "freundlich",
        colors,
        contact,
        pageIndex: 1,
        options: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode: "contact" },
      }),
    );
    expect(continuation).not.toContain("data-warm-contact-gold-orb");
  });
});
