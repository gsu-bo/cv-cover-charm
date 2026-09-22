import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LetterCanvas } from "../../src/components/letter/LetterCanvas";
import {
  DEFAULT_LETTER_CLOSING_GAP_MM,
  DEFAULT_LETTER_SIGNATURE_GAP_MM,
  DEMO_LETTER,
  emptyLetterDesign,
  normalizeLetterSpacingMm,
} from "../../src/components/letter/types";

describe("motivation-letter closing and signature spacing", () => {
  test("uses the compact spacing defaults when no saved spacing exists", () => {
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design: emptyLetterDesign(),
      }),
    );

    expect(markup).toContain(
      `data-letter-closing-gap-mm="${DEFAULT_LETTER_CLOSING_GAP_MM}"`,
    );
    expect(markup).toContain(
      `data-letter-signature-gap-mm="${DEFAULT_LETTER_SIGNATURE_GAP_MM}"`,
    );
  });

  test("renders both user-defined distances independently", () => {
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: {
          ...DEMO_LETTER,
          grussAbstandMm: 4,
          unterschriftAbstandMm: 28,
        },
        design: emptyLetterDesign(),
      }),
    );

    expect(markup).toContain('data-letter-closing-gap-mm="4"');
    expect(markup).toContain('data-letter-signature-gap-mm="28"');
    expect(markup).toContain("margin-top:4mm");
    expect(markup).toContain("margin-top:28mm");
  });

  test("clamps invalid and extreme values to printable limits", () => {
    expect(normalizeLetterSpacingMm(undefined, 9)).toBe(9);
    expect(normalizeLetterSpacingMm(Number.NaN, 12)).toBe(12);
    expect(normalizeLetterSpacingMm(-4, 9)).toBe(0);
    expect(normalizeLetterSpacingMm(18.26, 9)).toBe(18.3);
    expect(normalizeLetterSpacingMm(80, 9)).toBe(50);
  });
});