import {
  CV_INFO_POSITION_STORAGE_KEY,
  normalizeCvSectionGapMm,
  setCvInfoPosition,
  setCvLayout,
  setCvLayoutMirror,
  setCvSectionGapMm,
  type CvInfoPosition,
  type CvLayoutId,
} from "./layout";
import { CV_PAGE_FIT_STORAGE_KEY, setCvPageFitMode, type CvPageFitMode } from "./page-fit";
import { setCvPlacement } from "./placement";
import { setCvPhotoStyle } from "./photo";
import {
  normalizeCvPhotoPlacement,
  setCvPhotoPlacement,
  type CvPhotoPlacement,
} from "./photo-place";
import {
  clearCvTextAlignment,
  CV_TEXT_ALIGNMENT_STORAGE_KEY,
  readPersistedCvTextAlignment,
  setCvTextAlignment,
} from "./text-alignment";
import { normalizeDossierPhotoStyle, type DossierPhotoStyle } from "@/lib/dossier-photo";
import type { BodyTextAlignment } from "@/lib/text-alignment";
import {
  DEFAULT_CV_PLACEMENTS,
  isCustomSectionKey,
  type CvPlacementKey,
  type CvPlacements,
} from "./types";

const LAYOUT_KEY = "lebenslauf:layout:v1";
const MIRROR_KEY = "lebenslauf:layout-mirror:v1";
const INFO_POSITION_KEY = CV_INFO_POSITION_STORAGE_KEY;
const SECTION_GAP_KEY = "lebenslauf:section-gap:v1";
const PAGE_FIT_KEY = CV_PAGE_FIT_STORAGE_KEY;
const PLACEMENT_KEY = "lebenslauf:placement:v1";
const PHOTO_KEY = "lebenslauf:photo:v2";
const PHOTO_PLACEMENT_KEY = "lebenslauf:photo-place:v1";

const PORTABLE_CV_STORAGE_KEYS = [
  LAYOUT_KEY,
  MIRROR_KEY,
  INFO_POSITION_KEY,
  SECTION_GAP_KEY,
  PAGE_FIT_KEY,
  PLACEMENT_KEY,
  PHOTO_KEY,
  PHOTO_PLACEMENT_KEY,
  CV_TEXT_ALIGNMENT_STORAGE_KEY,
] as const;

/**
 * CV settings that historically lived in dedicated localStorage keys.
 * Keeping them inside the portable CV snapshot makes Save -> clear browser
 * state -> Load deterministic without changing the legacy keys themselves.
 */
export type PortableCvState = {
  layout?: CvLayoutId;
  mirrored?: boolean;
  infoPosition?: CvInfoPosition;
  sectionGapMm?: number;
  pageFitMode?: CvPageFitMode;
  placements?: Partial<CvPlacements>;
  photoStyle?: Partial<DossierPhotoStyle>;
  photoPlacement?: Partial<CvPhotoPlacement>;
  textAlign?: BodyTextAlignment;
};

const validLayout = (value: string | null): CvLayoutId | undefined => {
  if (
    value === "classic" ||
    value === "modern" ||
    value === "minimal" ||
    value === "timeline" ||
    value === "editorial"
  ) {
    return value;
  }
  return value === "executive" ? "modern" : undefined;
};

/**
 * Read the persisted values directly instead of going through renderer caches.
 * The portable file must represent what is actually stored, even if another
 * route or test changed localStorage after a CV module was already mounted.
 */
export function readPortableCvState(): PortableCvState | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const storage = window.localStorage;
    if (!PORTABLE_CV_STORAGE_KEYS.some((key) => storage.getItem(key) !== null)) return undefined;

    const layout = validLayout(storage.getItem(LAYOUT_KEY));
    const mirroredRaw = storage.getItem(MIRROR_KEY);
    const infoPositionRaw = storage.getItem(INFO_POSITION_KEY);
    const infoPosition =
      infoPositionRaw === "standard" || infoPositionRaw === "mirrored"
        ? infoPositionRaw
        : undefined;
    const sectionGapRaw = storage.getItem(SECTION_GAP_KEY);
    const pageFitRaw = storage.getItem(PAGE_FIT_KEY);
    const pageFitMode = pageFitRaw === "one" || pageFitRaw === "two" ? pageFitRaw : undefined;
    const placementsRaw = storage.getItem(PLACEMENT_KEY);
    const photoRaw = storage.getItem(PHOTO_KEY);
    const photoPlacementRaw = storage.getItem(PHOTO_PLACEMENT_KEY);
    const textAlign = readPersistedCvTextAlignment();
    const sectionGapMm = sectionGapRaw === null ? null : normalizeCvSectionGapMm(sectionGapRaw);

    let placements: CvPlacements | undefined;
    if (placementsRaw) {
      try {
        const parsed = JSON.parse(placementsRaw) as Partial<CvPlacements>;
        placements = { ...DEFAULT_CV_PLACEMENTS };
        for (const [key, value] of Object.entries(parsed)) {
          if (
            (Object.prototype.hasOwnProperty.call(DEFAULT_CV_PLACEMENTS, key) ||
              isCustomSectionKey(key)) &&
            (value === "side" || value === "main")
          ) {
            placements[key as CvPlacementKey] = value;
          }
        }
      } catch {
        placements = undefined;
      }
    }

    let photoStyle: DossierPhotoStyle | undefined;
    if (photoRaw) {
      try {
        photoStyle = normalizeDossierPhotoStyle(JSON.parse(photoRaw) as Partial<DossierPhotoStyle>);
      } catch {
        photoStyle = undefined;
      }
    }

    let photoPlacement: CvPhotoPlacement | undefined;
    if (photoPlacementRaw) {
      try {
        photoPlacement = normalizeCvPhotoPlacement(
          JSON.parse(photoPlacementRaw) as Partial<CvPhotoPlacement>,
        );
      } catch {
        photoPlacement = undefined;
      }
    }

    return {
      ...(layout ? { layout } : {}),
      ...(mirroredRaw !== null ? { mirrored: mirroredRaw === "true" } : {}),
      ...(infoPosition ? { infoPosition } : {}),
      ...(sectionGapMm !== null ? { sectionGapMm } : {}),
      ...(pageFitMode ? { pageFitMode } : {}),
      ...(placements ? { placements } : {}),
      ...(photoStyle ? { photoStyle } : {}),
      ...(photoPlacement ? { photoPlacement } : {}),
      ...(textAlign ? { textAlign } : {}),
    };
  } catch {
    return undefined;
  }
}

/** Entfernt nur die portablen CV-Sidecars; andere Browserdaten bleiben erhalten. */
export function clearPortableCvState() {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    for (const key of PORTABLE_CV_STORAGE_KEYS) storage.removeItem(key);
  } catch {
    // Blockierter Browser-Speicher darf den restlichen Import nicht abbrechen.
  }
  setCvPageFitMode(null);
  clearCvTextAlignment();
}

/**
 * Missing values are intentionally ignored. Older dossier/CV files therefore
 * never wipe newer browser-local choices merely because they predate M7.
 */
export function applyPortableCvState(state?: PortableCvState | null) {
  if (!state || typeof state !== "object") return;

  if (state.layout) setCvLayout(state.layout);
  if (typeof state.mirrored === "boolean") setCvLayoutMirror(state.mirrored);
  // New explicit state always wins over the legacy mirror fallback.
  if (state.infoPosition === "standard" || state.infoPosition === "mirrored") {
    setCvInfoPosition(state.infoPosition);
  }
  if (typeof state.sectionGapMm === "number") setCvSectionGapMm(state.sectionGapMm);
  if (state.pageFitMode === "one" || state.pageFitMode === "two") {
    setCvPageFitMode(state.pageFitMode);
  }

  if (state.placements && typeof state.placements === "object") {
    for (const [key, value] of Object.entries(state.placements)) {
      if (
        (Object.prototype.hasOwnProperty.call(DEFAULT_CV_PLACEMENTS, key) ||
          isCustomSectionKey(key)) &&
        (value === "side" || value === "main")
      ) {
        setCvPlacement(key as CvPlacementKey, value);
      }
    }
  }

  if (state.photoStyle && typeof state.photoStyle === "object") {
    setCvPhotoStyle(state.photoStyle);
  }
  if (state.photoPlacement && typeof state.photoPlacement === "object") {
    setCvPhotoPlacement(state.photoPlacement);
  }
  if (state.textAlign) setCvTextAlignment(state.textAlign);
}
