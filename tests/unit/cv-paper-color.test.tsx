import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { CvCanvas } from "../../src/components/cv/CvCanvas";
import {
  normalizeCvPaperColor,
  resolveCvPalette,
  resolveCvPaperColor,
} from "../../src/components/cv/cv-paper";
import { DEMO_CV, type CvDesign } from "../../src/components/cv/types";
import { readable } from "../../src/components/cv/palette";

const CUSTOM_PAPER = "#dcefff";

function colorsFor(template: TemplateId): Record<string, string> {
  const found = TEMPLATES.find(({ id }) => id === template);
  if (!found) throw new Error(`Missing template ${template}`);
  return Object.fromEntries(found.slots.map((slot) => [slot.key, slot.default]));
}

function designFor(template: TemplateId, paperColor: string | null): CvDesign {
  return {
    template,
    colors: colorsFor(template),
    paperColor,
    bgOpacity: 0.25,
    useElements: false,
  };
}

describe("template-independent CV paper color", () => {
  test("resolves the chosen paper color for every selectable template", () => {
    for (const { id } of TEMPLATES) {
      const design = designFor(id, CUSTOM_PAPER);
      expect(resolveCvPaperColor(design)).toBe(CUSTOM_PAPER);
      expect(resolveCvPalette(design).paper).toBe(CUSTOM_PAPER);
    }
  });

  test("renders the chosen paper color into CV preview and PDF canvas markup", () => {
    const design = designFor("neon", CUSTOM_PAPER);
    const markup = renderToStaticMarkup(
      createElement(CvCanvas, { data: DEMO_CV, design, elements: [] }),
    );

    expect(markup).toContain(`data-cv-paper-color="${CUSTOM_PAPER}"`);
    expect(markup).toContain(`data-letter-paper-override="${CUSTOM_PAPER}"`);
    expect(markup).toContain(`background-color:${CUSTOM_PAPER}`);
  });

  test("automatically keeps body text readable on dark custom paper", () => {
    const palette = resolveCvPalette(designFor("brief", "#171716"));

    expect(palette.paper).toBe("#171716");
    expect(readable(palette.ink, palette.paper, 7)).toBe(true);
  });

  test("old and malformed saves safely fall back to the template paper", () => {
    const legacy = designFor("freundlich", null);
    expect(resolveCvPaperColor(legacy)).toBe("#fff9ef");
    expect(normalizeCvPaperColor("not-a-color")).toBeNull();
  });
});
