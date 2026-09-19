import type { CoverData } from "@/components/cover/types";
import type { CvData } from "@/components/cv/types";
import type { LetterData } from "@/components/letter/types";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "@/lib/dossier-pdf-document";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  LETTER_STORAGE_KEY,
  readStoredDossierPart,
} from "@/lib/dossier-project";
import type { DossierChromeContact } from "@/lib/dossier-chrome";

const emptyContact = (): DossierChromeContact => ({
  name: "",
  address: "",
  place: "",
  phone: "",
  email: "",
});

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function dossierContactFromCover(data: CoverData | null | undefined): DossierChromeContact {
  if (!data) return emptyContact();
  return {
    name: [clean(data.vorname), clean(data.nachname)].filter(Boolean).join(" "),
    address: clean(data.adresse),
    place: clean(data.plzOrt),
    phone: clean(data.telefon),
    email: clean(data.email),
  };
}

export function dossierContactFromCv(data: CvData | null | undefined): DossierChromeContact {
  if (!data?.person) return emptyContact();
  const person = data.person;
  return {
    name: [clean(person.vorname), clean(person.nachname)].filter(Boolean).join(" "),
    address: clean(person.adresse),
    place: clean(person.plzOrt),
    phone: clean(person.telefon),
    email: clean(person.email),
  };
}

export function dossierContactFromLetter(
  data: LetterData | null | undefined,
): DossierChromeContact {
  if (!data) return emptyContact();
  return {
    name: clean(data.absenderName),
    address: clean(data.absenderAdresse),
    place: clean(data.absenderPlzOrt),
    phone: clean(data.absenderTelefon),
    email: clean(data.absenderEmail),
  };
}

/**
 * One dossier-level contact source for synchronized headers.
 *
 * Existing product semantics already prefer the title page for personal data,
 * then the CV, then the motivation letter. Resolve field-by-field so a partly
 * filled title page can still use missing contact details from the CV/letter.
 */
export function resolveDossierContact({
  cover,
  cv,
  letter,
}: {
  cover?: CoverData | null;
  cv?: CvData | null;
  letter?: LetterData | null;
}): DossierChromeContact {
  const sources = [
    dossierContactFromCover(cover),
    dossierContactFromCv(cv),
    dossierContactFromLetter(letter),
  ];
  const pick = (key: keyof DossierChromeContact) =>
    sources.map((source) => source[key]).find((value) => !!value) ?? "";
  return {
    name: pick("name"),
    address: pick("address"),
    place: pick("place"),
    phone: pick("phone"),
    email: pick("email"),
  };
}

/**
 * Resolve the same synchronized header contact in either editor. The currently
 * edited document can be supplied as an override so its in-memory changes do
 * not have to wait for autosave before the header updates.
 */
export function readDossierContact({
  cover,
  cv,
  letter,
}: {
  cover?: CoverData | null;
  cv?: CvData | null;
  letter?: LetterData | null;
} = {}): DossierChromeContact {
  const storedCover =
    cover === undefined
      ? coverPdfDocumentFromSaved(readStoredDossierPart(COVER_STORAGE_KEY))?.data
      : cover;
  const storedCv =
    cv === undefined ? cvPdfDocumentFromSaved(readStoredDossierPart(CV_STORAGE_KEY))?.data : cv;
  const storedLetter =
    letter === undefined
      ? letterPdfDocumentFromSaved(readStoredDossierPart(LETTER_STORAGE_KEY))?.data
      : letter;
  const stored = { cover: storedCover, cv: storedCv, letter: storedLetter };
  const fallback = resolveDossierContact(stored);
  const preferredSources = [
    cover !== undefined ? dossierContactFromCover(cover) : null,
    cv !== undefined ? dossierContactFromCv(cv) : null,
    letter !== undefined ? dossierContactFromLetter(letter) : null,
  ].filter((source): source is DossierChromeContact => source !== null);

  // The editor currently on screen is the live authority. Otherwise a stale
  // title-page name can mask freshly entered CV/letter values until autosave.
  // Keep the dossier-wide sources only as field-wise fallbacks for blanks.
  const pick = (key: keyof DossierChromeContact) =>
    preferredSources.map((source) => source[key]).find((value) => !!value) ?? fallback[key];

  return {
    name: pick("name"),
    address: pick("address"),
    place: pick("place"),
    phone: pick("phone"),
    email: pick("email"),
  };
}
