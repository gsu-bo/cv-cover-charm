import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";

const contact = {
  name: "Lea Müller",
  address: "Bahnhofstrasse 42",
  place: "8000 Zürich",
  email: "lea@example.ch",
  phone: "079 123 45 67",
};

const colors = {
  primary: "#173a5e",
  secondary: "#315d7d",
  accent: "#315d7d",
};

function markup(
  scope: "cv" | "letter",
  headerMode: "compact" | "contact" | "none",
  pageIndex = 1,
) {
  return renderToStaticMarkup(
    createElement(DossierHeaderFooterChrome, {
      scope,
      template: "klassisch",
      colors,
      contact,
      pageIndex,
      options: {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode,
        footerMode: "compact",
      },
    }),
  );
}

describe("shared dossier continuation headers", () => {
  test("compact means a decorative band without contact data in both documents", () => {
    for (const scope of ["cv", "letter"] as const) {
      const html = markup(scope, "compact");

      expect(html).toContain("data-dossier-compact-header");
      expect(html).not.toContain("data-dossier-continuation-contact-header");
      expect(html).not.toContain("Lea Müller");
      expect(html).not.toContain("8000 Zürich");
      expect(html).not.toContain("lea@example.ch");
      expect(html).not.toContain("079 123 45 67");
    }
  });

  test("contact defaults to a compact identity header on continuation pages", () => {
    for (const scope of ["cv", "letter"] as const) {
      const html = markup(scope, "contact");

      expect(html).toContain('data-dossier-first-page-different="true"');
      expect(html).toContain("data-dossier-continuation-contact-header");
      expect(html).toContain("Lea Müller");
      expect(html).toContain("lea@example.ch");
      expect(html).toContain("079 123 45 67");
      expect(html).not.toContain("8000 Zürich");
      expect(html).not.toContain("Bahnhofstrasse 42");
    }
  });

  test("turning first-page-different off repeats the selected contact header", () => {
    const html = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "cv",
        template: "klassisch",
        colors,
        contact,
        pageIndex: 1,
        options: {
          ...DEFAULT_DOSSIER_CHROME_OPTIONS,
          headerMode: "contact",
          headerDifferentFirstPage: false,
          headerTextLayout: "stacked",
          footerMode: "compact",
        },
      }),
    );

    expect(html).toContain('data-dossier-first-page-different="false"');
    expect(html).toContain("data-dossier-integrated-contact");
    expect(html).not.toContain("data-dossier-continuation-contact-header");
    expect(html).toContain("Lea Müller");
    expect(html).toContain("Bahnhofstrasse 42");
    expect(html).toContain("8000 Zürich");
    expect(html).toContain("lea@example.ch");
    expect(html).toContain("079 123 45 67");
  });

  test("contact continuation respects the existing visibility switches", () => {
    const html = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "cv",
        template: "klassisch",
        colors,
        contact,
        pageIndex: 1,
        options: {
          ...DEFAULT_DOSSIER_CHROME_OPTIONS,
          headerMode: "contact",
          headerShowPhone: false,
          footerMode: "compact",
        },
      }),
    );

    expect(html).toContain("Lea Müller");
    expect(html).toContain("lea@example.ch");
    expect(html).not.toContain("8000 Zürich");
    expect(html).not.toContain("079 123 45 67");
  });

  test("none removes the header in both documents", () => {
    for (const scope of ["cv", "letter"] as const) {
      const html = markup(scope, "none");

      expect(html).not.toContain("data-dossier-compact-header");
      expect(html).not.toContain("data-dossier-integrated-contact");
      expect(html).not.toContain("data-dossier-continuation-contact-header");
    }
  });
});
