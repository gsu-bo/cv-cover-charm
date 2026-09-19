import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DOSSIER_DOCX_LAZY_TEMPLATE_IDS,
  hasDossierDocxTemplateLoader,
} from "../../src/lib/dossier-docx-template-loader";
import { DOSSIER_DOCX_TEMPLATE_PLANS } from "../../src/lib/dossier-docx-family";

describe("lazy DOCX template modules", () => {
  test("registers exactly the 39 active DOCX dossier templates", () => {
    const lazyIds = [...DOSSIER_DOCX_LAZY_TEMPLATE_IDS].sort();
    const planIds = Object.keys(DOSSIER_DOCX_TEMPLATE_PLANS).sort();

    expect(lazyIds).toHaveLength(39);
    expect(new Set(lazyIds).size).toBe(39);
    expect(lazyIds).toEqual(planIds);
    expect(lazyIds).not.toContain("frame");
    expect(lazyIds.every((templateId) => hasDossierDocxTemplateLoader(templateId))).toBe(true);
  });

  test("keeps Word renderers out of the synchronous export router", () => {
    const source = readFileSync("src/lib/dossier-docx-export.ts", "utf8");

    for (const heavyModule of [
      "dossier-docx-warm-polish",
      "dossier-docx-studio3-polish",
      "dossier-docx-legacy-recipe-polish",
      "dossier-docx-family-renderer",
      "dossier-docx-template-recipes",
    ]) {
      expect(source).not.toContain(`from "@/lib/${heavyModule}"`);
    }
    expect(source).toContain("createLazyTemplateDossierDocxBlob");
  });
});
