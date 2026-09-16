import type { CvPdfDocument, LetterPdfDocument } from "@/lib/dossier-pdf-document";
import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  writeStoredDocxEntries,
} from "@/lib/dossier-docx-package";

function normalizedText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function paragraphText(paragraph: string) {
  return normalizedText(
    [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => xmlDecode(match[1]))
      .join(""),
  );
}

function ensureParagraphProperties(paragraph: string) {
  if (paragraph.includes("<w:pPr>")) return paragraph;
  return paragraph.replace(/^(<w:p(?:\s[^>]*)?>)/, "$1<w:pPr></w:pPr>");
}

function setParagraphHyphenation(paragraph: string, enabled: boolean) {
  let next = ensureParagraphProperties(paragraph);
  next = next.replace(/<w:suppressAutoHyphens(?:\s[^>]*)?\/>/g, "");
  const setting = enabled
    ? '<w:suppressAutoHyphens w:val="0"/>'
    : "<w:suppressAutoHyphens/>";
  return next.replace("</w:pPr>", `${setting}</w:pPr>`);
}

function setGermanSwissRunLanguage(paragraph: string) {
  return paragraph.replace(/<w:r>([\s\S]*?)<\/w:r>/g, (run, content: string) => {
    if (!content.includes("<w:t") || content.includes("<w:pict") || content.includes("<w:drawing")) {
      return run;
    }
    if (content.includes("<w:rPr>")) {
      const nextContent = /<w:lang\b[^>]*\/>/.test(content)
        ? content.replace(/<w:lang\b[^>]*\/>/, '<w:lang w:val="de-CH"/>')
        : content.replace("</w:rPr>", '<w:lang w:val="de-CH"/></w:rPr>');
      return `<w:r>${nextContent}</w:r>`;
    }
    return `<w:r><w:rPr><w:lang w:val="de-CH"/></w:rPr>${content}</w:r>`;
  });
}

function letterTargets(letter: LetterPdfDocument) {
  return new Set(
    letter.data.text
      .split(/\n\s*\n/g)
      .map(normalizedText)
      .filter(Boolean),
  );
}

function cvTargets(cv: CvPdfDocument) {
  const values = [
    ...(cv.data.schule ?? []).map((entry) => entry.beschreibung),
    ...(cv.data.erfahrung ?? []).map((entry) => entry.beschreibung),
    ...(cv.data.customSections ?? []).flatMap((section) =>
      section.entries.map((entry) => entry.beschreibung),
    ),
  ];
  return new Set(values.map(normalizedText).filter(Boolean));
}

export function patchDossierDocxHyphenationXml(
  documentXml: string,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  enabled: boolean,
) {
  const letterBody = letterTargets(letter);
  const cvBody = cvTargets(cv);
  let sectionIndex = 0;

  return documentXml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphText(paragraph);
    const prose =
      enabled &&
      ((sectionIndex === 1 && letterBody.has(text)) || (sectionIndex >= 2 && cvBody.has(text)));
    let next = setParagraphHyphenation(paragraph, prose);
    if (prose) next = setGermanSwissRunLanguage(next);
    if (paragraph.includes("<w:sectPr>")) sectionIndex += 1;
    return next;
  });
}

export function patchDossierDocxHyphenationSettings(settingsXml: string, enabled: boolean) {
  const withoutExisting = settingsXml.replace(/<w:autoHyphenation(?:\s[^>]*)?\/>/g, "");
  if (!enabled) return withoutExisting;
  return withoutExisting.replace("</w:settings>", "<w:autoHyphenation/></w:settings>");
}

/**
 * Word's auto-hyphenation switch is document-wide, so all paragraphs are explicitly
 * opted out first. Only motivation-letter body paragraphs and CV descriptions opt back in.
 * The title page therefore stays untouched even while the dossier preference is enabled.
 */
export async function applyDossierHyphenationToDocx(
  blob: Blob,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  enabled: boolean,
) {
  const entries = readStoredDocxEntries(new Uint8Array(await blob.arrayBuffer()), "Dossier-DOCX");
  const document = entries.find((entry) => entry.name === "word/document.xml");
  const settings = entries.find((entry) => entry.name === "word/settings.xml");
  if (!document || !settings) return blob;

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  document.bytes = encoder.encode(
    patchDossierDocxHyphenationXml(decoder.decode(document.bytes), letter, cv, enabled),
  );
  settings.bytes = encoder.encode(
    patchDossierDocxHyphenationSettings(decoder.decode(settings.bytes), enabled),
  );

  return new Blob([writeStoredDocxEntries(entries)], { type: DOCX_MIME_TYPE });
}
