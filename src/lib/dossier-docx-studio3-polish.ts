import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import {
  createStudio3DossierDocxBlob,
  studio3DossierDocxSupported,
} from "@/lib/dossier-docx-studio3";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { downloadBlob } from "@/lib/download";

export { studio3DossierDocxSupported };

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function wordColor(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
}

function xmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function vmlStyle(x: number, y: number, width: number, height: number, z = -251658240) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${width}mm;height:${height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function rectRun(id: string, x: number, y: number, width: number, height: number, color: string) {
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, width, height)}" fillcolor="#${color}" stroked="f"/></w:pict></w:r>`;
}

function replaceDrawing(source: string, id: string, replacement: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<w:r><w:pict><v:(?:shape|rect)[^>]*\\bid="${escaped}"[\\s\\S]*?</w:pict></w:r>`,
  );
  if (!pattern.test(source)) throw new Error(`Studio-3-DOCX-Polish Zeichnung fehlt: ${id}`);
  return source.replace(pattern, replacement);
}

function replaceParagraphAfter(source: string, text: string, afterMm: number) {
  const textIndex = source.indexOf(`>${xmlText(text)}</w:t>`);
  if (textIndex < 0) return source;
  const paragraphStart = source.lastIndexOf("<w:p>", textIndex);
  const paragraphEnd = source.indexOf("</w:p>", textIndex);
  if (paragraphStart < 0 || paragraphEnd < 0) return source;
  const paragraph = source.slice(paragraphStart, paragraphEnd + 6);
  const next = paragraph.replace(
    /(<w:spacing\b[^>]*\bw:after=")\d+("[^>]*\/>)/,
    `$1${twips(afterMm)}$2`,
  );
  return source.slice(0, paragraphStart) + next + source.slice(paragraphEnd + 6);
}

function replaceParagraphBefore(source: string, text: string, beforeMm: number) {
  const textIndex = source.indexOf(`>${xmlText(text)}</w:t>`);
  if (textIndex < 0) return source;
  const paragraphStart = source.lastIndexOf("<w:p>", textIndex);
  const paragraphEnd = source.indexOf("</w:p>", textIndex);
  if (paragraphStart < 0 || paragraphEnd < 0) return source;
  const paragraph = source.slice(paragraphStart, paragraphEnd + 6);
  const next = paragraph.replace(
    /(<w:spacing\b[^>]*\bw:before=")\d+("[^>]*\/>)/,
    `$1${twips(beforeMm)}$2`,
  );
  return source.slice(0, paragraphStart) + next + source.slice(paragraphEnd + 6);
}

function replaceSpacerAfter(source: string, anchor: string, fromMm: number, toMm: number) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) return source;
  const oldSpacing = `<w:spacing w:before="0" w:after="0" w:line="${twips(fromMm)}" w:lineRule="exact"/>`;
  const index = source.indexOf(oldSpacing, anchorIndex);
  if (index < 0) return source;
  const newSpacing = `<w:spacing w:before="0" w:after="0" w:line="${twips(toMm)}" w:lineRule="exact"/>`;
  return source.slice(0, index) + newSpacing + source.slice(index + oldSpacing.length);
}

function polishDocumentXml(
  source: string,
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const coverPrimary = wordColor(cover.colors.primary, "173D3A");
  const coverSecondary = wordColor(cover.colors.secondary, "5EC6B6");
  const letterPrimary = wordColor(letter.design.colors.primary, "173D3A");
  const letterSecondary = wordColor(letter.design.colors.secondary, "5EC6B6");
  const cvPrimary = wordColor(cv.design.colors.primary, "173D3A");

  let xml = source;

  // Custom VML paths are interpreted inconsistently by Word-compatible renderers.
  // Keep the same Studio-3 two-tone hierarchy with robust, editable VML rectangles.
  xml = replaceDrawing(
    xml,
    "studio3-cover-primary",
    rectRun("studio3-cover-primary", 0, 0, 210, 112, coverPrimary),
  );
  xml = replaceDrawing(
    xml,
    "studio3-cover-mint",
    rectRun("studio3-cover-mint", 126, 0, 84, 90, coverSecondary),
  );
  xml = replaceDrawing(
    xml,
    "studio3-letter-primary",
    rectRun("studio3-letter-primary", 0, 0, 210, 34, letterPrimary),
  );
  xml = replaceDrawing(
    xml,
    "studio3-letter-mint",
    rectRun("studio3-letter-mint", 146, 0, 64, 34, letterSecondary),
  );
  xml = replaceDrawing(
    xml,
    "studio3-cv-primary",
    rectRun("studio3-cv-primary", 0, 0, 210, 58, cvPrimary),
  );

  if (!cover.data.foto) {
    const coverInitials = `${cover.data.vorname.trim().charAt(0)}${cover.data.nachname.trim().charAt(0)}`.toUpperCase();
    xml = replaceParagraphAfter(xml, coverInitials, 45);
  }
  if (cover.data.lehrbeginn?.trim()) {
    xml = replaceSpacerAfter(xml, "Lehrbeginn ·", 48, 63);
  }

  // The native Studio-3 transform already places contact, title and personal
  // data inside the 58 mm CV masthead. Its historical 7 mm + 12 mm paragraph
  // offsets plus a 29 mm spacer reserve about 48 mm again on top of that band.
  // LibreOffice then pushes the final strength/reference block onto a fourth
  // dossier page. Keep the same editable masthead content, but let it flow
  // compactly inside the band and retain a 20 mm hand-off to the first section.
  const cvTitle = (cv.data.titel || "Lebenslauf").toUpperCase();
  const cvPersonal = [
    cv.data.person.geburtsdatum ? `Geburtsdatum ${cv.data.person.geburtsdatum}` : "",
    cv.data.person.nationalitaet ? `Nationalität ${cv.data.person.nationalitaet}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  xml = replaceParagraphBefore(xml, cvTitle, 0);
  if (cvPersonal) xml = replaceParagraphBefore(xml, cvPersonal, 0);
  xml = replaceSpacerAfter(xml, 'id="studio3-cv-primary"', 29, 20);

  return xml;
}

export async function createPolishedStudio3DossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const base = await createStudio3DossierDocxBlob(cover, letter, cv);
  return transformStoredDocxDocumentXml(
    base,
    (documentXml) => polishDocumentXml(documentXml, cover, letter, cv),
    "Studio-3-DOCX-Polish",
  );
}

export async function downloadPolishedStudio3DossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(await createPolishedStudio3DossierDocxBlob(cover, letter, cv), fileName);
}
