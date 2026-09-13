export type CoverData = {
  /** Zeile über dem Beruf, z. B. "Bewerbung um eine Lehrstelle als". */
  kicker: string;
  /** Kopfzeile oben links. Leer = Vorgabe der Vorlage. */
  eyebrow: string;
  beruf: string;
  lehrbeginn: string;
  vorname: string;
  nachname: string;
  adresse: string;
  plzOrt: string;
  telefon: string;
  email: string;
  geburtsdatum: string;
  lehrbetrieb: string;
  ansprechperson: string;
  betriebAdresse: string;
  /** Firma bleibt gespeichert, kann auf dem Titelblatt aber ausgeblendet werden. */
  showBetriebOnCover?: boolean;
  /** Native Beilagenrubrik auf dem Titelblatt. */
  showBeilagenOnCover?: boolean;
  beilagen?: string[];
  ort: string;
  datum: string;
  /**
   * Überschriften über Kontakt und Empfänger. Leer heisst "Wortlaut der
   * Vorlage" – die Vorlagen schreiben teils "Kontakt", teils "So erreichen Sie
   * mich", "An" oder "Für".
   */
  labelKontakt: string;
  labelEmpfaenger: string;
  foto: string | null;
  /** PDF-Dokumentinfos. Leere Felder werden automatisch gefüllt. */
  meta: PdfMeta;
};

/** Dokumentinfos im PDF – leer heisst "automatisch aus den Daten". */
export type PdfMeta = {
  title: string;
  author: string;
  subject: string;
  keywords: string;
};

export const EMPTY_META: PdfMeta = { title: "", author: "", subject: "", keywords: "" };

export const DEFAULT_COVER_BEILAGEN = ["Motivationsschreiben", "Lebenslauf", "Zeugnis"] as const;

export type ColorSlot = {
  key: string;
  label: string;
  default: string;
};

export type TemplateId =
  | "klassisch"
  | "modern"
  | "freundlich"
  | "edel"
  | "colorful"
  | "blockig"
  | "edelBlockig"
  | "serioes"
  | "human"
  | "sonnig"
  | "welle"
  | "terracotta"
  | "pastell"
  | "sonne"
  | "studio"
  | "neon"
  | "aurora"
  | "verlauf"
  | "citrus";

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  slots: ColorSlot[];
};

/** Aufzählungszeichen für mehrzeilige Textblöcke. */
export type ListStyle = "none" | "bullet" | "dash" | "number";

export const LIST_STYLES: { value: ListStyle; label: string }[] = [
  { value: "none", label: "Ohne" },
  { value: "bullet", label: "•" },
  { value: "dash", label: "–" },
  { value: "number", label: "1." },
];

/** Alle Werte in mm (Position/Grösse) bzw. pt (Schriftgrösse). */
export type BlockStyle = {
  x: number;
  y: number;
  w: number;
  /** Optionale Mindesthöhe für frei skalierte Textfelder. */
  h?: number;
  size: number;
  /** Farbe: entweder ein Slot-Key ("accent") oder ein Hex-Wert. */
  color: string;
  align: "left" | "center" | "right";
  weight: number;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  tracking: number; // em
  lineHeight: number;
  opacity: number;
  font: FontKey;
  hidden: boolean;
  list: ListStyle;
  /** Hintergrund-"Badge": Slot-Key, Hex oder null (= keiner). */
  bg: string | null;
  /** Innenabstand des Badges in mm. */
  padX: number;
  padY: number;
  /** Eckenradius des Badges in mm (999 = Pille). */
  bgRadius: number;
  /** Optional: Schrift automatisch verkleinern, bis der Text in n Zeilen passt. */
  maxLines?: number;
  /**
   * Block hängt unter einem anderen: `y` wird aus dessen Unterkante plus `gap`
   * berechnet. So schiebt ein zweizeiliger Titel den Namen mit nach unten,
   * statt ihn zu überdecken. Beim Verschieben löst sich die Bindung.
   */
  follows?: string | null;
  /** Umgekehrt: Block sitzt direkt *über* dem genannten Block. */
  above?: string | null;
  /** Abstand in mm zum verketteten Block. */
  gap?: number;
  /**
   * `y` ist die Unterkante. Fusszeilen wachsen damit nach oben, statt bei
   * grösserer Schrift unten aus dem Blatt zu laufen.
   */
  anchorBottom?: boolean;
  /** Foto und Formen: Höhe = w * ratio */
  ratio?: number;
  /** Breite und Höhe gemeinsam skalieren; ohne gespeicherten Wert setzt die UI den passenden Element-Default. */
  lockRatio?: boolean;
  /** Eckenradius in mm; 999 = Kreis, 0 = eckig. */
  radius?: number;
  /** Bildzuschnitt: Vergrösserung (1 = ganzes Bild) und Bildausschnitt in %. */
  imgZoom?: number;
  imgX?: number;
  imgY?: number;
  /**
   * Rahmen um das Element in mm (0 = keiner) und dessen Farbe. Beim Foto und
   * bei Bildern liegt der Rahmen aussen an und verändert die Bildgrösse nicht.
   */
  borderWidth?: number;
  borderColor?: string;
  /**
   * Eckenradius des Element-Rahmens in mm. Bewusst getrennt von `bgRadius`:
   * das ist der Radius der Badge-Pille und steht auf 999 vorbelegt – als
   * Rahmen um ein Textfeld ergäbe das ungefragt eine Pille.
   */
  boxRadius?: number;
  /** Füllfarbe: hinter den Initialen bzw. Flächenfarbe einer Form (null = keine). */
  fill?: string | null;
  /** Linienstärke einer Form in mm. */
  strokeWidth?: number;
  /**
   * Farbverlauf als Füllung einer Form. `gradFrom` gesetzt schaltet ihn ein und
   * ersetzt `fill`. Die Stopps stehen in Prozent, der Winkel in Grad
   * (0 = von unten nach oben, 90 = nach rechts, 135 = diagonal).
   */
  gradFrom?: string | null;
  gradTo?: string;
  gradStart?: number;
  gradEnd?: number;
  gradAngle?: number;
};

/**
 * Nur die frei veränderbare Geometrie entfernen, ohne Farbe, Schrift,
 * Rahmen, Sichtbarkeit oder Ebenenwahl anzutasten.
 */
export function withoutBlockGeometry(style: Partial<BlockStyle>): Partial<BlockStyle> {
  const {
    x: _x,
    y: _y,
    w: _w,
    h: _h,
    ratio: _ratio,
    follows: _follows,
    above: _above,
    gap: _gap,
    anchorBottom: _anchorBottom,
    ...visualStyle
  } = style;
  return visualStyle;
}

export type BlockKind = "text" | "photo" | "shape" | "image";

/** Ein Textabschnitt mit eigener Farbe/Gewichtung – für zweifarbige Zeilen. */
export type Segment = { t: string; color?: string; weight?: number };

/** Eine Zeile ist entweder reiner Text oder eine Folge von Abschnitten. */
export type Line = string | Segment[];

export type Block = {
  id: string;
  label: string;
  kind: BlockKind;
  lines: Line[];
  style: BlockStyle;
  /** nur für kind === "shape" */
  shape?: ShapeKind;
  path?: string;
  /** nur für kind === "image": Data-URL des Bildes, null = noch keins gewählt. */
  src?: string | null;
};

export function lineText(line: Line): string {
  return typeof line === "string" ? line : line.map((s) => s.t).join("");
}

export type ShapeKind = "circle" | "rect" | "line" | "path";

export const SHAPE_KINDS: { value: ShapeKind; label: string }[] = [
  { value: "circle", label: "Kreis" },
  { value: "rect", label: "Rechteck" },
  { value: "line", label: "Linie" },
  { value: "path", label: "Freihand" },
];

/** Art eines selbst hinzugefügten Elements. */
export type CustomKind = "text" | "shape" | "image";

/**
 * Selbst hinzugefügtes Element. `kind` fehlt in älteren gespeicherten
 * Entwürfen – dort entscheidet `shape` zwischen Form und Textfeld, siehe
 * `customKind`.
 */
export type CustomField = {
  id: string;
  label: string;
  text: string;
  /** CV-Seite des freien Elements; alte Entwürfe ohne Wert bleiben auf Seite 1. */
  page?: 1 | 2;
  kind?: CustomKind;
  shape?: ShapeKind;
  /** Nur für "path": SVG-Pfad in einem 0–100-Koordinatensystem. */
  path?: string;
  /**
   * Nur für `kind === "image"`: Data-URL des Bildes. `null` heisst, der Rahmen
   * steht schon, das Bild fehlt noch.
   */
  src?: string | null;
};

/** Art des Elements – verträgt Entwürfe, die noch kein `kind` gespeichert haben. */
export function customKind(c: CustomField): CustomKind {
  return c.kind ?? (c.shape ? "shape" : "text");
}

/**
 * Dossier-Schriften. Cabin wird lokal aus `public/fonts` geladen und ist
 * zugleich die eingebettete PDF-Standardschrift. Die übrigen Einträge behalten
 * System-Fallbacks für bestehende gespeicherte Schriftwahlen.
 */
export const FONT_STACKS: Record<FontKey, string> = {
  sans: "'Helvetica Neue', Helvetica, Arial, ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  times: "'Times New Roman', Times, Georgia, serif",
  humanist: "Verdana, Geneva, 'DejaVu Sans', sans-serif",
  freundlich: "Cabin, 'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif",
  schmal: "'Arial Narrow', 'Liberation Sans Narrow', 'Helvetica Neue Condensed', Arial, sans-serif",
  maschine: "'Courier New', Courier, 'DejaVu Sans Mono', monospace",
  plakativ: "Impact, Haettenschweiler, 'Arial Black', 'Franklin Gothic Bold', sans-serif",
};

export type FontKey =
  | "sans"
  | "serif"
  | "times"
  | "humanist"
  | "freundlich"
  | "schmal"
  | "maschine"
  | "plakativ";

/** Anzeigenamen für die Schriftwahl in der Werkzeugleiste. */
export const FONT_LABELS: Record<FontKey, string> = {
  sans: "Sans",
  serif: "Serif",
  times: "Times",
  humanist: "Verdana",
  freundlich: "Cabin",
  schmal: "Schmal",
  maschine: "Maschine",
  plakativ: "Plakativ",
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "brief" as TemplateId,
    name: "Brief",
    description: "Reinweisses Papier, schwarze Typografie, ohne Gestaltungselemente",
    slots: [
      { key: "bg", label: "Papier", default: "#ffffff" },
      { key: "ink", label: "Text", default: "#111111" },
      { key: "primary", label: "Hauptfarbe", default: "#111111" },
      { key: "accent", label: "Akzent", default: "#111111" },
    ],
  },
  {
    id: "klassisch",
    name: "Editorial",
    description: "Ruhige Serif, feine Rahmenlinien",
    slots: [
      { key: "ink", label: "Text", default: "#111111" },
      { key: "accent", label: "Akzent", default: "#8a6a3b" },
      { key: "bg", label: "Papier", default: "#f5efe4" },
    ],
  },
  {
    id: "modern",
    name: "Modern",
    description: "Grosse Typo, minimalistisch",
    slots: [
      { key: "primary", label: "Hauptfarbe", default: "#111827" },
      { key: "accent", label: "Akzent", default: "#f43f5e" },
      { key: "bg", label: "Hintergrund", default: "#fafafa" },
    ],
  },
  {
    id: "freundlich",
    name: "Warm",
    description: "Weiche Formen, warme Farben",
    slots: [
      { key: "primary", label: "Hauptform", default: "#0f766e" },
      { key: "secondary", label: "Zweite Form", default: "#f59e0b" },
      { key: "ink", label: "Text", default: "#0b1f24" },
      { key: "bg", label: "Hintergrund", default: "#fff9ef" },
    ],
  },
  {
    id: "edel",
    name: "Edel",
    description: "Dunkel, Gold, feine Serif",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#12131a" },
      { key: "ink", label: "Text", default: "#f2eee6" },
      { key: "accent", label: "Gold", default: "#c9a24a" },
    ],
  },
  {
    id: "colorful",
    name: "Colorful",
    description: "Kräftige Farbflächen, fröhlich",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#fffdf7" },
      { key: "primary", label: "Farbe 1", default: "#ef4444" },
      { key: "secondary", label: "Farbe 2", default: "#3b82f6" },
      { key: "tertiary", label: "Farbe 3", default: "#facc15" },
      { key: "ink", label: "Text", default: "#161616" },
    ],
  },
  {
    id: "blockig",
    name: "Blockig",
    description: "Grosse Rechtecke, Bauhaus-Raster",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#f4f4f2" },
      { key: "primary", label: "Blockfarbe", default: "#1f2937" },
      { key: "accent", label: "Akzentblock", default: "#f97316" },
      { key: "ink", label: "Text", default: "#111111" },
    ],
  },
  {
    id: "edelBlockig",
    name: "Edel blockig",
    description: "Dunkle Flächen mit Goldlinien",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#0f1115" },
      { key: "primary", label: "Fläche", default: "#1b1f27" },
      { key: "accent", label: "Gold", default: "#bfa06a" },
      { key: "ink", label: "Text", default: "#f5f2ec" },
    ],
  },
  {
    id: "serioes",
    name: "Seriös",
    description: "Zurückhaltend, Marineblau",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#ffffff" },
      { key: "primary", label: "Hauptfarbe", default: "#1e3a5f" },
      { key: "accent", label: "Akzent", default: "#94a3b8" },
      { key: "ink", label: "Text", default: "#1f2937" },
    ],
  },
  {
    id: "human",
    name: "Human",
    description: "Weich, persönlich, erdige Töne",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#fdf6f0" },
      { key: "primary", label: "Hauptfarbe", default: "#9c5b3c" },
      { key: "secondary", label: "Sanfte Fläche", default: "#e7d3c4" },
      { key: "ink", label: "Text", default: "#3b2a22" },
    ],
  },
  {
    id: "sonnig",
    name: "Bogen",
    description: "Eleganter Bogen, Foto im Rund",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#f7f2ea" },
      { key: "primary", label: "Bogenfarbe", default: "#1f3d34" },
      { key: "secondary", label: "Feine Linie", default: "#c9a24a" },
      { key: "ink", label: "Text", default: "#22201c" },
    ],
  },
  {
    id: "welle",
    name: "Horizont",
    description: "Ruhige Bandaufteilung, viel Weissraum",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#fbf8f4" },
      { key: "primary", label: "Band unten", default: "#243447" },
      { key: "secondary", label: "Akzentlinie", default: "#c08457" },
      { key: "ink", label: "Text", default: "#1b232c" },
    ],
  },
  {
    id: "terracotta",
    name: "Kolumne",
    description: "Farbspalte links, klare Typo rechts",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#fdfaf6" },
      { key: "primary", label: "Spaltenfarbe", default: "#8c3f28" },
      { key: "secondary", label: "Feine Linie", default: "#e0bfa3" },
      { key: "ink", label: "Text", default: "#2b211c" },
    ],
  },
  {
    id: "pastell",
    name: "Rahmen",
    description: "Feiner Rahmen, luftig und edel",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#fbfaf8" },
      { key: "primary", label: "Rahmen / Akzent", default: "#4a4e69" },
      { key: "secondary", label: "Weiche Fläche", default: "#e8e4de" },
      { key: "ink", label: "Text", default: "#22212b" },
    ],
  },
  {
    id: "sonne",
    name: "Sonne",
    description: "Gelbes Band, Foto im Kreis, kräftiger Kontrast",
    slots: [
      { key: "primary", label: "Signalfarbe", default: "#fbbf24" },
      { key: "bg", label: "Dunkelfläche", default: "#333333" },
      { key: "ink", label: "Text dunkel", default: "#141414" },
      { key: "light", label: "Text hell", default: "#f7f5f0" },
    ],
  },
  {
    id: "studio",
    name: "Studio",
    description: "Dunkle Spalte links, Farbband mit Namen",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#ffffff" },
      { key: "primary", label: "Spalte", default: "#232b3a" },
      { key: "accent", label: "Namensband", default: "#f5d547" },
      { key: "ink", label: "Text", default: "#1f2937" },
    ],
  },
  {
    id: "neon",
    name: "Neon",
    description: "Dunkel mit Farbverlauf-Blasen, sehr modern",
    slots: [
      { key: "bg", label: "Hintergrund", default: "#0d0b2b" },
      { key: "primary", label: "Verlauf 1", default: "#e11d8f" },
      { key: "secondary", label: "Verlauf 2", default: "#7c3aed" },
      { key: "ink", label: "Text", default: "#f8fafc" },
    ],
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Verlaufsband oben, heller Körper darunter",
    slots: [
      { key: "primary", label: "Verlauf links", default: "#0ea5e9" },
      { key: "secondary", label: "Verlauf rechts", default: "#6d28d9" },
      { key: "bg", label: "Hintergrund", default: "#ffffff" },
      { key: "ink", label: "Text", default: "#111827" },
    ],
  },
  {
    id: "verlauf",
    name: "Verlauf",
    description: "Ganzflächiger Farbverlauf, weisse Typo",
    slots: [
      { key: "primary", label: "Verlauf oben", default: "#7f5af0" },
      { key: "secondary", label: "Verlauf unten", default: "#2cb67d" },
      { key: "ink", label: "Text", default: "#ffffff" },
      { key: "bg", label: "Kreisfläche", default: "#ffffff" },
    ],
  },
  {
    id: "citrus",
    name: "Citrus",
    description: "Warmer Verlauf mit weisser Textkarte",
    slots: [
      { key: "primary", label: "Verlauf oben", default: "#fb7185" },
      { key: "secondary", label: "Verlauf unten", default: "#fbbf24" },
      { key: "bg", label: "Karte", default: "#fffdf9" },
      { key: "ink", label: "Text", default: "#3f1d2b" },
    ],
  },
];

export const LEHRBERUFE = [
  "Kaufmann/-frau EFZ",
  "Informatiker/in EFZ",
  "Detailhandelsfachmann/-frau EFZ",
  "Detailhandelsassistent/in EBA",
  "Fachmann/-frau Gesundheit EFZ",
  "Fachmann/-frau Betreuung EFZ",
  "Polymechaniker/in EFZ",
  "Elektroinstallateur/in EFZ",
  "Automatiker/in EFZ",
  "Logistiker/in EFZ",
  "Koch/Köchin EFZ",
  "Zeichner/in EFZ",
  "Mediamatiker/in EFZ",
  "Maurer/in EFZ",
  "Schreiner/in EFZ",
  "Coiffeur/Coiffeuse EFZ",
  "Landwirt/in EFZ",
];

export const DEMO_DATA: CoverData = {
  meta: { ...EMPTY_META },
  kicker: "",
  eyebrow: "",
  beruf: "Informatiker/in EFZ",
  lehrbeginn: "August 2027",
  vorname: "Lea",
  nachname: "Müller",
  adresse: "Dorfstrasse 12",
  plzOrt: "4535 Hubersdorf",
  telefon: "+41 79 123 45 67",
  email: "lea.mueller@example.ch",
  geburtsdatum: "14.03.2010",
  lehrbetrieb: "Beispiel AG",
  ansprechperson: "Herr Thomas Weber",
  betriebAdresse: "Industriestrasse 8, 4535 Hubersdorf",
  ort: "Hubersdorf",
  datum: "15.11.2026",
  labelKontakt: "",
  labelEmpfaenger: "",
  foto: null,
};
