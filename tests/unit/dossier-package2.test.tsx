import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  effectiveDossierHeaderModeForOptions,
  hasReducedContinuationHeader,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";
import { dossierDocxInlineHeaderText } from "../../src/lib/dossier-docx-chrome";

const contact = {
  name: "Lea Müller",
  address: "Bahnhofstrasse 42",
  place: "8000 Zürich",
  email: "lea@example.ch",
  phone: "079 123 45 67",
};
const colors = { primary: "#173a5e", secondary: "#315d7d", accent: "#315d7d" };

function markup(
  options: typeof DEFAULT_DOSSIER_CHROME_OPTIONS & {
    headerContinuationMode?: "compact" | "contact" | "none";
  },
  pageIndex: number,
) {
  return renderToStaticMarkup(
    createElement(DossierHeaderFooterChrome, {
      scope: "cv",
      template: "klassisch",
      colors,
      contact,
      pageIndex,
      options,
    }),
  );
}

describe("Package 2 continuation header model", () => {
  test("legacy JSON without continuation field preserves reduced contact behavior", () => {
    const state = normalizeDossierChromeState({
      sync: true,
      shared: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode: "contact" },
    });
    expect(state.shared.headerContinuationMode).toBeUndefined();
    expect(hasReducedContinuationHeader(state.shared, 1)).toBe(true);
    expect(effectiveDossierHeaderModeForOptions(state.shared, 1)).toBe("contact");
  });

  test("explicit continuation choices survive normalization", () => {
    const state = normalizeDossierChromeState({
      sync: true,
      shared: {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerContinuationMode: "compact",
      },
    });
    expect(state.shared.headerContinuationMode).toBe("compact");
    expect(effectiveDossierHeaderModeForOptions(state.shared, 1)).toBe("compact");
    expect(hasReducedContinuationHeader(state.shared, 1)).toBe(false);
  });

  test("page 1 contact can switch to compact on page 2", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerContinuationMode: "compact" as const,
    };
    const html = markup(options, 1);
    expect(html).toContain('data-dossier-effective-header-mode="compact"');
    expect(html).toContain('data-dossier-continuation-mode="compact"');
    expect(html).toContain("data-dossier-compact-header");
    expect(html).not.toContain("data-dossier-continuation-contact-header");
    expect(html).not.toContain("Lea Müller");
  });

  test("page 1 compact can switch to full contact on page 2", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "compact" as const,
      headerContinuationMode: "contact" as const,
    };
    const html = markup(options, 1);
    expect(html).toContain('data-dossier-effective-header-mode="contact"');
    expect(html).toContain("data-dossier-integrated-contact");
    expect(html).toContain("Lea Müller");
    expect(html).toContain("Bahnhofstrasse 42");
    expect(html).toContain("8000 Zürich");
  });

  test("continuation header can be disabled independently", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerContinuationMode: "none" as const,
    };
    const html = markup(options, 1);
    expect(html).toContain('data-dossier-effective-header-mode="none"');
    expect(html).not.toContain("data-dossier-compact-header");
    expect(html).not.toContain("data-dossier-integrated-contact");
    expect(html).not.toContain("data-dossier-continuation-contact-header");
  });

  test("first-page-different off ignores but preserves dormant continuation choice", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerContinuationMode: "none" as const,
      headerDifferentFirstPage: false,
    };
    expect(effectiveDossierHeaderModeForOptions(options, 1)).toBe("contact");
    expect(options.headerContinuationMode).toBe("none");
    const html = markup(options, 1);
    expect(html).toContain("data-dossier-integrated-contact");
    expect(html).toContain("Bahnhofstrasse 42");
  });

  test("DOCX inline separator mapping reflects every existing separator choice", () => {
    const rows = [
      { key: "name" as const, value: "Lea Müller" },
      { key: "phone" as const, value: "079 123" },
      { key: "email" as const, value: "lea@example.ch" },
    ];
    expect(dossierDocxInlineHeaderText(rows, "dot")).toBe(
      "Lea Müller · 079 123 · lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "slash")).toBe(
      "Lea Müller / 079 123 / lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "pipe")).toBe(
      "Lea Müller | 079 123 | lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "space")).toBe(
      "Lea Müller     079 123     lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "icons")).toBe(
      "Lea Müller  ☎ 079 123  ✉ lea@example.ch",
    );
  });
});
