export type DossierPageMarginScope = "cv" | "letter";

export type DossierPageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type DossierPageMarginsState = Partial<Record<DossierPageMarginScope, DossierPageMargins>>;

export const DOSSIER_PAGE_MARGINS_STORAGE_KEY = "bewerbungsdossier:page-margins:v1";
export const DOSSIER_PAGE_MARGINS_EVENT = "bewerbungsdossier-page-margins-change";
export const DOSSIER_PAGE_MARGIN_MIN_MM = 5;
/** CVs deliberately keep the physical bottom margin tiny so the final rubric can still print. */
export const CV_PAGE_MARGIN_BOTTOM_MM = 1;
export const DOSSIER_PAGE_MARGIN_MAX_MM = 80;
export const DOSSIER_PAGE_MARGIN_HARD_MAX_MM = 120;

let memoryRaw = "{}";

const roundHalfMm = (value: number) => Math.round(value * 2) / 2;

const normalizedSide = (
  value: unknown,
  max = DOSSIER_PAGE_MARGIN_MAX_MM,
  min = DOSSIER_PAGE_MARGIN_MIN_MM,
): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return roundHalfMm(Math.max(min, Math.min(max, numeric)));
};

const normalizedMinimumSide = (
  value: unknown,
  min = DOSSIER_PAGE_MARGIN_MIN_MM,
): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return min;
  return roundHalfMm(Math.max(min, Math.min(DOSSIER_PAGE_MARGIN_HARD_MAX_MM, numeric)));
};

function normalizeDossierPageMarginsWithMax(
  value: unknown,
  max: number,
): DossierPageMargins | null {
  if (!value || typeof value !== "object") return null;
  const incoming = value as Partial<DossierPageMargins>;
  const top = normalizedSide(incoming.top, max);
  const right = normalizedSide(incoming.right, max);
  const bottom = normalizedSide(incoming.bottom, max);
  const left = normalizedSide(incoming.left, max);
  if (top === null || right === null || bottom === null || left === null) return null;
  return { top, right, bottom, left };
}

export function normalizeDossierPageMargins(value: unknown): DossierPageMargins | null {
  return normalizeDossierPageMarginsWithMax(value, DOSSIER_PAGE_MARGIN_MAX_MM);
}

function normalizeStoredDossierPageMargins(value: unknown): DossierPageMargins | null {
  return normalizeDossierPageMarginsWithMax(value, DOSSIER_PAGE_MARGIN_HARD_MAX_MM);
}

function normalizeStoredCvPageMargins(value: unknown): DossierPageMargins | null {
  const normalized = normalizeStoredDossierPageMargins(value);
  return normalized ? { ...normalized, bottom: CV_PAGE_MARGIN_BOTTOM_MM } : null;
}

export function clampDossierPageMarginsToMinimums(
  value: unknown,
  minimums: Partial<DossierPageMargins>,
): DossierPageMargins | null {
  if (!value || typeof value !== "object") return null;
  const incoming = value as Partial<DossierPageMargins>;
  const clampSide = (side: keyof DossierPageMargins): number | null => {
    const minimumRaw = minimums[side];
    const lowerBound =
      side === "bottom" && Number(minimumRaw) < DOSSIER_PAGE_MARGIN_MIN_MM
        ? CV_PAGE_MARGIN_BOTTOM_MM
        : DOSSIER_PAGE_MARGIN_MIN_MM;
    const minimum = normalizedMinimumSide(minimumRaw, lowerBound);
    const normalized = normalizedSide(incoming[side], DOSSIER_PAGE_MARGIN_HARD_MAX_MM, lowerBound);
    return normalized === null ? null : roundHalfMm(Math.max(normalized, minimum));
  };
  const top = clampSide("top");
  const right = clampSide("right");
  const bottom = clampSide("bottom");
  const left = clampSide("left");
  if (top === null || right === null || bottom === null || left === null) return null;
  return { top, right, bottom, left };
}

export function normalizeDossierPageMarginsState(value: unknown): DossierPageMarginsState {
  if (!value || typeof value !== "object") return {};
  const incoming = value as DossierPageMarginsState;
  // Existing CV saves are intentionally migrated as well: a previously large
  // bottom margin must not keep hiding the final References rubric in PDF output.
  const cv = normalizeStoredCvPageMargins(incoming.cv);
  const letter = normalizeStoredDossierPageMargins(incoming.letter);
  return {
    ...(cv ? { cv } : {}),
    ...(letter ? { letter } : {}),
  };
}

function rawSnapshot(): string {
  if (typeof window === "undefined") return memoryRaw;
  try {
    const stored = window.localStorage.getItem(DOSSIER_PAGE_MARGINS_STORAGE_KEY);
    if (stored !== null) {
      memoryRaw = stored;
      return stored;
    }
  } catch {
    // Fall back to the in-memory session state when storage is unavailable.
  }
  return memoryRaw;
}

function stateFromSnapshot(): DossierPageMarginsState {
  try {
    return normalizeDossierPageMarginsState(JSON.parse(rawSnapshot()) as unknown);
  } catch {
    return {};
  }
}

export function getDossierPageMarginsSnapshot(): string {
  return rawSnapshot();
}

export function getDossierPageMarginsState(): DossierPageMarginsState {
  return stateFromSnapshot();
}

export function getDossierPageMargins(scope: DossierPageMarginScope): DossierPageMargins | null {
  return stateFromSnapshot()[scope] ?? null;
}

function writeState(state: DossierPageMarginsState) {
  const normalized = normalizeDossierPageMarginsState(state);
  const raw = JSON.stringify(normalized);
  memoryRaw = raw;
  if (typeof window === "undefined") return;
  try {
    if (!Object.keys(normalized).length) {
      window.localStorage.removeItem(DOSSIER_PAGE_MARGINS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(DOSSIER_PAGE_MARGINS_STORAGE_KEY, raw);
    }
  } catch {
    // The in-memory copy still keeps the current editor session responsive.
  }
  applyDossierPageMarginsToDocument(normalized);
  if (typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(DOSSIER_PAGE_MARGINS_EVENT));
  }
}

export function setDossierPageMargins(
  scope: DossierPageMarginScope,
  value: DossierPageMargins | null,
) {
  const current = stateFromSnapshot();
  const next = { ...current };
  const normalized = normalizeStoredDossierPageMargins(value);
  if (normalized) next[scope] = normalized;
  else delete next[scope];
  writeState(next);
}

export function clearDossierPageMargins() {
  writeState({});
}

export function subscribeDossierPageMargins(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (event.key !== DOSSIER_PAGE_MARGINS_STORAGE_KEY) return;
    memoryRaw = event.newValue ?? "{}";
    applyDossierPageMarginsToDocument(stateFromSnapshot());
    onChange();
  };
  window.addEventListener(DOSSIER_PAGE_MARGINS_EVENT, local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(DOSSIER_PAGE_MARGINS_EVENT, local);
    window.removeEventListener("storage", storage);
  };
}

export function readPortableDossierPageMarginsState(): DossierPageMarginsState | undefined {
  const state = stateFromSnapshot();
  return Object.keys(state).length ? state : undefined;
}

export function applyPortableDossierPageMarginsState(value: unknown) {
  writeState(normalizeDossierPageMarginsState(value));
}

export function applyDossierPageMarginsToDocument(
  state: DossierPageMarginsState = stateFromSnapshot(),
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const scope of ["cv", "letter"] as const) {
    const margins = state[scope];
    const datasetKey = scope === "cv" ? "cvPageMargins" : "letterPageMargins";
    if (!margins) {
      delete root.dataset[datasetKey];
      for (const side of ["top", "right", "bottom", "left"] as const) {
        root.style.removeProperty(`--${scope}-page-margin-${side}`);
      }
      continue;
    }
    root.dataset[datasetKey] = "custom";
    for (const side of ["top", "right", "bottom", "left"] as const) {
      root.style.setProperty(`--${scope}-page-margin-${side}`, `${margins[side]}mm`);
    }
  }
}
