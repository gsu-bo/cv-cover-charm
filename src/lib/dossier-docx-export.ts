import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import {
  briefDossierDocxSupported,
  createBriefDossierDocxBlob,
} from "@/lib/dossier-docx";
import {
  createPolishedWarmDossierDocxBlob,
  warmDossierDocxSupported,
} from "@/lib/dossier-docx-warm-polish";
import {
  createPolishedStudio3DossierDocxBlob,
  studio3DossierDocxSupported,
} from "@/lib/dossier-docx-studio3-polish";
import { downloadBlob } from "@/lib/download";

export type DossierDocxDocuments = {
  cover: CoverPdfDocument;
  letter: LetterPdfDocument;
  cv: CvPdfDocument;
};

export type DossierDocxProfile = {
  templateId: string;
  label: string;
  architecture: "native" | "native+polish" | "native+transform+polish";
  visualModel: {
    cover: "plain" | "organic-hero" | "editorial-split";
    letter: "edge-bars" | "organic-masthead" | "two-tone-masthead";
    cv: "edge-bars" | "banded" | "two-tone-masthead";
  };
  supports: (
    cover: CoverPdfDocument | null,
    letter: LetterPdfDocument | null,
    cv: CvPdfDocument | null,
  ) => boolean;
  createBlob: (documents: DossierDocxDocuments) => Blob | Promise<Blob>;
};

export const DOSSIER_DOCX_PROFILES: readonly DossierDocxProfile[] = [
  {
    templateId: "brief",
    label: "Brief",
    architecture: "native",
    visualModel: {
      cover: "plain",
      letter: "edge-bars",
      cv: "edge-bars",
    },
    supports: briefDossierDocxSupported,
    createBlob: ({ cover, letter, cv }) => createBriefDossierDocxBlob(cover, letter, cv),
  },
  {
    templateId: "freundlich",
    label: "Warm",
    architecture: "native+polish",
    visualModel: {
      cover: "organic-hero",
      letter: "organic-masthead",
      cv: "banded",
    },
    supports: warmDossierDocxSupported,
    createBlob: ({ cover, letter, cv }) => createPolishedWarmDossierDocxBlob(cover, letter, cv),
  },
  {
    templateId: "studio3",
    label: "Studio 3",
    architecture: "native+transform+polish",
    visualModel: {
      cover: "editorial-split",
      letter: "two-tone-masthead",
      cv: "two-tone-masthead",
    },
    supports: studio3DossierDocxSupported,
    createBlob: ({ cover, letter, cv }) => createPolishedStudio3DossierDocxBlob(cover, letter, cv),
  },
] as const;

export const DOSSIER_DOCX_SUPPORTED_LABELS = DOSSIER_DOCX_PROFILES.map(
  (profile) => profile.label,
);

export function resolveDossierDocxProfile(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  return DOSSIER_DOCX_PROFILES.find((profile) => profile.supports(cover, letter, cv)) ?? null;
}

export function dossierDocxSupported(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  return resolveDossierDocxProfile(cover, letter, cv) !== null;
}

export async function createDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const profile = resolveDossierDocxProfile(cover, letter, cv);
  if (!profile) {
    throw new Error(
      `DOCX ist derzeit für ${DOSSIER_DOCX_SUPPORTED_LABELS.join(", ")} verfügbar.`,
    );
  }
  return profile.createBlob({ cover, letter, cv });
}

export async function downloadDossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(await createDossierDocxBlob(cover, letter, cv), fileName);
}
