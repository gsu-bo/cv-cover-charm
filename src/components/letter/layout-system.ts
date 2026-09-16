import type { TemplateId } from "@/components/cover/types";
import { cvFrameFor } from "@/components/cv/archetype";
import {
  DOSSIER_PAGE_MARGIN_MIN_MM,
  clampDossierPageMarginsToMinimums,
  getDossierPageMargins,
  type DossierPageMargins,
} from "@/lib/dossier-page-margins";
import { freshLetterSpec } from "./fresh-letter-system";
import "./fresh-letter-integrity.css";
import {
  DEFAULT_LETTER_BEILAGEN,
  type LetterData,
  type LetterDesign,
  type LetterFooterMode,
  type LetterHeaderMode,
  type LetterTemplateId,
} from "./types";
import {
  isWarmFirstPageCompactHeader,
  WARM_FIRST_PAGE_HEADER_HEIGHT_MM,
} from "./warm-letter-layout";

export const LETTER_PAGE_MM = { width: 210, height: 297 } as const;

export type LetterArchetype = "quiet" | "band" | "sidebar" | "frame" | "fresh";

export type LetterPageContext = {
  /** Zero-based page index. Current editor renders page 0; pagination can reuse the same geometry later. */
  pageIndex?: number;
  /** Attachments belong only on the final page of a multi-page letter. */
  finalPage?: boolean;
  /** Additional template-owned whitespace after the header. Ignored once the user owns the page margins. */
  headerGapMm?: number;
};

type MmRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type MmBar = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type LetterPageGeometry = {
  pageIndex: number;
  firstPage: boolean;
  finalPage: boolean;
  archetype: LetterArchetype;
  freshTemplate: boolean;
  requestedHeaderMode: LetterHeaderMode;
  effectiveHeaderMode: LetterHeaderMode;
  requestedFooterMode: LetterFooterMode;
  effectiveFooterMode: LetterFooterMode;
  content: MmRect & { width: number; height: number };
  header: {
    contactHeight: number;
    contactLeft: number;
    contactRight: number;
    contactTop: number;
    contactMinHeight: number;
    sidebarWidth: number;
    compactTopBandHeight: number;
    compactAccent: MmBar;
    compactLineTop: number;
    compactPill: MmBar | null;
  };
  footer: {
    height: number;
    contentLeft: number;
    contentRight: number;
    paddingY: number;
    showAttachments: boolean;
  };
};

/**
 * Established templates remain archetype-based. Fresh templates own explicit
 * left/right insets in fresh-letter-system.ts because their letter signatures
 * are intentionally independent from CV geometry and from legacy `klassisch`
 * fallback behaviour.
 */
const CONTENT_INSETS: Record<LetterArchetype, { left: number; right: number }> = {
  quiet: { left: 24, right: 23 },
  fresh: { left: 25, right: 24 },
  band: { left: 24, right: 23 },
  sidebar: { left: 30, right: 23 },
  frame: { left: 27, right: 27 },
};

/**
 * CV geometry is used only as a structural visual reference for established
 * templates. Fresh templates are resolved first from their dedicated letter
 * registry, so they can never silently inherit legacy CV dimensions.
 */
export function letterArchetypeFor(template: LetterTemplateId): LetterArchetype {
  const fresh = freshLetterSpec(template);
  if (fresh) return fresh.archetype;

  if (template === "brief") return "quiet";

  const reference = cvFrameFor(template as TemplateId);
  const activeBand = reference.id === "band" && (reference.headFirstMm > 0 || reference.footMm > 0);

  if (reference.id === "column") return "sidebar";
  if (reference.id === "card" || reference.cardInsetMm > 0 || reference.borderInsetMm > 0) {
    return "frame";
  }
  if (activeBand) return "band";
  return "quiet";
}

export function visibleLetterAttachments(data: LetterData): string[] {
  const values = data.beilagen?.length ? data.beilagen : [...DEFAULT_LETTER_BEILAGEN];
  return values.filter((value) => value.trim());
}

export function letterFooterHeightMm(
  data: LetterData,
  mode: LetterFooterMode,
  heightOverrideMm: number | null = null,
): number {
  if (mode === "none") return 0;
  if (heightOverrideMm !== null && Number.isFinite(heightOverrideMm)) {
    return mode === "compact"
      ? Math.min(18, Math.max(1, heightOverrideMm))
      : Math.min(40, Math.max(4, heightOverrideMm));
  }
  if (mode === "compact") return 2.4;

  const attachments = data.showBeilagen !== false ? visibleLetterAttachments(data) : [];
  if (!attachments.length) return 4;

  // Footer text has roughly 140 mm usable width next to the heading. Reserve
  // space for wrapped long attachment names instead of sizing by item count only.
  const visualLineCount = attachments.reduce(
    (sum, value) => sum + Math.max(1, Math.ceil(value.trim().length / 56)),
    0,
  );
  return Math.min(30, 7 + visualLineCount * 3.8);
}

function effectiveHeaderMode(design: LetterDesign): LetterHeaderMode {
  // Header modes have the same semantic meaning as in the CV. The shared chrome
  // renderer decides how the contact mode is visually condensed on continuation pages.
  return design.headerMode ?? "compact";
}

function effectiveFooterMode(design: LetterDesign, finalPage: boolean): LetterFooterMode {
  const requested = design.footerMode ?? "compact";
  // Attachment lists belong on the final page only. Earlier pages keep the compact band.
  if (requested === "attachments" && !finalPage) return "compact";
  return requested;
}

function letterHeaderVisualHeightMm(
  design: LetterDesign,
  pageIndex: number,
  mode: LetterHeaderMode,
): number {
  if (mode === "none") return 0;
  const custom = design.headerHeightMm;
  if (pageIndex > 0 && mode === "contact") {
    return custom === null || custom === undefined ? 8 : Math.min(18, Math.max(5, custom));
  }
  if (mode === "contact") {
    return custom === null || custom === undefined ? 22 : Math.min(40, Math.max(10, custom));
  }
  return custom === null || custom === undefined ? 3 : Math.min(18, Math.max(1, custom));
}

function letterContentTopMm(
  design: LetterDesign,
  pageIndex: number,
  mode: LetterHeaderMode,
): number {
  if (mode === "none") return pageIndex > 0 ? 16 : 18;

  // Warm's first page deliberately owns a 52 mm masthead. The old generic compact
  // calculation started body flow around 21 mm and then visually dragged the sender
  // upward with a transform. Reserve the real masthead instead so the sender can be
  // centred inside it while recipient/body flow starts naturally below it.
  if (isWarmFirstPageCompactHeader(design.template, mode, pageIndex)) {
    return WARM_FIRST_PAGE_HEADER_HEIGHT_MM;
  }

  const height = letterHeaderVisualHeightMm(design, pageIndex, mode);
  if (pageIndex > 0) {
    return mode === "contact" ? Math.max(18, height + 10) : Math.max(18, height + 15);
  }
  return mode === "contact" ? Math.max(18, height + 9) : Math.max(18, height + 18);
}

const roundHalfMm = (value: number) => Math.round(value * 2) / 2;

/**
 * Hard collision minimums for custom motivation-letter margins. The values are
 * intentionally smaller than the normal template text box where whitespace is
 * optional, but they protect shared header/footer chrome and structural rails,
 * frames and fresh-template edge motifs.
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
  const headerMode = effectiveHeaderMode(design);
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
    // Fresh artwork is confined to the top safety zone or to full-height edge
    // rails. Keep custom text margins clear of those structural motifs.
    templateTop = Math.max(templateTop, 18);
    const railRight = fresh.motifs.reduce((max, motif) => {
      const fullHeightEdgeRail = motif.h >= LETTER_PAGE_MM.height * 0.5 && motif.x < 60;
      return fullHeightEdgeRail ? Math.max(max, motif.x + motif.w) : max;
    }, 0);
    if (railRight > 0) left = Math.max(left, railRight + 5);
  }

  const headerHeight = isWarmFirstPageCompactHeader(design.template, headerMode, pageIndex)
    ? WARM_FIRST_PAGE_HEADER_HEIGHT_MM
    : letterHeaderVisualHeightMm(design, pageIndex, headerMode);
  const top = Math.max(templateTop, headerMode === "none" ? floor : headerHeight + 5);
  const bottom = Math.max(templateBottom, footerMode === "none" ? floor : footerHeight + 5);

  return {
    top: roundHalfMm(top),
    right: roundHalfMm(right),
    bottom: roundHalfMm(bottom),
    left: roundHalfMm(left),
  };
}

export function letterPageGeometry(
  data: LetterData,
  design: LetterDesign,
  context: LetterPageContext = {},
): LetterPageGeometry {
  const pageIndex = Math.max(0, context.pageIndex ?? 0);
  const firstPage = pageIndex === 0;
  const finalPage = context.finalPage ?? true;
  const fresh = freshLetterSpec(design.template);
  const archetype = fresh?.archetype ?? letterArchetypeFor(design.template);
  const freshTemplate = fresh !== null;
  const requestedHeaderMode = design.headerMode ?? "compact";
  const requestedFooterMode = design.footerMode ?? "compact";
  const headerMode = effectiveHeaderMode(design);
  const footerMode = effectiveFooterMode(design, finalPage);
  const footerHeight = letterFooterHeightMm(data, footerMode, design.footerHeightMm ?? null);
  const defaultInsets = fresh
    ? { left: fresh.left, right: fresh.right }
    : CONTENT_INSETS[archetype];
  const defaultTop = letterContentTopMm(design, pageIndex, headerMode);
  const defaultBottom =
    footerMode === "none"
      ? 10
      : footerMode === "attachments"
        ? footerHeight + 7
        : footerHeight + 14.6;
  const storedCustomMargins = getDossierPageMargins("letter");
  const customMargins = storedCustomMargins
    ? clampDossierPageMarginsToMinimums(
        storedCustomMargins,
        letterSafePageMarginMinimums(data, design, context),
      )
    : null;
  const headerGapMm =
    customMargins || headerMode === "none"
      ? 0
      : Math.min(40, Math.max(0, context.headerGapMm ?? 0));
  const insets = customMargins
    ? { left: customMargins.left, right: customMargins.right }
    : defaultInsets;
  const top = customMargins?.top ?? defaultTop + headerGapMm;
  const bottom = customMargins?.bottom ?? defaultBottom;
  const width = LETTER_PAGE_MM.width - insets.left - insets.right;
  const height = LETTER_PAGE_MM.height - top - bottom;
  const showAttachments =
    footerMode === "attachments" &&
    finalPage &&
    data.showBeilagen !== false &&
    visibleLetterAttachments(data).length > 0;

  return {
    pageIndex,
    firstPage,
    finalPage,
    archetype,
    freshTemplate,
    requestedHeaderMode,
    effectiveHeaderMode: headerMode,
    requestedFooterMode,
    effectiveFooterMode: footerMode,
    content: {
      left: insets.left,
      right: insets.right,
      top,
      bottom,
      width,
      height,
    },
    header: {
      contactHeight: letterHeaderVisualHeightMm(design, pageIndex, "contact"),
      contactLeft: 24,
      contactRight: 23,
      contactTop: 3.1,
      contactMinHeight: 15,
      sidebarWidth: archetype === "sidebar" ? 6 : 0,
      compactTopBandHeight: archetype === "band" ? 5 : 0,
      // Global compact-header rule: decorative chrome must be edge-anchored and coherent.
      // Detached mini-bars, hairlines and pills are forbidden for every template.
      compactAccent: { left: 0, top: 0, width: 0, height: 0 },
      compactLineTop: 0,
      compactPill: null,
    },
    footer: {
      height: footerHeight,
      contentLeft: 24,
      contentRight: 23,
      paddingY: 2.2,
      showAttachments,
    },
  };
}
