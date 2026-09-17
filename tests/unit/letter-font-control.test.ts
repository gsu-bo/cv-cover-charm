import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FONT_STACKS } from "../../src/components/cover/types";
import { LetterCanvas } from "../../src/components/letter/LetterCanvas";
import {
  DEMO_LETTER,
  defaultLetterColors,
  emptyLetterDesign,
  letterFontSelection,
  withLetterFontSelection,
} from "../../src/components/letter/types";
import { effectiveDossierFont } from "../../src/lib/dossier-theme";

describe("motivation-letter font control", () => {
  test("keeps the established standalone Brief font behavior", () => {
    const design = emptyLetterDesign();

    expect(design.template).toBe("brief");
    expect(letterFontSelection(design)).toBe("freundlich");
  });

  test("shows template typography when a designed template has no override", () => {
    const design = { ...emptyLetterDesign(), template: "modern" as const };

    expect(letterFontSelection(design)).toBe("template");
  });

  test("stores an explicit selection in the field used by designed templates", () => {
    const design = { ...emptyLetterDesign(), template: "modern" as const };
    const changed = withLetterFontSelection(design, "maschine");

    expect(changed.font).toBe("maschine");
    expect(changed.fontOverride).toBe("maschine");
    expect(letterFontSelection(changed)).toBe("maschine");
    expect(effectiveDossierFont(changed.template, changed.fontOverride)).toBe(FONT_STACKS.maschine);

    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design: { ...changed, colors: defaultLetterColors(changed.template) },
      }),
    );
    expect(markup).toContain('data-letter-font="maschine"');
    expect(markup).toContain('data-letter-font-source="override"');
    expect(markup).toContain("Courier New");
  });

  test("can return a designed template to its own typography", () => {
    const design = withLetterFontSelection(
      { ...emptyLetterDesign(), template: "modern" as const },
      "times",
    );
    const reset = withLetterFontSelection(design, "template");

    expect(reset.font).toBe("times");
    expect(reset.fontOverride).toBeNull();
    expect(letterFontSelection(reset)).toBe("template");
    expect(effectiveDossierFont(reset.template, reset.fontOverride)).not.toBe(FONT_STACKS.times);
  });
});
