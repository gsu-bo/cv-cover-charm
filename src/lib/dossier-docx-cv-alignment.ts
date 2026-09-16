import type { CvPdfDocument } from "@/lib/dossier-pdf-document";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { readPersistedCvTextAlignment } from "@/components/cv/text-alignment";
import type { CvData, CvEntry } from "@/components/cv/types";
import type { TextAlignment } from "@/lib/text-alignment";

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const xmlDecode = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const normalized = (value: string) => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function wordAlignment(align: TextAlignment) {
  return align === "justify" ? "both" : align;
}

function entryBodyValues(entry: CvEntry) {
  return [entry.ort, entry.beschreibung];
}

/** Textrollen, die im Browser als `data-cv-body` gerendert werden. */
function cvBodyCandidates(data: CvData): string[] {
  const values: string[] = [];
  const person = data.person;
  values.push(
    person.adresse,
    person.plzOrt,
    person.telefon,
    person.email,
    person.geburtsdatum,
    person.nationalitaet,
    [person.adresse, person.plzOrt].filter(Boolean).join(", "),
    [person.telefon, person.email].filter(Boolean).join(" · "),
  );

  for (const entry of [...data.schule, ...data.erfahrung]) values.push(...entryBodyValues(entry));
  for (const section of data.customSections ?? []) {
    for (const entry of section.entries) values.push(...entryBodyValues(entry));
  }
  for (const language of data.sprachen) values.push(language.name, language.niveau);
  values.push(...data.hobbys, ...data.staerken);
  for (const reference of data.referenzen) {
    values.push(reference.funktion, reference.kontakt, reference.email ?? "", reference.zusatz ?? "");
    values.push(...reference.kontakt.split(/\r?\n/g));
  }

  return Array.from(new Set(values.map(normalized).filter((value) => value.length >= 2)));
}

function cvStartIndex(source: string, data: CvData) {
  const fullName = [data.person.vorname, data.person.nachname].filter(Boolean).join(" ");
  const title = data.titel?.trim() || "Lebenslauf";
  const markers = [fullName, title, title.toLocaleUpperCase("de-CH"), "Lebenslauf", "LEBENSLAUF"]
    .map(normalized)
    .filter(Boolean);
  let start = -1;
  for (const marker of markers) start = Math.max(start, source.lastIndexOf(xmlEscape(marker)));
  return start;
}

function paragraphText(paragraph: string) {
  return normalized(
    Array.from(paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g), (match) =>
      xmlDecode(match[1]),
    ).join(" "),
  );
}

function withAlignment(paragraph: string, align: TextAlignment) {
  const jc = `<w:jc w:val="${wordAlignment(align)}"/>`;
  if (/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/.test(paragraph)) {
    return paragraph.replace(/<w:pPr(?:\s[^>]*)?>([\s\S]*?)<\/w:pPr>/, (all, inner: string) => {
      const next = /<w:jc\b[^>]*\/>/.test(inner)
        ? inner.replace(/<w:jc\b[^>]*\/>/, jc)
        : `${inner}${jc}`;
      return all.replace(inner, next);
    });
  }
  return paragraph.replace(/<w:p(?:\s[^>]*)?>/, (open) => `${open}<w:pPr>${jc}</w:pPr>`);
}

function patchCvBodyAlignment(source: string, cv: CvPdfDocument, align: TextAlignment) {
  const start = cvStartIndex(source, cv.data);
  if (start < 0) return source;
  const candidates = cvBodyCandidates(cv.data);
  if (!candidates.length) return source;

  return source.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph, offset: number) => {
    if (offset < start) return paragraph;
    const text = paragraphText(paragraph);
    if (!text) return paragraph;
    const matchesBody = candidates.some(
      (candidate) => text === candidate || text.includes(candidate) || candidate.includes(text),
    );
    return matchesBody ? withAlignment(paragraph, align) : paragraph;
  });
}

/** Apply the persisted CV body alignment after every template-specific DOCX renderer. */
export async function applyCvTextAlignmentToDocx(blob: Blob, cv: CvPdfDocument) {
  const align = readPersistedCvTextAlignment();
  if (!align) return blob;
  return transformStoredDocxDocumentXml(
    blob,
    (documentXml) => patchCvBodyAlignment(documentXml, cv, align),
    "Dossier-DOCX CV-Ausrichtung",
  );
}
