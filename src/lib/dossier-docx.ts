import { CV_SECTION_LABELS, entryFilled, type CvData, type CvEntry } from "@/components/cv/types";
import type { CoverPdfDocument, CvPdfDocument, LetterPdfDocument } from "@/lib/dossier-pdf-document";
import { downloadBlob } from "@/lib/download";

const WORD_FONT = "Cabin";
const WORD_FONT_FALLBACK = "Trebuchet MS";
const MM_TO_TWIPS = 1440 / 25.4;
const MM_TO_EMU = 36000;

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);
const emu = (mm: number) => Math.round(mm * MM_TO_EMU);

function run(
  text: string,
  {
    size = 10.5,
    bold = false,
    italic = false,
    underline = false,
    color = "111111",
  }: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  } = {},
) {
  const halfPoints = Math.round(size * 2);
  return `<w:r><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}" w:eastAsia="${WORD_FONT}"/><w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/><w:color w:val="${color}"/>${bold ? "<w:b/><w:bCs/>" : ""}${italic ? "<w:i/><w:iCs/>" : ""}${underline ? '<w:u w:val="single"/>' : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(
  text = "",
  {
    size,
    bold,
    italic,
    underline,
    align = "left",
    before = 0,
    after = 0,
    line = 1.15,
    keepNext = false,
  }: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: "left" | "center" | "right";
    before?: number;
    after?: number;
    line?: number;
    keepNext?: boolean;
  } = {},
) {
  const spacing = `<w:spacing w:before="${twips(before)}" w:after="${twips(after)}" w:line="${Math.round(240 * line)}" w:lineRule="auto"/>`;
  return `<w:p><w:pPr>${spacing}<w:jc w:val="${align}"/>${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${text ? run(text, { size, bold, italic, underline }) : "<w:r/>"}</w:p>`;
}

function paragraphRuns(
  runs: string[],
  {
    align = "left",
    before = 0,
    after = 0,
    line = 1.15,
    keepNext = false,
  }: {
    align?: "left" | "center" | "right";
    before?: number;
    after?: number;
    line?: number;
    keepNext?: boolean;
  } = {},
) {
  return `<w:p><w:pPr><w:spacing w:before="${twips(before)}" w:after="${twips(after)}" w:line="${Math.round(240 * line)}" w:lineRule="auto"/><w:jc w:val="${align}"/>${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${runs.join("")}</w:p>`;
}

const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function noBorderTable(rows: string, widthsMm: number[]) {
  const grid = widthsMm.map((width) => `<w:gridCol w:w="${twips(width)}"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

function cell(content: string, widthMm: number, align: "top" | "center" = "top") {
  return `<w:tc><w:tcPr><w:tcW w:w="${twips(widthMm)}" w:type="dxa"/><w:vAlign w:val="${align}"/></w:tcPr>${content || paragraph()}</w:tc>`;
}

function row(cells: string[], heightMm?: number) {
  return `<w:tr>${heightMm ? `<w:trPr><w:trHeight w:val="${twips(heightMm)}" w:hRule="atLeast"/></w:trPr>` : ""}${cells.join("")}</w:tr>`;
}

type EmbeddedImage = {
  rid: string;
  fileName: string;
  extension: "png" | "jpg";
  contentType: "image/png" | "image/jpeg";
  bytes: Uint8Array;
};

function dataUrlImage(
  value: string | null | undefined,
  index: number,
): EmbeddedImage | null {
  if (!value) return null;
  const match = value.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  const extension = match[1].toLowerCase() === "png" ? "png" : "jpg";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return {
    rid: `rIdImage${index}`,
    fileName: `image-${index}.${extension}`,
    extension,
    contentType: extension === "png" ? "image/png" : "image/jpeg",
    bytes,
  };
}

function imageRun(image: EmbeddedImage, widthMm: number, heightMm: number, docPrId: number) {
  const cx = emu(widthMm);
  const cy = emu(heightMm);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="Bewerbungsfoto ${docPrId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${xmlEscape(image.fileName)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${image.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function coverPage(document: CoverPdfDocument, images: EmbeddedImage[]) {
  const data = document.data;
  const photo = dataUrlImage(data.foto, images.length + 1);
  if (photo) images.push(photo);
  const fullName = [data.vorname, data.nachname].filter(Boolean).join(" ");
  const placeDate = [data.ort, data.datum].filter(Boolean).join(", ");
  const contact = [data.adresse, data.plzOrt, data.telefon, data.email, data.geburtsdatum].filter(Boolean);
  const recipient = [data.lehrbetrieb, data.ansprechperson, data.betriebAdresse].filter(Boolean);
  const kicker = data.kicker || "Bewerbung um eine Lehrstelle als";

  const topRow = noBorderTable(
    row([
      cell(paragraph(data.eyebrow || "Bewerbung", { size: 9, bold: true }), 85),
      cell(paragraph(placeDate, { size: 9, align: "right" }), 85),
    ]),
    [85, 85],
  );

  const photoRow = photo
    ? noBorderTable(
        row([
          cell(paragraph(), 112),
          cell(paragraphRuns([imageRun(photo, 42, 42, 1)], { align: "right" }), 58),
        ]),
        [112, 58],
      )
    : paragraph();

  const bottom = noBorderTable(
    row([
      cell(
        [
          paragraph(data.labelKontakt || "Kontakt", { size: 8.5, bold: true, keepNext: true }),
          ...contact.map((line) => paragraph(line, { size: 9.5, after: 0.6 })),
        ].join(""),
        82,
      ),
      cell(
        [
          paragraph(data.labelEmpfaenger || "Adressiert an", {
            size: 8.5,
            bold: true,
            align: "right",
            keepNext: true,
          }),
          ...recipient.map((line) => paragraph(line, { size: 9.5, align: "right", after: 0.6 })),
        ].join(""),
        88,
      ),
    ]),
    [82, 88],
  );

  return [
    topRow,
    photoRow,
    paragraph(kicker, { size: 10, bold: true, before: photo ? 15 : 62, after: 2 }),
    paragraph(data.beruf, { size: 32, bold: true, after: 6, line: 1.02 }),
    paragraph(fullName, { size: 15, bold: true, after: 2 }),
    data.lehrbeginn ? paragraph(`Lehrbeginn ${data.lehrbeginn}`, { size: 10.5 }) : "",
    paragraph("", { before: 38 }),
    bottom,
  ].join("");
}

function letterPage(document: LetterPdfDocument, images: EmbeddedImage[]) {
  const data = document.data;
  const senderLeft = [data.absenderName, data.absenderAdresse, data.absenderPlzOrt].filter(Boolean);
  const senderRight = [data.absenderTelefon, data.absenderEmail].filter(Boolean);
  const recipient = [
    data.empfaengerFirma,
    data.empfaengerName,
    data.empfaengerAdresse,
    data.empfaengerPlzOrt,
  ].filter(Boolean);
  const bodyParagraphs = data.text
    .split(/\n\s*\n/g)
    .map((value) => value.trim())
    .filter(Boolean);

  const flowImages = (data.images ?? [])
    .map((image) => dataUrlImage(image.src, images.length + 1))
    .filter((image): image is EmbeddedImage => !!image);
  images.push(...flowImages);

  return [
    noBorderTable(
      row([
        cell(senderLeft.map((line) => paragraph(line, { size: 9.5, after: 0.4 })).join(""), 100),
        cell(
          senderRight.map((line) => paragraph(line, { size: 9.5, align: "right", after: 0.4 })).join(""),
          70,
        ),
      ]),
      [100, 70],
    ),
    paragraph("", { before: 16 }),
    ...recipient.map((line) => paragraph(line, { size: 10.5, after: 0.4 })),
    paragraph([data.ort, data.datum].filter(Boolean).join(", "), { size: 10.5, align: "right", before: 8 }),
    paragraph(data.betreff, { size: 12, bold: true, before: 9, after: 7, keepNext: true }),
    paragraph(data.anrede, { size: 10.5, after: 5, keepNext: true }),
    ...bodyParagraphs.map((text) => paragraph(text, { size: 10.5, after: 4.5, line: 1.22 })),
    ...flowImages.map((image, index) =>
      paragraphRuns([imageRun(image, 34, 34, 10 + index)], { align: "right", before: 2, after: 2 }),
    ),
    paragraph(data.gruss, { size: 10.5, before: 5, after: 6 }),
    paragraph(data.unterschrift, { size: 10.5, bold: true }),
    data.showBeilagen !== false && (data.beilagen ?? []).some((item) => item.trim())
      ? [
          paragraph("Beilagen", { size: 9.5, bold: true, before: 10, keepNext: true }),
          ...(data.beilagen ?? [])
            .filter((item) => item.trim())
            .map((item) => paragraph(item, { size: 9.5, after: 0.4 })),
        ].join("")
      : "",
  ].join("");
}

function entryTable(entries: CvEntry[]) {
  const filled = entries.filter(entryFilled);
  if (!filled.length) return "";
  return noBorderTable(
    filled
      .map((entry) =>
        row([
          cell(paragraph(entry.zeit, { size: 9.5 }), 36),
          cell(
            [
              paragraph(entry.titel, { size: 10.5, bold: true, keepNext: true }),
              entry.ort ? paragraph(entry.ort, { size: 9.5, italic: true, after: 1 }) : "",
              entry.beschreibung ? paragraph(entry.beschreibung, { size: 9.5, after: 4, line: 1.18 }) : "",
            ].join(""),
            134,
          ),
        ]),
      )
      .join(""),
    [36, 134],
  );
}

function cvHeading(label: string) {
  return paragraph(label, { size: 11.5, bold: true, before: 6, after: 2.5, keepNext: true });
}

function cvPage(document: CvPdfDocument, images: EmbeddedImage[]) {
  const data: CvData = document.data;
  const person = data.person;
  const photo = dataUrlImage(person.foto, images.length + 1);
  if (photo) images.push(photo);
  const fullName = [person.vorname, person.nachname].filter(Boolean).join(" ");
  const contact = [person.adresse, person.plzOrt, person.telefon, person.email, person.geburtsdatum, person.nationalitaet]
    .filter(Boolean)
    .join(" · ");
  const hidden = data.hidden ?? {};
  const labels = data.labels ?? {};

  const header = noBorderTable(
    row([
      cell(
        [
          data.titel ? paragraph(data.titel, { size: 9.5, bold: true, keepNext: true }) : "",
          paragraph(fullName, { size: 24, bold: true, after: 1.5, keepNext: true }),
          person.untertitel ? paragraph(person.untertitel, { size: 10.5 }) : "",
        ].join(""),
        photo ? 132 : 170,
      ),
      ...(photo
        ? [cell(paragraphRuns([imageRun(photo, 30, 30, 50)], { align: "right" }), 38, "center")]
        : []),
    ]),
    photo ? [132, 38] : [170],
  );

  const content: string[] = [header, paragraph(contact, { size: 9.5, before: 4, after: 5 })];

  if (!hidden.schule && data.schule.some(entryFilled)) {
    content.push(cvHeading(labels.schule || CV_SECTION_LABELS.schule), entryTable(data.schule));
  }
  if (!hidden.erfahrung && data.erfahrung.some(entryFilled)) {
    content.push(cvHeading(labels.erfahrung || CV_SECTION_LABELS.erfahrung), entryTable(data.erfahrung));
  }
  if (!hidden.sprachen && data.sprachen.some((entry) => entry.name.trim() || entry.niveau.trim())) {
    content.push(
      cvHeading(labels.sprachen || CV_SECTION_LABELS.sprachen),
      noBorderTable(
        data.sprachen
          .filter((entry) => entry.name.trim() || entry.niveau.trim())
          .map((entry) =>
            row([
              cell(paragraph(entry.name, { size: 9.5, bold: true }), 70),
              cell(paragraph(entry.niveau, { size: 9.5 }), 100),
            ]),
          )
          .join(""),
        [70, 100],
      ),
    );
  }
  if (!hidden.hobbys && data.hobbys.some((item) => item.trim())) {
    content.push(
      cvHeading(labels.hobbys || CV_SECTION_LABELS.hobbys),
      ...data.hobbys.filter((item) => item.trim()).map((item) => paragraph(`• ${item}`, { size: 9.5, after: 0.8 })),
    );
  }
  if (!hidden.staerken && data.staerken.some((item) => item.trim())) {
    content.push(
      cvHeading(labels.staerken || CV_SECTION_LABELS.staerken),
      ...data.staerken.filter((item) => item.trim()).map((item) => paragraph(`• ${item}`, { size: 9.5, after: 0.8 })),
    );
  }
  if (!hidden.referenzen && data.referenzen.some((entry) => entry.name.trim() || entry.kontakt.trim())) {
    content.push(cvHeading(labels.referenzen || CV_SECTION_LABELS.referenzen));
    for (const reference of data.referenzen.filter((entry) => entry.name.trim() || entry.kontakt.trim())) {
      content.push(
        paragraphRuns(
          [
            run(reference.name, { size: 9.5, bold: true }),
            reference.funktion ? run(` · ${reference.funktion}`, { size: 9.5 }) : "",
          ],
          { after: 0.5 },
        ),
      );
      for (const line of [reference.kontakt, reference.email, reference.zusatz].filter(Boolean) as string[]) {
        content.push(paragraph(line, { size: 9.5, after: 0.5 }));
      }
    }
  }

  for (const section of data.customSections ?? []) {
    if (!section.title.trim() && !section.entries.some(entryFilled)) continue;
    content.push(cvHeading(section.title || "Weitere Angaben"), entryTable(section.entries));
  }

  return content.join("");
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}" w:eastAsia="${WORD_FONT}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}"/></w:rPr></w:style></w:styles>`;
}

function fontTableXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:font w:name="${WORD_FONT}"><w:altName w:val="${WORD_FONT_FALLBACK}"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font><w:font w:name="${WORD_FONT_FALLBACK}"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>`;
}

function documentXml(cover: CoverPdfDocument, letter: LetterPdfDocument, cv: CvPdfDocument, images: EmbeddedImage[]) {
  const body = `${coverPage(cover, images)}${pageBreak()}${letterPage(letter, images)}${pageBreak()}${cvPage(cv, images)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${twips(20)}" w:right="${twips(20)}" w:bottom="${twips(20)}" w:left="${twips(20)}" w:header="${twips(8)}" w:footer="${twips(8)}" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
}

function relationshipsXml(images: EmbeddedImage[]) {
  const imageRels = images
    .map(
      (image) =>
        `<Relationship Id="${image.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${image.fileName}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFonts" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${imageRels}</Relationships>`;
}

function contentTypesXml(images: EmbeddedImage[]) {
  const defaults = new Map<string, string>([
    ["rels", "application/vnd.openxmlformats-package.relationships+xml"],
    ["xml", "application/xml"],
  ]);
  for (const image of images) defaults.set(image.extension, image.contentType);
  const defaultXml = [...defaults.entries()]
    .map(([extension, type]) => `<Default Extension="${extension}" ContentType="${type}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaultXml}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>`;
const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>CV Cover Charm</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>1.0</AppVersion></Properties>`;

function coreXml(author: string) {
  const created = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Bewerbungsdossier</dc:title><dc:subject>Lehrstellenbewerbung</dc:subject><dc:creator>${xmlEscape(author)}</dc:creator><cp:lastModifiedBy>CV Cover Charm</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
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
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

type ZipEntry = { name: string; bytes: Uint8Array };

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
    writeU16(local, 10, 0);
    writeU16(local, 12, 0);
    writeU32(local, 14, checksum);
    writeU32(local, 18, entry.bytes.length);
    writeU32(local, 22, entry.bytes.length);
    writeU16(local, 26, name.length);
    writeU16(local, 28, 0);
    local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, 0x0800);
    writeU16(central, 10, 0);
    writeU16(central, 12, 0);
    writeU16(central, 14, 0);
    writeU32(central, 16, checksum);
    writeU32(central, 20, entry.bytes.length);
    writeU32(central, 24, entry.bytes.length);
    writeU16(central, 28, name.length);
    writeU16(central, 30, 0);
    writeU16(central, 32, 0);
    writeU16(central, 34, 0);
    writeU16(central, 36, 0);
    writeU32(central, 38, 0);
    writeU32(central, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.bytes.length;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  writeU32(end, 0, 0x06054b50);
  writeU16(end, 4, 0);
  writeU16(end, 6, 0);
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, centralDirectory.length);
  writeU32(end, 16, localOffset);
  writeU16(end, 20, 0);
  return concat([...localParts, centralDirectory, end]);
}

export function briefDossierDocxSupported(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  return cover?.template === "brief" && letter?.design.template === "brief" && cv?.design.template === "brief";
}

export function createBriefDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
): Blob {
  if (!briefDossierDocxSupported(cover, letter, cv)) {
    throw new Error("Der DOCX-Referenzexport ist derzeit nur für die Vorlage Brief verfügbar.");
  }

  const images: EmbeddedImage[] = [];
  const document = documentXml(cover, letter, cv, images);
  const author =
    [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ") ||
    [cv.data.person.vorname, cv.data.person.nachname].filter(Boolean).join(" ") ||
    "Bewerbungsdossier";
  const encoder = new TextEncoder();
  const textEntry = (name: string, value: string): ZipEntry => ({ name, bytes: encoder.encode(value) });

  const entries: ZipEntry[] = [
    textEntry("[Content_Types].xml", contentTypesXml(images)),
    textEntry("_rels/.rels", packageRelsXml),
    textEntry("docProps/core.xml", coreXml(author)),
    textEntry("docProps/app.xml", appXml),
    textEntry("word/document.xml", document),
    textEntry("word/styles.xml", stylesXml()),
    textEntry("word/fontTable.xml", fontTableXml()),
    textEntry("word/settings.xml", settingsXml),
    textEntry("word/_rels/document.xml.rels", relationshipsXml(images)),
    ...images.map((image) => ({ name: `word/media/${image.fileName}`, bytes: image.bytes })),
  ];

  return new Blob([zipStore(entries)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function downloadBriefDossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(createBriefDossierDocxBlob(cover, letter, cv), fileName);
}
