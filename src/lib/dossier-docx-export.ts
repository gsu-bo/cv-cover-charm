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
import {
  createPolishedLegacyRecipeDossierDocxBlob,
  legacyRecipeDossierDocxSupported,
} from "@/lib/dossier-docx-legacy-recipe-polish";
import { ALL_DOSSIER_DOCX_TEMPLATE_RECIPES } from "@/lib/dossier-docx-template-recipes";
import {
  createGenericFamilyDossierDocxBlob,
  genericFamilyDossierDocxSupported,
} from "@/lib/dossier-docx-family-renderer";
import { dossierDocxTemplatePlan } from "@/lib/dossier-docx-family";
import { downloadBlob } from "@/lib/download";

export type DossierDocxDocuments = {
  cover: CoverPdfDocument;
  letter: LetterPdfDocument;
  cv: CvPdfDocument;
};

export type DossierDocxProfile = {
  templateId: string;
  label: string;
  architecture:
    | "native"
    | "native+polish"
    | "native+transform+polish"
    | "template-recipe"
    | "family-fallback";
  visualModel: {
    cover: string;
    letter: string;
    cv: string;
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

function resolveIndividualRecipeProfile(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
): DossierDocxProfile | null {
  if (!legacyRecipeDossierDocxSupported(cover, letter, cv) || !cover) return null;
  const templateId = String(cover.template);
  const recipe = ALL_DOSSIER_DOCX_TEMPLATE_RECIPES[templateId];
  if (!recipe) return null;

  return {
    templateId,
    label: recipe.label,
    architecture: "template-recipe",
    visualModel: {
      cover: `recipe:${templateId}`,
      letter: `recipe:${templateId}`,
      cv: `recipe:${templateId}`,
    },
    supports: legacyRecipeDossierDocxSupported,
    createBlob: ({ cover: nextCover, letter: nextLetter, cv: nextCv }) =>
      createPolishedLegacyRecipeDossierDocxBlob(nextCover, nextLetter, nextCv),
  };
}

function resolveFamilyFallbackProfile(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
): DossierDocxProfile | null {
  if (!genericFamilyDossierDocxSupported(cover, letter, cv) || !cover) return null;
  const templateId = String(cover.template);
  const plan = dossierDocxTemplatePlan(templateId);
  if (!plan) return null;

  return {
    templateId,
    label: plan.label,
    architecture: "family-fallback",
    visualModel: {
      cover: plan.family,
      letter: plan.family,
      cv: plan.family,
    },
    supports: genericFamilyDossierDocxSupported,
    createBlob: ({ cover: nextCover, letter: nextLetter, cv: nextCv }) =>
      createGenericFamilyDossierDocxBlob(nextCover, nextLetter, nextCv),
  };
}

export function resolveDossierDocxProfile(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  return (
    DOSSIER_DOCX_PROFILES.find((profile) => profile.supports(cover, letter, cv)) ??
    resolveIndividualRecipeProfile(cover, letter, cv) ??
    resolveFamilyFallbackProfile(cover, letter, cv)
  );
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
    throw new Error("DOCX benötigt dieselbe aktive Vorlage in allen drei Dossierteilen.");
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
