import {
  applyPortableCvState,
  clearPortableCvState,
  readPortableCvState,
  type PortableCvState,
} from "@/components/cv/portable-state";
import {
  applyPortableDossierChromeState,
  normalizeDossierChromeState,
  readPortableDossierChromeState,
  type DossierChromeState,
} from "@/lib/dossier-chrome";
import {
  applyPortableDossierFieldTypographyState,
  clearDossierFieldTypographyState,
  normalizeDossierFieldTypographyState,
  readPortableDossierFieldTypographyState,
  type PortableDossierFieldTypographyState,
} from "@/lib/dossier-field-typography";
import {
  applyPortableDossierHyphenationState,
  normalizeDossierHyphenationState,
  readPortableDossierHyphenationState,
  type DossierHyphenationState,
} from "@/lib/dossier-hyphenation";
import {
  applyPortableDossierPageMarginsState,
  clearDossierPageMargins,
  normalizeDossierPageMarginsState,
  readPortableDossierPageMarginsState,
  type DossierPageMarginsState,
} from "@/lib/dossier-page-margins";

export const COVER_STORAGE_KEY = "titelblatt:v3";
export const LETTER_STORAGE_KEY = "anschreiben:v1";
export const CV_STORAGE_KEY = "lebenslauf:v1";

export const DOSSIER_PROJECT_KIND = "cv-cover-charm-dossier";
/**
 * `letter`, `chrome`, `hyphenation`, `pageMargins`, `fieldTypography` and the optional CV portable
 * state are additive extensions of version 1. Older project files therefore stay readable without
 * migration.
 */
export const DOSSIER_PROJECT_VERSION = 1;

export type DossierProject = {
  kind: typeof DOSSIER_PROJECT_KIND;
  version: typeof DOSSIER_PROJECT_VERSION;
  savedAt: string;
  cover?: Record<string, unknown>;
  letter?: Record<string, unknown>;
  cv?: Record<string, unknown>;
  chrome?: DossierChromeState;
  hyphenation?: DossierHyphenationState;
  pageMargins?: DossierPageMarginsState;
  fieldTypography?: PortableDossierFieldTypographyState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const browserStorage = () => (typeof window === "undefined" ? null : window.localStorage);

/** Liest einen Teil des Dossiers, ohne einen beschädigten Browserstand weiterzugeben. */
export function readStoredDossierPart(storageKey: string): Record<string, unknown> | undefined {
  try {
    const storage = browserStorage();
    if (!storage) return undefined;
    const text = storage.getItem(storageKey);
    if (!text) return undefined;
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ergänzt den CV nur dann um portable Sidecars, wenn dafür wirklich ein
 * persistierter Browserstand existiert. Default-only CVs bleiben dadurch exakt
 * im bisherigen Projektformat.
 */
function portableCv(cv?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!cv) return undefined;
  const portableState = readPortableCvState();
  return portableState ? { ...cv, portableState } : cv;
}

/** Baut eine gemeinsame, portable Projektdatei aus allen Dossier-Teilen. */
export function createDossierProject(parts: {
  cover?: Record<string, unknown>;
  letter?: Record<string, unknown>;
  cv?: Record<string, unknown>;
}): DossierProject {
  const letter = parts.letter ?? readStoredDossierPart(LETTER_STORAGE_KEY);
  const cv = portableCv(parts.cv);
  const chrome = readPortableDossierChromeState();
  const hyphenation = readPortableDossierHyphenationState();
  const pageMargins = readPortableDossierPageMarginsState();
  const fieldTypography = readPortableDossierFieldTypographyState();
  return {
    kind: DOSSIER_PROJECT_KIND,
    version: DOSSIER_PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    ...(parts.cover ? { cover: parts.cover } : {}),
    ...(letter ? { letter } : {}),
    ...(cv ? { cv } : {}),
    chrome,
    hyphenation,
    ...(pageMargins ? { pageMargins } : {}),
    ...(fieldTypography ? { fieldTypography } : {}),
  };
}

/** Erkennt das gemeinsame Format; additive Felder bleiben für alte v1-Dateien optional. */
export function parseDossierProject(value: unknown): DossierProject | null {
  if (!isRecord(value)) return null;
  if (value.kind !== DOSSIER_PROJECT_KIND || value.version !== DOSSIER_PROJECT_VERSION) return null;

  const cover = isRecord(value.cover) && isRecord(value.cover.data) ? value.cover : undefined;
  const letter = isRecord(value.letter) && isRecord(value.letter.data) ? value.letter : undefined;
  const cv = isRecord(value.cv) && isRecord(value.cv.data) ? value.cv : undefined;
  const chrome = isRecord(value.chrome) ? normalizeDossierChromeState(value.chrome) : undefined;
  const hyphenation =
    isRecord(value.hyphenation) || typeof value.hyphenation === "boolean"
      ? normalizeDossierHyphenationState(value.hyphenation)
      : undefined;
  const normalizedPageMargins = isRecord(value.pageMargins)
    ? normalizeDossierPageMarginsState(value.pageMargins)
    : undefined;
  const pageMargins =
    normalizedPageMargins && Object.keys(normalizedPageMargins).length
      ? normalizedPageMargins
      : undefined;
  const normalizedFieldTypography = isRecord(value.fieldTypography)
    ? normalizeDossierFieldTypographyState(value.fieldTypography)
    : undefined;
  const fieldTypography =
    normalizedFieldTypography &&
    (Object.keys(normalizedFieldTypography.cv).length ||
      Object.keys(normalizedFieldTypography.letter).length)
      ? normalizedFieldTypography
      : undefined;

  return {
    kind: DOSSIER_PROJECT_KIND,
    version: DOSSIER_PROJECT_VERSION,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date(0).toISOString(),
    ...(cover ? { cover } : {}),
    ...(letter ? { letter } : {}),
    ...(cv ? { cv } : {}),
    ...(chrome ? { chrome } : {}),
    ...(hyphenation ? { hyphenation } : {}),
    ...(pageMargins ? { pageMargins } : {}),
    ...(fieldTypography ? { fieldTypography } : {}),
  };
}

/**
 * Schreibt alle vorhandenen Teile zurück. Fehlende Teile bleiben bewusst
 * unangetastet, damit auch partielle bzw. ältere Projektdateien nichts löschen.
 */
export function storeDossierProject(project: DossierProject): {
  cover: boolean;
  letter: boolean;
  cv: boolean;
} {
  const storage = browserStorage();
  if (!storage) return { cover: false, letter: false, cv: false };

  if (project.cover) storage.setItem(COVER_STORAGE_KEY, JSON.stringify(project.cover));
  if (project.letter) storage.setItem(LETTER_STORAGE_KEY, JSON.stringify(project.letter));
  if (project.cv) {
    const { portableState, ...cv } = project.cv;
    storage.setItem(CV_STORAGE_KEY, JSON.stringify(cv));
    if (isRecord(portableState)) applyPortableCvState(portableState as PortableCvState);
  }
  if (project.chrome) {
    // Ein bewusst geladenes Dossier darf den aktuellen Browserstand ersetzen.
    // Eingebettete Chrome-Kopien einzelner Dokumente dürfen das hingegen nicht.
    applyPortableDossierChromeState(project.chrome, { replaceExisting: true });
  }
  if (project.hyphenation) applyPortableDossierHyphenationState(project.hyphenation);
  if (project.pageMargins) applyPortableDossierPageMarginsState(project.pageMargins);
  if (project.fieldTypography) {
    applyPortableDossierFieldTypographyState(project.fieldTypography);
  }
  return { cover: !!project.cover, letter: !!project.letter, cv: !!project.cv };
}

/**
 * Vollständiger Restore für bewusst ausgewählte Projektdateien. Anders als der
 * additive Legacy-Loader entfernt dieser Pfad fehlende Dossierteile und alte
 * CV-Sidecars, damit sich zwei Projekte nie unbemerkt miteinander vermischen.
 */
export function replaceDossierProject(project: DossierProject): {
  cover: boolean;
  letter: boolean;
  cv: boolean;
} {
  const storage = browserStorage();
  if (!storage) return { cover: false, letter: false, cv: false };

  storage.removeItem(COVER_STORAGE_KEY);
  storage.removeItem(LETTER_STORAGE_KEY);
  storage.removeItem(CV_STORAGE_KEY);
  clearPortableCvState();
  clearDossierPageMargins();
  clearDossierFieldTypographyState();

  const restored = storeDossierProject(project);
  if (!project.chrome) {
    applyPortableDossierChromeState(normalizeDossierChromeState(null), { replaceExisting: true });
  }
  if (!project.hyphenation) applyPortableDossierHyphenationState(null);
  return restored;
}
