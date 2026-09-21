import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import {
  resolveDossierChromeDocumentContent,
  withDossierChromeDocumentContent,
} from "../../src/lib/dossier-chrome-content";

const contact = {
  name: "Lea Müller",
  address: "Dorfstrasse 12",
  place: "4535 Hubersdorf",
  phone: "079 123 45 67",
  email: "lea@example.ch",
};

describe("dossier chrome document content", () => {
  test("title and custom text coexist with a stacked contact header", () => {
    const content = resolveDossierChromeDocumentContent(
      {
        headerTitleEnabled: true,
        headerTextEnabled: true,
        headerText: "Bewerbung Informatik",
      },
      "Lebenslauf",
    );
    const options = withDossierChromeDocumentContent(
      {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerTextLayout: "stacked",
        headerHeightMm: null,
      },
      content,
    );

    const markup = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "cv",
        template: "modern",
        colors: { primary: "#111827", accent: "#f43f5e" },
        contact,
        options,
        documentContent: content,
      }),
    );

    expect(options.headerHeightMm).toBe(41);
    expect(markup).toContain('data-dossier-header-document-content="true"');
    expect(markup).toContain("Lebenslauf");
    expect(markup).toContain("Bewerbung Informatik");
    expect(markup).toContain("Lea Müller");
  });

  test("custom footer text replaces automatic detail payload in the renderer", () => {
    const content = resolveDossierChromeDocumentContent(
      {
        footerTitleEnabled: true,
        footerTitle: "Hinweis",
        footerTextEnabled: true,
        footerText: "Referenzen gerne auf Anfrage",
      },
      "Lebenslauf",
    );
    const markup = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "letter",
        template: "modern",
        colors: { primary: "#111827", accent: "#f43f5e" },
        contact,
        options: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, footerMode: "details" },
        documentContent: content,
        footerLabel: "Beilagen",
        footerDetails: ["Lebenslauf", "Zeugnis"],
      }),
    );

    expect(markup).toContain("Hinweis");
    expect(markup).toContain("Referenzen gerne auf Anfrage");
    expect(markup).not.toContain("Zeugnis");
  });
});
