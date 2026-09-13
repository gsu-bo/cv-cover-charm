import type { FontKey, TemplateId } from "@/components/cover/types";

/**
 * Ein Eintrag mit Zeitraum – Schule, Praktikum, Kurs. Alle Felder dürfen leer
 * bleiben; leere Einträge werden beim Rendern übersprungen.
 */
export type CvEntry = {
  id: string;
  /** "2021 – 2025" oder "Aug. 2024" – bewusst freier Text, kein Datumsfeld. */
  zeit: string;
  titel: string;
  /** Betrieb, Schule oder Ort. */
  ort: string;
  beschreibung: string;
};

/** Eine Sprache mit Niveau ("Muttersprache", "B1", "Schulkenntnisse"). */
export type CvSprache = { id: string; name: string; niveau: string };

/** Eine Referenzperson. */
export type CvReferenz = {
  id: string;
  name: string;
  funktion: string;
  /** Sichtbare Kontaktzeile; enthält für neue Einträge Telefon, E-Mail und Zusatz je auf eigener Zeile. */
  kontakt: string;
  /** Optionale E-Mail-Adresse der Referenzperson. */
  email?: string;
  /** Optionale freie Zusatzzeile; wird im CV ohne Feldbezeichnung ausgegeben. */
  zusatz?: string;
};

/**
 * Angaben zur Person. Dieselben Felder wie im Titelblatt, damit der Lebenslauf
 * sie übernehmen kann.
 */
export type CvPerson = {
  vorname: string;
  nachname: string;
  adresse: string;
  plzOrt: string;
  telefon: string;
  email: string;
  geburtsdatum: string;
  nationalitaet: string;
  /** Zeile unter dem Namen, z. B. "Schülerin, 3. Sek B". */
  untertitel: string;
  foto: string | null;
};

/** Welche Abschnitte gibt es und wie heissen sie in der Vorgabe? */
export type CvSectionKey =
  | "schule"
  | "erfahrung"
  | "sprachen"
  | "hobbys"
  | "staerken"
  | "referenzen";

export const CV_SECTION_LABELS: Record<CvSectionKey, string> = {
  schule: "Schulbildung",
  erfahrung: "Praktika & Schnuppertage",
  sprachen: "Sprachen",
  hobbys: "Hobbys & Interessen",
  staerken: "Stärken",
  referenzen: "Referenzen",
};

/** Reihenfolge der Abschnitte auf dem Blatt. */
export const CV_SECTION_ORDER: CvSectionKey[] = [
  "schule",
  "erfahrung",
  "sprachen",
  "hobbys",
  "staerken",
  "referenzen",
];

/** Eine frei benannte Rubrik mit denselben strukturierten Einträgen wie Schule und Praktika. */
export type CvCustomSection = {
  id: string;
  title: string;
  entries: CvEntry[];
};

export type CvCustomSectionKey = `custom:${string}`;

export const customSectionKey = (id: string): CvCustomSectionKey => `custom:${id}`;
export const isCustomSectionKey = (key: string): key is CvCustomSectionKey =>
  key.startsWith("custom:");

/**
 * Rubriken, deren komplette Anordnung die Schülerin / der Schüler bestimmen
 * kann. Die persönlichen Angaben sind bewusst ein eigener Layout-Block; die
 * einzelnen Felder darin bleiben weiterhin zusammen.
 */
export type CvLayoutSectionKey = "person" | CvSectionKey | CvCustomSectionKey;
export const CV_LAYOUT_SECTION_ORDER: CvLayoutSectionKey[] = ["person", ...CV_SECTION_ORDER];

export type CvSectionPage = 1 | 2;
export type CvSectionWidth = "full" | "half";
export type CvSectionPositioning = "flow" | "free";

/** Eine einzige, persistente Quelle für Seite, Breite und freie Position. */
export type CvSectionLayout = {
  page: CvSectionPage;
  width: CvSectionWidth;
  positioning: CvSectionPositioning;
  /** Absolute Position auf dem A4-Blatt in Millimetern; nur bei `free` benutzt. */
  x: number | null;
  y: number | null;
  /** Durch Ziehpunkte gesetzte freie Grösse; null verwendet die Breiten-Vorgabe bzw. Inhaltshöhe. */
  widthMm: number | null;
  heightMm: number | null;
};

export type CvSectionLayouts = Partial<Record<CvLayoutSectionKey, Partial<CvSectionLayout>>>;

export const DEFAULT_CV_SECTION_LAYOUT: CvSectionLayout = {
  page: 1,
  width: "full",
  positioning: "flow",
  x: null,
  y: null,
  widthMm: null,
  heightMm: null,
};

const finiteCoordinate = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const finiteSize = (value: unknown, min: number, max: number): number | null => {
  const number = finiteCoordinate(value);
  return number === null ? null : Math.max(min, Math.min(max, number));
};

/** Alte und teilweise beschädigte Entwürfe sicher auf die neuen Vorgaben ziehen. */
export function normalizeCvSectionLayout(value?: Partial<CvSectionLayout> | null): CvSectionLayout {
  return {
    page: value?.page === 2 ? 2 : 1,
    width: value?.width === "half" ? "half" : "full",
    positioning: value?.positioning === "free" ? "free" : "flow",
    x: finiteCoordinate(value?.x),
    y: finiteCoordinate(value?.y),
    widthMm: finiteSize(value?.widthMm, 20, 190),
    heightMm: finiteSize(value?.heightMm, 10, 277),
  };
}

export function cvSectionLayout(data: Pick<CvData, "sectionLayouts">, key: CvLayoutSectionKey) {
  return normalizeCvSectionLayout(data.sectionLayouts?.[key]);
}

/** Koordinaten allein ändern den normalen Dokumentfluss nicht. */
export function cvSectionOrder(
  data: Pick<CvData, "customSections" | "sectionOrder">,
): CvLayoutSectionKey[] {
  const customKeys = (data.customSections ?? []).map((section) => customSectionKey(section.id));
  const available = new Set<CvLayoutSectionKey>([...CV_LAYOUT_SECTION_ORDER, ...customKeys]);
  const result: CvLayoutSectionKey[] = [];

  for (const key of data.sectionOrder ?? []) {
    if (available.has(key) && !result.includes(key)) result.push(key);
  }
  for (const key of [...CV_LAYOUT_SECTION_ORDER, ...customKeys]) {
    if (!result.includes(key)) result.push(key);
  }
  return result;
}

export function customSectionForKey(
  data: Pick<CvData, "customSections">,
  key: CvLayoutSectionKey,
): CvCustomSection | null {
  if (!isCustomSectionKey(key)) return null;
  const id = key.slice("custom:".length);
  return (data.customSections ?? []).find((section) => section.id === id) ?? null;
}

export function hasCustomizedCvSectionLayout(
  data: Pick<CvData, "customSections" | "sectionOrder" | "sectionLayouts">,
): boolean {
  const canonicalOrder: CvLayoutSectionKey[] = [
    ...CV_LAYOUT_SECTION_ORDER,
    ...(data.customSections ?? []).map((section) => customSectionKey(section.id)),
  ];
  const order = cvSectionOrder(data);
  if (order.some((key, index) => key !== canonicalOrder[index])) return true;
  return order.some((key) => {
    const value = cvSectionLayout(data, key);
    return value.page !== 1 || value.width !== "full" || value.positioning !== "flow";
  });
}

/** Im Modern-Layout kann jeder Inhaltsblock bewusst links oder im Hauptteil liegen. */
export type CvPlacement = "side" | "main";
export type CvPlacementKey = "kontakt" | CvSectionKey;

/**
 * Überschriften aller Blöcke, Kontakt eingeschlossen.
 *
 * Kontakt war der einzige Block ohne änderbaren Titel – dabei will vielleicht
 * jemand dort den eigenen Namen stehen haben statt des Worts "Kontakt".
 */
export const CV_BLOCK_LABELS: Record<CvPlacementKey, string> = {
  kontakt: "Kontakt",
  ...CV_SECTION_LABELS,
};
export type CvPlacements = Record<CvPlacementKey, CvPlacement>;

/** Sinnvolle Startwerte; danach entscheidet die Schülerin / der Schüler selbst. */
export const DEFAULT_CV_PLACEMENTS: CvPlacements = {
  kontakt: "side",
  schule: "main",
  erfahrung: "main",
  sprachen: "side",
  hobbys: "side",
  staerken: "side",
  referenzen: "main",
};

export type CvData = {
  person: CvPerson;
  schule: CvEntry[];
  erfahrung: CvEntry[];
  sprachen: CvSprache[];
  /** Je eine Zeile pro Eintrag. */
  hobbys: string[];
  staerken: string[];
  referenzen: CvReferenz[];
  /** Frei benannte Rubriken wie Kurse, Projekte oder Auszeichnungen. */
  customSections?: CvCustomSection[];
  /** Reihenfolge aller kompletten Rubriken; fehlende Schlüssel werden sicher ergänzt. */
  sectionOrder?: CvLayoutSectionKey[];
  /**
   * Titel des Dokuments, z. B. "Lebenslauf". Leer lassen blendet ihn aus.
   * Vorher stand hier nichts und ein Aufbau druckte fest "CURRICULUM VITAE".
   */
  titel?: string;
  /** Eigene Überschriften. Leer = Vorgabe aus CV_BLOCK_LABELS. */
  labels: Partial<Record<CvPlacementKey, string>>;
  /** Ausgeblendete Abschnitte. */
  hidden: Partial<Record<CvSectionKey, boolean>>;
  /** Unabhängige Layouteinstellungen pro kompletter Rubrik. */
  sectionLayouts?: CvSectionLayouts;
};

/** Gestaltung des Lebenslaufs – kommt in der Regel vom Titelblatt. */
export type CvDesign = {
  template: TemplateId;
  colors: Record<string, string>;
  /** Einheitliche Dossier-Schrift; leer verwendet die passende Vorlagenschrift. */
  font?: FontKey;
  /**
   * Deckkraft des Hintergrunds, 0–1. Auf dem Lebenslauf zählt der Text mehr als
   * die Fläche, darum steht der Regler in der Bedienung auf "Transparenz" und
   * startet bei 94 % – der Hintergrund bleibt nur als leiser Farbakzent sichtbar.
   */
  bgOpacity: number;
  /** Formen und Bilder vom Titelblatt mitnehmen (ohne dessen Texte). */
  useElements: boolean;

  /** Linie neben der Abschnittsüberschrift. */
  headingRule?: CvHeadingRule;
  /** Grösse des Namens, 1 = Vorgabe. Der Dokumenttitel hat eigene Regler. */
  titleScale?: number;
  /** Grösse von Untertitel und Rubriken, 1 = Vorgabe. */
  headingScale?: number;
  /** Grösse des Fliesstexts, 1 = Vorgabe. */
  bodyScale?: number;
  /** Eigene Gestaltung für den kleinen Dokumenttitel über dem Namen. */
  docTitleFontSizePx?: number;
  docTitleColor?: string;
  docTitleBold?: boolean;
  docTitleItalic?: boolean;
  docTitleUnderline?: boolean;
  docTitleMarginBottomPx?: number;
  /** Eine gemeinsame Gestaltung für alle Rubriktitel, inklusive eigener Rubriken. */
  sectionTitleFontSizePx?: number;
  sectionTitleColor?: string;
  sectionTitleBold?: boolean;
  sectionTitleItalic?: boolean;
  sectionTitleUnderline?: boolean;
  sectionTitleMarginBottomPx?: number;
  /** Breite der Seitenspalte als Anteil der Blattbreite. */
  sidebarPct?: number;
};

/** „keine" blendet die Linie aus, „kurz" ist der feste Strich, „ganz" füllt die Zeile. */
export type CvHeadingRule = "none" | "short" | "full";

export const CV_TYPE_DEFAULTS = {
  headingRule: "full" as CvHeadingRule,
  titleScale: 1,
  headingScale: 1,
  bodyScale: 1,
  /** 30/70 – die Aufteilung, die sich beim Ausprobieren als brauchbar zeigte. */
  sidebarPct: 0.3,
} as const;

export const CV_DOC_TITLE_DEFAULTS = {
  fontSizePx: 18,
  bold: true,
  italic: false,
  underline: false,
  marginBottomPx: 10,
} as const;
export const CV_DOC_TITLE_FONT_SIZE_MIN = 10;
export const CV_DOC_TITLE_FONT_SIZE_MAX = 48;
export const CV_DOC_TITLE_MARGIN_BOTTOM_MAX = 100;

export const CV_SECTION_TITLE_DEFAULTS = {
  fontSizePx: 16,
  bold: true,
  italic: false,
  underline: false,
  marginBottomPx: 7,
} as const;
export const CV_SECTION_TITLE_FONT_SIZE_MIN = 10;
export const CV_SECTION_TITLE_FONT_SIZE_MAX = 32;
export const CV_SECTION_TITLE_MARGIN_BOTTOM_MAX = 100;

/**
 * Typografie-Regler sind bewusst enger als früher begrenzt.
 * 50–200 % war für einen Bewerbungs-CV kein sinnvoller Gestaltungsraum:
 * bei sehr kleinen Werten wurde Text unlesbar, bei sehr grossen Werten brach
 * die Hierarchie zusammen (Datum, Ort, Beschreibung und Eintragstitel wurden
 * gleichzeitig riesig). 75–135 % lässt weiterhin klare Varianten zu, hält die
 * Dokumente aber in einem realistisch druck- und bewerbungstauglichen Bereich.
 */
export const CV_SCALE_MIN = 0.75;
export const CV_SCALE_MAX = 1.35;

/**
 * Vor der engeren Skala konnten gespeicherte Entwürfe Werte bis 200 % tragen.
 * Die Route liest ihren Entwurf erst nach der Modulevaluation aus localStorage;
 * deshalb können wir solche Altwerte hier einmalig auf den neuen sicheren
 * Bereich ziehen. Entwürfe innerhalb des Bereichs werden nie verändert.
 */
function normalizeLegacyCvTypeScales() {
  if (typeof window === "undefined") return;
  try {
    const key = "lebenslauf:v1";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw) as { design?: CvDesign };
    if (!saved.design) return;

    let changed = false;
    for (const scaleKey of ["titleScale", "headingScale", "bodyScale"] as const) {
      const value = saved.design[scaleKey];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const next = Math.max(CV_SCALE_MIN, Math.min(CV_SCALE_MAX, value));
      if (Math.abs(next - value) > 0.0001) {
        saved.design[scaleKey] = next;
        changed = true;
      }
    }

    if (changed) window.localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    // Beschädigter oder blockierter Speicher darf das Formular nie verhindern.
  }
}

normalizeLegacyCvTypeScales();

export const emptyPerson: CvPerson = {
  vorname: "",
  nachname: "",
  adresse: "",
  plzOrt: "",
  telefon: "",
  email: "",
  geburtsdatum: "",
  nationalitaet: "",
  untertitel: "",
  foto: null,
};

/** Vorgabe für den Dokumenttitel. */
export const DEFAULT_CV_TITLE = "Lebenslauf";

export const emptyCv: CvData = {
  person: { ...emptyPerson },
  titel: DEFAULT_CV_TITLE,
  schule: [],
  erfahrung: [],
  sprachen: [],
  hobbys: [],
  staerken: [],
  referenzen: [],
  customSections: [],
  sectionOrder: [...CV_LAYOUT_SECTION_ORDER],
  labels: {},
  hidden: {},
  sectionLayouts: {},
};

let counter = 0;
/** Kennung für einen neuen Eintrag. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export const emptyEntry = (): CvEntry => ({
  id: newId("e"),
  zeit: "",
  titel: "",
  ort: "",
  beschreibung: "",
});

export const emptySprache = (): CvSprache => ({ id: newId("s"), name: "", niveau: "" });

export const emptyReferenz = (): CvReferenz => ({
  id: newId("r"),
  name: "",
  funktion: "",
  kontakt: "",
  email: "",
  zusatz: "",
});

/** Trägt ein Eintrag überhaupt etwas? Leere werden nicht gedruckt. */
export const entryFilled = (e: CvEntry) =>
  !!(e.zeit.trim() || e.titel.trim() || e.ort.trim() || e.beschreibung.trim());

export const DEMO_CV: CvData = {
  titel: DEFAULT_CV_TITLE,
  person: {
    vorname: "Lea",
    nachname: "Müller",
    adresse: "Dorfstrasse 12",
    plzOrt: "4535 Hubersdorf",
    telefon: "+41 79 123 45 67",
    email: "lea.mueller@example.ch",
    geburtsdatum: "14.03.2010",
    nationalitaet: "Schweiz",
    untertitel: "",
    foto: null,
  },
  schule: [
    {
      id: "demo-s1",
      zeit: "2023 – heute",
      titel: "Sekundarschule, Niveau A",
      ort: "Schulhaus Zentrum, Hubersdorf",
      beschreibung: "Schwerpunkt Mathematik und Informatik",
    },
    {
      id: "demo-s2",
      zeit: "2017 – 2023",
      titel: "Primarschule",
      ort: "Primarschule Hubersdorf",
      beschreibung: "",
    },
  ],
  erfahrung: [
    {
      id: "demo-p1",
      zeit: "Sept. 2026",
      titel: "Schnupperlehre Informatik",
      ort: "Beispiel AG, Hubersdorf",
      beschreibung: "Support, kleine Automatisierungen mit Python",
    },
    {
      id: "demo-p2",
      zeit: "März 2026",
      titel: "Schnupperlehre Mediamatik",
      ort: "Muster GmbH, Hubersdorf",
      beschreibung: "Website-Pflege, Bildbearbeitung",
    },
  ],
  sprachen: [
    { id: "demo-l1", name: "Deutsch", niveau: "Muttersprache" },
    { id: "demo-l2", name: "Englisch", niveau: "Gute Schulkenntnisse (B1)" },
    { id: "demo-l3", name: "Französisch", niveau: "Grundkenntnisse (A2)" },
  ],
  hobbys: ["Volleyball im Verein", "Programmieren kleiner Spiele", "Fotografieren"],
  staerken: ["Zuverlässig und pünktlich", "Arbeitet gern im Team", "Lernt schnell Neues"],
  referenzen: [
    {
      id: "demo-r1",
      name: "Herr Thomas Weber",
      funktion: "Klassenlehrer, Schulhaus Zentrum",
      kontakt: "+41 32 123 45 67",
      email: "",
      zusatz: "",
    },
  ],
  customSections: [],
  sectionOrder: [...CV_LAYOUT_SECTION_ORDER],
  labels: {},
  hidden: {},
  sectionLayouts: {},
};
