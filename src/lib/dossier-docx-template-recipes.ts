import {
  DOSSIER_DOCX_TEMPLATE_RECIPES,
  type DossierDocxRecipeShape,
  type DossierDocxTemplateRecipe,
} from "@/lib/dossier-docx-template-recipe";
import { FRESH_DOSSIER_DOCX_RECIPES } from "@/lib/dossier-docx-template-recipe-fresh";
import { LEGACY_EXTRA_DOCX_RECIPES } from "@/lib/dossier-docx-template-recipe-legacy-extra";

function wordRingShapes(shape: DossierDocxRecipeShape): DossierDocxRecipeShape[] {
  if (shape.kind !== "frame" || !/-ring$/.test(shape.id)) return [shape];

  // Fresh Orbit defines bordered circular motifs. The generic recipe converter
  // currently represents every bordered motif as a rectangular frame, so Word
  // loses the circular ring geometry. Build the ring from two concentric ovals
  // instead: a colored outer oval plus a paper-colored cutout.
  const inset = shape.strokeMm ?? 0.4;
  const { strokeMm: _strokeMm, ...outer } = shape;
  return [
    { ...outer, kind: "oval" },
    {
      kind: "oval",
      id: `${shape.id}-cutout`,
      x: shape.x + inset,
      y: shape.y + inset,
      w: Math.max(0.1, shape.w - inset * 2),
      h: Math.max(0.1, shape.h - inset * 2),
      color: "paper",
      opacity: 1,
    },
  ];
}

function normalizeFreshWordRecipe(recipe: DossierDocxTemplateRecipe) {
  if (recipe.templateId !== "orbit") return recipe;
  return {
    ...recipe,
    letter: {
      ...recipe.letter,
      shapes: recipe.letter.shapes.flatMap(wordRingShapes),
    },
    cv: {
      ...recipe.cv,
      shapes: recipe.cv.shapes.flatMap(wordRingShapes),
    },
  } satisfies DossierDocxTemplateRecipe;
}

function neonSurfaceShape(shape: DossierDocxRecipeShape): DossierDocxRecipeShape {
  if (shape.id !== "neon-letter-card" && shape.id !== "neon-cv-card") return shape;

  // LibreOffice 25.x can drop these page-sized VML roundrect surfaces when
  // they sit over Neon's dark full-page VML background. A plain VML rect keeps
  // the same white content surface, remains editable in Word, and renders
  // consistently across Word/LibreOffice without changing the web/PDF design.
  return { ...shape, kind: "rect" };
}

function withLibreOfficeCardPaginationHeadroom(page: DossierDocxTemplateRecipe["cv"]) {
  return {
    ...page,
    // The legacy light cards end at 285 mm. Keep 13.5 mm of visible inner-card
    // reserve while giving Word/LibreOffice 0.5 mm pagination headroom so the
    // final reference line is not rounded onto a spurious extra CV page.
    margins: page.margins ? { ...page.margins, bottom: 25.5 } : page.margins,
  } satisfies DossierDocxTemplateRecipe["cv"];
}

function normalizeLegacyWordRecipe(recipe: DossierDocxTemplateRecipe) {
  if (recipe.templateId === "neon") {
    return {
      ...recipe,
      letter: {
        ...recipe.letter,
        shapes: recipe.letter.shapes.map(neonSurfaceShape),
      },
      cv: {
        ...withLibreOfficeCardPaginationHeadroom(recipe.cv),
        shapes: recipe.cv.shapes.map(neonSurfaceShape),
      },
    } satisfies DossierDocxTemplateRecipe;
  }

  if (recipe.templateId === "citrus") {
    return {
      ...recipe,
      cv: withLibreOfficeCardPaginationHeadroom(recipe.cv),
    } satisfies DossierDocxTemplateRecipe;
  }

  return recipe;
}

const NORMALIZED_FRESH_DOSSIER_DOCX_RECIPES = Object.fromEntries(
  Object.entries(FRESH_DOSSIER_DOCX_RECIPES).map(([id, recipe]) => [
    id,
    normalizeFreshWordRecipe(recipe),
  ]),
) as Readonly<Record<string, DossierDocxTemplateRecipe>>;

const NORMALIZED_LEGACY_EXTRA_DOCX_RECIPES = Object.fromEntries(
  Object.entries(LEGACY_EXTRA_DOCX_RECIPES).map(([id, recipe]) => [
    id,
    normalizeLegacyWordRecipe(recipe),
  ]),
) as Readonly<Record<string, DossierDocxTemplateRecipe>>;

export const ALL_DOSSIER_DOCX_TEMPLATE_RECIPES: Readonly<
  Record<string, DossierDocxTemplateRecipe>
> = {
  ...DOSSIER_DOCX_TEMPLATE_RECIPES,
  ...NORMALIZED_LEGACY_EXTRA_DOCX_RECIPES,
  ...NORMALIZED_FRESH_DOSSIER_DOCX_RECIPES,
};

export function dossierDocxTemplateRecipe(templateId: string) {
  return ALL_DOSSIER_DOCX_TEMPLATE_RECIPES[templateId] ?? null;
}
