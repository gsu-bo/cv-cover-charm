export type DossierHyphenationState = {
  version: 1;
  enabled: boolean;
};

export const DOSSIER_HYPHENATION_STORAGE_KEY = "bewerbungsdossier:hyphenation:v1";
export const DEFAULT_DOSSIER_HYPHENATION_STATE: DossierHyphenationState = {
  version: 1,
  enabled: true,
};

const EVENT = "bewerbungsdossier-hyphenation-change";
let cached: DossierHyphenationState | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function normalizeDossierHyphenationState(value: unknown): DossierHyphenationState {
  if (typeof value === "boolean") return { version: 1, enabled: value };
  if (!isRecord(value)) return { ...DEFAULT_DOSSIER_HYPHENATION_STATE };
  return {
    version: 1,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
  };
}

function read(): DossierHyphenationState {
  if (typeof window === "undefined") return { ...DEFAULT_DOSSIER_HYPHENATION_STATE };
  try {
    const raw = window.localStorage?.getItem(DOSSIER_HYPHENATION_STORAGE_KEY);
    return raw
      ? normalizeDossierHyphenationState(JSON.parse(raw))
      : { ...DEFAULT_DOSSIER_HYPHENATION_STATE };
  } catch {
    return { ...DEFAULT_DOSSIER_HYPHENATION_STATE };
  }
}

function store(next: DossierHyphenationState) {
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
  return getDossierHyphenationState().enabled;
}

export function setDossierHyphenationEnabled(enabled: boolean) {
  store({ version: 1, enabled });
}

export function subscribeDossierHyphenation(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (event.key !== DOSSIER_HYPHENATION_STORAGE_KEY) return;
    cached = read();
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
  return getDossierHyphenationState();
}

export function applyPortableDossierHyphenationState(value: unknown) {
  store(normalizeDossierHyphenationState(value));
}
