import type { CoverPdfDocument } from "@/lib/dossier-pdf-document";
import {
  resolveDossierDocxV2RenderedCover,
  type DossierDocxV2RenderedCover,
} from "@/lib/dossier-docx-v2-cover-browser";
import type { DossierDocxV2CoverQaReport } from "@/lib/dossier-docx-v2-cover-qa";

export type DossierDocxV2CoverGalleryEntry = {
  templateId: string;
  report: DossierDocxV2CoverQaReport;
  rendered: DossierDocxV2RenderedCover;
};

export type DossierDocxV2CoverGalleryReport = {
  accepted: boolean;
  templateCount: number;
  acceptedCount: number;
  blockerCount: number;
  warningCount: number;
  lateLayoutTemplateIds: string[];
  entries: DossierDocxV2CoverGalleryEntry[];
};

/**
 * Sequential on purpose: each hidden CoverCanvas temporarily owns the global
 * dossier-template CSS scope. Parallel rendering would make the gallery itself
 * introduce cross-template races that normal export never has.
 */
export async function auditDossierDocxV2CoverGallery(
  covers: readonly CoverPdfDocument[],
): Promise<DossierDocxV2CoverGalleryReport> {
  const entries: DossierDocxV2CoverGalleryEntry[] = [];
  for (const cover of covers) {
    const rendered = await resolveDossierDocxV2RenderedCover(cover);
    entries.push({
      templateId: String(cover.template),
      report: rendered.qa,
      rendered,
    });
  }

  const acceptedCount = entries.filter((entry) => entry.report.accepted).length;
  const blockerCount = entries.reduce((sum, entry) => sum + entry.report.blockerCount, 0);
  const warningCount = entries.reduce((sum, entry) => sum + entry.report.warningCount, 0);
  const lateLayoutTemplateIds = entries
    .filter((entry) => entry.report.lateLayoutNodeIds.length > 0)
    .map((entry) => entry.templateId);

  return {
    accepted: blockerCount === 0,
    templateCount: entries.length,
    acceptedCount,
    blockerCount,
    warningCount,
    lateLayoutTemplateIds,
    entries,
  };
}
