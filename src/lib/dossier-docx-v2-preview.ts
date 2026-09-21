import { getCvInfoPosition, getCvLayoutChoiceForTemplate, getCvSectionGapMm } from "@/components/cv/layout";
import { getCvPhotoPlacement } from "@/components/cv/photo-place";
import { getCvPhotoStyle } from "@/components/cv/photo";
import { getCvPlacements } from "@/components/cv/placement";
import { cvBodyData } from "@/lib/dossier-body-contact";
import { getDossierChromeState } from "@/lib/dossier-chrome";
import { createDossierDocxBlob } from "@/lib/dossier-docx-export";
import { applyDossierDocxV2CoverToDocx } from "@/lib/dossier-docx-v2-cover-package";
import { applyDossierDocxV2FlowToDocx } from "@/lib/dossier-docx-v2-flow-package";
import { resolveDossierDocxV2MeasuredFlow } from "@/lib/dossier-docx-v2-flow-browser";
import { calibrateDossierDocxV2FlowScenes } from "@/lib/dossier-docx-v2-flow-calibration";
import { applyDossierDocxV2Metadata } from "@/lib/dossier-docx-v2-metadata";
import { assertDossierDocxV2FlowAccepted } from "@/lib/dossier-docx-v2-flow-qa";
import {
  buildDossierDocxV2CvFlowScene,
  buildDossierDocxV2LetterFlowScene,
} from "@/lib/dossier-docx-v2-flow-scene";
import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { resolveDossierChromeSnapshot } from "@/lib/dossier-resolved-chrome";

/**
 * Shadow-only Cover V2 path. Production export remains the fallback/package
 * owner while the canonical cover renderer is evaluated against all templates.
 */
export async function createDossierDocxV2PreviewBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const production = await createDossierDocxBlob(cover, letter, cv);
  return applyDossierDocxV2CoverToDocx(production, cover);
}

/**
 * Shadow-only structural V2 path: Cover + semantic Letter/CV flow. It deliberately
 * reuses the already-reviewed production package for section properties and
 * shared header/footer parts, then replaces document-body layout ownership.
 * No normal export entry point calls this function.
 */
export async function createDossierDocxV2FlowPreviewBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const resolved = resolveDossierChromeSnapshot({ cover, letter, cv }, getDossierChromeState());
  const bodyCv: CvPdfDocument = { ...cv, data: cvBodyData(cv.data, resolved.cv.options) };
  const production = await createDossierDocxBlob(cover, letter, cv);
  const withCover = await applyDossierDocxV2CoverToDocx(production, cover);
  const baselineLetter = buildDossierDocxV2LetterFlowScene(letter, resolved.letter.options);
  const baselineCv = buildDossierDocxV2CvFlowScene(bodyCv, {
    layout: getCvLayoutChoiceForTemplate(cv.design.template),
    placements: { ...getCvPlacements() },
    infoPosition: getCvInfoPosition(),
    sectionGapMm: getCvSectionGapMm(),
    photoStyle: getCvPhotoStyle(),
    photoPlacement: getCvPhotoPlacement(),
  });
  const measured = await resolveDossierDocxV2MeasuredFlow(letter, cv, resolved);
  const calibrated = calibrateDossierDocxV2FlowScenes(
    { letter: baselineLetter, cv: baselineCv },
    measured,
  );
  assertDossierDocxV2FlowAccepted(calibrated.letter, calibrated.cv);

  // V2 owns semantic body text, colors, alignment, page geometry and the CV
  // artwork layer after this point. Re-running legacy XML text/color passes
  // would create a second renderer and can silently undo browser-measured
  // geometry. Section properties and shared header/footer parts stay inherited
  // from the reviewed production package.
  const flow = await applyDossierDocxV2FlowToDocx(withCover, calibrated);
  return applyDossierDocxV2Metadata(flow, cover);
}
