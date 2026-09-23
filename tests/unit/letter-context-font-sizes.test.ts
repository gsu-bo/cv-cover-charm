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

describe("contextual letter font sizes", () => {
  test("keeps all new role sizes optional and normalizes explicit values", () => {
    const defaults = emptyLetterDesign();
    expect(defaults.dateFontSizePt).toBeUndefined();
    expect(defaults.salutationFontSizePt).toBeUndefined();
    expect(defaults.closingFontSizePt).toBeUndefined();
    expect(defaults.signatureFontSizePt).toBeUndefined();
    expect(defaults.attachmentsFontSizePt).toBeUndefined();

    const normalized = normalizeLetterDesign({
      ...defaults,
      dateFontSizePt: 7,
      salutationFontSizePt: 9.24,
      closingFontSizePt: 11.26,
      signatureFontSizePt: 20,
      attachmentsFontSizePt: 10.5,
    });
    expect(normalized.dateFontSizePt).toBe(8);
    expect(normalized.salutationFontSizePt).toBe(9);
    expect(normalized.closingFontSizePt).toBe(11.5);
    expect(normalized.signatureFontSizePt).toBe(16);
    expect(normalized.attachmentsFontSizePt).toBe(10.5);
  });

  test("places size controls in the matching form accordions", () => {
    expect(route).toContain('data-letter-context-font-sizes="brief"');
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

  test("removes duplicate size sliders from Layout", () => {
    expect(layout).not.toContain("BodyFontSizeControl");
    expect(layout).not.toContain("aria-label={`${label} Schriftgrösse`}");
    expect(layout).toContain("Schriftgrössen stellst du");
  });

  test("renders the new role sizes in the shared canvas used by preview, pagination and PDF", () => {
    expect(canvas).toContain("design.dateFontSizePt");
    expect(canvas).toContain("design.salutationFontSizePt");
    expect(canvas).toContain("design.closingFontSizePt");
    expect(canvas).toContain("design.signatureFontSizePt");
    expect(canvas).toContain("design.attachmentsFontSizePt");
  });
});
