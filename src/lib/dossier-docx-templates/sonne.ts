import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { recipeTemplate } from "@/lib/dossier-docx-templates/shared";
import type { CoverPdfDocument } from "@/lib/dossier-pdf-document";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

const createBaseDossierDocxBlob = recipeTemplate("sonne");

function hex(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="${line.align ?? "left"}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin" w:eastAsia="Cabin"/><w:sz w:val="${Math.round(line.size * 2)}"/><w:szCs w:val="${Math.round(line.size * 2)}"/><w:color w:val="${color}"/>${line.tracking ? `<w:spacing w:val="${line.tracking}"/>` : ""}${line.bold ? "<w:b/><w:bCs/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(line.text)}</w:t></w:r></w:p>`;
}

function textBoxRun(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  lines: TextBoxLine[],
  z = 251658200,
) {
  const style = `${vmlStyle(x, y, width, height, z)};v-text-anchor:top`;
  return `<w:r><w:pict><v:rect id="${id}" style="${style}" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent>${lines.map(textBoxParagraph).join("")}</w:txbxContent></v:textbox></v:rect></w:pict></w:r>`;
}

function pillRun(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fill: string,
) {
  const style = `${vmlStyle(x, y, width, height, 251658300)};v-text-anchor:middle`;
  return `<w:r><w:pict><v:roundrect id="${id}" arcsize="50%" style="${style}" fillcolor="${fill}" stroked="f"><v:textbox inset="2mm,0,2mm,0"><w:txbxContent>${textBoxParagraph({ text, size: 12.5, color: "#141414", bold: true, align: "center" })}</w:txbxContent></v:textbox></v:roundrect></w:pict></w:r>`;
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
          { text: placeDate, size: 11.5, color: "#4a4a4a" },
        ])
      : "",
    fullName
      ? textBoxRun("sonne-docx-cover-name", 20, 43, 84, 17, [
          { text: fullName, size: 33.5, color: ink, bold: true },
        ])
      : "",
    textBoxRun("sonne-docx-cover-role-label", 20, 61, 82, 15, [
      { text: "BEWERBUNG UM EINE", size: 11, color: ink, bold: true, tracking: 32 },
      { text: "LEHRSTELLE ALS", size: 11, color: ink, bold: true, tracking: 32 },
    ]),
    cover.data.beruf
      ? textBoxRun("sonne-docx-cover-role", 20, 76, 88, 13, [
          { text: cover.data.beruf, size: 22, color: ink, bold: true },
        ])
      : "",
    !cover.data.foto && initials(cover)
      ? textBoxRun(
          "sonne-docx-cover-initials",
          114,
          44,
          78,
          20,
          [{ text: initials(cover), size: 32, color: primary, bold: true, align: "center" }],
          251658500,
        )
      : "",
    cover.data.lehrbeginn?.trim()
      ? pillRun(
          "sonne-docx-cover-lehrbeginn",
          20,
          134,
          66,
          11,
          `Lehrbeginn ${cover.data.lehrbeginn.trim()}`,
          primary,
        )
      : "",
    contact.length
      ? textBoxRun("sonne-docx-cover-contact", 20, 236, 78, 44, [
          { text: "KONTAKT", size: 10, color: primary, bold: true, tracking: 28 },
          ...contact.map((text) => ({ text, size: 10.5, color: coverWhite })),
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
            {
              text: "BEILAGEN",
              size: 10,
              color: primary,
              bold: true,
              align: "right",
              tracking: 28,
            },
            ...attachments.map((text) => ({
              text,
              size: 10.5,
              color: coverWhite,
              align: "right" as const,
            })),
          ],
        )
      : "",
  ].join("");

  xml = insertIntoFirstCoverParagraph(xml, runs);
  return xml.replace(
    /(<w:shd w:fill=")FBBF24("[\s\S]{0,5000}?Lehrbeginn ·)/,
    `$1${dark.replace("#", "").toUpperCase()}$2`,
  );
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createBaseDossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => polishSonneCover(xml, documents.cover),
    "Sonne DOCX 1:1 polish",
  );
}
