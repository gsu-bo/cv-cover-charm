import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  emptyLetterDesign,
  normalizeLetterDesign,
} from "../../src/components/letter/types";

const cvOverrideCss = readFileSync(
  new URL("../../src/components/cv/document-title-user-override.css", import.meta.url),
  "utf8",
);
const cvNameControls = readFileSync(
  new URL("../../src/components/cv/CvNameTypographyControls.tsx", import.meta.url),
  "utf8",
);
const headerControls = readFileSync(
  new URL("../../src/components/dossier/DossierChromeControls.tsx", import.meta.url),
  "utf8",
);
const headerRenderer = readFileSync(
  new URL("../../src/components/dossier/DossierHeaderFooterChrome.tsx", import.meta.url),
  "utf8",
);
const letterControls = readFileSync(
  new URL("../../src/components/letter/LetterLayoutControls.tsx", import.meta.url),
  "utf8",
);
const letterCss = readFileSync(
  new URL("../../src/components/letter/letter-user-typography.css", import.meta.url),
  "utf8",
);

describe("user-owned typography roles", () => {
  test("document-title explicit color, size and spacing outrank template rules", () => {
    expect(cvOverrideCss).toContain('[data-cv-doc-title][data-cv-user-doc-size="true"]');
    expect(cvOverrideCss).toContain("font-size: var(--cv-user-doc-font-size) !important;");
    expect(cvOverrideCss).toContain('[data-cv-doc-title][data-cv-user-doc-color="true"]');
    expect(cvOverrideCss).toContain("color: var(--cv-user-doc-color) !important;");
    expect(cvOverrideCss).toContain('[data-cv-doc-title][data-cv-user-doc-margin="true"]');
  });

  test("CV name exposes font, size, color and emphasis controls", () => {
    expect(cvNameControls).toContain("Vorname &amp; Nachname gestalten");
    expect(cvNameControls).toContain("data-cv-name-font-control");
    expect(cvNameControls).toContain("data-cv-name-size-control");
    expect(cvNameControls).toContain("data-cv-name-color-control");
    expect(cvOverrideCss).toContain("--cv-user-name-font");
    expect(cvOverrideCss).toContain("--cv-user-name-decoration");
  });

  test("stacked contact header groups address/place and phone/email with configurable separator", () => {
    expect(headerControls).toContain("Kontaktdaten in Zeilen");
    expect(headerControls).toContain("Gilt zwischen Strasse und Ort sowie zwischen Telefon und E-Mail.");
    expect(headerRenderer).toContain("stackedAddressRows");
    expect(headerRenderer).toContain("stackedPhoneRows");
    expect(headerRenderer).toContain("data-dossier-stacked-contact");
    expect(headerRenderer).toContain("style={inlineSeparator}");
  });

  test("letter role typography is normalized and clamped without changing untouched defaults", () => {
    const base = emptyLetterDesign();
    expect(base.senderTypography).toBeUndefined();
    expect(base.recipientTypography).toBeUndefined();
    expect(base.subjectTypography).toBeUndefined();

    const normalized = normalizeLetterDesign({
      ...base,
      senderTypography: {
        font: "freundlich",
        fontSizePt: 99,
        color: "#ABCDEF",
        bold: false,
        italic: true,
        underline: true,
      },
      recipientTypography: { fontSizePt: 1 },
      subjectTypography: { color: "not-a-color" },
    });

    expect(normalized.senderTypography).toEqual({
      font: "freundlich",
      fontSizePt: 30,
      color: "#abcdef",
      bold: false,
      italic: true,
      underline: true,
    });
    expect(normalized.recipientTypography).toEqual({ fontSizePt: 7 });
    expect(normalized.subjectTypography).toBeUndefined();
  });

  test("letter UI and renderer expose sender, recipient and subject roles", () => {
    expect(letterControls).toContain('label="Eigene Anschrift"');
    expect(letterControls).toContain('label="Empfängeranschrift"');
    expect(letterControls).toContain('label="Betreff"');
    expect(letterCss).toContain("--letter-user-sender-font");
    expect(letterCss).toContain("--letter-user-recipient-color");
    expect(letterCss).toContain("--letter-user-subject-weight");
  });
});
