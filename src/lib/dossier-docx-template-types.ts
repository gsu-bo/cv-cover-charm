import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";

export type DossierDocxDocuments = {
  cover: CoverPdfDocument;
  letter: LetterPdfDocument;
  cv: CvPdfDocument;
};

export type DossierDocxTemplateModule = {
  createDossierDocxBlob: (documents: DossierDocxDocuments) => Blob | Promise<Blob>;
};
