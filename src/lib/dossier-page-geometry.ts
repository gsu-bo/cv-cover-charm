import {
  DOSSIER_PAGE_MARGIN_MIN_MM,
  clampDossierPageMarginsToMinimums,
  type DossierPageMargins,
} from "@/lib/dossier-page-margins";

export type DossierPageReserves = {
  headerReserveMm: number;
  headerGapMm: number;
  footerReserveMm: number;
};

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;
const ceilHalfMm = (value: number) => Math.ceil(value * 2) / 2;

export function normalizeDossierPageReserves(
  reserves: DossierPageReserves,
): DossierPageReserves {
  const headerReserveMm = finiteNonNegative(reserves.headerReserveMm);
  return {
    headerReserveMm,
    headerGapMm: headerReserveMm > 0 ? finiteNonNegative(reserves.headerGapMm) : 0,
    footerReserveMm: finiteNonNegative(reserves.footerReserveMm),
  };
}

/**
 * Compose user-owned physical page margins with shared header/footer reserves.
 * Horizontal page margins are the readable boundaries. Vertical chrome reserve
 * is added exactly once on top of those physical margins.
 */
export function resolveDossierContentMargins(
  pageMargins: DossierPageMargins,
  minimumPageMargins: Partial<DossierPageMargins>,
  reserves: DossierPageReserves,
): DossierPageMargins | null {
  const safePageMargins = clampDossierPageMarginsToMinimums(pageMargins, minimumPageMargins);
  if (!safePageMargins) return null;
  const resolved = normalizeDossierPageReserves(reserves);
  return {
    left: safePageMargins.left,
    right: safePageMargins.right,
    top: safePageMargins.top + resolved.headerReserveMm + resolved.headerGapMm,
    bottom: safePageMargins.bottom + resolved.footerReserveMm,
  };
}

/**
 * Convert a reviewed content rectangle back into the physical page margins that
 * would reproduce it under the same shared chrome reserve. Used by editor
 * defaults so enabling custom margins does not accidentally double the chrome.
 */
export function dossierPageMarginsFromContentMargins(
  contentMargins: DossierPageMargins,
  minimumPageMargins: Partial<DossierPageMargins>,
  reserves: DossierPageReserves,
): DossierPageMargins | null {
  const resolved = normalizeDossierPageReserves(reserves);
  return clampDossierPageMarginsToMinimums(
    {
      left: contentMargins.left,
      right: contentMargins.right,
      top: Math.max(
        DOSSIER_PAGE_MARGIN_MIN_MM,
        contentMargins.top - resolved.headerReserveMm - resolved.headerGapMm,
      ),
      bottom: Math.max(
        DOSSIER_PAGE_MARGIN_MIN_MM,
        contentMargins.bottom - resolved.footerReserveMm,
      ),
    },
    minimumPageMargins,
  );
}

/**
 * Structural constraints are expressed as final readable-content minimums.
 * Translate them into minimum physical page margins after subtracting the
 * shared chrome reserve. Ceil to the store's 0.5 mm grid so safety never rounds
 * down across a rail, frame or masthead edge.
 */
export function dossierPageMarginMinimumsForContentMinimums(
  contentMinimums: DossierPageMargins,
  reserves: DossierPageReserves,
): DossierPageMargins {
  const resolved = normalizeDossierPageReserves(reserves);
  return {
    left: ceilHalfMm(Math.max(DOSSIER_PAGE_MARGIN_MIN_MM, contentMinimums.left)),
    right: ceilHalfMm(Math.max(DOSSIER_PAGE_MARGIN_MIN_MM, contentMinimums.right)),
    top: ceilHalfMm(
      Math.max(
        DOSSIER_PAGE_MARGIN_MIN_MM,
        contentMinimums.top - resolved.headerReserveMm - resolved.headerGapMm,
      ),
    ),
    bottom: ceilHalfMm(
      Math.max(
        DOSSIER_PAGE_MARGIN_MIN_MM,
        contentMinimums.bottom - resolved.footerReserveMm,
      ),
    ),
  };
}
