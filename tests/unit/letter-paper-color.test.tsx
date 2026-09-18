import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES } from "../../src/components/cover/types";
import { LetterCanvas } from "../../src/components/letter/LetterCanvas";
import {
  resolveLetterPalette,
  resolveLetterPaperColor,
} from "../../src/components/letter/letter-paper";
import {
  DEMO_LETTER,
  defaultLetterColors,
  emptyLetterDesign,
  normalizeLetterDesign,
  type LetterTemplateId,
} from "../../src/components/letter/types";
import { readable } from "../../src/components/cv/palette";

const CUSTOM_PAPER = "#dcefff";

describe("template-independent motivation-letter paper color", () => {
  test("renders the chosen paper color for every selectable template", () => {
    for (const { id } of TEMPLATES) {
      const template = id as LetterTemplateId;
      const design = {
        ...emptyLetterDesign(),
        template,
        colors: defaultLetterColors(template),
        paperColor: CUSTOM_PAPER,
      };
      const markup = renderToStaticMarkup(
        createElement(LetterCanvas, { data: DEMO_LETTER, design }),
      );

      expect(markup).toContain(`data-letter-paper-color="${CUSTOM_PAPER}"`);
      expect(markup).toContain(`data-letter-paper-override="${CUSTOM_PAPER}"`);
      expect(markup).toContain(`background-color:${CUSTOM_PAPER}`);
    }
  });

  test("automatically keeps body text readable on a dark custom paper", () => {
    const design = {
      ...emptyLetterDesign(),
      paperColor: "#171716",
    };
    const palette = resolveLetterPalette(design);

    expect(resolveLetterPaperColor(design)).toBe("#171716");
    expect(readable(palette.ink, palette.paper, 7)).toBe(true);
  });

  test("old saves keep their template paper until the user chooses an override", () => {
    const legacy = normalizeLetterDesign({
      template: "freundlich",
      colors: defaultLetterColors("freundlich"),
      font: "freundlich",
    });

    expect(legacy.paperColor).toBeNull();
    expect(resolveLetterPaperColor(legacy)).toBe("#fff9ef");
  });
});
