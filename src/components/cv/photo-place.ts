/**
 * Wo das Foto auf dem Blatt sitzt, wie gross es ist und welchen Rahmen es hat.
 *
 * Bewusst getrennt von `photo.ts`: dort steht der Ausschnitt *im* Bild (Form,
 * Zoom, Bildmitte), hier die Platzierung *auf der Seite*. Der Ausschnitt wird
 * mit dem Titelblatt geteilt, die Platzierung gilt nur für den Lebenslauf.
 */

const STORAGE_KEY = "lebenslauf:photo-place:v1";
const EVENT = "lebenslauf-photo-place-change";

export type CvPhotoPosition = "left" | "right" | "free";
export type CvPhotoPlacement = {
  /** `auto` ist nur noch Legacy-Fallback. Neue Auswahl speichert left/right/frei. */
  mode: "auto" | "left" | "right" | "frei";
  /** Abstand von der linken oberen Blattecke in mm (nur bei "frei"). */
  xMm: number;
  yMm: number;
  /** Breite des Fotos in mm; die Höhe folgt der Rahmenform. */
  widthMm: number;
  /**
   * Rahmenfarbe, oder null für die Farbe aus der Vorlage.
   *
   * Ob es überhaupt einen Rahmen gibt und wie dick er ist, steht weiterhin in
   * `photo.ts` (`borderWidth`, 0 = kein Rahmen) – dieselbe Einstellung wie auf
   * dem Titelblatt. Zwei Regler für dieselbe Stärke wären nur verwirrend.
   */
  frameColor: string | null;
};

export type CvPhotoPositionContext = {
  template?: string | null;
  layout: "classic" | "modern";
  legacyMirrored: boolean;
};

/** A4 in mm – die Grenzen, innerhalb derer das Foto liegen darf. */
const SHEET_W = 210;
const SHEET_H = 297;
export const CV_PHOTO_MIN_MM = 15;
export const CV_PHOTO_MAX_MM = 90;

export const DEFAULT_CV_PHOTO_PLACEMENT: CvPhotoPlacement = {
  // Template-aware default/legacy sentinel. UI never exposes "auto".
  mode: "auto",
  xMm: 150,
  yMm: 20,
  widthMm: 34,
  frameColor: null,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const numberOr = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Nimmt nur "#rgb"/"#rrggbb" an; alles andere fällt auf die Vorlage zurück. */
function colorOrNull(value: unknown): string | null {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? value.trim()
    : null;
}

export function normalizeCvPhotoPlacement(
  value?: Partial<CvPhotoPlacement> | null,
): CvPhotoPlacement {
  const widthMm = clamp(
    numberOr(value?.widthMm, DEFAULT_CV_PHOTO_PLACEMENT.widthMm),
    CV_PHOTO_MIN_MM,
    CV_PHOTO_MAX_MM,
  );
  const mode =
    value?.mode === "left" ||
    value?.mode === "right" ||
    value?.mode === "frei" ||
    value?.mode === "auto"
      ? value.mode
      : DEFAULT_CV_PHOTO_PLACEMENT.mode;
  return {
    mode,
    // Das Foto darf nicht komplett aus dem Blatt wandern; ein Rest bleibt sichtbar.
    xMm: clamp(numberOr(value?.xMm, DEFAULT_CV_PHOTO_PLACEMENT.xMm), 0, SHEET_W - CV_PHOTO_MIN_MM),
    yMm: clamp(numberOr(value?.yMm, DEFAULT_CV_PHOTO_PLACEMENT.yMm), 0, SHEET_H - CV_PHOTO_MIN_MM),
    widthMm,
    frameColor: colorOrNull(value?.frameColor),
  };
}

/**
 * Resolves the one physical photo side. `auto` exists only to reproduce old
 * dossiers: Standard/Brief historically defaulted right, other classic
 * templates left; the legacy mirror boolean flipped that side. Sidebar put
 * the photo in the sidebar, which the legacy mirror moved as a whole.
 */
export function resolveCvPhotoPosition(
  place: Pick<CvPhotoPlacement, "mode">,
  { template, layout, legacyMirrored }: CvPhotoPositionContext,
): CvPhotoPosition {
  if (place.mode === "left") return "left";
  if (place.mode === "right") return "right";
  if (place.mode === "frei") return "free";

  if (layout === "modern") return legacyMirrored ? "right" : "left";
  const normal: Exclude<CvPhotoPosition, "free"> = template === "brief" ? "right" : "left";
  return legacyMirrored ? (normal === "left" ? "right" : "left") : normal;
}

/**
 * Die Rahmenfarbe wird über eine CSS-Variable gesetzt, nicht im Renderer: die
 * gemeinsame Regel in `layout-options.css` trägt `!important` und würde einen
 * Inline-Wert sonst überstimmen.
 */
function apply(place: CvPhotoPlacement) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (place.frameColor) root.style.setProperty("--cv-photo-border-color", place.frameColor);
  else root.style.removeProperty("--cv-photo-border-color");
}

let cached: CvPhotoPlacement | null = null;

function read(): CvPhotoPlacement {
  if (typeof window === "undefined") return DEFAULT_CV_PHOTO_PLACEMENT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CV_PHOTO_PLACEMENT;
    return normalizeCvPhotoPlacement(JSON.parse(raw) as Partial<CvPhotoPlacement>);
  } catch {
    return DEFAULT_CV_PHOTO_PLACEMENT;
  }
}

export function getCvPhotoPlacement(): CvPhotoPlacement {
  if (!cached) cached = read();
  apply(cached);
  return cached;
}

export function setCvPhotoPlacement(patch: Partial<CvPhotoPlacement>) {
  const next = normalizeCvPhotoPlacement({ ...getCvPhotoPlacement(), ...patch });
  cached = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Die laufende Seite reagiert trotzdem über das Event.
  }
  apply(next);
  window.dispatchEvent(new CustomEvent<CvPhotoPlacement>(EVENT, { detail: next }));
}

export function setCvPhotoPosition(position: CvPhotoPosition) {
  setCvPhotoPlacement({ mode: position === "free" ? "frei" : position });
}

export function resetCvPhotoPlacement() {
  setCvPhotoPlacement(DEFAULT_CV_PHOTO_PLACEMENT);
}

export function subscribeCvPhotoPlacement(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cached = read();
    apply(cached);
    onChange();
  };

  window.addEventListener(EVENT, local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener("storage", storage);
  };
}
