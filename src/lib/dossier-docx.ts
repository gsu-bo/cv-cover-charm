import { coverAttachmentValues } from "@/components/cover/types";
import { CV_SECTION_LABELS, entryFilled, type CvData, type CvEntry } from "@/components/cv/types";
import {
  DEFAULT_LETTER_CLOSING_GAP_MM,
  DEFAULT_LETTER_SIGNATURE_GAP_MM,
  normalizeLetterSpacingMm,
} from "@/components/letter/types";
import type { CoverPdfDocument, CvPdfDocument, LetterPdfDocument } from "@/lib/dossier-pdf-document";
import { downloadBlob } from "@/lib/download";

const WORD_FONT = "Cabin";
const WORD_FONT_FALLBACK = "Trebuchet MS";
const MM_TO_TWIPS = 1440 / 25.4;
const MM_TO_EMU = 36000;
const INK = "111111";
const MUTED = "6B7280";
const RULE = "CBD5E1";

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
    color = INK,
    trackingPt = 0,
  }: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    trackingPt?: number;
  } = {},
) {
  const halfPoints = Math.round(size * 2);
  const spacing = trackingPt ? `<w:spacing w:val="${Math.round(trackingPt * 20)}"/>` : "";
  return `<w:r><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}" w:eastAsia="${WORD_FONT}"/><w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/><w:color w:val="${color}"/>${spacing}${bold ? "<w:b/><w:bCs/>" : ""}${italic ? "<w:i/><w:iCs/>" : ""}${underline ? '<w:u w:val="single"/>' : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(
  text = "",
  {
    size,
    bold,
    italic,
    underline,
    color,
    trackingPt,
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
    color?: string;
    trackingPt?: number;
    align?: "left" | "center" | "right";
    before?: number;
    after?: number;
    line?: number;
    keepNext?: boolean;
  } = {},
) {
  const spacing = `<w:spacing w:before="${twips(before)}" w:after="${twips(after)}" w:line="${Math.round(240 * line)}" w:lineRule="auto"/>`;
  return `<w:p><w:pPr>${spacing}<w:jc w:val="${align}"/>${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${text ? run(text, { size, bold, italic, underline, color, trackingPt }) : "<w:r/>"}</w:p>`;
}

function paragraphRuns(
  runs: string[],
  {
    align = "left",
    before = 0,
    after = 0,
    line = 1.15,
    keepNext = false,
    borderBottom,
  }: {
    align?: "left" | "center" | "right";
    before?: number;
    after?: number;
    line?: number;
    keepNext?: boolean;
    borderBottom?: { color: string; size?: number };
  } = {},
) {
  const border = borderBottom
    ? `<w:pBdr><w:bottom w:val="single" w:sz="${borderBottom.size ?? 6}" w:space="1" w:color="${borderBottom.color}"/></w:pBdr>`
    : "";
  return `<w:p><w:pPr><w:spacing w:before="${twips(before)}" w:after="${twips(after)}" w:line="${Math.round(240 * line)}" w:lineRule="auto"/><w:jc w:val="${align}"/>${border}${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${runs.join("")}</w:p>`;
}

function spacer(mm: number) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${twips(mm)}" w:lineRule="exact"/></w:pPr><w:r><w:t></w:t></w:r></w:p>`;
}

function noBorderTable(rows: string, widthsMm: number[]) {
  const grid = widthsMm.map((width) => `<w:gridCol w:w="${twips(width)}"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${twips(widthsMm.reduce((sum, width) => sum + width, 0))}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

function cell(
  content: string,
  widthMm: number,
  {
    align = "top",
    border = false,
    paddingMm = 0,
  }: { align?: "top" | "center"; border?: boolean; paddingMm?: number } = {},
) {
  const borders = border
    ? `<w:tcBorders><w:top w:val="single" w:sz="10" w:color="${INK}"/><w:left w:val="single" w:sz="10" w:color="${INK}"/><w:bottom w:val="single" w:sz="10" w:color="${INK}"/><w:right w:val="single" w:sz="10" w:color="${INK}"/></w:tcBorders>`
    : "";
  const margins = paddingMm
    ? `<w:tcMar><w:top w:w="${twips(paddingMm)}" w:type="dxa"/><w:left w:w="${twips(paddingMm)}" w:type="dxa"/><w:bottom w:w="${twips(paddingMm)}" w:type="dxa"/><w:right w:w="${twips(paddingMm)}" w:type="dxa"/></w:tcMar>`
    : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${twips(widthMm)}" w:type="dxa"/><w:vAlign w:val="${align}"/>${borders}${margins}</w:tcPr>${content || paragraph()}</w:tc>`;
}

function row(cells: string[], heightMm?: number, exact = false) {
  return `<w:tr>${heightMm ? `<w:trPr><w:trHeight w:val="${twips(heightMm)}" w:hRule="${exact ? "exact" : "atLeast"}"/></w:trPr>` : ""}${cells.join("")}</w:tr>`;
}

type EmbeddedImage = {
  rid: string;
  fileName: string;
  extension: "png" | "jpg";
  contentType: "image/png" | "image/jpeg";
  bytes: Uint8Array;
};

function dataUrlImage(value: string | null | undefined, index: number): EmbeddedImage | null {
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

function initials(vorname: string, nachname: string) {
  return `${vorname.trim().charAt(0)}${nachname.trim().charAt(0)}`.toUpperCase();
}

function coverPage(document: CoverPdfDocument, images: EmbeddedImage[]) {
  const data = document.data;
  const photo = dataUrlImage(data.foto, images.length + 1);
  if (photo) images.push(photo);
  const fullName = [data.vorname, data.nachname].filter(Boolean).join(" ");
  const placeDate = [data.ort, data.datum].filter(Boolean).join(", ");
  const contact = [data.adresse, data.plzOrt, data.telefon, data.email, data.geburtsdatum].filter(Boolean);
  const attachments = coverAttachmentValues(data).filter((value) => value.trim());
  const kicker = (data.kicker || "Bewerbung um eine Lehrstelle als").toUpperCase();
  const eyebrow = (data.eyebrow || "Bewerbung").toUpperCase();

  const header = noBorderTable(
    row([
      cell(
        paragraph(eyebrow, {
          size: 10.5,
          bold: true,
          trackingPt: 2.8,
        }),
        85,
      ),
      cell(paragraph(placeDate, { size: 9.5, color: MUTED, align: "right" }), 85),
    ]),
    [85, 85],
  );

  const portraitContent = photo
    ? paragraphRuns([imageRun(photo, 49.5, 49.5, 1)], { align: "center" })
    : paragraph(initials(data.vorname, data.nachname), {
        size: 27,
        bold: true,
        align: "center",
      });
  const portrait = noBorderTable(
    row(
      [
        cell(paragraph(), 109),
        cell(portraitContent, 52, { align: "center", border: true, paddingMm: photo ? 0.5 : 1 }),
        cell(paragraph(), 9),
      ],
      52,
      true,
    ),
    [109, 52, 9],
  );

  const bottom = noBorderTable(
    row([
      cell(
        [
          paragraph((data.labelKontakt || "Kontakt").toUpperCase(), {
            size: 9.5,
            bold: true,
            trackingPt: 1.6,
            keepNext: true,
            after: 2,
          }),
          ...contact.map((line) => paragraph(line, { size: 9.5, after: 0.6 })),
        ].join(""),
        82,
      ),
      cell(
        [
          paragraph("BEILAGEN", {
            size: 9.5,
            bold: true,
            trackingPt: 1.6,
            align: "right",
            keepNext: true,
            after: 2,
          }),
          ...attachments.map((line) => paragraph(line, { size: 9.5, align: "right", after: 0.6 })),
        ].join(""),
        88,
      ),
    ]),
    [82, 88],
  );

  return [
    header,
    spacer(15),
    portrait,
    spacer(30),
    paragraph(kicker, { size: 10.5, bold: true, trackingPt: 2.4, after: 2, keepNext: true }),
    paragraph(data.beruf, { size: 36, bold: true, after: 6, line: 1.02, keepNext: true }),
    paragraph(fullName, { size: 15, bold: true, after: 2, keepNext: true }),
    data.lehrbeginn ? paragraph(`Lehrbeginn ${data.lehrbeginn}`, { size: 10.5, bold: true }) : "",
    spacer(46),
    bottom,
  ].join("");
}

function letterPage(document: LetterPdfDocument, images: EmbeddedImage[]) {
  const data = document.data;
  const sender = [
    data.absenderName,
    data.absenderAdresse,
    data.absenderPlzOrt,
    data.absenderTelefon,
    data.absenderEmail,
  ].filter(Boolean);
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
    ...sender.map((line, index) =>
      paragraph(line, {
        size: index === 0 ? 10.5 : 9.5,
        bold: index === 0,
        after: index === 0 ? 0.8 : 0.35,
      }),
    ),
    spacer(10),
    ...recipient.map((line) => paragraph(line, { size: 10, after: 0.35 })),
    paragraph([data.ort, data.datum].filter(Boolean).join(", "), {
      size: 9.5,
      color: MUTED,
      before: 5,
      after: 0,
    }),
    paragraph(data.betreff, { size: 12, bold: true, before: 7, after: 8, keepNext: true }),
    paragraph(data.anrede, { size: 10.5, after: 5, keepNext: true }),
    ...bodyParagraphs.map((text) => paragraph(text, { size: 10.5, after: 4.5, line: 1.46 })),
    ...flowImages.map((image, index) =>
      paragraphRuns([imageRun(image, 34, 34, 10 + index)], { align: "right", before: 2, after: 2 }),
    ),
    paragraph(data.gruss, {
      size: 10.5,
      before: normalizeLetterSpacingMm(data.grussAbstandMm, DEFAULT_LETTER_CLOSING_GAP_MM),
      after: normalizeLetterSpacingMm(data.unterschriftAbstandMm, DEFAULT_LETTER_SIGNATURE_GAP_MM),
    }),
    paragraph(data.unterschrift || data.absenderName, { size: 10.5, bold: true }),
    data.showBeilagen !== false && (data.beilagen ?? []).some((item) => item.trim())
      ? [
          paragraph("Beilagen", { size: 9.5, bold: true, before: 9, after: 1.5, keepNext: true }),
          ...(data.beilagen ?? [])
            .filter((item) => item.trim())
            .map((item) => paragraph(item, { size: 9.5, after: 0.35 })),
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
          cell(paragraph(entry.zeit, { size: 9.5, color: MUTED }), 36),
          cell(
            [
              paragraph(entry.titel, { size: 10.5, bold: true, keepNext: true }),
              entry.ort ? paragraph(entry.ort, { size: 9.5, color: MUTED, after: 0.8 }) : "",
              entry.beschreibung
                ? paragraph(entry.beschreibung, { size: 9.5, after: 4, line: 1.22 })
                : spacer(2),
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
  const title = label.toLocaleUpperCase("de-CH");
  const labelWidth = Math.min(76, Math.max(34, 17 + title.length * 1.65));
  const ruleWidth = 170 - labelWidth;
  const ruleParagraph = paragraphRuns([], {
    borderBottom: { color: RULE, size: 7 },
    after: 1.5,
  });
  return noBorderTable(
    row([
      cell(
        paragraph(title, {
          size: 10.5,
          bold: true,
          trackingPt: 0.45,
          keepNext: true,
          after: 1.5,
        }),
        labelWidth,
        { align: "center" },
      ),
      cell(ruleParagraph, ruleWidth, { align: "center" }),
    ]),
    [labelWidth, ruleWidth],
  );
}

function cvPage(document: CvPdfDocument, images: EmbeddedImage[]) {
  const data: CvData = document.data;
  const person = data.person;
  const photo = dataUrlImage(person.foto, images.length + 1);
  if (photo) images.push(photo);
  const fullName = [person.vorname, person.nachname].filter(Boolean).join(" ");
  const address = [person.adresse, person.plzOrt].filter(Boolean).join(", ");
  const direct = [person.telefon, person.email].filter(Boolean).join(" · ");
  const personal = [
    person.geburtsdatum ? `Geburtsdatum ${person.geburtsdatum}` : "",
    person.nationalitaet ? `Nationalität ${person.nationalitaet}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const hidden = data.hidden ?? {};
  const labels = data.labels ?? {};

  const header = noBorderTable(
    row([
      cell(
        [
          paragraph((data.titel || "Lebenslauf").toUpperCase(), {
            size: 10.5,
            color: MUTED,
            bold: true,
            trackingPt: 0.8,
            keepNext: true,
            after: 1.2,
          }),
          paragraph(fullName, { size: 25, bold: true, after: 1.5, keepNext: true }),
          person.untertitel ? paragraph(person.untertitel, { size: 10.5, color: MUTED }) : "",
        ].join(""),
        photo ? 132 : 170,
      ),
      ...(photo
        ? [
            cell(paragraphRuns([imageRun(photo, 30, 30, 50)], { align: "right" }), 38, {
              align: "center",
            }),
          ]
        : []),
    ]),
    photo ? [132, 38] : [170],
  );

  const content: string[] = [
    header,
    address ? paragraph(address, { size: 9.5, before: 3, after: 0.5 }) : "",
    direct ? paragraph(direct, { size: 9.5, after: 0.5 }) : "",
    personal ? paragraph(personal, { size: 9.5, color: MUTED, after: 5 }) : spacer(3),
  ];

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
              cell(paragraph(entry.name, { size: 9.5, bold: true, after: 1 }), 70),
              cell(paragraph(entry.niveau, { size: 9.5, color: MUTED, after: 1 }), 100),
            ]),
          )
          .join(""),
        [70, 100],
      ),
      spacer(2),
    );
  }
  if (!hidden.hobbys && data.hobbys.some((item) => item.trim())) {
    content.push(
      cvHeading(labels.hobbys || CV_SECTION_LABELS.hobbys),
      ...data.hobbys
        .filter((item) => item.trim())
        .map((item) => paragraph(`• ${item}`, { size: 9.5, after: 0.8 })),
      spacer(2),
    );
  }
  if (!hidden.staerken && data.staerken.some((item) => item.trim())) {
    content.push(
      cvHeading(labels.staerken || CV_SECTION_LABELS.staerken),
      ...data.staerken
        .filter((item) => item.trim())
        .map((item) => paragraph(`• ${item}`, { size: 9.5, after: 0.8 })),
      spacer(2),
    );
  }
  if (!hidden.referenzen && data.referenzen.some((entry) => entry.name.trim() || entry.kontakt.trim())) {
    content.push(cvHeading(labels.referenzen || CV_SECTION_LABELS.referenzen));
    for (const reference of data.referenzen.filter((entry) => entry.name.trim() || entry.kontakt.trim())) {
      content.push(
        paragraphRuns(
          [
            run(reference.name, { size: 9.5, bold: true }),
            reference.funktion ? run(` · ${reference.funktion}`, { size: 9.5, color: MUTED }) : "",
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

function pageBorders() {
  return `<w:pgBorders w:offsetFrom="page"><w:top w:val="single" w:sz="64" w:space="0" w:color="${INK}"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="42" w:space="0" w:color="9CA3AF"/><w:right w:val="nil"/></w:pgBorders>`;
}

function sectionProperties({
  topMm,
  bottomMm,
  bordered,
  nextPage = false,
}: {
  topMm: number;
  bottomMm: number;
  bordered: boolean;
  nextPage?: boolean;
}) {
  return `<w:sectPr>${nextPage ? '<w:type w:val="nextPage"/>' : ""}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${twips(topMm)}" w:right="${twips(20)}" w:bottom="${twips(bottomMm)}" w:left="${twips(20)}" w:header="${twips(8)}" w:footer="${twips(8)}" w:gutter="0"/>${bordered ? pageBorders() : ""}<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
}

function sectionBreak(topMm: number, bottomMm: number, bordered: boolean) {
  return `<w:p><w:pPr>${sectionProperties({ topMm, bottomMm, bordered, nextPage: true })}</w:pPr></w:p>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}" w:eastAsia="${WORD_FONT}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}"/></w:rPr></w:style></w:styles>`;
}

function fontTableXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:font w:name="${WORD_FONT}"><w:altName w:val="${WORD_FONT_FALLBACK}"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font><w:font w:name="${WORD_FONT_FALLBACK}"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>`;
}

function documentXml(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  images: EmbeddedImage[],
) {
  const body = `${coverPage(cover, images)}${sectionBreak(20, 20, false)}${letterPage(letter, images)}${sectionBreak(20, 18, true)}${cvPage(cv, images)}${sectionProperties({ topMm: 29, bottomMm: 18, bordered: true })}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`;
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
  return (
    String(cover?.template) === "brief" &&
    String(letter?.design.template) === "brief" &&
    String(cv?.design.template) === "brief"
  );
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
