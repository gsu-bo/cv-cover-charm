import type { TemplateId } from "@/components/cover/types";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierFooterContentBottomMmForOptions,
  dossierFooterVisualHeightMmForOptions,
  dossierHeaderContentTopMmForOptions,
  dossierHeaderVisualHeightMmForOptions,
  effectiveDossierHeaderModeForOptions,
  type DossierChromeOptions,
} from "@/lib/dossier-chrome";
import {
  dossierPageMarginMinimumsForContentMinimums,
  dossierPageMarginsFromContentMargins,
  resolveDossierContentMargins,
  type DossierPageReserves,
} from "@/lib/dossier-page-geometry";
import {
  CV_PAGE_MARGIN_BOTTOM_MM,
  DOSSIER_PAGE_MARGIN_MIN_MM,
  getDossierPageMargins,
  type DossierPageMargins,
} from "@/lib/dossier-page-margins";
import { getCvContinuationTopMarginMm } from "./layout";

/**
 * Bauformen des Lebenslaufs.
 *
 * Der Lebenslauf übernimmt vom Titelblatt nicht dessen Hintergrundbild, sondern
 * dessen *Bauform*: was die grossen Flächen tun. Ein blasser Abzug der ganzen
 * Titelseite wäre auf einem Textblatt weder sichtbar noch lesbar – die Fläche
 * an der richtigen Stelle dagegen macht die Verwandtschaft sofort erkennbar.
 */
export type CvArchetypeId = "column" | "band" | "card" | "quiet";

export type CvFrame = {
  id: CvArchetypeId;
  columnMm: number;
  headFirstMm: number;
  headRestMm: number;
  footMm: number;
  bandMotif: boolean;
  footRule: boolean;
  cardInsetMm: number;
  cardRadiusMm: number;
  firstPageContentTopMm: number | null;
  borderInsetMm: number;
  borderDouble: boolean;
};

const base: CvFrame = {
  id: "quiet",
  columnMm: 0,
  headFirstMm: 0,
  headRestMm: 0,
  footMm: 0,
  bandMotif: false,
  footRule: false,
  cardInsetMm: 0,
  cardRadiusMm: 0,
  firstPageContentTopMm: null,
  borderInsetMm: 0,
  borderDouble: false,
};

const column = (columnMm: number, extra: Partial<CvFrame> = {}): CvFrame => ({
  ...base,
  id: "column",
  columnMm,
  ...extra,
});

const band = (headFirstMm: number, extra: Partial<CvFrame> = {}): CvFrame => ({
  ...base,
  id: "band",
  headFirstMm,
  headRestMm: headFirstMm === 0 ? 0 : Math.min(headFirstMm, 14),
  ...extra,
});

const card = (
  cardInsetMm: number,
  cardRadiusMm: number,
  extra: Partial<CvFrame> = {},
): CvFrame => ({
  ...base,
  id: "card",
  cardInsetMm,
  cardRadiusMm,
  ...extra,
});

const quiet = (borderInsetMm: number, extra: Partial<CvFrame> = {}): CvFrame => ({
  ...base,
  id: "quiet",
  borderInsetMm,
  ...extra,
});

/** Eine einzige Zuordnung Vorlage → CV-Bauform. */
const FRAMES: Record<TemplateId, CvFrame> = {
  brief: quiet(0),
  studio: column(72, { footMm: 6, headFirstMm: 38, headRestMm: 13 }),
  terracotta: column(70),
  // Blockig keeps the narrow structural rail used by its letter instead of
  // reserving a 66 mm pseudo-sidebar with no content in the classic CV layout.
  blockig: column(19),

  sonne: band(54, { bandMotif: true }),
  freundlich: band(52, { bandMotif: true }),
  aurora: band(56, { bandMotif: true, footMm: 5 }),
  edelBlockig: band(36, { footMm: 16, footRule: true }),
  colorful: band(40, { footMm: 8 }),
  welle: band(0, { footMm: 24, footRule: true }),
  serioes: band(6, { footMm: 3 }),
  modern: band(0),

  citrus: card(12, 8),
  verlauf: card(12, 6),
  neon: card(12, 6, { firstPageContentTopMm: 15 }),

  klassisch: quiet(10),
  edel: quiet(12, { borderDouble: true }),
  pastell: quiet(12, { headFirstMm: 8, headRestMm: 8 }),
  human: quiet(0),
  sonnig: quiet(0),
};

export function cvFrameFor(template: TemplateId): CvFrame {
  if ((template as string) === "edelDark") return FRAMES.edel;
  return FRAMES[template] ?? FRAMES.klassisch;
}

export function templatesForArchetype(id: CvArchetypeId): TemplateId[] {
  return (Object.entries(FRAMES) as Array<[TemplateId, CvFrame]>)
    .filter(([, frame]) => frame.id === id)
    .map(([template]) => template);
}

export type CvContentBox = { left: number; right: number; top: number; bottom: number };
export type CvRenderLayout = "classic" | "modern";

const MARGIN_X = 20;
const GAP = 8;
export const FOOTER_MM = 9;

const SHEET_MM = 210;
export const SIDEBAR_PCT_MIN = 0.22;
export const SIDEBAR_PCT_MAX = 0.5;

export function sidebarWidthMm(frame: CvFrame, layout: CvRenderLayout, sidebarPct = 0.3): number {
  if (frame.id === "column") return frame.columnMm;
  if (layout !== "modern") return 0;
  const pct = Math.min(SIDEBAR_PCT_MAX, Math.max(SIDEBAR_PCT_MIN, sidebarPct));
  return Math.round(SHEET_MM * pct);
}

const SURFACE_PAD = 5;
const roundHalfMm = (value: number) => Math.round(value * 2) / 2;

/**
 * Page 1 keeps the shared dossier gap. From page 2 onward the CV owns one
 * independent top margin, so no second hidden header-gap value is added.
 */
function cvChromeForPage(chrome: DossierChromeOptions, pageIndex: number): DossierChromeOptions {
  return pageIndex > 0 ? { ...chrome, headerGapMm: 0 } : chrome;
}

export function cvPageReserves(
  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
  pageIndex = 0,
): DossierPageReserves {
  const pageChrome = cvChromeForPage(chrome, pageIndex);
  const headerReserveMm = dossierHeaderVisualHeightMmForOptions(pageChrome, pageIndex);
  return {
    headerReserveMm,
    headerGapMm: headerReserveMm > 0 ? Math.min(40, Math.max(0, pageChrome.headerGapMm ?? 12)) : 0,
    footerReserveMm: dossierFooterVisualHeightMmForOptions(pageChrome),
  };
}

/**
 * Die gemeinsame Dossier-Chrome besitzt ab jetzt die Kopf-/Fusszone. Die
 * weisse CV-Schreibfläche deckt deshalb die früheren, teils riesigen
 * template-spezifischen Kopf-/Fussbänder ab, sobald deren gemeinsame Zone endet.
 * Seitenspalte, Karte und Rahmen bleiben als eigentliche Bauform erhalten.
 */
/**
 * Final readable top edge for CV continuation pages. The user-owned page-2
 * margin replaces the normal page-1 physical top margin, while visible chrome
 * and structural card/frame interiors remain hard safety floors.
 */
export function cvContinuationContentTopMm(
  frame: CvFrame,
  requestedTopMm: number,
  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
  pageIndex = 1,
): number {
  const pageChrome = cvChromeForPage(chrome, pageIndex);
  const headerFloor = dossierHeaderVisualHeightMmForOptions(pageChrome, pageIndex);
  const structuralFloor =
    frame.id === "card"
      ? frame.cardInsetMm + 11
      : frame.id === "quiet" && frame.borderInsetMm > 0
        ? frame.borderInsetMm + 7
        : 0;
  return roundHalfMm(Math.max(0, requestedTopMm, headerFloor, structuralFloor));
}

export function cvSurface(
  frame: CvFrame,
  pageIndex: number,
  layout: CvRenderLayout,
  sidebarPct?: number,
  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
): CvContentBox {
  const header = dossierHeaderVisualHeightMmForOptions(chrome, pageIndex);
  const footer = dossierFooterVisualHeightMmForOptions(chrome);

  if (frame.id === "card") {
    const inset = frame.cardInsetMm;
    return {
      left: inset,
      right: inset,
      top: Math.max(inset, header),
      bottom: Math.max(inset, footer),
    };
  }

  // Decorative paper geometry remains template-owned. User page margins move
  // only the text/content box and must never drag a frame or paper surface.
  const box = cvDefaultContentBox(frame, pageIndex, layout, sidebarPct, chrome);

  if (frame.id === "quiet") {
    const frameClearance = frame.borderInsetMm ? frame.borderInsetMm + 2 : 0;
    return {
      left: Math.max(0, box.left - SURFACE_PAD),
      right: Math.max(0, box.right - SURFACE_PAD),
      top: Math.max(header, frameClearance),
      bottom: Math.max(footer, frameClearance),
    };
  }

  return {
    left: sidebarWidthMm(frame, layout, sidebarPct),
    right: 0,
    top: header,
    bottom: footer,
  };
}

/** Alte Template-Geometrie bleibt für Hintergrundsignaturen verfügbar. */
export function headTopMm(frame: CvFrame, pageIndex: number): number {
  if (pageIndex > 0) return 0;
  return frame.id === "column" && frame.headFirstMm > 0 ? 24 : 0;
}

/**
 * Bewährter Satzspiegel der gewählten CV-Vorlage. Diese Funktion ignoriert
 * bewusst eigene Seitenränder und ist damit auch die Quelle für die vier
 * Default-Werte im Editor.
 */
export function cvDefaultContentBox(
  frame: CvFrame,
  pageIndex: number,
  layout: CvRenderLayout,
  sidebarPct?: number,
  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
): CvContentBox {
  const pageChrome = cvChromeForPage(chrome, pageIndex);
  const top = dossierHeaderContentTopMmForOptions(pageChrome, pageIndex);
  const bottom = dossierFooterContentBottomMmForOptions(pageChrome);

  if (frame.id === "card") {
    const inset = frame.cardInsetMm + 11;
    const contentTop =
      pageIndex === 0 &&
      frame.firstPageContentTopMm !== null &&
      effectiveDossierHeaderModeForOptions(pageChrome, pageIndex) === "none"
        ? frame.firstPageContentTopMm
        : Math.max(top, inset);
    const side = sidebarWidthMm(frame, layout, sidebarPct);
    return {
      left: side > 0 ? frame.cardInsetMm + side + GAP : inset,
      right: inset,
      top: contentTop,
      bottom: Math.max(bottom, inset),
    };
  }

  const side = sidebarWidthMm(frame, layout, sidebarPct);
  if (side > 0) {
    return { left: side + GAP, right: MARGIN_X, top, bottom };
  }

  if (frame.id === "quiet" && frame.borderInsetMm > 0) {
    const inset = frame.borderInsetMm + 7;
    return {
      left: inset,
      right: inset,
      top: Math.max(top, inset),
      bottom: Math.max(bottom, inset),
    };
  }

  return { left: MARGIN_X, right: MARGIN_X, top, bottom };
}

/**
 * Harte Sicherheitszone für eigene CV-Seitenränder. Vertikale Header-/Footer-
 * Reserven werden separat durch den gemeinsamen Dossier-Vertrag addiert. Der
 * physische untere Rand ist absichtlich immer 1 mm, damit die letzte Rubrik
 * (typischerweise Referenzen) nicht durch einen hohen Template-Rand verschwindet.
 */
export function cvSafePageMarginMinimums(
  frame: CvFrame,
  pageIndex: number,
  layout: CvRenderLayout,
  sidebarPct?: number,
  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
): DossierPageMargins {
  const floor = DOSSIER_PAGE_MARGIN_MIN_MM;
  const side = sidebarWidthMm(frame, layout, sidebarPct);
  let contentMinimums: DossierPageMargins = {
    top: floor,
    right: floor,
    bottom: floor,
    left: floor,
  };

  if (frame.id === "card") {
    const edge = frame.cardInsetMm + 7;
    const contentTopEdge =
      pageIndex === 0 &&
      frame.firstPageContentTopMm !== null &&
      effectiveDossierHeaderModeForOptions(chrome, pageIndex) === "none"
        ? frame.firstPageContentTopMm
        : edge;
    contentMinimums = {
      left: roundHalfMm(side > 0 ? frame.cardInsetMm + side + GAP : edge),
      right: roundHalfMm(edge),
      top: roundHalfMm(contentTopEdge),
      bottom: roundHalfMm(edge),
    };
  } else if (frame.id === "quiet" && frame.borderInsetMm > 0) {
    const edge = frame.borderInsetMm + 5;
    contentMinimums = {
      left: roundHalfMm(Math.max(edge, side > 0 ? side + GAP : edge)),
      right: roundHalfMm(edge),
      top: roundHalfMm(edge),
      bottom: roundHalfMm(edge),
    };
  } else if (side > 0) {
    contentMinimums = {
      left: roundHalfMm(side + GAP),
      right: floor,
      top: floor,
      bottom: floor,
    };
  }

  const minimums = dossierPageMarginMinimumsForContentMinimums(
    contentMinimums,
    cvPageReserves(chrome, pageIndex),
  );
  return { ...minimums, bottom: CV_PAGE_MARGIN_BOTTOM_MM };
}

/**
 * Physical page-margin defaults corresponding to the reviewed CV content box,
 * except for the intentionally global 1 mm bottom margin.
 */
export function cvDefaultPageMargins(
  frame: CvFrame,
  pageIndex: number,
  layout: CvRenderLayout,
  sidebarPct?: number,
  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
): DossierPageMargins {
  const minimums = cvSafePageMarginMinimums(frame, pageIndex, layout, sidebarPct, chrome);
  const resolved =
    dossierPageMarginsFromContentMargins(
      cvDefaultContentBox(frame, pageIndex, layout, sidebarPct, chrome),
      minimums,
      cvPageReserves(chrome, pageIndex),
    ) ?? minimums;
  return { ...resolved, bottom: CV_PAGE_MARGIN_BOTTOM_MM };
}

/**
 * Textbereich einer CV-Seite. Links/rechts/oben behalten die bestehende
 * vorlagenabhängige Geometrie; unten gilt für jede Vorlage 1 mm physischer Rand.
 * Shared header/footer reserve is composed on top exactly once.
 */
export function cvContentBox(
  frame: CvFrame,
  pageIndex: number,
  layout: CvRenderLayout,
  sidebarPct?: number,
  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
): CvContentBox {
  const fallback = cvDefaultContentBox(frame, pageIndex, layout, sidebarPct, chrome);
  const custom = getDossierPageMargins("cv");
  const pageMargins = custom ?? cvDefaultPageMargins(frame, pageIndex, layout, sidebarPct, chrome);
  const resolved =
    resolveDossierContentMargins(
      { ...pageMargins, bottom: CV_PAGE_MARGIN_BOTTOM_MM },
      cvSafePageMarginMinimums(frame, pageIndex, layout, sidebarPct, chrome),
      cvPageReserves(chrome, pageIndex),
    ) ?? fallback;

  // A modern sidebar is a structural rail, not merely a page-margin hint.
  // Keep the full reviewed 8 mm gutter at the final content-box boundary even
  // while persisted state/template hydration is settling. This makes the
  // physical renderer unable to collapse to the old ~1 mm clearance.
  const side = sidebarWidthMm(frame, layout, sidebarPct);
  const sidebarFloor =
    side > 0 ? (frame.id === "card" ? frame.cardInsetMm + side + GAP : side + GAP) : null;
  const guarded =
    sidebarFloor === null ? resolved : { ...resolved, left: Math.max(resolved.left, sidebarFloor) };

  if (pageIndex === 0) return guarded;

  return {
    ...guarded,
    top: cvContinuationContentTopMm(frame, getCvContinuationTopMarginMm(), chrome, pageIndex),
  };
}

/**
 * Der Name wird nicht mehr in ein template-spezifisches CV-Band verschoben:
 * die gemeinsame Dossier-Chrome besitzt den Header und verhindert so zwei
 * konkurrierende Kopfbereiche.
 */
export function headerSitsInBand(frame: CvFrame): boolean {
  void frame;
  return false;
}

/**
 * Die gemeinsame Dossier-Chrome zeichnet auch den CV-Footer. Der historische
 * template-spezifische Seitenmarker wird deshalb unterdrückt.
 */
export function pageMarker(frame: CvFrame): "band" | "sidebar" | "footer" | "none" {
  void frame;
  return "none";
}

export function bandLeftMm(frame: CvFrame, layout: CvRenderLayout): number {
  void layout;
  return frame.id === "column" ? frame.columnMm : 0;
}

/*
 * Kein Aufbau wird erzwungen. Jede der sechs CV-Aufbauten funktioniert mit
 * jeder Vorlage; die gemeinsame Header-/Footer-Chrome ist davon unabhängig.
 */