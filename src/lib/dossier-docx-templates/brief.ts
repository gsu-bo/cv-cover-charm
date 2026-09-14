import { createBriefDossierDocxBlob } from "@/lib/dossier-docx";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

export function createDossierDocxBlob({ cover, letter, cv }: DossierDocxDocuments) {
  return createBriefDossierDocxBlob(cover, letter, cv);
}
