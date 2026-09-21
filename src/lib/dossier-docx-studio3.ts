import { CV_SECTION_LABELS, entryFilled } from "@/components/cv/types";
import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { createWarmDossierDocxBlob } from "@/lib/dossier-docx-warm";
import { downloadBlob } from "@/lib/download";

const MM_TO_TWIPS = 1440 / 25.4;
const WORD_FONT = "Cabin";
const PRIMARY_FALLBACK = "173D3A";
const SECONDARY_FALLBACK = "5EC6B6";
const ACCENT_FALLBACK = "E2A94B";
const PAPER_FALLBACK = "F7FBFA";
const INK_FALLBACK = "18302D";

const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

function wordColor(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
}

function studioPalette(colors: Record<string, string> | undefined) {
  return {
    primary: wordColor(colors?.primary, PRIMARY_FALLBACK),
    secondary: wordColor(colors?.secondary, SECONDARY_FALLBACK),
    accent: wordColor(colors?.accent, ACCENT_FALLBACK),
    paper: wordColor(colors?.bg, PAPER_FALLBACK),
    ink: wordColor(colors?.ink, INK_FALLBACK),
  };
}

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

type ZipEntry = { name: string; bytes: Uint8Array };

function storedZipEntries(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && u32(bytes, offset) === 0x04034b50) {
    const method = u16(bytes, offset + 8);
    if (method !== 0) throw new Error("Studio-3-DOCX erwartet unkomprimierte ZIP-Einträge.");
    const size = u32(bytes, offset + 18);
    const nameLength = u16(bytes, offset + 26);
    const extraLength = u16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries.push({ name, bytes: bytes.slice(dataStart, dataStart + size) });
    offset = dataStart + size;
  }

  return entries;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, 0x0800);
    writeU16(local, 8, 0);
    writeU32(local, 14, checksum);
    writeU32(local, 18, entry.bytes.length);
    writeU32(local, 22, entry.bytes.length);
    writeU16(local, 26, name.length);
    local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, 0x0800);
    writeU32(central, 16, checksum);
    writeU32(central, 20, entry.bytes.length);
    writeU32(central, 24, entry.bytes.length);
    writeU16(central, 28, name.length);
    writeU32(central, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.bytes.length;
  }

  const directory = concat(centralParts);
  const end = new Uint8Array(22);
  writeU32(end, 0, 0x06054b50);
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, directory.length);
  writeU32(end, 16, localOffset);
  return concat([...localParts, directory, end]);
}

function vmlStyle(x: number, y: number, width: number, height: number, z = -251658240) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${width}mm;height:${height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function shapeRun(id: string, path: string, color: string) {
  return `<w:r><w:pict><v:shape id="${id}" coordorigin="0 0" coordsize="21000 29700" style="${vmlStyle(0, 0, 210, 297)}" path="${path}" fillcolor="#${color}" stroked="f"/></w:pict></w:r>`;
}

function rectRun(id: string, x: number, y: number, width: number, height: number, color: string) {
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, width, height)}" fillcolor="#${color}" stroked="f"/></w:pict></w:r>`;
}

function frameRun(id: string, x: number, y: number, width: number, height: number, color: string) {
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, width, height)}" filled="f" strokecolor="#${color}" strokeweight="0.7pt"/></w:pict></w:r>`;
}

function ovalRun(id: string, x: number, y: number, width: number, height: number, fill: string, stroke: string) {
  return `<w:r><w:pict><v:oval id="${id}" style="${vmlStyle(x, y, width, height)}" fillcolor="#${fill}" strokecolor="#${stroke}" strokeweight="1pt"/></w:pict></w:r>`;
}

function photoOvalRun(
  id: string,
  relationshipId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
) {
  return `<w:r><w:pict><v:oval id="${id}" style="${vmlStyle(x, y, width, height, 251658000)}" fillcolor="#FFFFFF" strokecolor="#${stroke}" strokeweight="1.2pt"><v:imagedata r:id="${relationshipId}" o:title="Bewerbungsfoto"/></v:oval></w:pict></w:r>`;
}

function replaceDrawing(source: string, id: string, replacement: string, required = true) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<w:r><w:pict><v:[a-z]+\\s+id="${escaped}"[\\s\\S]*?</w:pict></w:r>`);
  if (!pattern.test(source)) {
    if (required) throw new Error(`Studio-3-DOCX Zeichnung fehlt: ${id}`);
    return source;
  }
  return source.replace(pattern, replacement);
}

function replaceFirstAfter(source: string, anchor: string, search: string, replacement: string) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`Studio-3-DOCX Anker fehlt: ${anchor}`);
  const index = source.indexOf(search, anchorIndex);
  if (index < 0) throw new Error(`Studio-3-DOCX Ziel fehlt nach ${anchor}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function patchParagraphContaining(
  source: string,
  text: string,
  mutate: (paragraphProperties: string) => string,
) {
  if (!text) return source;
  const needle = xmlEscape(text);
  const textIndex = source.indexOf(`>${needle}</w:t>`);
  if (textIndex < 0) return source;
  const paragraphStart = source.lastIndexOf("<w:p>", textIndex);
  const propertiesStart = source.indexOf("<w:pPr>", paragraphStart);
  const propertiesEnd = source.indexOf("</w:pPr>", propertiesStart);
  if (paragraphStart < 0 || propertiesStart < 0 || propertiesEnd < 0 || propertiesEnd > textIndex) {
    return source;
  }
  const current = source.slice(propertiesStart + 7, propertiesEnd);
  const next = mutate(current);
  return source.slice(0, propertiesStart + 7) + next + source.slice(propertiesEnd);
}

function setAlignment(source: string, text: string, alignment: "left" | "right", rightIndentMm = 0) {
  return patchParagraphContaining(source, text, (properties) => {
    const jc = `<w:jc w:val="${alignment}"/>`;
    const indent = rightIndentMm ? `<w:ind w:right="${twips(rightIndentMm)}"/>` : "";
    const aligned = /<w:jc w:val="[^"]+"\/>/.test(properties)
      ? properties.replace(/<w:jc w:val="[^"]+"\/>/, jc)
      : `${properties}${jc}`;
    return `${aligned}${indent}`;
  });
}

function addLeftBorder(source: string, text: string, color: string) {
  return patchParagraphContaining(source, text, (properties) =>
    `${properties}<w:pBdr><w:left w:val="single" w:sz="18" w:space="5" w:color="${color}"/></w:pBdr>`,
  );
}

function run(text: string, size: number, color: string, bold = false, trackingPt = 0) {
  const halfPoints = Math.round(size * 2);
  return `<w:r><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}" w:eastAsia="${WORD_FONT}"/><w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/><w:color w:val="${color}"/>${trackingPt ? `<w:spacing w:val="${Math.round(trackingPt * 20)}"/>` : ""}${bold ? "<w:b/><w:bCs/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(
  text: string,
  size: number,
  color: string,
  { bold = false, before = 0, after = 0, trackingPt = 0 }: { bold?: boolean; before?: number; after?: number; trackingPt?: number } = {},
) {
  return `<w:p><w:pPr><w:spacing w:before="${twips(before)}" w:after="${twips(after)}" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${run(text, size, color, bold, trackingPt)}</w:p>`;
}

function spacer(mm: number) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${twips(mm)}" w:lineRule="exact"/></w:pPr><w:r/></w:p>`;
}

function pillTable(text: string, fill: string, ink: string) {
  const left = twips(72);
  const right = twips(106);
  return `<w:tbl><w:tblPr><w:tblW w:w="${twips(178)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${left}"/><w:gridCol w:w="${right}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${left}" w:type="dxa"/><w:shd w:fill="${fill}"/><w:tcMar><w:top w:w="${twips(1.8)}" w:type="dxa"/><w:left w:w="${twips(4)}" w:type="dxa"/><w:bottom w:w="${twips(1.8)}" w:type="dxa"/><w:right w:w="${twips(4)}" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(text, 10, ink, { bold: true })}</w:tc><w:tc><w:tcPr><w:tcW w:w="${right}" w:type="dxa"/></w:tcPr><w:p/></w:tc></w:tr></w:tbl>`;
}

function replaceLehrbeginnTable(source: string, text: string, fill: string, ink: string) {
  const textIndex = source.indexOf(`>${xmlEscape(text)}</w:t>`);
  if (textIndex < 0) return source;
  const tableStart = source.lastIndexOf("<w:tbl>", textIndex);
  const tableEnd = source.indexOf("</w:tbl>", textIndex);
  if (tableStart < 0 || tableEnd < 0) return source;
  return source.slice(0, tableStart) + pillTable(text, fill, ink) + source.slice(tableEnd + 8);
}

function studioHeadingLabels(cv: CvPdfDocument) {
  const labels = cv.data.labels ?? {};
  const hidden = cv.data.hidden ?? {};
  const values: string[] = [];
  if (!hidden.schule && cv.data.schule.some(entryFilled)) values.push(labels.schule || CV_SECTION_LABELS.schule);
  if (!hidden.erfahrung && cv.data.erfahrung.some(entryFilled)) values.push(labels.erfahrung || CV_SECTION_LABELS.erfahrung);
  if (!hidden.sprachen && cv.data.sprachen.some((entry) => entry.name.trim() || entry.niveau.trim())) values.push(labels.sprachen || CV_SECTION_LABELS.sprachen);
  if (!hidden.hobbys && cv.data.hobbys.some((item) => item.trim())) values.push(labels.hobbys || CV_SECTION_LABELS.hobbys);
  if (!hidden.staerken && cv.data.staerken.some((item) => item.trim())) values.push(labels.staerken || CV_SECTION_LABELS.staerken);
  if (!hidden.referenzen && cv.data.referenzen.some((entry) => entry.name.trim() || entry.kontakt.trim())) values.push(labels.referenzen || CV_SECTION_LABELS.referenzen);
  for (const section of cv.data.customSections ?? []) {
    if (section.title.trim() || section.entries.some(entryFilled)) values.push(section.title || "Weitere Angaben");
  }
  return values.map((label) => label.toLocaleUpperCase("de-CH"));
}

function replaceCvIntro(source: string, cv: CvPdfDocument, paper: string) {
  const cvAnchor = source.indexOf('id="warm-cv-paper"');
  if (cvAnchor < 0) return source;
  const decorationsEnd = source.indexOf("</w:p>", cvAnchor);
  if (decorationsEnd < 0) return source;

  const labels = studioHeadingLabels(cv);
  let firstHeadingIndex = -1;
  for (const label of labels) {
    const index = source.indexOf(`>${xmlEscape(label)}</w:t>`, decorationsEnd);
    if (index >= 0 && (firstHeadingIndex < 0 || index < firstHeadingIndex)) firstHeadingIndex = index;
  }
  if (firstHeadingIndex < 0) return source;
  const firstTable = source.lastIndexOf("<w:tbl>", firstHeadingIndex);
  if (firstTable < 0) return source;

  const person = cv.data.person;
  const fullName = [person.vorname, person.nachname].filter(Boolean).join(" ");
  const address = [person.adresse, person.plzOrt].filter(Boolean).join(", ");
  const direct = [person.telefon, person.email].filter(Boolean).join(" · ");
  const personal = [
    person.geburtsdatum ? `Geburtsdatum ${person.geburtsdatum}` : "",
    person.geburtsort ? `Geburtsort ${person.geburtsort}` : "",
    person.heimatort ? `Heimatort ${person.heimatort}` : "",
    person.nationalitaet ? `Nationalität ${person.nationalitaet}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const header = [
    paragraph(fullName, 9.5, paper, { bold: true, after: 0.2 }),
    address ? paragraph(address, 8.8, paper, { after: 0.15 }) : "",
    direct ? paragraph(direct, 8.8, paper, { after: 0.15 }) : "",
    paragraph((cv.data.titel || "Lebenslauf").toUpperCase(), 11.6, paper, {
      bold: true,
      before: 7,
      trackingPt: 0.7,
    }),
    personal ? paragraph(personal, 9.5, paper, { before: 12 }) : "",
    spacer(29),
  ].join("");

  return source.slice(0, decorationsEnd + 6) + header + source.slice(firstTable);
}

function patchStudioDocumentXml(
  source: string,
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const coverPalette = studioPalette(cover.colors);
  const letterPalette = studioPalette(letter.design.colors);
  const cvPalette = studioPalette(cv.design.colors);

  let xml = source;

  xml = replaceDrawing(
    xml,
    "warm-cover-teal",
    shapeRun(
      "studio3-cover-primary",
      "m 0,0 l 21000,0 21000,9200 13400,12400 0,10400 x e",
      coverPalette.primary,
    ),
  );
  xml = replaceDrawing(
    xml,
    "warm-cover-large-orb",
    shapeRun(
      "studio3-cover-mint",
      "m 12600,0 l 21000,0 21000,9000 14200,9000 c 13200,8700 12600,7300 12600,5600 x e",
      coverPalette.secondary,
    ),
  );
  xml = replaceDrawing(xml, "warm-cover-small-orb", "");
  xml = replaceDrawing(
    xml,
    "warm-cover-photo-mat",
    ovalRun("studio3-cover-photo-mat", 130, 60, 48, 48, coverPalette.paper, coverPalette.primary),
  );
  const photoRelationship = xml.match(/<v:oval id="warm-cover-photo"[\s\S]*?<v:imagedata r:id="([^"]+)"/)?.[1];
  if (photoRelationship) {
    xml = replaceDrawing(
      xml,
      "warm-cover-photo",
      photoOvalRun("studio3-cover-photo", photoRelationship, 132, 62, 44, 44, coverPalette.primary),
      false,
    );
  }

  const coverName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
  const coverInitials = `${cover.data.vorname.trim().charAt(0)}${cover.data.nachname.trim().charAt(0)}`.toUpperCase();
  xml = setAlignment(xml, coverInitials, "right", 38);
  xml = setAlignment(xml, coverName, "left");
  xml = setAlignment(xml, cover.data.beruf, "left");
  if (cover.data.lehrbeginn?.trim()) {
    xml = replaceLehrbeginnTable(
      xml,
      `Lehrbeginn · ${cover.data.lehrbeginn}`,
      coverPalette.secondary,
      coverPalette.ink,
    );
  }

  xml = replaceDrawing(xml, "warm-letter-masthead", rectRun("studio3-letter-primary", 0, 0, 210, 22, letterPalette.primary));
  xml = replaceDrawing(xml, "warm-letter-ring", rectRun("studio3-letter-mint", 146, 0, 64, 22, letterPalette.secondary));
  xml = replaceDrawing(xml, "warm-letter-orb", "");
  xml = replaceDrawing(xml, "warm-letter-footer", "");
  const oldLetterSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(23)}" w:lineRule="exact"/>`;
  const newLetterSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(10)}" w:lineRule="exact"/>`;
  xml = replaceFirstAfter(xml, 'id="studio3-letter-primary"', oldLetterSpacer, newLetterSpacer);

  const letterMargin = new RegExp(
    `<w:pgMar w:top="${twips(14)}" w:right="${twips(22)}" w:bottom="${twips(18)}" w:left="${twips(24)}"`,
  );
  xml = xml.replace(
    letterMargin,
    `<w:pgMar w:top="${twips(3)}" w:right="${twips(22)}" w:bottom="${twips(18)}" w:left="${twips(24)}"`,
  );

  xml = replaceDrawing(
    xml,
    "warm-cv-top-band",
    shapeRun(
      "studio3-cv-primary",
      "m 0,0 l 21000,0 21000,4300 13400,6000 0,5000 x e",
      cvPalette.primary,
    ),
  );
  xml = replaceDrawing(xml, "warm-cv-orb", rectRun("studio3-cv-mint", 146, 0, 64, 22, cvPalette.secondary));
  xml = replaceDrawing(xml, "warm-cv-bottom-band", frameRun("studio3-cv-frame", 10, 10, 190, 277, cvPalette.accent));
  const cvPhotoRelationship = xml.match(/<v:oval id="warm-cv-photo"[\s\S]*?<v:imagedata r:id="([^"]+)"/)?.[1];
  if (cvPhotoRelationship) {
    xml = replaceDrawing(
      xml,
      "warm-cv-photo",
      photoOvalRun("studio3-cv-photo", cvPhotoRelationship, 164, 9, 28, 28, cvPalette.paper),
      false,
    );
  }
  xml = replaceCvIntro(xml, cv, cvPalette.paper);

  const cvAnchor = xml.indexOf('id="studio3-cv-primary"');
  if (cvAnchor >= 0) {
    const before = xml.slice(0, cvAnchor);
    let tail = xml.slice(cvAnchor);
    tail = tail.replace(
      new RegExp(`<w:bottom w:val="single" w:sz="8" w:space="1" w:color="${cvPalette.primary}"/>`, "g"),
      `<w:bottom w:val="single" w:sz="8" w:space="1" w:color="${cvPalette.accent}"/>`,
    );
    xml = before + tail;
  }
  for (const heading of studioHeadingLabels(cv)) {
    xml = addLeftBorder(xml, heading, cvPalette.secondary);
  }

  const cvMargin = new RegExp(
    `<w:pgMar w:top="${twips(24)}" w:right="${twips(20)}" w:bottom="${twips(18)}" w:left="${twips(20)}"`,
  );
  xml = xml.replace(
    cvMargin,
    `<w:pgMar w:top="${twips(3)}" w:right="${twips(20)}" w:bottom="${twips(18)}" w:left="${twips(20)}"`,
  );

  return xml;
}

function warmCompatibleDocuments(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  return {
    cover: { ...cover, template: "freundlich" } as CoverPdfDocument,
    letter: {
      ...letter,
      design: { ...letter.design, template: "freundlich" },
    } as LetterPdfDocument,
    cv: {
      ...cv,
      design: { ...cv.design, template: "freundlich" },
    } as CvPdfDocument,
  };
}

export function studio3DossierDocxSupported(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  return (
    String(cover?.template) === "studio3" &&
    String(letter?.design.template) === "studio3" &&
    String(cv?.design.template) === "studio3"
  );
}

export async function createStudio3DossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  if (!studio3DossierDocxSupported(cover, letter, cv)) {
    throw new Error("Der DOCX-Referenzexport Studio 3 benötigt Studio 3 in allen drei Dossierteilen.");
  }

  const compatible = warmCompatibleDocuments(cover, letter, cv);
  const base = createWarmDossierDocxBlob(compatible.cover, compatible.letter, compatible.cv);
  const entries = storedZipEntries(new Uint8Array(await base.arrayBuffer()));
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("Studio-3-DOCX document.xml fehlt.");

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  document.bytes = encoder.encode(
    patchStudioDocumentXml(decoder.decode(document.bytes), cover, letter, cv),
  );

  const core = entries.find((entry) => entry.name === "docProps/core.xml");
  if (core) {
    core.bytes = encoder.encode(
      decoder.decode(core.bytes).replace("Bewerbungsdossier – Warm", "Bewerbungsdossier – Studio 3"),
    );
  }

  return new Blob([zipStore(entries)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function downloadStudio3DossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(await createStudio3DossierDocxBlob(cover, letter, cv), fileName);
}
