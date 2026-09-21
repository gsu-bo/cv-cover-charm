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

const DARK_TEXT = "#1c2328";

// Visual QA across the full 39-template gallery showed that these recipe
// covers place the Warm header/date on a light area after their shapes replace
// the Warm masthead. Keep the correction here in the shared polish layer
// instead of duplicating it in each lazy template module.
const DARK_COVER_EYEBROW_TEMPLATES = new Set([
  "klassisch",
  "modern",
  "edel",
  "serioes",
  "welle",
  "pastell",
  "glow",
  "frame",
  "violetPulse",
  "prism",
  "orbit",
]);

const DARK_COVER_DATE_TEMPLATES = new Set([
  "klassisch",
  "modern",
  "edel",
  "blockig",
  "serioes",
  "human",
  "welle",
  "terracotta",
  "pastell",
  "studio",
  "glow",
  "frame",
  "forestFlow",
  "gallery",
]);

// A few portrait recipes put the replacement photo mat on top of the Warm
// name line. Moving only that recipe frame restores the intended hierarchy
// without touching the shared flow layout.
const COVER_PHOTO_TOP_MM: Readonly<Record<string, number>> = {
  edel: 45,
  serioes: 45,
  pastell: 45,
  blockig: 38,
};

const LIGHT_CONTACT_DARK_ATTACHMENTS = new Set(["terracotta", "blockig"]);
const DARK_COVER_INITIALS_TEMPLATES = new Set(["verlauf2", "verlauf3"]);
const DARK_CV_IDENTITY_TEMPLATES = new Set(["colorful", "aurora"]);

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

function sectionRanges(source: string) {
  const matches = [...source.matchAll(/<w:sectPr>[\s\S]*?<\/w:sectPr>/g)];
  if (
    matches.length < 2 ||
    matches[0].index === undefined ||
    matches[1].index === undefined
  ) {
    return null;
  }
  return [
    { start: 0, end: matches[0].index },
    { start: matches[0].index + matches[0][0].length, end: matches[1].index },
    { start: matches[1].index + matches[1][0].length, end: source.length },
  ] as const;
}

function patchSection(
  source: string,
  sectionIndex: 0 | 1 | 2,
  mutate: (section: string) => string,
) {
  const ranges = sectionRanges(source);
  if (!ranges) return source;
  const range = ranges[sectionIndex];
  return source.slice(0, range.start) + mutate(source.slice(range.start, range.end)) + source.slice(range.end);
}

function senderColor(letter: LetterPdfDocument) {
  const templateId = String(letter.design.template);
  const recipe = ALL_DOSSIER_DOCX_TEMPLATE_RECIPES[templateId];
  const letterRecipe = recipe?.letter as { contentSurface?: "light" } | undefined;
  if (letterRecipe?.contentSurface === "light") return DARK_TEXT;

  const colors = letter.design.colors;
  const paper = hex(colors?.bg ?? colors?.sheet, "#ffffff");
  const fallback = luminance(paper) < 0.46 ? "#f7f7f5" : DARK_TEXT;
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

  return patchSection(source, 1, (letterXml) => {
    let next = letterXml;
    for (const text of texts) next = setParagraphColor(next, text, color);
    return next;
  });
}

function normalizeLehrbeginn(source: string, cover: CoverPdfDocument) {
  const value = cover.data.lehrbeginn?.trim();
  if (!value) return source;
  const label = `Lehrbeginn · ${value}`;

  // createWarmDossierDocxBlob historically wrapped the already-complete
  // coloured middle cell in a second w:tc. LibreOffice then dropped or
  // mangled the visible middle cell for recipe-based templates. Flatten only
  // the cell that contains Lehrbeginn and preserve its width.
  let xml = source.replace(
    /<w:tc><w:tcPr><w:tcW w:w="(\d+)" w:type="dxa"\/><w:vAlign w:val="top"\/><\/w:tcPr><w:tc><w:tcPr>([\s\S]*?<w:t(?: xml:space="preserve")?>Lehrbeginn · [\s\S]*?<\/w:tc>)<\/w:tc>/,
    (_match, width: string, inner: string) =>
      `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/>${inner}`,
  );

  // Hero indentation belongs to free-flow name/occupation paragraphs, not to
  // the centred Lehrbeginn table cell. Remove any inherited indent that would
  // squeeze the label into a few characters per line.
  xml = patchFirstParagraphContaining(xml, label, (paragraph) => {
    let next = paragraph.replace(/<w:ind\b[^>]*\/>/g, "");
    next = /<w:jc w:val="[^"]+"\/>/.test(next)
      ? next.replace(/<w:jc w:val="[^"]+"\/>/, '<w:jc w:val="center"/>')
      : next.replace("</w:pPr>", '<w:jc w:val="center"/></w:pPr>');
    return next;
  });
  return xml;
}

function initials(cover: CoverPdfDocument) {
  return `${cover.data.vorname.trim().charAt(0)}${cover.data.nachname.trim().charAt(0)}`.toUpperCase();
}

function restorePhotoInitials(source: string, cover: CoverPdfDocument) {
  if (cover.data.foto) return source;
  const value = initials(cover);
  if (!value) return source;

  return patchSection(source, 0, (coverXml) => {
    const emptyText = new RegExp(
      '(<v:(?:oval|rect) id="docx-recipe-cover-photo-mat"[\\s\\S]*?<w:t(?: xml:space="preserve")?>)(<\\/w:t>)',
    );
    const match = emptyText.exec(coverXml);
    if (!match || match.index === undefined) return coverXml;

    let next =
      coverXml.slice(0, match.index) +
      match[1] +
      xmlEscape(value) +
      match[2] +
      coverXml.slice(match.index + match[0].length);

    // The legacy renderer cleared the first occurrence after creating the new
    // frame, which emptied the textbox and left the original flow initials.
    // Keep the frame initials and clear that later duplicate flow run.
    const textboxEnd = next.indexOf("</v:textbox>", match.index);
    if (textboxEnd >= 0) {
      const needle = `>${xmlEscape(value)}</w:t>`;
      const flowIndex = next.indexOf(needle, textboxEnd);
      if (flowIndex >= 0) {
        next = next.slice(0, flowIndex + 1) + next.slice(flowIndex + 1).replace(xmlEscape(value), "");
      }
    }
    if (DARK_COVER_INITIALS_TEMPLATES.has(String(cover.template))) {
      next = setParagraphColor(next, value, DARK_TEXT);
    }
    return next;
  });
}

function moveCoverPhotoFrame(source: string, templateId: string) {
  const top = COVER_PHOTO_TOP_MM[templateId];
  if (top === undefined) return source;

  return patchSection(source, 0, (coverXml) => {
    let next = coverXml;
    for (const [id, y] of [
      ["docx-recipe-cover-photo-mat", top],
      ["warm-cover-photo", top + 1],
    ] as const) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(\\bid="${escaped}"[^>]*\\bstyle="[^"]*?margin-top:)-?\\d+(?:\\.\\d+)?mm`);
      next = next.replace(pattern, `$1${y}mm`);
    }
    return next;
  });
}

function restoreCoverTopContrast(source: string, cover: CoverPdfDocument) {
  const templateId = String(cover.template);
  const eyebrow = (cover.data.eyebrow || "Bewerbung").toUpperCase();
  const placeDate = [cover.data.ort, cover.data.datum].filter(Boolean).join(", ").toUpperCase();

  return patchSection(source, 0, (coverXml) => {
    let next = coverXml;
    if (DARK_COVER_EYEBROW_TEMPLATES.has(templateId)) {
      next = setParagraphColor(next, eyebrow, DARK_TEXT);
    }
    if (DARK_COVER_DATE_TEMPLATES.has(templateId)) {
      next = setParagraphColor(next, placeDate, DARK_TEXT);
    }
    return next;
  });
}

function restoreCoverBlocksContrast(source: string, cover: CoverPdfDocument) {
  const templateId = String(cover.template);
  if (!LIGHT_CONTACT_DARK_ATTACHMENTS.has(templateId)) return source;

  return patchSection(source, 0, (coverXml) => {
    let next = coverXml;
    const attachmentTexts = ["BEILAGEN", ...(cover.data.beilagen ?? [])].filter(Boolean) as string[];
    for (const text of attachmentTexts) next = setParagraphColor(next, text, DARK_TEXT);

    // Blockig's recipe contact block does not line up with the Warm flow row;
    // dark text keeps the complete contact data readable on the light surface
    // instead of white-on-white. The decorative navy block remains intact.
    if (templateId === "blockig") {
      const contactTexts = [
        "KONTAKT",
        cover.data.adresse,
        cover.data.plzOrt,
        cover.data.telefon,
        cover.data.email,
        cover.data.geburtsdatum,
      ].filter(Boolean) as string[];
      for (const text of contactTexts) next = setParagraphColor(next, text, DARK_TEXT);
    }
    return next;
  });
}

function restoreCvIdentityContrast(source: string, cv: CvPdfDocument) {
  const templateId = String(cv.design.template);
  if (!DARK_CV_IDENTITY_TEMPLATES.has(templateId)) return source;
  const person = cv.data.person;
  const identityLine = [
    person.geburtsdatum ? `Geburtsdatum ${person.geburtsdatum}` : "",
    person.geburtsort ? `Geburtsort ${person.geburtsort}` : "",
    person.heimatort ? `Heimatort ${person.heimatort}` : "",
    person.nationalitaet ? `Nationalität ${person.nationalitaet}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return patchSection(source, 2, (cvXml) => {
    let next = cv.data.titel
      ? setParagraphColor(cvXml, cv.data.titel.toUpperCase(), DARK_TEXT)
      : cvXml;
    if (identityLine) next = setParagraphColor(next, identityLine, DARK_TEXT);
    return next;
  });
}

export async function createPolishedLegacyRecipeDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const base = await createLegacyRecipeDossierDocxBlob(cover, letter, cv);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => {
      let next = normalizeLehrbeginn(xml, cover);
      next = restorePhotoInitials(next, cover);
      next = moveCoverPhotoFrame(next, String(cover.template));
      next = restoreCoverTopContrast(next, cover);
      next = restoreCoverBlocksContrast(next, cover);
      next = restoreLetterSenderContrast(next, letter);
      next = restoreCvIdentityContrast(next, cv);
      return next;
    },
    `DOCX-Einzelrezept Sichtbarkeit ${String(letter.design.template)}`,
  );
}
