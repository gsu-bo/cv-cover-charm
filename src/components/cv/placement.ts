import {
  DEFAULT_CV_PLACEMENTS,
  isCustomSectionKey,
  type CvPlacement,
  type CvPlacementKey,
  type CvPlacements,
} from "./types";

const STORAGE_KEY = "lebenslauf:placement:v1";
const EVENT = "lebenslauf-placement-change";

let cached: CvPlacements | null = null;

function read(): CvPlacements {
  if (typeof window === "undefined") return DEFAULT_CV_PLACEMENTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CV_PLACEMENTS };
    const parsed = JSON.parse(raw) as Partial<Record<CvPlacementKey, CvPlacement>>;
    const placements: CvPlacements = { ...DEFAULT_CV_PLACEMENTS };
    for (const [key, value] of Object.entries(parsed)) {
      if (
        (Object.prototype.hasOwnProperty.call(DEFAULT_CV_PLACEMENTS, key) ||
          isCustomSectionKey(key)) &&
        (value === "side" || value === "main")
      ) {
        placements[key as CvPlacementKey] = value;
      }
    }
    return placements;
  } catch {
    return { ...DEFAULT_CV_PLACEMENTS };
  }
}

/** Eigene Rubriken starten wie bisher im Hauptbereich, können danach aber gleich umgestellt werden. */
export function resolveCvPlacement(placements: CvPlacements, key: CvPlacementKey): CvPlacement {
  return placements[key] ?? "main";
}

export function getCvPlacements(): CvPlacements {
  if (cached) return cached;
  cached = read();
  return cached;
}

export function setCvPlacement(key: CvPlacementKey, value: CvPlacement) {
  if (typeof window === "undefined") return;
  cached = { ...getCvPlacements(), [key]: value };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Die laufende Seite reagiert trotzdem über das Event.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeCvPlacements(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
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
