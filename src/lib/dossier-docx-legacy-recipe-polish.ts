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
    .replace(/\"/g, "&quot;")
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
  const letterRecipe = recipe?.letter as { contentSurface?: "light" } | undefined;
  if (letterRecipe?.contentSurface === "light") return "#1c2328";

  const colors = letter.design.colors;
  const paper = hex(colors?.bg ?? colors?.sheet, "#ffffff");
  const fallback = luminance(paper) < 0.46 ? "#f7f7f5" : "#1c2328";
  return hex(colors?.ink ?? colors?.light, fallback);
}

function letterSectionRange(source: string) {
  const matches = [...source.matchAll(/<w:sectPr>[\s\S]*?<\/w:sectPr>/g)];
  if (
    matches.length < 2 ||
    matches[0].index === undefined ||
    matches[1].index === undefined
  ) {
    return null;
  }
  return {
    start: matches[0].index + matches[0][0].length,
    end: matches[1].index,
  };
}

function restoreLetterSenderContrast(source: string, letter: LetterPdfDocument) {
  const range = letterSectionRange(source);
  if (!range) return source;

  const color = senderColor(letter);
  const texts = [
    letter.data.absenderName,
    letter.data.absenderAdresse,
    letter.data.absenderPlzOrt,
    letter.data.absenderTelefon,
    letter.data.absenderEmail,
  ].filter(Boolean) as string[];

  let letterXml = source.slice(range.start, range.end);
  for (const text of texts) letterXml = setParagraphColor(letterXml, text, color);
  return source.slice(0, range.start) + letterXml + source.slice(range.end);
}

function vmlStyle(x: number, y: number, width: number, height: number, z = 251658200) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${width}mm;height:${height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

type TextBoxLine = {
  text: string;
  size: number;
  color: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  tracking?: number;
};

function textBoxParagraph(line: TextBoxLine) {
  const color = line.color.replace("#", "").toUpperCase();
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="${line.align ?? "left"}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin" w:eastAsia="Cabin"/><w:sz w:val="${line.size * 2}"/><w:szCs w:val="${line.size * 2}"/><w:color w:val="${color}"/>${line.tracking ? `<w:spacing w:val="${line.tracking}"/>` : ""}${line.bold ? "<w:b/><w:bCs/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(line.text)}</w:t></w:r></w:p>`;
}

function textBoxRun(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  lines: TextBoxLine[],
  anchor: "top" | "middle" = "top",
) {
  const style = `${vmlStyle(x, y, width, height)};v-text-anchor:${anchor}`;
  return `<w:r><w:pict><v:rect id="${id}" style="${style}" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent>${lines.map(textBoxParagraph).join("")}</w:txbxContent></v:textbox></v:rect></w:pict></w:r>`;
}

function pillRun(id: string, x: number, y: number, width: number, height: number, text: string, fill: string) {
  const style = `${vmlStyle(x, y, width, height)};v-text-anchor:middle`;
  return `<w:r><w:pict><v:roundrect id="${id}" style="${style}" fillcolor="${fill}" stroked="f"><v:textbox inset="2mm,0,2mm,0"><w:txbxContent>${textBoxParagraph({ text, size: 11, color: "#141414", bold: true, align: "center" })}</w:txbxContent></v:textbox></v:roundrect></w:pict></w:r>`;
}

function replaceShapeStyle(source: string, id: string, style: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(\\bid="${escaped}"[^>]*\\bstyle=")[^"]+("[^>]*>)`);
  return source.replace(pattern, `$1${style}$2`);
}

function hideFirstSectionText(source: string) {
  const end = source.indexOf("<w:sectPr>");
  if (end < 0) return source;
  let cover = source.slice(0, end);
  cover = cover.replace(/<w:rPr>/g, "<w:rPr><w:vanish/>");
  cover = cover.replace(/<w:r>(?=<w:t)/g, "<w:r><w:rPr><w:vanish/></w:rPr>");
  return cover + source.slice(end);
}

function insertIntoFirstCoverParagraph(source: string, runs: string) {
  const paragraph = source.indexOf("<w:p>");
  if (paragraph < 0) return source;
  const pPrEnd = source.indexOf("</w:pPr>", paragraph);
  if (pPrEnd < 0) return source;
  const insertAt = pPrEnd + "</w:pPr>".length;
  return source.slice(0, insertAt) + runs + source.slice(insertAt);
}

function initials(cover: CoverPdfDocument) {
  return `${cover.data.vorname?.trim().charAt(0) ?? ""}${cover.data.nachname?.trim().charAt(0) ?? ""}`.toUpperCase();
}

function polishSonneCover(source: string, cover: CoverPdfDocument) {
  if (String(cover.template) !== "sonne") return source;

  const primary = hex(cover.colors?.primary, "#fbbf24");
  const dark = hex(cover.colors?.bg, "#333333");
  const ink = hex(cover.colors?.ink, "#141414");
  const coverWhite = "#ffffff";
  const fullName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
  const placeDate = [cover.data.ort, cover.data.datum].filter(Boolean).join(", ");
  const contact = [
    cover.data.adresse,
    cover.data.plzOrt,
    cover.data.telefon,
    cover.data.email,
    cover.data.geburtsdatum,
  ].filter(Boolean) as string[];
  const attachments = cover.data.showBeilagenOnCover
    ? ((cover.data.beilagen ?? []).filter(Boolean) as string[])
    : [];

  let xml = hideFirstSectionText(source);
  xml = replaceShapeStyle(
    xml,
    "docx-recipe-cover-photo-mat",
    `${vmlStyle(114, 16, 78, 78, 251657900)};v-text-anchor:middle`,
  );
  xml = replaceShapeStyle(xml, "warm-cover-photo", vmlStyle(115, 17, 76, 76, 251658000));

  const runs = [
    textBoxRun("sonne-docx-cover-kicker", 20, 15, 72, 8, [
      { text: "BEWERBUNG", size: 10, color: ink, bold: true, tracking: 42 },
    ]),
    placeDate
      ? textBoxRun("sonne-docx-cover-date", 20, 25, 78, 8, [
          { text: placeDate, size: 11, color: ink },
        ])
      : "",
    fullName
      ? textBoxRun("sonne-docx-cover-name", 20, 43, 80, 15, [
          { text: fullName, size: 25, color: ink, bold: true },
        ])
      : "",
    textBoxRun("sonne-docx-cover-role-label", 20, 61, 78, 15, [
      { text: "BEWERBUNG UM EINE", size: 11, color: ink, bold: true, tracking: 32 },
      { text: "LEHRSTELLE ALS", size: 11, color: ink, bold: true, tracking: 32 },
    ]),
    cover.data.beruf
      ? textBoxRun("sonne-docx-cover-role", 20, 76, 84, 12, [
          { text: cover.data.beruf, size: 18, color: ink, bold: true },
        ])
      : "",
    !cover.data.foto && initials(cover)
      ? textBoxRun(
          "sonne-docx-cover-initials",
          114,
          16,
          78,
          78,
          [{ text: initials(cover), size: 24, color: primary, bold: true, align: "center" }],
          "middle",
        )
      : "",
    cover.data.lehrbeginn?.trim()
      ? pillRun(
          "sonne-docx-cover-lehrbeginn",
          20,
          132,
          68,
          11,
          `Lehrbeginn ${cover.data.lehrbeginn.trim()}`,
          primary,
        )
      : "",
    contact.length
      ? textBoxRun("sonne-docx-cover-contact", 20, 236, 78, 44, [
          { text: "KONTAKT", size: 10, color: primary, bold: true, tracking: 28 },
          ...contact.map((text) => ({ text, size: 10, color: coverWhite })),
        ])
      : "",
    attachments.length
      ? textBoxRun(
          "sonne-docx-cover-attachments",
          142,
          236,
          48,
          38,
          [
            { text: "BEILAGEN", size: 10, color: primary, bold: true, align: "right", tracking: 28 },
            ...attachments.map((text) => ({ text, size: 10, color: coverWhite, align: "right" as const })),
          ],
        )
      : "",
  ].join("");

  xml = insertIntoFirstCoverParagraph(xml, runs);
  return xml.replace(
    /(<w:shd w:fill=")FBBF24("\/>[\s\S]{0,5000}?Lehrbeginn ·)/,
    `$1${dark.replace("#", "").toUpperCase()}$2`,
  );
}

export async function createPolishedLegacyRecipeDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const base = await createLegacyRecipeDossierDocxBlob(cover, letter, cv);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => polishSonneCover(restoreLetterSenderContrast(xml, letter), cover),
    `DOCX-Einzelrezept Absender ${String(letter.design.template)}`,
  );
}
