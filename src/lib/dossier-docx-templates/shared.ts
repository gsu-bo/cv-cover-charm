import {
  createPolishedLegacyRecipeDossierDocxBlob,
  legacyRecipeDossierDocxSupported,
} from "@/lib/dossier-docx-legacy-recipe-polish";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

function matchingTemplateId(documents: DossierDocxDocuments) {
  const coverId = String(documents.cover.template);
  const letterId = String(documents.letter.design.template);
  const cvId = String(documents.cv.design.template);
  return coverId === letterId && coverId === cvId ? coverId : null;
}

export function recipeTemplate(templateId: string) {
  return async (documents: DossierDocxDocuments) => {
    if (matchingTemplateId(documents) !== templateId) {
      throw new Error(`DOCX-Modul ${templateId} benötigt dieselbe Vorlage in allen Dossierteilen.`);
    }

    const { cover, letter, cv } = documents;
    if (legacyRecipeDossierDocxSupported(cover, letter, cv)) {
      return createPolishedLegacyRecipeDossierDocxBlob(cover, letter, cv);
    }

    const {
      createGenericFamilyDossierDocxBlob,
      genericFamilyDossierDocxSupported,
    } = await import("@/lib/dossier-docx-family-renderer");
    if (!genericFamilyDossierDocxSupported(cover, letter, cv)) {
      throw new Error(`Kein DOCX-Rezept oder Family-Fallback für ${templateId}.`);
    }
    return createGenericFamilyDossierDocxBlob(cover, letter, cv);
  };
}
