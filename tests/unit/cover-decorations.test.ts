import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverBackground } from "../../src/components/cover/CoverBackground";
import { DossierSheetBackground } from "../../src/components/dossier/DossierSheetBackground";
import { isFreshTemplate } from "../../src/components/cover/fresh-templates";
import { templateDecorations } from "../../src/components/cover/template-decorations";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { cvFrameFor } from "../../src/components/cv/archetype";

const COLORS = {
  bg: "#ffffff",
  ink: "#111827",
  primary: "#334155",
  secondary: "#c08457",
  tertiary: "#e2e8f0",
  accent: "#d97706",
};

function backgroundChildCount(template: TemplateId) {
  const markup = renderToStaticMarkup(createElement(CoverBackground, { template, colors: COLORS }));
  const divCount = markup.match(/<div\b/g)?.length ?? 0;
  return Math.max(0, divCount - 1); // minus the page-surface wrapper
}

function decoration(template: TemplateId, id: string) {
  const found = templateDecorations(template, {}).find((block) => block.id === id);
  expect(found).toBeDefined();
  return found!;
}

function shapeBottom(template: TemplateId, id: string) {
  const block = decoration(template, id);
  return block.style.y + block.style.w * (block.style.ratio ?? 1);
}

describe("cover decoration single source", () => {
  test("CoverBackground contains structural artwork only", () => {
    const structuralChildren: Partial<Record<TemplateId, number>> = {
      klassisch: 1,
      edel: 2,
      sonnig: 2,
      aurora: 1,
      citrus: 1,
      pastell: 1,
    };

    for (const { id } of TEMPLATES) {
      const expectedChildren = isFreshTemplate(id) ? 3 : (structuralChildren[id] ?? 0);
      expect(backgroundChildCount(id)).toBe(expectedChildren);
    }
  });

  test("editable decoration ids are unique within every template", () => {
    for (const { id } of TEMPLATES) {
      const ids = templateDecorations(id, {}).map((block) => block.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("edge-bound editable blocks reset exactly onto the A4 edges", () => {
    const fullWidth = [
      ["colorful", "decor-top-band"],
      ["colorful", "decor-bottom-band"],
      ["edelBlockig", "decor-top-band"],
      ["edelBlockig", "decor-bottom-field"],
      ["serioes", "decor-top-band"],
      ["serioes", "decor-bottom-band"],
      ["welle", "decor-bottom-field"],
      ["sonne", "decor-top-field"],
      ["aurora", "decor-bottom-band"],
      ["freundlich", "decor-top-field"],
    ] as const satisfies ReadonlyArray<readonly [TemplateId, string]>;

    for (const [template, id] of fullWidth) {
      const block = decoration(template, id);
      expect(block.style.x).toBe(0);
      expect(block.style.x + block.style.w).toBeCloseTo(210, 6);
    }

    const bottomBound = [
      ["colorful", "decor-bottom-band"],
      ["edelBlockig", "decor-bottom-field"],
      ["serioes", "decor-bottom-band"],
      ["welle", "decor-bottom-field"],
      ["terracotta", "decor-side-column"],
      ["studio", "decor-side-column"],
      ["studio", "decor-bottom-band"],
      ["aurora", "decor-bottom-band"],
    ] as const satisfies ReadonlyArray<readonly [TemplateId, string]>;

    for (const [template, id] of bottomBound) {
      expect(shapeBottom(template, id)).toBeCloseTo(297, 6);
    }

    const topBound = [
      ["colorful", "decor-top-band"],
      ["blockig", "decor-top-block"],
      ["edelBlockig", "decor-top-band"],
      ["serioes", "decor-top-band"],
      ["terracotta", "decor-side-column"],
      ["sonne", "decor-top-field"],
      ["studio", "decor-side-column"],
      ["freundlich", "decor-top-field"],
    ] as const satisfies ReadonlyArray<readonly [TemplateId, string]>;

    for (const [template, id] of topBound) {
      expect(decoration(template, id).style.y).toBe(0);
    }

    // Rahmen/Pastell deliberately uses an inset signature instead of touching A4 edges.
    const pastellBand = decoration("pastell", "decor-top-band");
    expect(pastellBand.style.x).toBe(12);
    expect(pastellBand.style.x + pastellBand.style.w).toBe(198);
    expect(pastellBand.style.y).toBe(12);
  });

  test("Warm and Colorful CVs keep real header fields and print-safe geometry", () => {
    const warm = renderToStaticMarkup(
      createElement(DossierSheetBackground, { template: "freundlich", colors: COLORS }),
    );
    const colorful = renderToStaticMarkup(
      createElement(DossierSheetBackground, { template: "colorful", colors: COLORS }),
    );

    expect(warm).toContain("height:52mm");
    expect(colorful).toContain("height:40mm");
    expect(colorful).toContain("height:8mm");
    expect(cvFrameFor("freundlich").headFirstMm).toBe(52);
    expect(cvFrameFor("colorful").headFirstMm).toBe(40);
  });

  test("reported Modern, Blockig, Warm and Edel regressions stay guarded", async () => {
    const [layouts, photoCss, sheetBackground] = await Promise.all([
      Bun.file("src/components/cover/layouts.ts").text(),
      Bun.file("src/components/cv/layout-options.css").text(),
      Bun.file("src/components/dossier/DossierSheetBackground.tsx").text(),
    ]);

    expect(layouts).toContain('block.id === "eyebrow"');
    expect(layouts).toContain("x: 20");
    expect(layouts).toContain("{ w: 174 }");
    expect(layouts).toContain("{ maxLines: 1 }");
    expect(photoCss).toContain('data-dossier-template="freundlich"');
    expect(photoCss).toContain("box-shadow: none !important");
    expect(sheetBackground).toContain("top: 44");
    expect(sheetBackground).toContain("bandMm: 36");
    expect(sheetBackground).toContain("footMm: 16");
    expect(sheetBackground).toContain('template === "edel"');
    expect(sheetBackground).toContain(
      'style={{ inset: "19mm", backgroundColor: paperColor ?? palette.paper }}',
    );
  });
});
