import {
  DOSSIER_DOCX_TEMPLATE_RECIPES,
  type DossierDocxTemplateRecipe,
} from "@/lib/dossier-docx-template-recipe";
import { LEGACY_EXTRA_DOCX_RECIPES } from "@/lib/dossier-docx-template-recipe-legacy-extra";

export const ALL_DOSSIER_DOCX_TEMPLATE_RECIPES: Readonly<
  Record<string, DossierDocxTemplateRecipe>
> = {
  ...DOSSIER_DOCX_TEMPLATE_RECIPES,
  ...LEGACY_EXTRA_DOCX_RECIPES,
};

export function dossierDocxTemplateRecipe(templateId: string) {
  return ALL_DOSSIER_DOCX_TEMPLATE_RECIPES[templateId] ?? null;
}
