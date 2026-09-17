import { getDossierChromeState } from "@/lib/dossier-chrome";
import { cvBodyData } from "@/lib/dossier-body-contact";
import { resolveDossierChromeSnapshot } from "@/lib/dossier-resolved-chrome";
import { applyDossierChromeToDocx } from "@/lib/dossier-docx-chrome";
import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import {
  createLazyTemplateDossierDocxBlob,
  hasDossierDocxTemplateLoader,
} from "@/lib/dossier-docx-template-loader";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";
import { dossierDocxTemplatePlan } from "@/lib/dossier-docx-family";
import { applyLetterAlignmentToDocx } from "@/lib/dossier-docx-letter-alignment";
import { applyCvTextAlignmentToDocx } from "@/lib/dossier-docx-cv-alignment";
import { applyDossierHyphenationToDocx } from "@/lib/dossier-docx-hyphenation";
import { applyDossierPageMarginsToDocx } from "@/lib/dossier-docx-page-margins";
import { getDossierHyphenationEnabled } from "@/lib/dossier-hyphenation";
import { downloadBlob } from "@/lib/download";

export type { DossierDocxDocuments };

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

function matchingTemplateId(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  if (!cover || !letter || !cv) return null;
  const coverId = String(cover.template);
  const letterId = String(letter.design.template);
  const cvId = String(cv.design.template);
  return coverId && coverId === letterId && coverId === cvId ? coverId : null;
}

function supportsTemplate(templateId: string) {
  return (
    cover: CoverPdfDocument | null,
    letter: LetterPdfDocument | null,
    cv: CvPdfDocument | null,
  ) => matchingTemplateId(cover, letter, cv) === templateId;
}

function lazyProfileBlob(templateId: string) {
  return (documents: DossierDocxDocuments) =>
    createLazyTemplateDossierDocxBlob(templateId, documents);
}

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
    supports: supportsTemplate("brief"),
    createBlob: lazyProfileBlob("brief"),
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
    supports: supportsTemplate("freundlich"),
    createBlob: lazyProfileBlob("freundlich"),
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
    supports: supportsTemplate("studio3"),
    createBlob: lazyProfileBlob("studio3"),
  },
] as const;

export const DOSSIER_DOCX_SUPPORTED_LABELS = DOSSIER_DOCX_PROFILES.map((profile) => profile.label);

const REVIEWED_TEMPLATE_IDS = new Set(DOSSIER_DOCX_PROFILES.map((profile) => profile.templateId));
const RETIRED_RECIPE_LABELS: Readonly<Record<string, string>> = {
  warm4: "Warm 4",
  warm5: "Warm 5",
};

function resolveIndividualRecipeProfile(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
): DossierDocxProfile | null {
  const templateId = matchingTemplateId(cover, letter, cv);
  if (!templateId || REVIEWED_TEMPLATE_IDS.has(templateId)) return null;
  const plan = dossierDocxTemplatePlan(templateId);
  const label = plan?.label ?? RETIRED_RECIPE_LABELS[templateId];
  if (!label || !hasDossierDocxTemplateLoader(templateId)) return null;

  return {
    templateId,
    label,
    architecture: "template-recipe",
    visualModel: {
      cover: `recipe:${templateId}`,
      letter: `recipe:${templateId}`,
      cv: `recipe:${templateId}`,
    },
    supports: supportsTemplate(templateId),
    createBlob: lazyProfileBlob(templateId),
  };
}

function resolveFamilyFallbackProfile(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
): DossierDocxProfile | null {
  const templateId = matchingTemplateId(cover, letter, cv);
  if (!templateId) return null;
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
    supports: supportsTemplate(templateId),
    createBlob: async ({ cover: nextCover, letter: nextLetter, cv: nextCv }) => {
      const { createGenericFamilyDossierDocxBlob, genericFamilyDossierDocxSupported } =
        await import("@/lib/dossier-docx-family-renderer");
      if (!genericFamilyDossierDocxSupported(nextCover, nextLetter, nextCv)) {
        throw new Error(`Kein DOCX-Family-Fallback für ${templateId}.`);
      }
      return createGenericFamilyDossierDocxBlob(nextCover, nextLetter, nextCv);
    },
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
  const resolved = resolveDossierChromeSnapshot({ cover, letter, cv }, getDossierChromeState());
  const blob = await profile.createBlob({
    cover,
    letter,
    cv: { ...cv, data: cvBodyData(cv.data, resolved.cv.options) },
  });
  const letterAligned = await applyLetterAlignmentToDocx(blob, letter);
  const aligned = await applyCvTextAlignmentToDocx(letterAligned, cv);
  const hyphenated = await applyDossierHyphenationToDocx(
    aligned,
    letter,
    cv,
    getDossierHyphenationEnabled(),
  );
  const margined = await applyDossierPageMarginsToDocx(hyphenated, letter, cv);
  return applyDossierChromeToDocx(margined, { cover, letter, cv }, resolved);
}

export async function downloadDossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(await createDossierDocxBlob(cover, letter, cv), fileName);
}
