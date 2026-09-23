import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LetterFontSizeControl } from "../../src/components/letter/LetterFontSizeControl";
import {
  LETTER_BODY_FONT_SIZE_MAX,
  LETTER_BODY_FONT_SIZE_MIN,
  LETTER_FONT_SIZE_MAX,
  LETTER_FONT_SIZE_MIN,
  LETTER_ROLE_FONT_SIZE_MAX,
  LETTER_ROLE_FONT_SIZE_MIN,
  normalizeLetterBodyFontSizePt,
  normalizeLetterRoleTypography,
} from "../../src/components/letter/types";

describe("letter font-size range", () => {
  test("uses one shared 5–30 pt range for body and role typography", () => {
    expect(LETTER_FONT_SIZE_MIN).toBe(5);
    expect(LETTER_FONT_SIZE_MAX).toBe(30);
    expect(LETTER_BODY_FONT_SIZE_MIN).toBe(5);
    expect(LETTER_BODY_FONT_SIZE_MAX).toBe(30);
    expect(LETTER_ROLE_FONT_SIZE_MIN).toBe(5);
    expect(LETTER_ROLE_FONT_SIZE_MAX).toBe(30);
  });

  test("normalization preserves the shared range across saves and reloads", () => {
    expect(normalizeLetterBodyFontSizePt(4)).toBe(5);
    expect(normalizeLetterBodyFontSizePt(5.5)).toBe(5.5);
    expect(normalizeLetterBodyFontSizePt(31)).toBe(30);

    expect(normalizeLetterRoleTypography({ fontSizePt: 4 })?.fontSizePt).toBe(5);
    expect(normalizeLetterRoleTypography({ fontSizePt: 17.5 })?.fontSizePt).toBe(17.5);
    expect(normalizeLetterRoleTypography({ fontSizePt: 31 })?.fontSizePt).toBe(30);
  });

  test("legacy narrower control bounds cannot shrink the shared slider range", () => {
    const markup = renderToStaticMarkup(
      createElement(LetterFontSizeControl, {
        label: "Kontaktdaten",
        fallbackSize: 14,
        min: 6,
        max: 30,
        onChange: () => undefined,
        onFontChange: () => undefined,
      }),
    );

    expect(markup).toContain('min="5"');
    expect(markup).toContain('max="30"');
  });
});
