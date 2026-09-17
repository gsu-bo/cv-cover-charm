import type { CvPdfDocument, LetterPdfDocument } from "@/lib/dossier-pdf-document";
import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  writeStoredDocxEntries,
} from "@/lib/dossier-docx-package";

function ensureParagraphProperties(paragraph: string) {
  if (paragraph.includes("<w:pPr>")) return paragraph;
  return paragraph.replace(/^(<w:p(?:\s[^>]*)?>)/, "$1<w:pPr></w:pPr>");
}

function suppressParagraphHyphenation(paragraph: string) {
  let next = ensureParagraphProperties(paragraph);
  next = next.replace(/<w:suppressAutoHyphens(?:\s[^>]*)?\/>/g, "");
  return next.replace("</w:pPr>", "<w:suppressAutoHyphens/></w:pPr>");
}

/** Automatic hyphenation is retired; every Word paragraph explicitly suppresses it. */
export function patchDossierDocxHyphenationXml(
  documentXml: string,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  enabled: boolean,
) {
  void letter;
  void cv;
  void enabled;
  return documentXml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) =>
    suppressParagraphHyphenation(paragraph),
  );
}

/** Remove Word's document-wide auto-hyphenation flag regardless of legacy state. */
export function patchDossierDocxHyphenationSettings(settingsXml: string, enabled: boolean) {
  void enabled;
  return settingsXml.replace(/<w:autoHyphenation(?:\s[^>]*)?\/>/g, "");
}

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
