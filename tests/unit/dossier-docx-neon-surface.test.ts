import { describe, expect, test } from "bun:test";
import { LEGACY_EXTRA_DOCX_RECIPES } from "@/lib/dossier-docx-template-recipe-legacy-extra";

function shape(template: "neon" | "verlauf" | "citrus", page: "letter" | "cv", id: string) {
  return LEGACY_EXTRA_DOCX_RECIPES[template][page].shapes.find((candidate) => candidate.id === id);
}

describe("Neon DOCX content surfaces", () => {
  test("uses LibreOffice-safe white rectangles without flattening the other rounded-card recipes", () => {
    for (const page of ["letter", "cv"] as const) {
      const neonCard = shape("neon", page, `neon-${page}-card`);
      expect(neonCard?.kind).toBe("rect");
      expect((neonCard as { fillHex?: string } | undefined)?.fillHex).toBe("#ffffff");

      expect(shape("verlauf", page, `verlauf-${page}-card`)?.kind).toBe("roundrect");
      expect(shape("citrus", page, `citrus-${page}-card`)?.kind).toBe("roundrect");
    }
  });
});
