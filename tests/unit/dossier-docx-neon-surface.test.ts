import { describe, expect, test } from "bun:test";
import { dossierDocxTemplateRecipe } from "@/lib/dossier-docx-template-recipes";

function shape(template: "neon" | "verlauf" | "citrus", page: "letter" | "cv", id: string) {
  return dossierDocxTemplateRecipe(template)?.[page].shapes.find((candidate) => candidate.id === id);
}

describe("legacy DOCX light-card surfaces", () => {
  test("uses LibreOffice-safe Neon rectangles without flattening the other rounded-card recipes", () => {
    for (const page of ["letter", "cv"] as const) {
      const neonCard = shape("neon", page, `neon-${page}-card`);
      expect(neonCard?.kind).toBe("rect");
      expect((neonCard as { fillHex?: string } | undefined)?.fillHex).toBe("#ffffff");

      expect(shape("verlauf", page, `verlauf-${page}-card`)?.kind).toBe("roundrect");
      expect(shape("citrus", page, `citrus-${page}-card`)?.kind).toBe("roundrect");
    }
  });

  test("keeps card reserve while allowing LibreOffice CV pagination headroom", () => {
    for (const template of ["neon", "citrus"] as const) {
      const recipe = dossierDocxTemplateRecipe(template);
      const card = shape(template, "cv", `${template}-cv-card`);
      const bottomMarginMm = recipe?.cv.margins?.bottom;

      expect(bottomMarginMm).toBe(25.5);
      expect(card).toBeDefined();
      if (!card || bottomMarginMm === undefined) continue;

      const cardBottomMm = card.y + card.h;
      const contentBottomMm = 297 - bottomMarginMm;
      expect(cardBottomMm - contentBottomMm).toBeGreaterThanOrEqual(13);
    }
  });
});
