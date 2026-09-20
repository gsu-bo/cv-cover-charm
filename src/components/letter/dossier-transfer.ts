import {
  FONT_LABELS,
  TEMPLATES,
  type CoverData,
  type FontKey,
  type TemplateId,
} from "@/components/cover/types";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  LETTER_STORAGE_KEY,
  readStoredDossierPart,
} from "@/lib/dossier-project";
import { dossierDefaultFontKey } from "@/lib/dossier-theme";
import {
  defaultLetterColors,
  normalizeLetterMotifOpacity,
  type LetterData,
  type LetterDesign,
} from "./types";

type RecordLike = Record<string, unknown>;

export type LetterDossierSource = {
  personalData: Partial<LetterData>;
  applicationData: Partial<LetterData>;
  design: LetterDesign | null;
  hasPersonal: boolean;
  hasApplication: boolean;
  hasDesign: boolean;
  personalSource: "Titelblatt" | "Lebenslauf" | null;
  applicationSource: "Titelblatt" | null;
  designSource: "Titelblatt" | "Lebenslauf" | null;
};

export type CoverDossierSource = {
  personalData: Partial<CoverData>;
  applicationData: Partial<CoverData>;
  hasPersonal: boolean;
  hasApplication: boolean;
  personalSource:
    "Lebenslauf" | "Motivationsschreiben" | "Lebenslauf + Motivationsschreiben" | null;
  applicationSource: "Motivationsschreiben" | null;
};

const isRecord = (value: unknown): value is RecordLike =>
  !!value && typeof value === "object" && !Array.isArray(value);

const text = (record: RecordLike | undefined, key: string): string => {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
};

function fullName(record: RecordLike | undefined): string {
  return [text(record, "vorname"), text(record, "nachname")].filter(Boolean).join(" ");
}

function splitLetterName(value: string): { vorname: string; nachname: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { vorname: "", nachname: "" };
  if (parts.length === 1) return { vorname: parts[0], nachname: "" };
  return {
    vorname: parts.slice(0, -1).join(" "),
    nachname: parts.at(-1) ?? "",
  };
}

function coverBerufFromLetterSubject(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  const match =
    normalized.match(/^Bewerbung\s+um\s+(?:eine\s+)?Lehrstelle\s+als\s+(.+)$/i) ??
    normalized.match(/^Bewerbung\s+als\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

/** Titelblatt speichert die Betriebsadresse bislang in einem Feld. Für den Brief
 * trennen wir nur den klaren Schweizer Fall "Strasse 1, 4500 Ort". Alles andere
 * bleibt vollständig in der Adresszeile, statt durch eine aggressive Heuristik
 * beschädigt zu werden. */
function splitRecipientAddress(value: string): { address: string; plzOrt: string } {
  const normalized = value.trim();
  const match = normalized.match(/^(.*?),\s*(\d{4}\s+.+)$/);
  if (!match) return { address: normalized, plzOrt: "" };
  return { address: match[1].trim(), plzOrt: match[2].trim() };
}

function validTemplate(value: unknown): TemplateId | null {
  if (typeof value !== "string" || value === "colorful") return null;
  return TEMPLATES.some((template) => template.id === value) ? (value as TemplateId) : null;
}

function validFont(value: unknown): FontKey | null {
  return typeof value === "string" && value in FONT_LABELS ? (value as FontKey) : null;
}

function coverDesign(raw: RecordLike | undefined): LetterDesign | null {
  if (!raw) return null;
  const template = validTemplate(raw.template);
  if (!template) return null;

  const colorsByTemplate = isRecord(raw.colors) ? raw.colors : {};
  const savedColors = isRecord(colorsByTemplate[template])
    ? (colorsByTemplate[template] as Record<string, string>)
    : {};
  const explicitFont = validFont(raw.font);

  return {
    template,
    colors: { ...defaultLetterColors(template), ...savedColors },
    // Kompatibilitätswert für das Auswahlfeld. Die tatsächliche Schrift kommt
    // aus der Dossier-Familie, solange kein expliziter Override gesetzt wurde.
    font: explicitFont ?? dossierDefaultFontKey(template),
    fontOverride: explicitFont,
  };
}

function cvDesign(raw: RecordLike | undefined): LetterDesign | null {
  if (!raw || !isRecord(raw.design)) return null;
  const incoming = raw.design;
  const template = validTemplate(incoming.template);
  if (!template) return null;
  const colors = isRecord(incoming.colors)
    ? (incoming.colors as Record<string, string>)
    : defaultLetterColors(template);
  const explicitFont = validFont(incoming.font);
  const bgOpacity =
    typeof incoming.bgOpacity === "number" && Number.isFinite(incoming.bgOpacity)
      ? normalizeLetterMotifOpacity(incoming.bgOpacity)
      : undefined;

  return {
    template,
    colors: { ...defaultLetterColors(template), ...colors },
    font: explicitFont ?? dossierDefaultFontKey(template),
    fontOverride: explicitFont,
    ...(bgOpacity !== undefined ? { bgOpacity } : {}),
  };
}

/**
 * Ein noch leeres Titelblatt darf das vorhandene Dossier zusammensetzen:
 * persönliche Angaben bevorzugt aus dem Lebenslauf, fehlende Felder aus dem
 * Motivationsschreiben; Foto nur aus dem Lebenslauf; Betrieb/Bewerbung aus dem
 * Motivationsschreiben. Dadurch hängt die sinnvolle Reihenfolge der drei
 * Editoren nicht mehr davon ab, womit jemand begonnen hat.
 */
export function readCoverDossierSource(): CoverDossierSource {
  const cv = readStoredDossierPart(CV_STORAGE_KEY);
  const letter = readStoredDossierPart(LETTER_STORAGE_KEY);
  const cvData = cv && isRecord(cv.data) ? cv.data : undefined;
  const cvPerson = cvData && isRecord(cvData.person) ? cvData.person : undefined;
  const letterData = letter && isRecord(letter.data) ? letter.data : undefined;
  const letterName = splitLetterName(text(letterData, "absenderName"));
  const foto = cvPerson?.foto;

  const cvPersonal = {
    vorname: text(cvPerson, "vorname"),
    nachname: text(cvPerson, "nachname"),
    adresse: text(cvPerson, "adresse"),
    plzOrt: text(cvPerson, "plzOrt"),
    telefon: text(cvPerson, "telefon"),
    email: text(cvPerson, "email"),
    geburtsdatum: text(cvPerson, "geburtsdatum"),
  };
  const letterPersonal = {
    vorname: letterName.vorname,
    nachname: letterName.nachname,
    adresse: text(letterData, "absenderAdresse"),
    plzOrt: text(letterData, "absenderPlzOrt"),
    telefon: text(letterData, "absenderTelefon"),
    email: text(letterData, "absenderEmail"),
  };

  const personalData: Partial<CoverData> = {
    vorname: cvPersonal.vorname || letterPersonal.vorname,
    nachname: cvPersonal.nachname || letterPersonal.nachname,
    adresse: cvPersonal.adresse || letterPersonal.adresse,
    plzOrt: cvPersonal.plzOrt || letterPersonal.plzOrt,
    telefon: cvPersonal.telefon || letterPersonal.telefon,
    email: cvPersonal.email || letterPersonal.email,
    geburtsdatum: cvPersonal.geburtsdatum,
    foto: typeof foto === "string" && foto.startsWith("data:") ? foto : null,
  };

  const cvContributed =
    Object.values(cvPersonal).some(Boolean) ||
    (typeof personalData.foto === "string" && personalData.foto.startsWith("data:"));
  const letterContributed = !!(
    (!cvPersonal.vorname && letterPersonal.vorname) ||
    (!cvPersonal.nachname && letterPersonal.nachname) ||
    (!cvPersonal.adresse && letterPersonal.adresse) ||
    (!cvPersonal.plzOrt && letterPersonal.plzOrt) ||
    (!cvPersonal.telefon && letterPersonal.telefon) ||
    (!cvPersonal.email && letterPersonal.email)
  );
  const hasPersonal = Object.entries(personalData).some(([key, value]) =>
    key === "foto" ? !!value : typeof value === "string" && !!value.trim(),
  );

  const recipientAddress = [
    text(letterData, "empfaengerAdresse"),
    text(letterData, "empfaengerPlzOrt"),
  ]
    .filter(Boolean)
    .join(", ");
  const lehrbetrieb = text(letterData, "empfaengerFirma");
  const ansprechperson = text(letterData, "empfaengerName");
  const beruf = coverBerufFromLetterSubject(text(letterData, "betreff"));
  const applicationData: Partial<CoverData> = {
    lehrbetrieb,
    ansprechperson,
    betriebAdresse: recipientAddress,
    beruf,
    ort: text(letterData, "ort"),
    datum: text(letterData, "datum"),
    ...(lehrbetrieb || ansprechperson || recipientAddress ? { showBetriebOnCover: true } : {}),
  };
  const hasApplication = [
    lehrbetrieb,
    ansprechperson,
    recipientAddress,
    beruf,
    text(letterData, "ort"),
    text(letterData, "datum"),
  ].some(Boolean);

  return {
    personalData,
    applicationData,
    hasPersonal,
    hasApplication,
    personalSource: hasPersonal
      ? cvContributed && letterContributed
        ? "Lebenslauf + Motivationsschreiben"
        : cvContributed
          ? "Lebenslauf"
          : "Motivationsschreiben"
      : null,
    applicationSource: hasApplication ? "Motivationsschreiben" : null,
  };
}

export function readLetterDossierSource(): LetterDossierSource {
  const cover = readStoredDossierPart(COVER_STORAGE_KEY);
  const cv = readStoredDossierPart(CV_STORAGE_KEY);
  const coverData = cover && isRecord(cover.data) ? cover.data : undefined;
  const cvData = cv && isRecord(cv.data) ? cv.data : undefined;
  const cvPerson = cvData && isRecord(cvData.person) ? cvData.person : undefined;

  const coverName = fullName(coverData);
  const cvName = fullName(cvPerson);
  const personalFromCover = !!(
    coverName ||
    text(coverData, "adresse") ||
    text(coverData, "plzOrt") ||
    text(coverData, "telefon") ||
    text(coverData, "email")
  );
  const personalRecord = personalFromCover ? coverData : cvPerson;
  const personalName = personalFromCover ? coverName : cvName;

  const recipient = splitRecipientAddress(text(coverData, "betriebAdresse"));
  const beruf = text(coverData, "beruf");
  const applicationData: Partial<LetterData> = {
    empfaengerFirma: text(coverData, "lehrbetrieb"),
    empfaengerName: text(coverData, "ansprechperson"),
    empfaengerAdresse: recipient.address,
    empfaengerPlzOrt: recipient.plzOrt,
    ort: text(coverData, "ort"),
    datum: text(coverData, "datum"),
    betreff: beruf ? `Bewerbung um eine Lehrstelle als ${beruf}` : "",
  };

  const personalData: Partial<LetterData> = {
    absenderName: personalName,
    absenderAdresse: text(personalRecord, "adresse"),
    absenderPlzOrt: text(personalRecord, "plzOrt"),
    absenderTelefon: text(personalRecord, "telefon"),
    absenderEmail: text(personalRecord, "email"),
    unterschrift: personalName,
  };

  const hasPersonal = Object.values(personalData).some((value) => !!value);
  const hasApplication = Object.values(applicationData).some((value) => !!value);
  const fromCover = coverDesign(cover);
  const fromCv = cvDesign(cv);
  const design = fromCover
    ? {
        ...fromCover,
        ...(typeof fromCv?.bgOpacity === "number" ? { bgOpacity: fromCv.bgOpacity } : {}),
      }
    : fromCv;

  return {
    personalData,
    applicationData,
    design,
    hasPersonal,
    hasApplication,
    hasDesign: !!design,
    personalSource: hasPersonal ? (personalFromCover ? "Titelblatt" : "Lebenslauf") : null,
    applicationSource: hasApplication ? "Titelblatt" : null,
    designSource: design ? (fromCover ? "Titelblatt" : "Lebenslauf") : null,
  };
}

/** Nur echte Inhalte übertragen. Leere Felder aus einem Dossier dürfen einen
 * bereits geschriebenen Brief nie löschen. */
export function mergeNonEmptyLetterData(
  current: LetterData,
  incoming: Partial<LetterData>,
): LetterData {
  const next = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value !== "string" || !value.trim()) continue;
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}
