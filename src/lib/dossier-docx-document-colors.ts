import { CV_SECTION_LABELS, entryFilled } from "@/components/cv/types";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";

function wordColor(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : null;
}

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizedText(value: string) {
  return xmlDecode(value).replace(/\s+/g, " ").trim().toLocaleLowerCase("de-CH");
}

function visibleText(xml: string) {
  return normalizedText(
    Array.from(xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g), (match) => match[1]).join(""),
  );
}

function textTargets(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => normalizedText(value ?? "")).filter((value) => value.length >= 3),
    ),
  ];
}

function ensureRunColor(run: string, color: string) {
  const colorTag = `<w:color w:val="${color}"/>`;
  const properties = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (properties) {
    const next = /<w:color\b[^>]*\/>/.test(properties[1])
      ? properties[1].replace(/<w:color\b[^>]*\/>/g, colorTag)
      : `${properties[1]}${colorTag}`;
    return run.replace(properties[0], `<w:rPr>${next}</w:rPr>`);
  }
  return run.replace(/<w:r(\s[^>]*)?>/, (open) => `${open}<w:rPr>${colorTag}</w:rPr>`);
}

function patchRunsByText(
  source: string,
  values: Array<string | null | undefined>,
  color: string | null,
) {
  if (!color) return source;
  const targets = textTargets(values);
  if (!targets.length) return source;

  return source.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => {
    const text = visibleText(run);
    if (!text) return run;
    const matches = targets.some(
      (target) => text.includes(target) || (text.length >= 3 && target.includes(text)),
    );
    return matches ? ensureRunColor(run, color) : run;
  });
}

type SectionBounds = { start: number; end: number };

function bodyStart(source: string) {
  const body = /<w:body(?:\s[^>]*)?>/.exec(source);
  return body?.index === undefined ? null : body.index + body[0].length;
}

function enclosingParagraph(source: string, index: number) {
  const before = source.slice(0, index);
  const paragraphStarts = [...before.matchAll(/<w:p(?:\s[^>]*)?>/g)];
  const start = paragraphStarts.at(-1)?.index ?? -1;
  const endTag = source.indexOf("</w:p>", index);
  if (start < 0 || endTag < 0) return null;
  return { start, end: endTag + "</w:p>".length };
}

/** Cover, letter and CV are the three consecutive Word sections. */
function dossierSections(source: string): [SectionBounds, SectionBounds, SectionBounds] | null {
  const start = bodyStart(source);
  if (start === null) return null;
  const sectionProperties = [...source.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)];
  if (sectionProperties.length < 2) return null;
  const firstIndex = sectionProperties[0].index;
  const secondIndex = sectionProperties[1].index;
  if (firstIndex === undefined || secondIndex === undefined) return null;
  const firstBreak = enclosingParagraph(source, firstIndex);
  const secondBreak = enclosingParagraph(source, secondIndex);
  if (!firstBreak || !secondBreak) return null;

  const finalSectionIndex = sectionProperties.at(-1)?.index ?? source.length;
  return [
    { start, end: firstBreak.start },
    { start: firstBreak.end, end: secondBreak.start },
    { start: secondBreak.end, end: finalSectionIndex },
  ];
}

function setVmlFill(tag: string, color: string) {
  return /\bfillcolor="[^"]*"/.test(tag)
    ? tag.replace(/\bfillcolor="[^"]*"/, `fillcolor="#${color}"`)
    : tag.replace(/>$/, ` fillcolor="#${color}">`);
}

function recolorExistingPaper(source: string, color: string) {
  let changed = false;
  const next = source.replace(/<v:rect\b[^>]*>/g, (tag) => {
    if (!/\bid="[^"]*paper[^"]*"/i.test(tag)) return tag;
    changed = true;
    return setVmlFill(tag, color);
  });
  return { source: next, changed };
}

function paperParagraph(id: string, color: string) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:rect id="${id}" style="position:absolute;margin-left:0mm;margin-top:0mm;width:210mm;height:297mm;z-index:-251658241;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0" fillcolor="#${color}" stroked="f"/></w:pict></w:r></w:p>`;
}

function patchSectionPaper(section: string, color: string | null, id: string) {
  if (!color) return section;
  const recolored = recolorExistingPaper(section, color);
  return recolored.changed ? recolored.source : `${paperParagraph(id, color)}${section}`;
}

function coverTextValues(cover: CoverPdfDocument) {
  const d = cover.data;
  return [
    d.eyebrow,
    d.kicker,
    d.beruf,
    d.lehrbeginn,
    d.vorname,
    d.nachname,
    [d.vorname, d.nachname].filter(Boolean).join(" "),
    d.adresse,
    d.plzOrt,
    d.telefon,
    d.email,
    d.geburtsdatum,
    d.lehrbetrieb,
    d.ansprechperson,
    d.betriebAdresse,
    d.ort,
    d.datum,
    [d.ort, d.datum].filter(Boolean).join(", "),
    d.labelKontakt || "Kontakt",
    d.labelEmpfaenger,
    "Beilagen",
    ...(d.beilagen ?? []),
  ];
}

function letterTextValues(letter: LetterPdfDocument) {
  const d = letter.data;
  return [
    d.absenderName,
    d.absenderAdresse,
    d.absenderPlzOrt,
    d.absenderTelefon,
    d.absenderEmail,
    d.empfaengerFirma,
    d.empfaengerName,
    d.empfaengerAdresse,
    d.empfaengerPlzOrt,
    d.betreff,
    d.anrede,
    ...d.text.split(/\n+/),
    d.gruss,
    d.unterschrift,
    "Beilagen",
    ...(d.beilagen ?? []),
  ];
}

function cvMainTextValues(cv: CvPdfDocument) {
  const d = cv.data;
  return [
    d.person.vorname,
    d.person.nachname,
    [d.person.vorname, d.person.nachname].filter(Boolean).join(" "),
    d.person.adresse,
    d.person.plzOrt,
    d.person.telefon,
    d.person.email,
    ...d.schule.filter(entryFilled).flatMap((entry) => [entry.titel, entry.beschreibung]),
    ...d.erfahrung.filter(entryFilled).flatMap((entry) => [entry.titel, entry.beschreibung]),
    ...d.sprachen.map((entry) => entry.name),
    ...d.hobbys,
    ...d.staerken,
    ...d.referenzen.flatMap((entry) => [entry.name, entry.kontakt, entry.email, entry.zusatz]),
    ...(d.customSections ?? []).flatMap((section) =>
      section.entries.filter(entryFilled).flatMap((entry) => [entry.titel, entry.beschreibung]),
    ),
  ];
}

function cvMutedTextValues(cv: CvPdfDocument) {
  const d = cv.data;
  return [
    d.person.untertitel,
    d.person.geburtsdatum,
    d.person.nationalitaet,
    ...d.schule.flatMap((entry) => [entry.zeit, entry.ort]),
    ...d.erfahrung.flatMap((entry) => [entry.zeit, entry.ort]),
    ...d.sprachen.map((entry) => entry.niveau),
    ...d.referenzen.map((entry) => entry.funktion),
    ...(d.customSections ?? []).flatMap((section) =>
      section.entries.flatMap((entry) => [entry.zeit, entry.ort]),
    ),
  ];
}

function cvHeadingValues(cv: CvPdfDocument) {
  const d = cv.data;
  return [
    d.titel || "Lebenslauf",
    ...Object.entries(CV_SECTION_LABELS).map(
      ([key, fallback]) => d.labels?.[key as keyof typeof CV_SECTION_LABELS]?.trim() || fallback,
    ),
    ...(d.customSections ?? []).map((section) => section.title),
  ];
}

function patchAtBounds(
  source: string,
  bounds: [SectionBounds, SectionBounds, SectionBounds],
  mutate: (section: string, index: 0 | 1 | 2) => string,
) {
  let next = source;
  for (const index of [2, 1, 0] as const) {
    const range = bounds[index];
    next =
      next.slice(0, range.start) + mutate(next.slice(range.start, range.end), index) + next.slice(range.end);
  }
  return next;
}

/**
 * Apply only explicit document-level color choices after every template recipe
 * and polish step. Template accents remain recipe-owned; explicit paper and
 * semantic text colors win consistently across Web/PDF/DOCX.
 */
export function applyDossierDocumentColorsToDocumentXml(
  source: string,
  documents: {
    cover: CoverPdfDocument;
    letter: LetterPdfDocument;
    cv: CvPdfDocument;
  },
) {
  const coverPaper = wordColor(documents.cover.colors.coverPaper);
  const coverInk = wordColor(documents.cover.colors.coverInk);
  const letterPaper = wordColor(documents.letter.design.paperColor);
  const letterInk = wordColor(documents.letter.design.textColor);
  const cvPaper = wordColor(documents.cv.design.paperColor);
  const cvInk = wordColor(documents.cv.design.colors.cvInk);
  const cvMuted = wordColor(documents.cv.design.colors.cvMuted);
  const cvHeading = wordColor(documents.cv.design.colors.cvHeading);

  if (
    !coverPaper &&
    !coverInk &&
    !letterPaper &&
    !letterInk &&
    !cvPaper &&
    !cvInk &&
    !cvMuted &&
    !cvHeading
  ) {
    return source;
  }

  const bounds = dossierSections(source);
  if (!bounds) return source;

  let next = patchAtBounds(source, bounds, (section, index) => {
    if (index === 0) {
      let patched = patchSectionPaper(section, coverPaper, "dossier-cover-paper-override");
      patched = patchRunsByText(patched, coverTextValues(documents.cover), coverInk);
      return patched;
    }
    if (index === 1) {
      let patched = patchSectionPaper(section, letterPaper, "dossier-letter-paper-override");
      patched = patchRunsByText(patched, letterTextValues(documents.letter), letterInk);
      return patched;
    }

    let patched = patchSectionPaper(section, cvPaper, "dossier-cv-paper-override");
    patched = patchRunsByText(patched, cvMainTextValues(documents.cv), cvInk);
    patched = patchRunsByText(patched, cvMutedTextValues(documents.cv), cvMuted);
    patched = patchRunsByText(patched, cvHeadingValues(documents.cv), cvHeading);
    return patched;
  });

  if ((coverPaper || letterPaper || cvPaper) && !/\bxmlns:v=/.test(next)) {
    next = next.replace(/<w:document\b/, '<w:document xmlns:v="urn:schemas-microsoft-com:vml"');
  }
  return next;
}

export async function applyDossierDocumentColorsToDocx(
  blob: Blob,
  documents: {
    cover: CoverPdfDocument;
    letter: LetterPdfDocument;
    cv: CvPdfDocument;
  },
) {
  return transformStoredDocxDocumentXml(
    blob,
    (xml) => applyDossierDocumentColorsToDocumentXml(xml, documents),
    "DOCX Dokumentfarben",
  );
}
