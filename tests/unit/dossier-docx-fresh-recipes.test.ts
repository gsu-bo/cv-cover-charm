import { describe, expect, test } from "bun:test";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";
import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "../../src/lib/dossier-pdf-document";
import { resolveDossierDocxProfile } from "../../src/lib/dossier-docx-export";
import { dossierDocxTemplateRecipe } from "../../src/lib/dossier-docx-template-recipes";

function documentsFor(templateId: string) {
  const cover = { template: templateId } as CoverPdfDocument;
  const letter = { design: { template: templateId } } as LetterPdfDocument;
  const cv = { design: { template: templateId } } as CvPdfDocument;
  return { cover, letter, cv };
}

describe("Fresh DOCX recipe registry", () => {
  test("all Fresh templates are connected to an individual Word recipe", () => {
    expect(FRESH_TEMPLATE_REGISTRY).toHaveLength(22);
    for (const template of FRESH_TEMPLATE_REGISTRY) {
      const recipe = dossierDocxTemplateRecipe(template.id);
      expect(recipe?.templateId).toBe(template.id);
      expect(recipe?.label).toBe(template.name);
    }
  });

  test("Fresh templates resolve through template-recipe instead of family-fallback", () => {
    for (const template of FRESH_TEMPLATE_REGISTRY) {
      const { cover, letter, cv } = documentsFor(template.id);
      const profile = resolveDossierDocxProfile(cover, letter, cv);
      expect(profile?.label).toBe(template.name);
      expect(profile?.architecture).toBe(
        template.id === "studio3" ? "native+transform+polish" : "template-recipe",
      );
    }
  });
});
