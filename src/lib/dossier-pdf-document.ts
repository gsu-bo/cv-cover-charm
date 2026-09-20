import { buildBlocks, type StyleOverrides } from "@/components/cover/layouts";
import {
  EMPTY_META,
  FONT_LABELS,
  TEMPLATES,
  type Block,
  type CoverData,
  type CustomField,
  type FontKey,
  type TemplateId,
} from "@/components/cover/types";
import { emptyCv, entryFilled, type CvData, type CvDesign } from "@/components/cv/types";
import { normalizeCvPaperColor } from "@/components/cv/cv-paper";
import { normalizeActiveTemplateId } from "@/components/cover/fresh-templates";
import {
  EMPTY_LETTER,
  normalizeLetterDesign,
  type LetterData,
  type LetterDesign,
} from "@/components/letter/types";
import { emptyCoverDraft } from "@/lib/dossier";
import { DEFAULTS } from "@/default-config";

export type CoverPdfDocument = {
  template: TemplateId;
  data: CoverData;
  colors: Record<string, string>;
  blocks: Block[];
  fontScale: number;
};

export type LetterPdfDocument = {
  data: LetterData;
  design: LetterDesign;
};

export type CvPdfDocument = {
  data: CvData;
  design: CvDesign;
  elements: CustomField[];
  elementStyles: StyleOverrides;
  coverFingerprint?: string | null;
};

const EMPTY_COVER_DATA: CoverData = {
  meta: { ...EMPTY_META },
  kicker: "",
  eyebrow: "",
  beruf: "",
  lehrbeginn: "",
  vorname: "",
  nachname: "",
  adresse: "",
  plzOrt: "",
  telefon: "",
  email: "",
  geburtsdatum: "",
  lehrbetrieb: "",
  ansprechperson: "",
  betriebAdresse: "",
  ort: "",
  datum: "",
  labelKontakt: "",
  labelEmpfaenger: "",
  foto: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const templateDefinition = (template: TemplateId) => {
  const definition =
    TEMPLATES.find((candidate) => candidate.id === template) ??
    TEMPLATES.find((candidate) => candidate.id === DEFAULTS.TEMPLATE);
  if (!definition) throw new Error("Canonical dossier template is missing");
  return definition;
};

const defaultColors = (template: TemplateId): Record<string, string> =>
  Object.fromEntries(templateDefinition(template).slots.map((slot) => [slot.key, slot.default]));

export function coverPdfHasContent(data: CoverData, customs: CustomField[] = []): boolean {
  const fields = [
    data.beruf,
    data.lehrbeginn,
    data.vorname,
    data.nachname,
    data.adresse,
    data.plzOrt,
    data.telefon,
    data.email,
    data.geburtsdatum,
    data.lehrbetrieb,
    data.ansprechperson,
    data.betriebAdresse,
  ];
  return (
    fields.some((value) => value.trim().length > 0) ||
    !!data.foto ||
    customs.some((field) => !!field.text.trim() || !!field.src)
  );
}

/** Default-Anrede und -Gruss zählen bewusst nicht: ein unangetasteter Brief ist noch kein Inhalt. */
export function letterPdfHasContent(data: LetterData): boolean {
  return [
    data.absenderName,
    data.empfaengerFirma,
    data.empfaengerName,
    data.betreff,
    data.text,
    data.unterschrift,
  ].some((value) => value.trim().length > 0);
}

export function cvPdfHasContent(data: CvData): boolean {
  const person = data.person ?? emptyCv.person;
  if (
    [
      person.vorname,
      person.nachname,
      person.adresse,
      person.plzOrt,
      person.telefon,
      person.email,
      person.geburtsdatum,
      person.nationalitaet,
      person.untertitel,
    ].some((value) => value.trim().length > 0) ||
    person.foto
  ) {
    return true;
  }
  return !!(
    data.schule?.some(entryFilled) ||
    data.erfahrung?.some(entryFilled) ||
    data.sprachen?.some((entry) => entry.name.trim() || entry.niveau.trim()) ||
    data.hobbys?.some((entry) => entry.trim()) ||
    data.staerken?.some((entry) => entry.trim()) ||
    data.referenzen?.some((entry) =>
      [entry.name, entry.funktion, entry.kontakt, entry.email, entry.zusatz].some((value) =>
        value?.trim(),
      ),
    ) ||
    data.customSections?.some((section) => section.entries.some(entryFilled))
  );
}

/** Baut die druckbare Titelblattansicht aus dem gespeicherten Projektteil. */
export function coverPdfDocumentFromSaved(raw: unknown): CoverPdfDocument | null {
  if (!isRecord(raw) || !isRecord(raw.data)) return null;
  const template = normalizeActiveTemplateId(raw.template);
  const definition = templateDefinition(template);
  const data = {
    ...EMPTY_COVER_DATA,
    ...(raw.data as Partial<CoverData>),
    meta: {
      ...EMPTY_META,
      ...(isRecord(raw.data.meta) ? raw.data.meta : {}),
    },
  };
  const colorsByTemplate = isRecord(raw.colors) ? raw.colors : {};
  const colors = isRecord(colorsByTemplate[template])
    ? (colorsByTemplate[template] as Record<string, string>)
    : defaultColors(template);
  const layoutByTemplate = isRecord(raw.layout) ? raw.layout : {};
  const overrides = isRecord(layoutByTemplate[template])
    ? (layoutByTemplate[template] as StyleOverrides)
    : {};
  const customs = Array.isArray(raw.customs) ? (raw.customs as CustomField[]) : [];
  const fontScale =
    typeof raw.fontScale === "number" && Number.isFinite(raw.fontScale) ? raw.fontScale : 1.2;
  const documentFont =
    typeof raw.font === "string" && raw.font in FONT_LABELS ? (raw.font as FontKey) : null;
  const built = buildBlocks(template, data, customs, overrides, definition.slots);
  const blocks = documentFont
    ? built.map((block) =>
        overrides[block.id]?.font
          ? block
          : { ...block, style: { ...block.style, font: documentFont } },
      )
    : built;

  return { template, data, colors, blocks, fontScale };
}

/** Baut die druckbare Anschreibenansicht aus dem gespeicherten Projektteil. */
export function letterPdfDocumentFromSaved(raw: unknown): LetterPdfDocument | null {
  if (!isRecord(raw) || !isRecord(raw.data)) return null;
  const data: LetterData = { ...EMPTY_LETTER, ...(raw.data as Partial<LetterData>) };
  const design = normalizeLetterDesign(raw.design);
  return { data, design };
}

/** Baut die druckbare CV-Ansicht aus dem gespeicherten Projektteil. */
export function cvPdfDocumentFromSaved(raw: unknown): CvPdfDocument | null {
  if (!isRecord(raw) || !isRecord(raw.data)) return null;
  const draft = emptyCoverDraft();
  const incomingData = raw.data as Partial<CvData>;
  const data: CvData = {
    ...emptyCv,
    ...incomingData,
    person: { ...emptyCv.person, ...(incomingData.person ?? {}) },
  };
  const incomingDesign = isRecord(raw.design) ? (raw.design as Partial<CvDesign>) : {};
  const template = normalizeActiveTemplateId(incomingDesign.template ?? draft.template);
  const design: CvDesign = {
    template,
    colors: isRecord(incomingDesign.colors)
      ? (incomingDesign.colors as Record<string, string>)
      : defaultColors(template),
    paperColor: normalizeCvPaperColor(incomingDesign.paperColor),
    bgOpacity: typeof incomingDesign.bgOpacity === "number" ? incomingDesign.bgOpacity : 0.25,
    useElements: incomingDesign.useElements === true,
    ...(incomingDesign.font && incomingDesign.font in FONT_LABELS
      ? { font: incomingDesign.font }
      : {}),
    ...(incomingDesign.headingRule ? { headingRule: incomingDesign.headingRule } : {}),
    ...(typeof incomingDesign.titleScale === "number"
      ? { titleScale: incomingDesign.titleScale }
      : {}),
    ...(typeof incomingDesign.headingScale === "number"
      ? { headingScale: incomingDesign.headingScale }
      : {}),
    ...(typeof incomingDesign.bodyScale === "number"
      ? { bodyScale: incomingDesign.bodyScale }
      : {}),
    ...(typeof incomingDesign.sectionTitlePill === "boolean"
      ? { sectionTitlePill: incomingDesign.sectionTitlePill }
      : {}),
    ...(typeof incomingDesign.sectionTitleOffsetMm === "number"
      ? { sectionTitleOffsetMm: incomingDesign.sectionTitleOffsetMm }
      : {}),
    ...(typeof incomingDesign.sectionContentIndentMm === "number"
      ? { sectionContentIndentMm: incomingDesign.sectionContentIndentMm }
      : {}),
    ...(typeof incomingDesign.citrusRubricPill === "boolean"
      ? { citrusRubricPill: incomingDesign.citrusRubricPill }
      : {}),
    ...(typeof incomingDesign.citrusRubricOffsetMm === "number"
      ? { citrusRubricOffsetMm: incomingDesign.citrusRubricOffsetMm }
      : {}),
    ...(typeof incomingDesign.citrusContentIndentMm === "number"
      ? { citrusContentIndentMm: incomingDesign.citrusContentIndentMm }
      : {}),
    ...(typeof incomingDesign.sidebarPct === "number"
      ? { sidebarPct: incomingDesign.sidebarPct }
      : {}),
  };

  return {
    data,
    design,
    elements: Array.isArray(raw.elements) ? (raw.elements as CustomField[]) : [],
    elementStyles: isRecord(raw.elementStyles) ? (raw.elementStyles as StyleOverrides) : {},
    coverFingerprint: typeof raw.coverFingerprint === "string" ? raw.coverFingerprint : null,
  };
}
