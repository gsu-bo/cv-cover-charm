import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import {
  createLegacyRecipeDossierDocxBlob,
  legacyRecipeDossierDocxSupported,
} from "@/lib/dossier-docx-legacy-recipe-renderer";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { ALL_DOSSIER_DOCX_TEMPLATE_RECIPES } from "@/lib/dossier-docx-template-recipes";

export { legacyRecipeDossierDocxSupported };

function hex(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function luminance(color: string) {
  const raw = color.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function patchFirstParagraphContaining(
  source: string,
  text: string,
  mutate: (paragraph: string) => string,
) {
  if (!text) return source;
  const needle = `>${xmlEscape(text)}</w:t>`;
  const textIndex = source.indexOf(needle);
  if (textIndex < 0) return source;
  const start = source.lastIndexOf("<w:p>", textIndex);
  const end = source.indexOf("</w:p>", textIndex);
  if (start < 0 || end < 0) return source;
  const paragraph = source.slice(start, end + 6);
  return source.slice(0, start) + mutate(paragraph) + source.slice(end + 6);
}

function setParagraphColor(source: string, text: string, color: string) {
  const wordColor = color.replace("#", "").toUpperCase();
  return patchFirstParagraphContaining(source, text, (paragraph) => {
    if (/<w:color w:val="[^"]+"\/>/.test(paragraph)) {
      return paragraph.replace(/<w:color w:val="[^"]+"\/>/g, `<w:color w:val="${wordColor}"/>`);
    }
    return paragraph.replace(/<w:rPr>/g, `<w:rPr><w:color w:val="${wordColor}"/>`);
  });
}

function senderColor(letter: LetterPdfDocument) {
  const templateId = String(letter.design.template);
  const recipe = ALL_DOSSIER_DOCX_TEMPLATE_RECIPES[templateId];
  const letterRecipe = recipe?.letter as
    | (typeof recipe.letter & { contentSurface?: "light" })
    | undefined;
  if (letterRecipe?.contentSurface === "light") return "#1c2328";

  const colors = letter.design.colors;
  const paper = hex(colors?.bg ?? colors?.sheet, "#ffffff");
  const fallback = luminance(paper) < 0.46 ? "#f7f7f5" : "#1c2328";
  return hex(colors?.ink ?? colors?.light, fallback);
}

function restoreLetterSenderContrast(source: string, letter: LetterPdfDocument) {
  const color = senderColor(letter);
  const texts = [
    letter.data.absenderName,
    letter.data.absenderAdresse,
    letter.data.absenderPlzOrt,
    letter.data.absenderTelefon,
    letter.data.absenderEmail,
  ].filter(Boolean) as string[];

  let xml = source;
  for (const text of texts) xml = setParagraphColor(xml, text, color);
  return xml;
}

export async function createPolishedLegacyRecipeDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const base = await createLegacyRecipeDossierDocxBlob(cover, letter, cv);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => restoreLetterSenderContrast(xml, letter),
    `DOCX-Einzelrezept Absender ${String(letter.design.template)}`,
  );
}
