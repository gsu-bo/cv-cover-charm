import { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";

export type CvLayoutId = "classic" | "modern" | "minimal" | "timeline" | "executive" | "editorial";
export type CvRenderLayoutId = "classic" | "modern";
export type CvInfoPosition = "standard" | "mirrored";

/**
 * Internal IDs intentionally stay unchanged for localStorage/backwards compatibility.
 * Visible names describe structure only, so they cannot be confused with dossier styles.
 */
export const CV_LAYOUTS: Array<{
  id: CvLayoutId;
  name: string;
  description: string;
}> = [
  {
    id: "classic",
    name: "Standard",
    description: "Klares einspaltiges Grundraster",
  },
  {
    id: "modern",
    name: "Sidebar links",
    description: "Seitenspalte links, Hauptspalte rechts, Breite einstellbar",
  },
  {
    id: "minimal",
    name: "Luftig",
    description: "Einspaltig mit besonders viel Weissraum",
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Chronologie entlang einer vertikalen Achse",
  },
  {
    id: "editorial",
    name: "Magazin",
    description: "Asymmetrisches Print-Raster",
  },
];

export type CvLayoutPickerOption = {
  key: string;
  layout: CvLayoutId;
  name: string;
  description: string;
  infoPosition?: CvInfoPosition;
};

/**
 * Links/rechts sind im Picker zwei klare Entscheidungen, teilen intern aber
 * weiterhin den bewährten Sidebar-Renderer. So bleiben gespeicherte "modern"-
 * Dokumente kompatibel und die bestehende Spiegelungslogik bleibt die einzige
 * Quelle für die physische Seite.
 */
export const CV_LAYOUT_PICKER_OPTIONS: CvLayoutPickerOption[] = CV_LAYOUTS.flatMap(
  (layout): CvLayoutPickerOption[] => {
    if (layout.id !== "modern") {
      return [
        {
          key: layout.id,
          layout: layout.id,
          name: layout.name,
          description: layout.description,
        },
      ];
    }
    return [
      {
        key: "sidebar-left",
        layout: "modern",
        name: "Sidebar links",
        description: "Seitenspalte links, Hauptspalte rechts, Breite einstellbar",
        infoPosition: "standard",
      },
      {
        key: "sidebar-right",
        layout: "modern",
        name: "Sidebar rechts",
        description: "Seitenspalte rechts, Hauptspalte links, Breite einstellbar",
        infoPosition: "mirrored",
      },
    ];
  },
);

const STORAGE_KEY = "lebenslauf:layout:v1";
const MIRROR_STORAGE_KEY = "lebenslauf:layout-mirror:v1";
export const CV_INFO_POSITION_STORAGE_KEY = "lebenslauf:info-position:v1";
const SECTION_GAP_STORAGE_KEY = "lebenslauf:section-gap:v1";
export const CV_LAYOUT_EVENT = "lebenslauf-layout-change";
const DEFAULT_LAYOUT: CvLayoutId = CANONICAL_DOSSIER_PRESENTATION.cv.layout;

/**
 * Globaler vertikaler Rubrik-Abstand. `null` bedeutet: die jeweilige Vorlage
 * darf ihren bewährten Abstand behalten. Ein eigener Wert gilt für alle
 * Rubriktitel, unabhängig davon, ob die Rubrik volle oder halbe Breite hat.
 */
export const CV_SECTION_GAP_MIN_MM = 0;
export const CV_SECTION_GAP_MAX_MM = 12;
export const CV_SECTION_GAP_CUSTOM_DEFAULT_MM = 4;

function valid(value: string | null): value is CvLayoutId {
  return (
    value === "classic" ||
    value === "modern" ||
    value === "minimal" ||
    value === "timeline" ||
    value === "executive" ||
    value === "editorial"
  );
}

/**
 * A template may have one natural starting structure without taking the choice
 * away from the user. Kolumne is built around a real side column, so a fresh
 * document starts in Sidebar.
 */
export function defaultCvLayoutForTemplate(template?: string | null): CvLayoutId {
  return template === "terracotta" ? "modern" : DEFAULT_LAYOUT;
}

/** Explicit saved layouts win over template-owned defaults. */
export function resolveCvLayoutChoice(
  template: string | null | undefined,
  saved: string | null,
): CvLayoutId {
  const fallback = defaultCvLayoutForTemplate(template);
  return valid(saved) ? saved : fallback;
}

export function getCvLayoutChoiceForTemplate(template?: string | null): CvLayoutId {
  if (typeof window === "undefined") return resolveCvLayoutChoice(template, null);
  try {
    return resolveCvLayoutChoice(template, window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return resolveCvLayoutChoice(template, null);
  }
}
function readChoice(): CvLayoutId {
  return getCvLayoutChoiceForTemplate(
    typeof document === "undefined" ? null : document.documentElement.dataset.dossierTemplate,
  );
}

function readMirror(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MIRROR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function readInfoPosition(): CvInfoPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CV_INFO_POSITION_STORAGE_KEY);
    return value === "standard" || value === "mirrored" ? value : null;
  } catch {
    return null;
  }
}

export function resolveCvInfoPosition(
  explicit: CvInfoPosition | null | undefined,
  legacyMirrored: boolean,
): CvInfoPosition {
  return explicit === "standard" || explicit === "mirrored"
    ? explicit
    : legacyMirrored
      ? "mirrored"
      : "standard";
}

export function normalizeCvSectionGapMm(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(CV_SECTION_GAP_MIN_MM, Math.min(CV_SECTION_GAP_MAX_MM, numeric));
}

function readSectionGap(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SECTION_GAP_STORAGE_KEY);
    if (raw === null || raw.trim() === "") return null;
    return normalizeCvSectionGapMm(raw);
  } catch {
    return null;
  }
}

function rendererFor(choice: CvLayoutId): CvRenderLayoutId {
  // M5.6: diese Zuordnung entscheidet nur die Inhaltsgeometrie. Die visuelle
  // DNA (Typografie, Linien, Intensität, Radien) kommt aus DossierTheme.
  return choice === "modern" || choice === "executive" ? "modern" : "classic";
}

/**
 * "Zweispaltig" war dasselbe Raster wie "Sidebar" und unterschied sich nur in
 * Polsterung und Spaltenbreite – zwei Karten für einen Aufbau. Geblieben ist
 * "Sidebar", dessen Breite jetzt einstellbar ist. Ältere Stände, die noch
 * "executive" gespeichert haben, lesen sich als "Sidebar".
 */
function canonical(choice: CvLayoutId): CvLayoutId {
  return choice === "executive" ? "modern" : choice;
}

function applyVariant(choice: CvLayoutId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.cvVariant = canonical(choice);
  const infoPosition = resolveCvInfoPosition(readInfoPosition(), readMirror());
  root.dataset.cvInfoPosition = infoPosition;
  root.dataset.cvMirrored = infoPosition === "mirrored" ? "true" : "false";

  const sectionGap = readSectionGap();
  if (sectionGap === null) {
    delete root.dataset.cvSectionGap;
    root.style.removeProperty("--cv-section-gap");
  } else {
    root.dataset.cvSectionGap = "custom";
    root.style.setProperty("--cv-section-gap", `${sectionGap}mm`);
  }
}

/** Tatsächlich ausgewählte Karte im Aufbau-Picker. */
export function getCvLayoutChoice(): CvLayoutId {
  const choice = canonical(readChoice());
  applyVariant(choice);
  return choice;
}

/** Renderer-Modus für Canvas/Formular. */
export function getCvLayout(): CvRenderLayoutId {
  const choice = canonical(readChoice());
  applyVariant(choice);
  return rendererFor(choice);
}

/** Legacy mirror value. New UI/state must use `getCvInfoPosition`. */
export function getCvLayoutMirror(): boolean {
  return readMirror();
}

/** Explicit information/date-side choice, with legacy mirror as fallback. */
export function getCvInfoPosition(): CvInfoPosition {
  return resolveCvInfoPosition(readInfoPosition(), readMirror());
}

/** `null` lässt die Abstände der gewählten Vorlage unverändert. */
export function getCvSectionGapMm(): number | null {
  const value = readSectionGap();
  if (typeof document !== "undefined") applyVariant(readChoice());
  return value;
}

export function setCvLayout(layout: CvLayoutId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // Aufbauwahl funktioniert für die laufende Seite trotzdem über das Event.
  }
  applyVariant(readChoice());
  window.dispatchEvent(new CustomEvent<CvLayoutId>(CV_LAYOUT_EVENT, { detail: layout }));
}

export function setCvLayoutMirror(mirrored: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIRROR_STORAGE_KEY, mirrored ? "true" : "false");
  } catch {
    // Die laufende Seite reagiert trotzdem über das Event.
  }
  applyVariant(readChoice());
  window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));
}

export function setCvInfoPosition(position: CvInfoPosition) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CV_INFO_POSITION_STORAGE_KEY, position);
  } catch {
    // Die laufende Seite reagiert trotzdem über das Event.
  }
  applyVariant(readChoice());
  window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));
}

export function setCvSectionGapMm(value: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(SECTION_GAP_STORAGE_KEY);
    else {
      const normalized = normalizeCvSectionGapMm(value);
      if (normalized === null) window.localStorage.removeItem(SECTION_GAP_STORAGE_KEY);
      else window.localStorage.setItem(SECTION_GAP_STORAGE_KEY, String(normalized));
    }
  } catch {
    // Die laufende Seite reagiert trotzdem über CSS + Event.
  }
  applyVariant(readChoice());
  window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));
}

export function subscribeCvLayout(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === MIRROR_STORAGE_KEY ||
      event.key === CV_INFO_POSITION_STORAGE_KEY ||
      event.key === SECTION_GAP_STORAGE_KEY
    ) {
      applyVariant(readChoice());
      onChange();
    }
  };
  window.addEventListener(CV_LAYOUT_EVENT, local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CV_LAYOUT_EVENT, local);
    window.removeEventListener("storage", storage);
  };
}

/** Gleicher Event-Stream, aber mit dem rohen Aufbauwert als Snapshot. */
export const subscribeCvLayoutChoice = subscribeCvLayout;
/** Angaben-/Datumsseite teilt denselben Event-Stream wie der Aufbau. */
export const subscribeCvInfoPosition = subscribeCvLayout;
/** Globaler Rubrik-Abstand teilt denselben Event-Stream wie die übrigen Aufbauoptionen. */
export const subscribeCvSectionGap = subscribeCvLayout;
