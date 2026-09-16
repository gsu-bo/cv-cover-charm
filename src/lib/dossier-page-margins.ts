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
export const DOSSIER_PAGE_MARGIN_MAX_MM = 80;

let memoryRaw = "{}";

const roundHalfMm = (value: number) => Math.round(value * 2) / 2;

const normalizedSide = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return roundHalfMm(
    Math.max(DOSSIER_PAGE_MARGIN_MIN_MM, Math.min(DOSSIER_PAGE_MARGIN_MAX_MM, numeric)),
  );
};

export function normalizeDossierPageMargins(value: unknown): DossierPageMargins | null {
  if (!value || typeof value !== "object") return null;
  const incoming = value as Partial<DossierPageMargins>;
  const top = normalizedSide(incoming.top);
  const right = normalizedSide(incoming.right);
  const bottom = normalizedSide(incoming.bottom);
  const left = normalizedSide(incoming.left);
  if (top === null || right === null || bottom === null || left === null) return null;
  return { top, right, bottom, left };
}

export function normalizeDossierPageMarginsState(value: unknown): DossierPageMarginsState {
  if (!value || typeof value !== "object") return {};
  const incoming = value as DossierPageMarginsState;
  const cv = normalizeDossierPageMargins(incoming.cv);
  const letter = normalizeDossierPageMargins(incoming.letter);
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
  const state = stateFromSnapshot();
  // Renderers read this function even when the collapsed control itself has not
  // mounted yet. Keeping the CSS mirror in sync here guarantees that a restored
  // project has the same final letter content box before the first export.
  applyDossierPageMarginsToDocument(state);
  return state[scope] ?? null;
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
  window.dispatchEvent(new CustomEvent(DOSSIER_PAGE_MARGINS_EVENT));
}

export function setDossierPageMargins(
  scope: DossierPageMarginScope,
  value: DossierPageMargins | null,
) {
  const current = stateFromSnapshot();
  const next = { ...current };
  const normalized = normalizeDossierPageMargins(value);
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
