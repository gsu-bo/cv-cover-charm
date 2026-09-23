import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { emptyLetterDesign, normalizeLetterDesign } from "../../src/components/letter/types";

const route = readFileSync(new URL("../../src/routes/anschreiben.tsx", import.meta.url), "utf8");
const layout = readFileSync(
  new URL("../../src/components/letter/LetterLayoutControls.tsx", import.meta.url),
  "utf8",
);
const canvas = readFileSync(
  new URL("../../src/components/letter/LetterCanvas.tsx", import.meta.url),
  "utf8",
);

describe("contextual letter typography", () => {
  test("keeps all new role typography optional and normalizes explicit values", () => {
    const defaults = emptyLetterDesign();
    expect(defaults.dateFont).toBeUndefined();
    expect(defaults.dateFontSizePt).toBeUndefined();
    expect(defaults.bodyFont).toBeUndefined();
    expect(defaults.attachmentsFont).toBeUndefined();
    expect(defaults.salutationFontSizePt).toBeUndefined();
    expect(defaults.closingFontSizePt).toBeUndefined();
    expect(defaults.signatureFontSizePt).toBeUndefined();
    expect(defaults.attachmentsFontSizePt).toBeUndefined();

    const normalized = normalizeLetterDesign({
      ...defaults,
      dateFont: "sans",
      bodyFont: "serif",
      attachmentsFont: "freundlich",
      dateFontSizePt: 7,
      salutationFontSizePt: 9.24,
      closingFontSizePt: 11.26,
      signatureFontSizePt: 20,
      attachmentsFontSizePt: 10.5,
    });
    expect(normalized.dateFont).toBe("sans");
    expect(normalized.bodyFont).toBe("serif");
    expect(normalized.attachmentsFont).toBe("freundlich");
    expect(normalized.dateFontSizePt).toBe(7);
    expect(normalized.salutationFontSizePt).toBe(9);
    expect(normalized.closingFontSizePt).toBe(11.5);
    expect(normalized.signatureFontSizePt).toBe(20);
    expect(normalized.attachmentsFontSizePt).toBe(10.5);
  });

  test("places font family and size controls in the matching form accordions", () => {
    expect(route).toContain('data-letter-context-font-sizes="brief"');
    expect(route).not.toContain('<Section title="Schrift"');
    expect(route).not.toContain('open={open.typo}');
    expect(route).toContain('font={design.dateFont}');
    expect(route).toContain('font={design.bodyFont}');
    expect(route).toContain('font={design.senderTypography?.font}');
    expect(route).toContain('font={design.recipientTypography?.font}');
    expect(route).toContain('font={design.attachmentsFont}');
    for (const label of [
      "Ort & Datum",
      "Titel / Betreff",
      "Anrede",
      "Fliesstext",
      "Grussformel",
      "Unterschrift / Name",
      "Kontaktdaten",
      "Empfängeranschrift",
      "Beilagen",
    ]) {
      expect(route).toContain(`label="${label}"`);
    }
    expect(route).toContain('patchDossierChrome("letter", { headerFontSizePt: fontSizePt ?? null })');
    expect(route).toContain('patchDossierChrome("letter", { footerFontSizePt: fontSizePt ?? null })');
  });

  test("removes duplicate font family and size controls from Layout", () => {
    expect(layout).not.toContain("BodyFontSizeControl");
    expect(layout).not.toContain("FONT_LABELS");
    expect(layout).not.toContain("Schriftart</span>");
    expect(layout).not.toContain("aria-label={`${label} Schriftgrösse`}");
    expect(layout).toContain("Schriftart und Schriftgrösse stellst du");
  });

  test("renders the new role sizes in the shared canvas used by preview, pagination and PDF", () => {
    expect(canvas).toContain("design.dateFontSizePt");
    expect(canvas).toContain("design.salutationFontSizePt");
    expect(canvas).toContain("design.closingFontSizePt");
    expect(canvas).toContain("design.signatureFontSizePt");
    expect(canvas).toContain("design.attachmentsFontSizePt");
    expect(canvas).toContain("design.dateFont");
    expect(canvas).toContain("design.bodyFont");
    expect(canvas).toContain("design.attachmentsFont");
  });
});
