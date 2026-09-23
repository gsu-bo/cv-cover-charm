import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_LETTER_BODY_FONT_SIZE_PT,
  LETTER_BODY_FONT_SIZE_MAX,
  LETTER_BODY_FONT_SIZE_MIN,
  emptyLetterDesign,
  normalizeLetterDesign,
} from "../../src/components/letter/types";

const control = readFileSync(
  new URL("../../src/components/letter/LetterFontSizeControl.tsx", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../../src/routes/anschreiben.tsx", import.meta.url),
  "utf8",
);
const canvas = readFileSync(
  new URL("../../src/components/letter/LetterCanvas.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../../src/components/letter/letter-user-typography.css", import.meta.url),
  "utf8",
);

describe("letter body font size", () => {
  test("keeps template size as the default and normalizes explicit overrides", () => {
    expect(emptyLetterDesign().bodyFontSizePt).toBeUndefined();
    expect(DEFAULT_LETTER_BODY_FONT_SIZE_PT).toBe(10.5);
    expect(LETTER_BODY_FONT_SIZE_MIN).toBe(5);
    expect(LETTER_BODY_FONT_SIZE_MAX).toBe(30);

    expect(normalizeLetterDesign({ ...emptyLetterDesign(), bodyFontSizePt: 4 }).bodyFontSizePt).toBe(5);
    expect(normalizeLetterDesign({ ...emptyLetterDesign(), bodyFontSizePt: 31 }).bodyFontSizePt).toBe(30);
    expect(normalizeLetterDesign({ ...emptyLetterDesign(), bodyFontSizePt: 11.24 }).bodyFontSizePt).toBe(11);
    expect(normalizeLetterDesign({ ...emptyLetterDesign(), bodyFontSizePt: 11.26 }).bodyFontSizePt).toBe(11.5);
  });

  test("offers the shared 5–30 pt control with half-point steps", () => {
    expect(route).toContain('label="Fliesstext"');
    expect(route).toContain("value={design.bodyFontSizePt}");
    expect(control).toContain("LETTER_FONT_SIZE_MIN");
    expect(control).toContain("LETTER_FONT_SIZE_MAX");
    expect(control).toContain("step={0.5}");
    expect(control).toContain("Wie Vorlage");
  });

  test("applies an explicit body-size override to preview, measurement and PDF markup", () => {
    expect(canvas).toContain("data-letter-user-body-size");
    expect(canvas).toContain('"--letter-user-body-size"');
    expect(css).toContain('[data-letter-user-body-size="true"] [data-letter-pdf-richtext="body"]');
    expect(css).toContain("font-size: var(--letter-user-body-size) !important;");
  });
});
