import {
  LETTER_PAGE_MM,
  letterArchetypeFor,
  letterFooterHeightMm,
  type LetterPageContext,
} from "@/components/letter/layout-system";
import { freshLetterSpec } from "@/components/letter/fresh-letter-system";
import type { LetterData, LetterDesign } from "@/components/letter/types";
import {
  isWarmFirstPageCompactHeader,
  WARM_FIRST_PAGE_HEADER_HEIGHT_MM,
} from "@/components/letter/warm-letter-layout";
import {
  DOSSIER_PAGE_MARGIN_MIN_MM,
  type DossierPageMargins,
} from "@/lib/dossier-page-margins";

const roundHalfMm = (value: number) => Math.round(value * 2) / 2;

function headerVisualHeightMm(
  design: LetterDesign,
  pageIndex: number,
  mode: "compact" | "contact" | "none",
): number {
  if (mode === "none") return 0;
  if (isWarmFirstPageCompactHeader(design.template, mode, pageIndex)) {
    return WARM_FIRST_PAGE_HEADER_HEIGHT_MM;
  }
  const custom = design.headerHeightMm;
  if (pageIndex > 0 && mode === "contact") {
    return custom === null || custom === undefined ? 8 : Math.min(18, Math.max(5, custom));
  }
  if (mode === "contact") {
    return custom === null || custom === undefined ? 22 : Math.min(40, Math.max(10, custom));
  }
  return custom === null || custom === undefined ? 3 : Math.min(18, Math.max(1, custom));
}

function effectiveFooterMode(design: LetterDesign, finalPage: boolean) {
  const requested = design.footerMode ?? "compact";
  return requested === "attachments" && !finalPage ? "compact" : requested;
}

/**
 * Minimum page margins that keep motivation-letter text clear of shared chrome
 * and structural template artwork. These are deliberately smaller than the
 * normal template text box where it is safe to let the user tighten spacing.
 */
export function letterSafePageMarginMinimums(
  data: LetterData,
  design: LetterDesign,
  context: LetterPageContext = {},
): DossierPageMargins {
  const floor = DOSSIER_PAGE_MARGIN_MIN_MM;
  const pageIndex = Math.max(0, context.pageIndex ?? 0);
  const finalPage = context.finalPage ?? true;
  const fresh = freshLetterSpec(design.template);
  const archetype = fresh?.archetype ?? letterArchetypeFor(design.template);
  const headerMode = design.headerMode ?? "compact";
  const footerMode = effectiveFooterMode(design, finalPage);
  const footerHeight = letterFooterHeightMm(data, footerMode, design.footerHeightMm ?? null);

  let left = floor;
  let right = floor;
  let templateTop = floor;
  let templateBottom = floor;

  if (archetype === "sidebar") left = Math.max(left, 11);
  if (archetype === "band") templateTop = Math.max(templateTop, 10);
  if (archetype === "frame") {
    left = Math.max(left, 15);
    right = Math.max(right, 15);
    templateTop = Math.max(templateTop, 15);
    templateBottom = Math.max(templateBottom, 15);
  }

  if (fresh) {
    // Fresh motifs are intentionally confined to the first/last 18 mm or to a
    // full-height edge rail. Keep the reading box out of those structural zones.
    templateTop = Math.max(templateTop, 18);
    const railRight = fresh.motifs.reduce((max, motif) => {
      const fullHeightEdgeRail = motif.h >= LETTER_PAGE_MM.height * 0.5 && motif.x < 60;
      return fullHeightEdgeRail ? Math.max(max, motif.x + motif.w) : max;
    }, 0);
    if (railRight > 0) left = Math.max(left, railRight + 5);
  }

  const headerHeight = headerVisualHeightMm(design, pageIndex, headerMode);
  const top = Math.max(
    templateTop,
    headerMode === "none" ? floor : headerHeight + 5,
  );
  const bottom = Math.max(
    templateBottom,
    footerMode === "none" ? floor : footerHeight + 5,
  );

  return {
    top: roundHalfMm(top),
    right: roundHalfMm(right),
    bottom: roundHalfMm(bottom),
    left: roundHalfMm(left),
  };
}
