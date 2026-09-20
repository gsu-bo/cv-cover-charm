import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierHeaderVisualHeightMmForOptions,
  effectiveDossierHeaderModeForOptions,
  hasReducedContinuationHeader,
  type DossierChromeOptions,
} from "@/lib/dossier-chrome";
import type { TemplateId } from "@/components/cover/types";
import { defaultHeaderModeForTemplate, defaultFooterModeForTemplate } from "@/lib/template-chrome";
import { cvFrameFor } from "@/components/cv/archetype";
import {
  dossierPageMarginMinimumsForContentMinimums,
  dossierPageMarginsFromContentMargins,
  resolveDossierContentMargins,
  type DossierPageReserves,
} from "@/lib/dossier-page-geometry";
import {
  DOSSIER_PAGE_MARGIN_MIN_MM,
  getDossierPageMargins,
  type DossierPageMargins,
} from "@/lib/dossier-page-margins";
import { freshLetterSpec } from "./fresh-letter-system";
import { letterPaginationPageContext } from "./letter-page-context";
import "./fresh-letter-integrity.css";
import {
  letterAttachmentValues,
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
  /** Zero-based page index supplied by the shared letter-document paginator. */
  pageIndex?: number;
  /** Attachments belong only on the final page of a multi-page letter. */
  finalPage?: boolean;
  /** Legacy caller override. Live rendering should pass chromeOptions instead. */
  headerGapMm?: number;
  /** Exact shared chrome snapshot used by DossierHeaderFooterChrome for this page. */
  chromeOptions?: DossierChromeOptions;
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
  const values = letterAttachmentValues(data);
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

function requestedHeaderMode(design: LetterDesign, context: LetterPageContext): LetterHeaderMode {
  return context.chromeOptions?.headerMode ?? design.headerMode ?? defaultHeaderModeForTemplate(design.template);
}

function requestedFooterMode(design: LetterDesign, context: LetterPageContext): LetterFooterMode {
  const mode = context.chromeOptions?.footerMode;
  if (mode === "details") return "attachments";
  if (mode === "compact" || mode === "none") return mode;
  return design.footerMode ?? (defaultFooterModeForTemplate(design.template) as LetterFooterMode);
}

function effectiveHeaderMode(
  design: LetterDesign,
  pageIndex: number,
  context: LetterPageContext,
): LetterHeaderMode {
  if (context.chromeOptions) {
    return effectiveDossierHeaderModeForOptions(context.chromeOptions, pageIndex) as LetterHeaderMode;
  }
  return design.headerMode ?? defaultHeaderModeForTemplate(design.template);
}

function effectiveFooterMode(
  design: LetterDesign,
  finalPage: boolean,
  context: LetterPageContext,
): LetterFooterMode {
  const requested = requestedFooterMode(design, context);
  // Attachment lists belong on the final page only. Earlier pages keep the compact band.
  return requested === "attachments" && !finalPage ? "compact" : requested;
}

function legacyLetterHeaderVisualHeightMm(
  design: LetterDesign,
  pageIndex: number,
  mode: LetterHeaderMode,
): number {
  if (mode === "none") return 0;
  const custom = design.headerHeightMm;
  if (hasReducedContinuationHeader({ ...design, headerMode: mode }, pageIndex)) {
    return custom === null || custom === undefined ? 8 : Math.min(18, Math.max(5, custom));
  }
  if (mode === "contact") {
    return custom === null || custom === undefined ? 22 : Math.min(40, Math.max(10, custom));
  }
  return custom === null || custom === undefined ? 3 : Math.min(18, Math.max(1, custom));
}

function letterHeaderVisualHeightMm(
  design: LetterDesign,
  pageIndex: number,
  mode: LetterHeaderMode,
  context: LetterPageContext,
): number {
  if (mode === "none") return 0;
  if (context.chromeOptions) {
    return dossierHeaderVisualHeightMmForOptions(context.chromeOptions, pageIndex);
  }
  return legacyLetterHeaderVisualHeightMm(design, pageIndex, mode);
}

function letterHeaderReserveMm(
  design: LetterDesign,
  pageIndex: number,
  mode: LetterHeaderMode,
  context: LetterPageContext,
): number {
  if (mode === "none") return 0;
  if (isWarmFirstPageCompactHeader(design.template, mode, pageIndex)) {
    return WARM_FIRST_PAGE_HEADER_HEIGHT_MM;
  }
  return letterHeaderVisualHeightMm(design, pageIndex, mode, context);
}

function letterHeaderGapMm(mode: LetterHeaderMode, context: LetterPageContext): number {
  if (mode === "none") return 0;
  const value = context.chromeOptions?.headerGapMm ?? context.headerGapMm ?? 0;
  return Math.min(40, Math.max(0, value));
}

function letterContentTopMm(
  design: LetterDesign,
  pageIndex: number,
  mode: LetterHeaderMode,
  context: LetterPageContext,
): number {
  if (mode === "none") return pageIndex > 0 ? 16 : 18;

  // Warm's first page deliberately owns a 52 mm masthead. Reserve the actual
  // masthead instead of a generic compact-header value.
  if (isWarmFirstPageCompactHeader(design.template, mode, pageIndex)) {
    return WARM_FIRST_PAGE_HEADER_HEIGHT_MM;
  }

  const height = letterHeaderVisualHeightMm(design, pageIndex, mode, context);
  const differentFirstPage = context.chromeOptions
    ? context.chromeOptions.headerDifferentFirstPage !== false
    : design.headerDifferentFirstPage !== false;
  if (pageIndex > 0 && differentFirstPage) {
    return mode === "contact" ? Math.max(18, height + 10) : Math.max(18, height + 15);
  }
  return mode === "contact" ? Math.max(18, height + 9) : Math.max(18, height + 18);
}

function letterPageReservesMm(
  data: LetterData,
  design: LetterDesign,
  context: LetterPageContext,
): DossierPageReserves {
  const paginationContext = letterPaginationPageContext(design);
  const pageIndex = Math.max(0, context.pageIndex ?? paginationContext?.pageIndex ?? 0);
  const finalPage = context.finalPage ?? paginationContext?.finalPage ?? true;
  const headerMode = effectiveHeaderMode(design, pageIndex, context);
  const footerMode = effectiveFooterMode(design, finalPage, context);
  const heightOverride = context.chromeOptions?.footerHeightMm ?? design.footerHeightMm ?? null;
  return {
    headerReserveMm: letterHeaderReserveMm(design, pageIndex, headerMode, context),
    headerGapMm: letterHeaderGapMm(headerMode, context),
    footerReserveMm: letterFooterHeightMm(data, footerMode, heightOverride),
  };
}

const roundHalfMm = (value: number) => Math.round(value * 2) / 2;

/**
 * Hard collision minimums for custom motivation-letter page margins. Shared
 * header/footer reserve is not baked into these values; it is composed exactly
 * once by letterPageGeometry.
 */
export function letterSafePageMarginMinimums(
  data: LetterData,
  design: LetterDesign,
  context: LetterPageContext = {},
): DossierPageMargins {
  const floor = DOSSIER_PAGE_MARGIN_MIN_MM;
  const paginationContext = letterPaginationPageContext(design);
  const pageIndex = Math.max(0, context.pageIndex ?? paginationContext?.pageIndex ?? 0);
  const fresh = freshLetterSpec(design.template);
  const archetype = fresh?.archetype ?? letterArchetypeFor(design.template);

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

  return dossierPageMarginMinimumsForContentMinimums(
    {
      top: roundHalfMm(templateTop),
      right: roundHalfMm(right),
      bottom: roundHalfMm(templateBottom),
      left: roundHalfMm(left),
    },
    letterPageReservesMm(data, design, { ...context, pageIndex }),
  );
}

/** Physical page-margin defaults corresponding to the reviewed Letter content box. */
export function letterDefaultPageMargins(
  data: LetterData,
  design: LetterDesign,
  context: LetterPageContext = {},
): DossierPageMargins {
  const paginationContext = letterPaginationPageContext(design);
  const pageIndex = Math.max(0, context.pageIndex ?? paginationContext?.pageIndex ?? 0);
  const finalPage = context.finalPage ?? paginationContext?.finalPage ?? true;
  const fresh = freshLetterSpec(design.template);
  const archetype = fresh?.archetype ?? letterArchetypeFor(design.template);
  const headerMode = effectiveHeaderMode(design, pageIndex, context);
  const footerMode = effectiveFooterMode(design, finalPage, context);
  const heightOverride = context.chromeOptions?.footerHeightMm ?? design.footerHeightMm ?? null;
  const footerHeight = letterFooterHeightMm(data, footerMode, heightOverride);
  const insets = fresh ? { left: fresh.left, right: fresh.right } : CONTENT_INSETS[archetype];
  const contentMargins: DossierPageMargins = {
    left: insets.left,
    right: insets.right,
    top: letterContentTopMm(design, pageIndex, headerMode, context) + letterHeaderGapMm(headerMode, context),
    bottom:
      footerMode === "none"
        ? 10
        : footerMode === "attachments"
          ? footerHeight + 7
          : footerHeight + 14.6,
  };
  const minimums = letterSafePageMarginMinimums(data, design, context);
  return (
    dossierPageMarginsFromContentMargins(
      contentMargins,
      minimums,
      letterPageReservesMm(data, design, context),
    ) ?? minimums
  );
}

export function letterPageGeometry(
  data: LetterData,
  design: LetterDesign,
  context: LetterPageContext = {},
): LetterPageGeometry {
  const paginationContext = letterPaginationPageContext(design);
  const pageIndex = Math.max(0, context.pageIndex ?? paginationContext?.pageIndex ?? 0);
  const firstPage = pageIndex === 0;
  const finalPage = context.finalPage ?? paginationContext?.finalPage ?? true;
  const fresh = freshLetterSpec(design.template);
  const archetype = fresh?.archetype ?? letterArchetypeFor(design.template);
  const freshTemplate = fresh !== null;
  const requestedHeader = requestedHeaderMode(design, context);
  const requestedFooter = requestedFooterMode(design, context);
  const headerMode = effectiveHeaderMode(design, pageIndex, context);
  const footerMode = effectiveFooterMode(design, finalPage, context);
  const heightOverride = context.chromeOptions?.footerHeightMm ?? design.footerHeightMm ?? null;
  const footerHeight = letterFooterHeightMm(data, footerMode, heightOverride);
  const defaultInsets = fresh
    ? { left: fresh.left, right: fresh.right }
    : CONTENT_INSETS[archetype];
  const headerGapMm = letterHeaderGapMm(headerMode, context);
  const defaultTop = letterContentTopMm(design, pageIndex, headerMode, context) + headerGapMm;
  const defaultBottom =
    footerMode === "none"
      ? 10
      : footerMode === "attachments"
        ? footerHeight + 7
        : footerHeight + 14.6;
  const storedCustomMargins = getDossierPageMargins("letter");
  const customContentMargins = storedCustomMargins
    ? resolveDossierContentMargins(
        storedCustomMargins,
        letterSafePageMarginMinimums(data, design, context),
        letterPageReservesMm(data, design, context),
      )
    : null;
  const insets = customContentMargins
    ? { left: customContentMargins.left, right: customContentMargins.right }
    : defaultInsets;
  const top = customContentMargins?.top ?? defaultTop;
  const bottom = customContentMargins?.bottom ?? defaultBottom;
  const width = LETTER_PAGE_MM.width - insets.left - insets.right;
  const height = LETTER_PAGE_MM.height - top - bottom;
  const showAttachments =
    footerMode === "attachments" &&
    finalPage &&
    data.showBeilagen !== false &&
    visibleLetterAttachments(data).length > 0;
  const contactHeight = context.chromeOptions
    ? dossierHeaderVisualHeightMmForOptions(
        {
          ...DEFAULT_DOSSIER_CHROME_OPTIONS,
          ...context.chromeOptions,
          headerMode: "contact",
          headerContinuationMode: undefined,
        },
        0,
      )
    : legacyLetterHeaderVisualHeightMm(design, pageIndex, "contact");

  return {
    pageIndex,
    firstPage,
    finalPage,
    archetype,
    freshTemplate,
    requestedHeaderMode: requestedHeader,
    effectiveHeaderMode: headerMode,
    requestedFooterMode: requestedFooter,
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
      contactHeight,
      contactLeft: insets.left,
      contactRight: insets.right,
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
      contentLeft: insets.left,
      contentRight: insets.right,
      paddingY: 2.2,
      showAttachments,
    },
  };
}