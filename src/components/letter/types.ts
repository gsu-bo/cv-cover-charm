import { defaultHeaderModeForTemplate, defaultFooterModeForTemplate } from "@/lib/template-chrome";
import { FONT_LABELS, TEMPLATES, type FontKey, type TemplateId } from "@/components/cover/types";
import { FRESH_TEMPLATE_REGISTRY } from "@/components/cover/fresh-template-registry";
import { normalizeActiveTemplateId } from "@/components/cover/fresh-templates";
import { LETTER_STORAGE_KEY } from "@/lib/dossier-project";
import { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";
import {
  normalizeDossierChromeDocumentContentSettings,
  type DossierChromeDocumentContentSettings,
} from "@/lib/dossier-chrome-content";
import type {
  DossierChromeInlineSeparator,
  DossierChromeState,
  DossierChromeTextLayout,
} from "@/lib/dossier-chrome";

export type LetterAlignment = "left" | "right";
export type LetterTemplateId = TemplateId;
export type LetterFontSelection = FontKey | "template";
export type LetterBodyColumns = 1 | 2 | 3;
export type LetterHeaderMode = "compact" | "contact" | "none";
export type LetterFooterMode = "compact" | "attachments" | "none";

/** Optional role-specific typography. Missing values preserve the template. */
export type LetterRoleTypography = {
  font?: FontKey;
  fontSizePt?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export const LETTER_ROLE_FONT_SIZE_MIN = 7;
export const LETTER_ROLE_FONT_SIZE_MAX = 30;

/** Frei platzierbares Bild im Anschreiben mit proportionaler Skalierung und automatischem Textfluss. */
export type LetterFlowImage = {
  id: string;
  src: string;
  side: "left" | "right";
  /** Horizontale Position im Brieftext-Bereich in mm. Fehlt bei älteren Entwürfen. */
  xMm?: number;
  /** Vertikaler Versatz ab Beginn des Brieftext-Bereichs in mm. */
  topMm: number;
  widthMm: number;
  /** Abstand des Textes zum Bild in mm. */
  gapMm: number;
};

export type LetterData = {
  absenderName: string;
  absenderAdresse: string;
  absenderPlzOrt: string;
  absenderTelefon: string;
  absenderEmail: string;
  empfaengerFirma: string;
  empfaengerName: string;
  empfaengerAdresse: string;
  empfaengerPlzOrt: string;
  ort: string;
  datum: string;
  betreff: string;
  anrede: string;
  text: string;
  /** Optionaler Rich-Text-Stand. `text` bleibt für alte Dateien und Suche erhalten. */
  richTextHtml?: string;
  gruss: string;
  unterschrift: string;
  /** Abstand zwischen Brieftext und Grussformel in mm. */
  grussAbstandMm?: number;
  /** Freier Platz zwischen Grussformel und gedrucktem Namen in mm. */
  unterschriftAbstandMm?: number;
  /** Optionale frei platzierbare Fotos/Bilder. Alte Entwürfe ohne Feld bleiben kompatibel. */
  images?: LetterFlowImage[];
  /** Beilagen am Ende des Motivationsschreibens. */
  showBeilagen?: boolean;
  beilagen?: string[];
};

export type LetterDesign = {
  template: LetterTemplateId;
  colors: Record<string, string>;
  /** Sichtbarkeit dekorativer Hintergrund-Motive von 0 (aus) bis 1 (Vorlagen-Baseline). */
  bgOpacity?: number;
  /** Eigene Papierfarbe nur für das Anschreiben; unabhängig von der Vorlage. */
  paperColor?: string | null;
  /** Eigene Haupttextfarbe; leer lässt sie automatisch aus der Papierfarbe ableiten. */
  textColor?: string | null;
  /** Standalone-Briefschrift bzw. Kompatibilitätswert für ältere Saves. */
  font: FontKey;
  /**
   * Nur eine bewusst gewählte Dossier-Schrift darf die Vorlagenfamilie
   * überschreiben. Fehlt dieser Wert, entscheidet die zentrale Dossier-Familie.
   */
  fontOverride?: FontKey | null;
  /** Briefspezifische Optionen sind optional, damit alte gespeicherte Designs kompatibel bleiben. */
  senderAlign?: LetterAlignment;
  recipientAlign?: LetterAlignment;
  dateAlign?: LetterAlignment;
  ruleAfterSender?: boolean;
  ruleAfterRecipient?: boolean;
  ruleAfterSubject?: boolean;
  /** Eigene Typografie für die Absenderanschrift; fehlt = wie Vorlage. */
  senderTypography?: LetterRoleTypography;
  /** Eigene Typografie für die Empfängeranschrift; fehlt = wie Vorlage. */
  recipientTypography?: LetterRoleTypography;
  /** Eigene Typografie für den Betreff; fehlt = wie Vorlage. */
  subjectTypography?: LetterRoleTypography;
  /** @deprecated Legacy-/SSR-Kompatibilität. Live ist DossierChromeState kanonisch. */
  headerMode?: LetterHeaderMode;
  headerShowName?: boolean;
  headerShowAddress?: boolean;
  headerShowPhone?: boolean;
  headerShowEmail?: boolean;
  headerDifferentFirstPage?: boolean;
  headerHeightMm?: number | null;
  headerTextLayout?: DossierChromeTextLayout;
  headerInlineSeparator?: DossierChromeInlineSeparator;
  headerBackgroundColor?: string | null;
  headerGradientColor?: string | null;
  /** @deprecated Legacy-/SSR-Kompatibilität. Live ist DossierChromeState kanonisch. */
  footerMode?: LetterFooterMode;
  footerHeightMm?: number | null;
  footerTextLayout?: DossierChromeTextLayout;
  footerBackgroundColor?: string | null;
  footerGradientColor?: string | null;
  chromeBorderEnabled?: boolean;
  chromeBorderColor?: string | null;
  chromeBorderWidthMm?: number;
  chromeTextFont?: FontKey | null;
  /** Dokumenteigene Header-/Footer-Texte; bewusst nicht Teil des Sync-States. */
  chromeContent?: DossierChromeDocumentContentSettings;
};

export type SavedLetter = {
  version: 1;
  data: LetterData;
  design: LetterDesign;
  /** Optional so existing v1 saves remain valid. */
  chrome?: DossierChromeState;
};

export { LETTER_STORAGE_KEY };

export const DEFAULT_LETTER_BEILAGEN = ["Lebenslauf", "Zeugnis"] as const;
export const DEFAULT_LETTER_CLOSING_GAP_MM = 4;
export const DEFAULT_LETTER_SIGNATURE_GAP_MM = 1;
export const MAX_LETTER_SIGNATURE_SPACING_MM = 50;
export const DEFAULT_LETTER_MOTIF_OPACITY = 0.25;

/** Ein gemeinsamer 0..1-Vertrag für Preview, Pagination, Persistenz und Export. */
export function normalizeLetterMotifOpacity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULT_LETTER_MOTIF_OPACITY;
}

/** Hält frei eingegebene Briefabstände in einem druckbaren Bereich. */
export function normalizeLetterSpacingMm(
  value: unknown,
  fallback = DEFAULT_LETTER_CLOSING_GAP_MM,
): number {
  const normalizedFallback = Number.isFinite(fallback)
    ? Math.min(MAX_LETTER_SIGNATURE_SPACING_MM, Math.max(0, fallback))
    : DEFAULT_LETTER_CLOSING_GAP_MM;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(MAX_LETTER_SIGNATURE_SPACING_MM, Math.max(0, Math.round(value * 10) / 10))
    : normalizedFallback;
}

/**
 * Brief keeps its historic standalone font control. Designed templates inherit
 * their dossier family until the user explicitly chooses an override.
 */
export function letterFontSelection(design: LetterDesign): LetterFontSelection {
  return design.template === "brief" ? design.font : (design.fontOverride ?? "template");
}

export function withLetterFontSelection(
  design: LetterDesign,
  selection: LetterFontSelection,
): LetterDesign {
  if (selection === "template") return { ...design, fontOverride: null };
  if (design.template === "brief") return { ...design, font: selection, fontOverride: null };
  return { ...design, font: selection, fontOverride: selection };
}

/** Fehlendes Feld migrieren, ein bewusst leeres Feld aber respektieren. */
export function letterAttachmentValues(data: Pick<LetterData, "beilagen">): string[] {
  return Array.isArray(data.beilagen) ? [...data.beilagen] : [...DEFAULT_LETTER_BEILAGEN];
}

export const DEMO_LETTER: LetterData = {
  absenderName: "Lea Müller",
  absenderAdresse: "Dorfstrasse 12",
  absenderPlzOrt: "4535 Hubersdorf",
  absenderTelefon: "079 123 45 67",
  absenderEmail: "lea.mueller@example.ch",
  empfaengerFirma: "Beispiel AG",
  empfaengerName: "Herr Thomas Weber",
  empfaengerAdresse: "Industriestrasse 8",
  empfaengerPlzOrt: "4535 Hubersdorf",
  ort: "Hubersdorf",
  datum: "15.11.2026",
  betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
  anrede: "Guten Tag Herr Weber",
  text: "Die Informatik begeistert mich, weil ich gerne logisch denke, Probleme löse und Neues ausprobiere. Deshalb bewerbe ich mich mit grossem Interesse um die Lehrstelle als Informatikerin EFZ bei der Beispiel AG.\n\nIn der Schule arbeite ich besonders gerne an Aufgaben, bei denen ich selbstständig Lösungen entwickeln kann. Ich bin zuverlässig, lerne schnell und arbeite gerne im Team.\n\nGerne möchte ich Ihr Unternehmen und den Beruf bei einem persönlichen Gespräch oder einer Schnupperlehre näher kennenlernen. Ich freue mich über Ihre Rückmeldung.",
  richTextHtml: "",
  gruss: "Freundliche Grüsse",
  unterschrift: "Lea Müller",
  images: [],
  showBeilagen: true,
  beilagen: [...DEFAULT_LETTER_BEILAGEN],
};

export const EMPTY_LETTER: LetterData = {
  absenderName: "",
  absenderAdresse: "",
  absenderPlzOrt: "",
  absenderTelefon: "",
  absenderEmail: "",
  empfaengerFirma: "",
  empfaengerName: "",
  empfaengerAdresse: "",
  empfaengerPlzOrt: "",
  ort: "",
  datum: "",
  betreff: "",
  anrede: "Guten Tag",
  text: "",
  richTextHtml: "",
  gruss: "Freundliche Grüsse",
  unterschrift: "",
  images: [],
  showBeilagen: true,
  beilagen: [...DEFAULT_LETTER_BEILAGEN],
};

export function defaultLetterColors(template: LetterTemplateId): Record<string, string> {
  if (template === "brief") {
    return {
      bg: "#ffffff",
      ink: "#111111",
      primary: "#111111",
      secondary: "#111111",
      accent: "#111111",
      cvInk: "#111111",
      cvMuted: "#4b5563",
      cvHeading: "#111111",
    };
  }
  const templateId = String(template);
  const definition =
    TEMPLATES.find((candidate) => String(candidate.id) === templateId) ??
    FRESH_TEMPLATE_REGISTRY.find((candidate) => String(candidate.id) === templateId) ??
    TEMPLATES.find((candidate) => candidate.id === CANONICAL_DOSSIER_PRESENTATION.template);
  if (!definition) return defaultLetterColors("brief");
  return Object.fromEntries(definition.slots.map((slot) => [slot.key, slot.default]));
}

function normalizedMm(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(40, Math.max(1, Math.round(value * 10) / 10))
    : null;
}

function normalizedBorderWidth(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(3, Math.max(0.2, Math.round(value * 10) / 10))
    : 0.6;
}

function normalizedColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

export function normalizeLetterRoleTypography(value: unknown): LetterRoleTypography | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const incoming = value as Partial<LetterRoleTypography>;
  const next: LetterRoleTypography = {};
  if (typeof incoming.font === "string" && incoming.font in FONT_LABELS) {
    next.font = incoming.font as FontKey;
  }
  if (typeof incoming.fontSizePt === "number" && Number.isFinite(incoming.fontSizePt)) {
    next.fontSizePt = Math.min(
      LETTER_ROLE_FONT_SIZE_MAX,
      Math.max(LETTER_ROLE_FONT_SIZE_MIN, Math.round(incoming.fontSizePt * 10) / 10),
    );
  }
  const color = normalizedColor(incoming.color);
  if (color) next.color = color;
  if (typeof incoming.bold === "boolean") next.bold = incoming.bold;
  if (typeof incoming.italic === "boolean") next.italic = incoming.italic;
  if (typeof incoming.underline === "boolean") next.underline = incoming.underline;
  return Object.keys(next).length ? next : undefined;
}

function normalizedHeaderInlineSeparator(value: unknown): DossierChromeInlineSeparator {
  return value === "dot" ||
    value === "icons" ||
    value === "slash" ||
    value === "pipe" ||
    value === "space"
    ? value
    : "icons";
}

export function emptyLetterDesign(): LetterDesign {
  const template: LetterTemplateId = CANONICAL_DOSSIER_PRESENTATION.template;
  return {
    template,
    colors: defaultLetterColors(template),
    bgOpacity: DEFAULT_LETTER_MOTIF_OPACITY,
    paperColor: null,
    textColor: null,
    font: "freundlich",
    fontOverride: null,
    senderAlign: "left",
    recipientAlign: "left",
    dateAlign: "left",
    ruleAfterSender: false,
    ruleAfterRecipient: false,
    ruleAfterSubject: false,
    headerMode: CANONICAL_DOSSIER_PRESENTATION.letter.headerMode,
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    headerDifferentFirstPage: false,
    headerHeightMm: null,
    headerTextLayout: "stacked",
    headerInlineSeparator: "icons",
    headerBackgroundColor: null,
    headerGradientColor: null,
    footerMode: CANONICAL_DOSSIER_PRESENTATION.letter.footerMode,
    footerHeightMm: null,
    footerTextLayout: "inline",
    footerBackgroundColor: null,
    footerGradientColor: null,
    chromeBorderEnabled: false,
    chromeBorderColor: null,
    chromeBorderWidthMm: 0.6,
    chromeTextFont: null,
  };
}

export function normalizeLetterDesign(value: unknown): LetterDesign {
  const fallback = emptyLetterDesign();
  if (!value || typeof value !== "object") return fallback;
  const incoming = value as Partial<LetterDesign>;
  const template: LetterTemplateId = normalizeActiveTemplateId(incoming.template);
  const font =
    typeof incoming.font === "string" && incoming.font in FONT_LABELS
      ? (incoming.font as FontKey)
      : fallback.font;
  const fontOverride =
    template !== "brief" &&
    typeof incoming.fontOverride === "string" &&
    incoming.fontOverride in FONT_LABELS
      ? (incoming.fontOverride as FontKey)
      : null;
  const chromeTextFont =
    typeof incoming.chromeTextFont === "string" && incoming.chromeTextFont in FONT_LABELS
      ? (incoming.chromeTextFont as FontKey)
      : null;
  const colors =
    incoming.colors && typeof incoming.colors === "object"
      ? { ...defaultLetterColors(template), ...incoming.colors }
      : defaultLetterColors(template);
  const headerMode: LetterHeaderMode =
    incoming.headerMode === "compact" ||
    incoming.headerMode === "contact" ||
    incoming.headerMode === "none"
      ? incoming.headerMode
      : defaultHeaderModeForTemplate(template);
  const footerMode: LetterFooterMode =
    incoming.footerMode === "attachments" ||
    incoming.footerMode === "none" ||
    incoming.footerMode === "compact"
      ? incoming.footerMode
      : (defaultFooterModeForTemplate(template) as LetterFooterMode);
  return {
    template,
    colors,
    bgOpacity: normalizeLetterMotifOpacity(incoming.bgOpacity),
    paperColor: normalizedColor(incoming.paperColor),
    textColor: normalizedColor(incoming.textColor),
    font,
    fontOverride,
    senderAlign: incoming.senderAlign === "right" ? "right" : "left",
    recipientAlign: incoming.recipientAlign === "right" ? "right" : "left",
    dateAlign: incoming.dateAlign === "right" ? "right" : "left",
    ruleAfterSender: incoming.ruleAfterSender === true,
    ruleAfterRecipient: incoming.ruleAfterRecipient === true,
    ruleAfterSubject: incoming.ruleAfterSubject === true,
    senderTypography: normalizeLetterRoleTypography(incoming.senderTypography),
    recipientTypography: normalizeLetterRoleTypography(incoming.recipientTypography),
    subjectTypography: normalizeLetterRoleTypography(incoming.subjectTypography),
    headerMode,
    headerShowName: incoming.headerShowName !== false,
    headerShowAddress: incoming.headerShowAddress !== false,
    headerShowPhone: incoming.headerShowPhone !== false,
    headerShowEmail: incoming.headerShowEmail !== false,
    headerDifferentFirstPage:
      typeof incoming.headerDifferentFirstPage === "boolean"
        ? incoming.headerDifferentFirstPage
        : (fallback.headerDifferentFirstPage ?? false),
    headerHeightMm: normalizedMm(incoming.headerHeightMm),
    headerTextLayout: incoming.headerTextLayout === "inline" ? "inline" : "stacked",
    headerInlineSeparator: normalizedHeaderInlineSeparator(incoming.headerInlineSeparator),
    headerBackgroundColor: normalizedColor(incoming.headerBackgroundColor),
    headerGradientColor: normalizedColor(incoming.headerGradientColor),
    footerMode,
    footerHeightMm: normalizedMm(incoming.footerHeightMm),
    footerTextLayout: incoming.footerTextLayout === "stacked" ? "stacked" : "inline",
    footerBackgroundColor: normalizedColor(incoming.footerBackgroundColor),
    footerGradientColor: normalizedColor(incoming.footerGradientColor),
    chromeBorderEnabled:
      typeof incoming.chromeBorderEnabled === "boolean"
        ? incoming.chromeBorderEnabled
        : (fallback.chromeBorderEnabled ?? false),
    chromeBorderColor: normalizedColor(incoming.chromeBorderColor),
    chromeBorderWidthMm: normalizedBorderWidth(incoming.chromeBorderWidthMm),
    chromeTextFont,
    chromeContent: normalizeDossierChromeDocumentContentSettings(incoming.chromeContent),
  };
}
