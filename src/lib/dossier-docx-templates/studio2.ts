import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { recipeTemplate } from "@/lib/dossier-docx-templates/shared";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";
import type { CoverPdfDocument } from "@/lib/dossier-pdf-document";

const createBaseDossierDocxBlob = recipeTemplate("studio2");

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="276" w:lineRule="auto"/><w:jc w:val="${line.align ?? "left"}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin" w:eastAsia="Cabin"/><w:sz w:val="${Math.round(line.size * 2)}"/><w:szCs w:val="${Math.round(line.size * 2)}"/><w:color w:val="${color}"/>${line.tracking ? `<w:spacing w:val="${line.tracking}"/>` : ""}${line.bold ? "<w:b/><w:bCs/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(line.text)}</w:t></w:r>`;
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
  const content = lines.map((line) => `${textBoxParagraph(line)}</w:p>`).join("");
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, width, height, z)};v-text-anchor:top" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent>${content}</w:txbxContent></v:textbox></v:rect></w:pict></w:r>`;
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
  const paragraph = `${textBoxParagraph({ text, size: 10, color: "#1b2430", bold: true, align: "center" })}</w:p>`;
  return `<w:r><w:pict><v:roundrect id="${id}" arcsize="50%" style="${vmlStyle(x, y, width, height, 251658400)};v-text-anchor:middle" fillcolor="${fill}" stroked="f"><v:textbox inset="2mm,0,2mm,0"><w:txbxContent>${paragraph}</w:txbxContent></v:textbox></v:roundrect></w:pict></w:r>`;
}

function replaceShapeStyle(source: string, id: string, style: string) {
  const pattern = new RegExp(`(\\bid="${regexEscape(id)}"[^>]*\\bstyle=")[^"]+("[^>]*>)`);
  return source.replace(pattern, `$1${style}$2`);
}

function replaceShapeBlock(source: string, id: string, replacement: string) {
  const pattern = new RegExp(
    `<v:(rect|oval|roundrect)\\b([^>]*\\bid="${regexEscape(id)}"[^>]*)>[\\s\\S]*?<\\/v:\\1>`,
  );
  return source.replace(pattern, replacement);
}

function hideFirstSectionText(source: string) {
  const end = source.indexOf("<w:sectPr>");
  if (end < 0) return source;
  let cover = source.slice(0, end);
  cover = cover.replace(/<w:rPr>/g, "<w:rPr><w:vanish/>");
  cover = cover.replace(/<w:r>(?=<w:t)/g, "<w:r><w:rPr><w:vanish/></w:rPr>");
  return cover + source.slice(end);
}

function insertIntoFirstParagraph(source: string, runs: string) {
  const paragraph = source.indexOf("<w:p>");
  if (paragraph < 0) return source;
  const pPrEnd = source.indexOf("</w:pPr>", paragraph);
  if (pPrEnd < 0) return source;
  const insertAt = pPrEnd + "</w:pPr>".length;
  return source.slice(0, insertAt) + runs + source.slice(insertAt);
}

function transformSection(source: string, index: number, transform: (segment: string) => string) {
  const ends = [...source.matchAll(/<\/w:sectPr>/g)].map(
    (match) => (match.index ?? 0) + match[0].length,
  );
  if (index > ends.length) return source;
  const start = index === 0 ? 0 : ends[index - 1];
  const end = index < ends.length ? ends[index] : source.length;
  return source.slice(0, start) + transform(source.slice(start, end)) + source.slice(end);
}

function removeFirstParagraphContaining(source: string, text: string) {
  const needle = new RegExp(`<w:t[^>]*>${regexEscape(xmlEscape(text))}<\\/w:t>`);
  let removed = false;
  return source.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (removed || !needle.test(paragraph)) return paragraph;
    removed = true;
    return "";
  });
}

function setSectionMargins(
  source: string,
  margins: { top: number; right: number; bottom: number; left: number },
) {
  const twips = (mm: number) => Math.round((mm / 25.4) * 1440);
  return source.replace(
    /<w:pgMar[^>]*\/>/,
    `<w:pgMar w:top="${twips(margins.top)}" w:right="${twips(margins.right)}" w:bottom="${twips(margins.bottom)}" w:left="${twips(margins.left)}" w:header="454" w:footer="454" w:gutter="0"/>`,
  );
}

function initials(cover: CoverPdfDocument) {
  return `${cover.data.vorname?.trim().charAt(0) ?? ""}${cover.data.nachname?.trim().charAt(0) ?? ""}`.toUpperCase();
}

function studio2Cover(source: string, cover: CoverPdfDocument) {
  if (cover.data.foto) return source;

  const primary = cover.colors?.primary ?? "#202a3b";
  const secondary = cover.colors?.secondary ?? "#f2c84b";
  const paper = cover.colors?.bg ?? "#fbfbf8";
  const ink = cover.colors?.ink ?? "#1b2430";
  const fullName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
  const placeDate = [cover.data.ort, cover.data.datum].filter(Boolean).join(", ").toUpperCase();
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

  const railText = `${textBoxParagraph({ text: "BEWERBUNG", size: 9, color: "#ffffff", bold: true, tracking: 45 })}</w:p>`;
  xml = replaceShapeBlock(
    xml,
    "studio2-cover-rail",
    `<v:rect id="studio2-cover-rail" style="${vmlStyle(0, 0, 124, 104, -251658240)};v-text-anchor:top" fillcolor="${primary}" stroked="f"><v:textbox inset="16mm,14mm,0,0"><w:txbxContent>${railText}</w:txbxContent></v:textbox></v:rect>`,
  );
  xml = replaceShapeStyle(xml, "studio2-cover-signal", vmlStyle(124, 0, 86, 104, -251658240));

  const dateText = `${textBoxParagraph({ text: placeDate, size: 8.5, color: "#ffffff", tracking: 35, align: "right" })}</w:p>`;
  xml = replaceShapeBlock(
    xml,
    "studio2-cover-rule",
    `<v:rect id="studio2-cover-rule" style="${vmlStyle(104, 14, 90, 9, 251658100)};v-text-anchor:top" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent>${dateText}</w:txbxContent></v:textbox></v:rect>`,
  );

  const initialsText = `${textBoxParagraph({ text: initials(cover), size: 22, color: primary, bold: true, align: "center" })}</w:p>`;
  xml = replaceShapeBlock(
    xml,
    "docx-recipe-cover-photo-mat",
    `<v:oval id="docx-recipe-cover-photo-mat" style="${vmlStyle(128, 76, 49, 49, 251658400)};v-text-anchor:middle" fillcolor="${paper}" strokecolor="${primary}" strokeweight="0.8pt"><v:textbox inset="0,0,0,0"><w:txbxContent>${initialsText}</w:txbxContent></v:textbox></v:oval>`,
  );

  const runs = [
    fullName
      ? textBoxRun("studio2-docx-cover-name", 20, 136, 100, 16, [
          { text: fullName, size: 26, color: ink, bold: true },
        ])
      : "",
    cover.data.beruf
      ? textBoxRun("studio2-docx-cover-role", 20, 154, 105, 20, [
          { text: "Bewerbung um eine Lehrstelle als", size: 11, color: ink },
          { text: cover.data.beruf, size: 11, color: ink, bold: true },
        ])
      : "",
    cover.data.lehrbeginn?.trim()
      ? pillRun(
          "studio2-docx-cover-lehrbeginn",
          20,
          174,
          69,
          11,
          `Lehrbeginn · ${cover.data.lehrbeginn.trim()}`,
          secondary,
        )
      : "",
    contact.length
      ? textBoxRun("studio2-docx-cover-contact", 20, 246, 68, 38, [
          { text: "KONTAKT", size: 8.5, color: ink, bold: true, tracking: 25 },
          ...contact.map((text) => ({ text, size: 8.8, color: ink })),
        ])
      : "",
    attachments.length
      ? textBoxRun(
          "studio2-docx-cover-attachments",
          148,
          246,
          42,
          34,
          [
            { text: "BEILAGEN", size: 8.5, color: ink, bold: true, align: "right", tracking: 25 },
            ...attachments.map((text) => ({ text, size: 8.8, color: ink, align: "right" as const })),
          ],
        )
      : "",
  ].join("");

  return transformSection(xml, 0, (segment) => insertIntoFirstParagraph(segment, runs));
}

function studio2Letter(source: string, cover: CoverPdfDocument) {
  let xml = replaceShapeStyle(source, "studio2-letter-rail", vmlStyle(0, 0, 210, 22, -251658240));
  xml = replaceShapeStyle(xml, "studio2-letter-signal", vmlStyle(153, 19, 57, 20, -251658240));
  xml = replaceShapeStyle(xml, "studio2-letter-rail-rule", vmlStyle(0, 0, 0, 0, -251658240));

  return transformSection(xml, 1, (segment) => {
    const fullName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
    for (const text of [
      fullName,
      cover.data.adresse,
      cover.data.plzOrt,
      cover.data.telefon,
      cover.data.email,
    ].filter(Boolean) as string[]) {
      segment = removeFirstParagraphContaining(segment, text);
    }
    segment = setSectionMargins(segment, { top: 35.5, right: 24, bottom: 20, left: 25 });
    const lines = [fullName, cover.data.adresse, cover.data.plzOrt, cover.data.telefon, cover.data.email].filter(
      Boolean,
    ) as string[];
    const contact = textBoxRun(
      "studio2-docx-letter-contact",
      24,
      2,
      72,
      18,
      lines.map((text, index) => ({
        text,
        size: index === 0 ? 8.5 : 7.5,
        color: "#ffffff",
        bold: index === 0,
      })),
    );
    return insertIntoFirstParagraph(segment, contact);
  });
}

function studio2Cv(source: string, cover: CoverPdfDocument) {
  let xml = replaceShapeStyle(source, "studio2-cv-rail", vmlStyle(0, 0, 58, 297, -251658240));
  xml = replaceShapeStyle(xml, "studio2-cv-signal", vmlStyle(153, 0, 57, 22, -251658240));
  xml = replaceShapeBlock(
    xml,
    "studio2-cv-rail-rule",
    `<v:rect id="studio2-cv-rail-rule" style="${vmlStyle(62, 17, 140, 266, -251658100)}" filled="f" stroked="t" strokecolor="#202a3b" strokeweight="0.45pt"></v:rect>`,
  );

  return transformSection(xml, 2, (segment) => {
    const fullName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
    const address = [cover.data.adresse, cover.data.plzOrt].filter(Boolean).join(", ");
    const phoneMail = [cover.data.telefon, cover.data.email].filter(Boolean).join(" · ");
    for (const text of [fullName, address, phoneMail].filter(Boolean)) {
      segment = removeFirstParagraphContaining(segment, text);
    }
    segment = setSectionMargins(segment, { top: 8, right: 20, bottom: 18, left: 69 });
    const lines = [fullName, cover.data.adresse, cover.data.plzOrt, cover.data.telefon, cover.data.email].filter(
      Boolean,
    ) as string[];
    const contact = textBoxRun(
      "studio2-docx-cv-contact",
      24,
      2,
      32,
      20,
      lines.map((text, index) => ({
        text,
        size: index === 0 ? 8.5 : 7.2,
        color: "#ffffff",
        bold: index === 0,
      })),
    );
    return insertIntoFirstParagraph(segment, contact);
  });
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createBaseDossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => studio2Cv(studio2Letter(studio2Cover(xml, documents.cover), documents.cover), documents.cover),
    "Studio 2 DOCX 1:1 polish",
  );
}
