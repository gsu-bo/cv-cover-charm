import { createPolishedWarmDossierDocxBlob } from "@/lib/dossier-docx-warm-polish";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

export function createDossierDocxBlob({ cover, letter, cv }: DossierDocxDocuments) {
  return createPolishedWarmDossierDocxBlob(cover, letter, cv);
}
