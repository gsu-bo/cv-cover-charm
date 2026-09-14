import { createPolishedStudio3DossierDocxBlob } from "@/lib/dossier-docx-studio3-polish";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

export function createDossierDocxBlob({ cover, letter, cv }: DossierDocxDocuments) {
  return createPolishedStudio3DossierDocxBlob(cover, letter, cv);
}
