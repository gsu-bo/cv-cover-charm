import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DossierSheetBackground,
  letterLayoutFor,
} from "../../src/components/dossier/DossierSheetBackground";
import { TEMPLATES } from "../../src/components/cover/types";
import { defaultLetterColors } from "../../src/components/letter/types";

const markupFor = (
  template: Parameters<typeof DossierSheetBackground>[0]["template"],
  pageIndex = 0,
) =>
  renderToStaticMarkup(
    createElement(DossierSheetBackground, {
      template,
      colors: defaultLetterColors(template),
      pageIndex,
    }),
  );

// Release guard: Brief is a shared dossier template across cover, letter and CV.
describe("shared dossier sheet background", () => {
  test("Brief is selectable from the shared dossier template catalogue", () => {
    const brief = TEMPLATES.find(({ id }) => (id as string) === "brief");
    expect(brief?.name).toBe("Brief");
    expect(brief?.slots.find(({ key }) => key === "bg")?.default).toBe("#ffffff");
  });

  test("every dossier template renders a motif-only shared non-brief background", () => {
    for (const { id } of TEMPLATES.filter(({ id }) => (id as string) !== "brief")) {
      const markup = markupFor(id);
      expect(markup).toContain(`data-dossier-sheet-background="${id}"`);
      expect(markup).not.toContain('data-dossier-chrome="cv"');
      expect(markup).not.toContain('data-dossier-sheet-background="brief"');
      expect(markup).not.toContain('data-letter-background="brief"');
      expect(markup).not.toContain("bg-white");
    }
  });

  test("established templates keep their structural geometry while shared chrome owns top spacing", () => {
    expect(markupFor("freundlich")).toContain("height:52mm");
    expect(markupFor("colorful")).toContain("height:40mm");
    expect(markupFor("colorful")).toContain("height:8mm");
    expect(markupFor("blockig")).toContain("width:19mm");
    expect(markupFor("terracotta")).toContain("width:70mm");
    expect(markupFor("studio")).toContain("width:72mm");
    expect(markupFor("studio")).toContain("height:38mm");

    // Compact is the dossier default in both CV and motivation letter. The
    // common chrome plus the default 12 mm post-header gap owns the text top.
    expect(letterLayoutFor("modern").top).toBe(34);
    expect(letterLayoutFor("freundlich").top).toBe(34);
    expect(letterLayoutFor("blockig").left).toBe(27);
    expect(letterLayoutFor("studio").left).toBe(80);
    expect(letterLayoutFor("edel").left).toBe(19);
  });

  test("continuation pages collapse large CV headers without overlapping content", () => {
    expect(markupFor("freundlich", 1)).toContain("height:14mm");
    expect(markupFor("colorful", 1)).toContain("height:14mm");
    expect(markupFor("studio", 1)).toContain("height:13mm");
    expect(markupFor("studio", 1)).toContain("top:0mm");
    expect(markupFor("studio", 1)).toContain("width:72mm");
  });

  test("Brief remains the deliberate plain-white alternative", () => {
    const markup = markupFor("brief");
    expect(markup).toContain('data-dossier-sheet-background="brief"');
    expect(markup).toContain('data-letter-background="brief"');
    expect(markup).toContain("bg-white");
  });
});