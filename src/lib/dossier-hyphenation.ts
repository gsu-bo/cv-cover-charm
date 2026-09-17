export type DossierHyphenationState = {
  version: 1;
  enabled: boolean;
};

export const DOSSIER_HYPHENATION_STORAGE_KEY = "bewerbungsdossier:hyphenation:v1";
export const DEFAULT_DOSSIER_HYPHENATION_STATE: DossierHyphenationState = {
  version: 1,
  enabled: false,
};

const EVENT = "bewerbungsdossier-hyphenation-change";
let cached: DossierHyphenationState | null = null;

const disabledState = (): DossierHyphenationState => ({
  ...DEFAULT_DOSSIER_HYPHENATION_STATE,
});

/** Automatic hyphenation is retired; legacy/project values are intentionally ignored. */
export function normalizeDossierHyphenationState(_value: unknown): DossierHyphenationState {
  return disabledState();
}

function read(): DossierHyphenationState {
  return disabledState();
}

function storeDisabled() {
  const next = disabledState();
  cached = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.setItem(DOSSIER_HYPHENATION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The current tab still receives the in-memory state and event.
    }
    if (typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT));
    }
  }
}

export function getDossierHyphenationState(): DossierHyphenationState {
  if (!cached) cached = read();
  return cached;
}

export function getDossierHyphenationEnabled(): boolean {
  return false;
}

export function setDossierHyphenationEnabled(_enabled: boolean) {
  storeDisabled();
}

export function subscribeDossierHyphenation(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (event.key !== DOSSIER_HYPHENATION_STORAGE_KEY) return;
    cached = disabledState();
    onChange();
  };
  window.addEventListener(EVENT, local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener("storage", storage);
  };
}

export function readPortableDossierHyphenationState(): DossierHyphenationState {
  return disabledState();
}

export function applyPortableDossierHyphenationState(_value: unknown) {
  storeDisabled();
}
