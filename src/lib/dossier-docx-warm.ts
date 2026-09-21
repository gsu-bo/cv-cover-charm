import { coverAttachmentValues } from "@/components/cover/types";
import { CV_SECTION_LABELS, entryFilled, type CvData, type CvEntry } from "@/components/cv/types";
import {
  DEFAULT_LETTER_CLOSING_GAP_MM,
  DEFAULT_LETTER_SIGNATURE_GAP_MM,
  normalizeLetterSpacingMm,
} from "@/components/letter/types";
import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { downloadBlob } from "@/lib/download";

const WORD_FONT = "Cabin";
const WORD_FONT_FALLBACK = "Trebuchet MS";
const MM_TO_TWIPS = 1440 / 25.4;
const INK_FALLBACK = "0B1F24";
const PRIMARY_FALLBACK = "0F766E";
const SECONDARY_FALLBACK = "F59E0B";
const PAPER_FALLBACK = "FFF9EF";

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function wordColor(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
}

function warmPalette(colors: Record<string, string> | undefined) {
  return {
    primary: wordColor(colors?.primary, PRIMARY_FALLBACK),
    secondary: wordColor(colors?.secondary, SECONDARY_FALLBACK),
    ink: wordColor(colors?.ink, INK_FALLBACK),
    paper: wordColor(colors?.bg, PAPER_FALLBACK),
  };
}

function run(
  text: string,
  {
    size = 10.5,
    bold = false,
    italic = false,
    color = INK_FALLBACK,
    trackingPt = 0,
  }: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    trackingPt?: number;
  } = {},
) {
  const halfPoints = Math.round(size * 2);
  const spacing = trackingPt ? `<w:spacing w:val="${Math.round(trackingPt * 20)}"/>` : "";
  return `<w:r><w:rPr><w:rFonts w:ascii="${WORD_FONT}" w:hAnsi="${WORD_FONT}" w:eastAsia="${WORD_FONT}"/><w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/><w:color w:val="${color}"/>${spacing}${bold ? "<w:b/><w:bCs/>" : ""}${italic ? "<w:i/><w:iCs/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(
  text = "",
  {
    size,
    bold,
    italic,
    color,
    trackingPt,
    align = "left",
    before = 0,
    after = 0,
    line = 1.15,
    keepNext = false,
    borderBottom,
  }: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    trackingPt?: number;
    align?: "left" | "center" | "right";
    before?: number;
    after?: number;
    line?: number;
    keepNext?: boolean;
    borderBottom?: { color: string; size?: number };
  } = {},
) {
  const border = borderBottom
    ? `<w:pBdr><w:bottom w:val="single" w:sz="${borderBottom.size ?? 8}" w:space="1" w:color="${borderBottom.color}"/></w:pBdr>`
    : "";
  return `<w:p><w:pPr><w:spacing w:before="${twips(before)}" w:after="${twips(after)}" w:line="${Math.round(240 * line)}" w:lineRule="auto"/><w:jc w:val="${align}"/>${border}${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${text ? run(text, { size, bold, italic, color, trackingPt }) : "<w:r/>"}</w:p>`;
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
    ? `<w:pBdr><w:bottom w:val="single" w:sz="${borderBottom.size ?? 8}" w:space="1" w:color="${borderBottom.color}"/></w:pBdr>`
    : "";
  return `<w:p><w:pPr><w:spacing w:before="${twips(before)}" w:after="${twips(after)}" w:line="${Math.round(240 * line)}" w:lineRule="auto"/><w:jc w:val="${align}"/>${border}${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${runs.join("")}</w:p>`;
}

function spacer(mm: number) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${twips(mm)}" w:lineRule="exact"/></w:pPr><w:r><w:t></w:t></w:r></w:p>`;
}

function noBorderTable(rows: string, widthsMm: number[]) {
  const total = widthsMm.reduce((sum, width) => sum + width, 0);
  const grid = widthsMm.map((width) => `<w:gridCol w:w="${twips(width)}"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${twips(total)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

function cell(content: string, widthMm: number, paddingMm = 0) {
  const margins = paddingMm
    ? `<w:tcMar><w:top w:w="${twips(paddingMm)}" w:type="dxa"/><w:left w:w="${twips(paddingMm)}" w:type="dxa"/><w:bottom w:w="${twips(paddingMm)}" w:type="dxa"/><w:right w:w="${twips(paddingMm)}" w:type="dxa"/></w:tcMar>`
    : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${twips(widthMm)}" w:type="dxa"/><w:vAlign w:val="top"/>${margins}</w:tcPr>${content || paragraph()}</w:tc>`;
}

function row(cells: string[]) {
  return `<w:tr>${cells.join("")}</w:tr>`;
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
    rid: `rIdWarmImage${index}`,
    fileName: `warm-image-${index}.${extension}`,
    extension,
    contentType: extension === "png" ? "image/png" : "image/jpeg",
    bytes,
  };
}

function vmlStyle(x: number, y: number, w: number, h: number, z = -251658240) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${w}mm;height:${h}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function vmlRect(id: string, x: number, y: number, w: number, h: number, color: string, opacity = 1) {
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, w, h)}" fillcolor="#${color}" stroked="f"><v:fill opacity="${opacity}"/></v:rect></w:pict></w:r>`;
}

function vmlOval(id: string, x: number, y: number, w: number, h: number, color: string, opacity = 1) {
  return `<w:r><w:pict><v:oval id="${id}" style="${vmlStyle(x, y, w, h)}" fillcolor="#${color}" stroked="f"><v:fill opacity="${opacity}"/></v:oval></w:pict></w:r>`;
}

function vmlRing(id: string, x: number, y: number, w: number, h: number, color: string, opacity = 1) {
  return `<w:r><w:pict><v:oval id="${id}" style="${vmlStyle(x, y, w, h)}" filled="f" strokecolor="#${color}" strokeweight="2.25pt"><v:stroke opacity="${opacity}"/></v:oval></w:pict></w:r>`;
}

function vmlPhoto(id: string, image: EmbeddedImage, x: number, y: number, w: number, h: number, border: string) {
  return `<w:r><w:pict><v:oval id="${id}" style="${vmlStyle(x, y, w, h, 251658000)}" fillcolor="#FFFFFF" strokecolor="#${border}" strokeweight="1.5pt"><v:imagedata r:id="${image.rid}" o:title="Bewerbungsfoto"/></v:oval></w:pict></w:r>`;
}

function floatingDecorations(runs: string[]) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr>${runs.join("")}</w:p>`;
}

function initials(vorname: string, nachname: string) {
  return `${vorname.trim().charAt(0)}${nachname.trim().charAt(0)}`.toUpperCase();
}

function coverPage(document: CoverPdfDocument, images: EmbeddedImage[]) {
  const data = document.data;
  const palette = warmPalette(document.colors);
  const photo = dataUrlImage(data.foto, images.length + 1);
  if (photo) images.push(photo);
  const fullName = [data.vorname, data.nachname].filter(Boolean).join(" ");
  const placeDate = [data.ort, data.datum].filter(Boolean).join(", ");
  const contact = [data.adresse, data.plzOrt, data.telefon, data.email, data.geburtsdatum].filter(Boolean);
  const attachments = coverAttachmentValues(data).filter((value) => value.trim());
  const kicker = data.kicker || "Bewerbung um eine Lehrstelle als";
  const eyebrow = (data.eyebrow || "Bewerbung").toUpperCase();

  const decorations = [
    vmlRect("warm-cover-paper", 0, 0, 210, 297, palette.paper),
    vmlRect("warm-cover-teal", 0, 0, 210, 115, palette.primary),
    vmlOval("warm-cover-large-orb", 90, -40, 160, 160, palette.secondary, 0.9),
    vmlOval("warm-cover-small-orb", -25, 60, 80, 80, palette.secondary, 0.55),
    vmlOval("warm-cover-photo-mat", 75, 82, 60, 60, palette.paper),
    ...(photo ? [vmlPhoto("warm-cover-photo", photo, 77, 84, 56, 56, palette.primary)] : []),
  ];

  const header = noBorderTable(
    row([
      cell(paragraph(eyebrow, { size: 9.5, bold: true, color: palette.paper, trackingPt: 2.1 }), 89),
      cell(paragraph(placeDate.toUpperCase(), { size: 9.5, color: palette.paper, trackingPt: 1.4, align: "right" }), 89),
    ]),
    [89, 89],
  );

  const contactBlock = [
    paragraph((data.labelKontakt || "Kontakt").toUpperCase(), {
      size: 9.5,
      bold: true,
      color: palette.primary,
      trackingPt: 1.8,
      keepNext: true,
      after: 2,
    }),
    ...contact.map((line) => paragraph(line, { size: 9.5, color: palette.ink, after: 0.5 })),
  ].join("");
  const attachmentsBlock = [
    paragraph("BEILAGEN", {
      size: 9.5,
      bold: true,
      color: palette.primary,
      trackingPt: 1.8,
      align: "right",
      keepNext: true,
      after: 2,
    }),
    ...attachments.map((line) => paragraph(line, { size: 9.5, color: palette.ink, align: "right", after: 0.5 })),
  ].join("");

  return [
    floatingDecorations(decorations),
    header,
    spacer(62),
    photo
      ? spacer(15)
      : paragraph(initials(data.vorname, data.nachname), {
          size: 26,
          bold: true,
          color: palette.primary,
          align: "center",
          after: 10,
        }),
    paragraph(fullName, { size: 24, bold: true, color: palette.ink, align: "center", after: 2, keepNext: true }),
    paragraphRuns(
      [
        run(`${kicker} `, { size: 13, color: palette.ink }),
        run(data.beruf, { size: 13, bold: true, color: palette.primary }),
      ],
      { align: "center", after: 4, keepNext: true, line: 1.3 },
    ),
    data.lehrbeginn
      ? noBorderTable(
          row([
            cell(paragraph(), 50),
            cell(
              `<w:tc><w:tcPr><w:shd w:fill="${palette.secondary}"/><w:tcMar><w:top w:w="${twips(1.8)}" w:type="dxa"/><w:left w:w="${twips(4)}" w:type="dxa"/><w:bottom w:w="${twips(1.8)}" w:type="dxa"/><w:right w:w="${twips(4)}" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(`Lehrbeginn · ${data.lehrbeginn}`, { size: 10, bold: true, color: palette.ink, align: "center" })}</w:tc>`,
              78,
            ),
            cell(paragraph(), 50),
          ]),
          [50, 78, 50],
        )
      : "",
    spacer(48),
    noBorderTable(row([cell(contactBlock, 85), cell(attachmentsBlock, 93)]), [85, 93]),
  ].join("");
}

function letterPage(document: LetterPdfDocument) {
  const data = document.data;
  const palette = warmPalette(document.design.colors);
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
  const decorations = [
    vmlRect("warm-letter-paper", 0, 0, 210, 297, palette.paper),
    vmlRect("warm-letter-masthead", 0, 0, 210, 52, palette.primary),
    vmlRing("warm-letter-ring", 142, -41, 92, 92, palette.secondary, 0.78),
    vmlOval("warm-letter-orb", 151, -31, 72, 72, palette.secondary, 0.72),
    vmlRect("warm-letter-footer", 0, 294, 210, 3, palette.secondary),
  ];

  return [
    floatingDecorations(decorations),
    ...sender.map((line, index) =>
      paragraph(line, {
        size: index === 0 ? 11 : 9.5,
        bold: index === 0,
        color: palette.paper,
        after: index === 0 ? 1 : 0.35,
      }),
    ),
    spacer(23),
    ...recipient.map((line) => paragraph(line, { size: 10, color: palette.ink, after: 0.35 })),
    paragraph([data.ort, data.datum].filter(Boolean).join(", "), {
      size: 9.5,
      color: palette.primary,
      before: 5,
      after: 0,
    }),
    paragraph(data.betreff, { size: 12, bold: true, color: palette.ink, before: 7, after: 8, keepNext: true }),
    paragraph(data.anrede, { size: 10.5, color: palette.ink, after: 5, keepNext: true }),
    ...bodyParagraphs.map((text) => paragraph(text, { size: 10.5, color: palette.ink, after: 4.5, line: 1.48 })),
    paragraph(data.gruss, {
      size: 10.5,
      color: palette.ink,
      before: normalizeLetterSpacingMm(data.grussAbstandMm, DEFAULT_LETTER_CLOSING_GAP_MM),
      after: normalizeLetterSpacingMm(data.unterschriftAbstandMm, DEFAULT_LETTER_SIGNATURE_GAP_MM),
    }),
    paragraph(data.unterschrift || data.absenderName, { size: 10.5, bold: true, color: palette.ink }),
    data.showBeilagen !== false && (data.beilagen ?? []).some((item) => item.trim())
      ? [
          paragraph("Beilagen", { size: 9.5, bold: true, color: palette.primary, before: 8, after: 1.5, keepNext: true }),
          ...(data.beilagen ?? []).filter((item) => item.trim()).map((item) => paragraph(item, { size: 9.5, color: palette.ink, after: 0.3 })),
        ].join("")
      : "",
  ].join("");
}

function cvHeading(label: string, primary: string) {
  const title = label.toLocaleUpperCase("de-CH");
  const labelWidth = Math.min(80, Math.max(38, 18 + title.length * 1.8));
  const ruleWidth = 170 - labelWidth;
  return noBorderTable(
    row([
      cell(paragraph(title, { size: 10.5, bold: true, color: primary, trackingPt: 0.5, keepNext: true, after: 1.2 }), labelWidth),
      cell(paragraph("", { borderBottom: { color: primary, size: 8 }, after: 1.2 }), ruleWidth),
    ]),
    [labelWidth, ruleWidth],
  );
}

function entryTable(entries: CvEntry[], ink: string, primary: string) {
  const filled = entries.filter(entryFilled);
  if (!filled.length) return "";
  return noBorderTable(
    filled
      .map((entry) =>
        row([
          cell(paragraph(entry.zeit, { size: 9.5, color: primary }), 38),
          cell(
            [
              paragraph(entry.titel, { size: 10.5, bold: true, color: ink, keepNext: true }),
              entry.ort ? paragraph(entry.ort, { size: 9.5, color: primary, after: 0.8 }) : "",
              entry.beschreibung ? paragraph(entry.beschreibung, { size: 9.5, color: ink, after: 4, line: 1.22 }) : spacer(2),
            ].join(""),
            132,
          ),
        ]),
      )
      .join(""),
    [38, 132],
  );
}

function cvPage(document: CvPdfDocument, images: EmbeddedImage[]) {
  const data: CvData = document.data;
  const palette = warmPalette(document.design.colors);
  const person = data.person;
  const photo = dataUrlImage(person.foto, images.length + 1);
  if (photo) images.push(photo);
  const fullName = [person.vorname, person.nachname].filter(Boolean).join(" ");
  const address = [person.adresse, person.plzOrt].filter(Boolean).join(", ");
  const direct = [person.telefon, person.email].filter(Boolean).join(" · ");
  const personal = [
    person.geburtsdatum ? `Geburtsdatum ${person.geburtsdatum}` : "",
    person.geburtsort ? `Geburtsort ${person.geburtsort}` : "",
    person.heimatort ? `Heimatort ${person.heimatort}` : "",
    person.nationalitaet ? `Nationalität ${person.nationalitaet}` : "",
  ].filter(Boolean).join(" · ");
  const labels = data.labels ?? {};
  const hidden = data.hidden ?? {};
  const decorations = [
    vmlRect("warm-cv-paper", 0, 0, 210, 297, palette.paper),
    vmlRect("warm-cv-top-band", 0, 0, 210, 14, palette.primary),
    vmlRect("warm-cv-bottom-band", 0, 294, 210, 3, palette.secondary),
    vmlOval("warm-cv-orb", 164, -22, 58, 58, palette.secondary, 0.18),
    ...(photo ? [vmlPhoto("warm-cv-photo", photo, 160, 24, 30, 30, palette.primary)] : []),
  ];

  const content: string[] = [
    floatingDecorations(decorations),
    paragraph((data.titel || "Lebenslauf").toUpperCase(), {
      size: 9.5,
      bold: true,
      color: palette.primary,
      trackingPt: 1.2,
      keepNext: true,
      after: 1.2,
    }),
    paragraph(fullName, { size: 25, bold: true, color: palette.ink, after: 1.2, keepNext: true }),
    person.untertitel ? paragraph(person.untertitel, { size: 10.5, color: palette.primary, after: 3 }) : "",
    address ? paragraph(address, { size: 9.5, color: palette.ink, after: 0.4 }) : "",
    direct ? paragraph(direct, { size: 9.5, color: palette.ink, after: 0.4 }) : "",
    personal ? paragraph(personal, { size: 9.5, color: palette.primary, after: 5 }) : spacer(3),
  ];

  if (!hidden.schule && data.schule.some(entryFilled)) {
    content.push(cvHeading(labels.schule || CV_SECTION_LABELS.schule, palette.primary), entryTable(data.schule, palette.ink, palette.primary));
  }
  if (!hidden.erfahrung && data.erfahrung.some(entryFilled)) {
    content.push(cvHeading(labels.erfahrung || CV_SECTION_LABELS.erfahrung, palette.primary), entryTable(data.erfahrung, palette.ink, palette.primary));
  }
  if (!hidden.sprachen && data.sprachen.some((entry) => entry.name.trim() || entry.niveau.trim())) {
    content.push(
      cvHeading(labels.sprachen || CV_SECTION_LABELS.sprachen, palette.primary),
      noBorderTable(
        data.sprachen
          .filter((entry) => entry.name.trim() || entry.niveau.trim())
          .map((entry) => row([
            cell(paragraph(entry.name, { size: 9.5, bold: true, color: palette.ink, after: 1 }), 70),
            cell(paragraph(entry.niveau, { size: 9.5, color: palette.primary, after: 1 }), 100),
          ]))
          .join(""),
        [70, 100],
      ),
      spacer(2),
    );
  }
  if (!hidden.hobbys && data.hobbys.some((item) => item.trim())) {
    content.push(
      cvHeading(labels.hobbys || CV_SECTION_LABELS.hobbys, palette.primary),
      ...data.hobbys.filter((item) => item.trim()).map((item) => paragraph(`• ${item}`, { size: 9.5, color: palette.ink, after: 0.7 })),
      spacer(2),
    );
  }
  if (!hidden.staerken && data.staerken.some((item) => item.trim())) {
    content.push(
      cvHeading(labels.staerken || CV_SECTION_LABELS.staerken, palette.primary),
      ...data.staerken.filter((item) => item.trim()).map((item) => paragraph(`• ${item}`, { size: 9.5, color: palette.ink, after: 0.7 })),
      spacer(2),
    );
  }
  if (!hidden.referenzen && data.referenzen.some((entry) => entry.name.trim() || entry.kontakt.trim())) {
    content.push(cvHeading(labels.referenzen || CV_SECTION_LABELS.referenzen, palette.primary));
    for (const reference of data.referenzen.filter((entry) => entry.name.trim() || entry.kontakt.trim())) {
      content.push(paragraphRuns([
        run(reference.name, { size: 9.5, bold: true, color: palette.ink }),
        reference.funktion ? run(` · ${reference.funktion}`, { size: 9.5, color: palette.primary }) : "",
      ], { after: 0.5 }));
      for (const line of [reference.kontakt, reference.email, reference.zusatz].filter(Boolean) as string[]) {
        content.push(paragraph(line, { size: 9.5, color: palette.ink, after: 0.5 }));
      }
    }
  }
  for (const section of data.customSections ?? []) {
    if (!section.title.trim() && !section.entries.some(entryFilled)) continue;
    content.push(cvHeading(section.title || "Weitere Angaben", palette.primary), entryTable(section.entries, palette.ink, palette.primary));
  }

  return content.join("");
}

function sectionProperties({
  topMm,
  rightMm,
  bottomMm,
  leftMm,
  nextPage = false,
}: {
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
  nextPage?: boolean;
}) {
  return `<w:sectPr>${nextPage ? '<w:type w:val="nextPage"/>' : ""}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${twips(topMm)}" w:right="${twips(rightMm)}" w:bottom="${twips(bottomMm)}" w:left="${twips(leftMm)}" w:header="${twips(8)}" w:footer="${twips(8)}" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
}

function sectionBreak(topMm: number, rightMm: number, bottomMm: number, leftMm: number) {
  return `<w:p><w:pPr>${sectionProperties({ topMm, rightMm, bottomMm, leftMm, nextPage: true })}</w:pPr></w:p>`;
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
  const body = `${coverPage(cover, images)}${sectionBreak(14, 16, 16, 16)}${letterPage(letter)}${sectionBreak(14, 22, 18, 24)}${cvPage(cv, images)}${sectionProperties({ topMm: 24, rightMm: 20, bottomMm: 18, leftMm: 20 })}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><w:body>${body}</w:body></w:document>`;
}

function relationshipsXml(images: EmbeddedImage[]) {
  const imageRels = images.map((image) => `<Relationship Id="${image.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${image.fileName}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFonts" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${imageRels}</Relationships>`;
}

function contentTypesXml(images: EmbeddedImage[]) {
  const defaults = new Map<string, string>([
    ["rels", "application/vnd.openxmlformats-package.relationships+xml"],
    ["xml", "application/xml"],
  ]);
  for (const image of images) defaults.set(image.extension, image.contentType);
  const defaultXml = [...defaults.entries()].map(([extension, type]) => `<Default Extension="${extension}" ContentType="${type}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaultXml}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>`;
const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>CV Cover Charm</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>1.0</AppVersion></Properties>`;

function coreXml(author: string) {
  const created = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Bewerbungsdossier – Warm</dc:title><dc:subject>Lehrstellenbewerbung</dc:subject><dc:creator>${xmlEscape(author)}</dc:creator><cp:lastModifiedBy>CV Cover Charm</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
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

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  writeU32(end, 0, 0x06054b50);
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, centralDirectory.length);
  writeU32(end, 16, localOffset);
  return concat([...localParts, centralDirectory, end]);
}

export function warmDossierDocxSupported(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  return (
    String(cover?.template) === "freundlich" &&
    String(letter?.design.template) === "freundlich" &&
    String(cv?.design.template) === "freundlich"
  );
}

export function createWarmDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
): Blob {
  if (!warmDossierDocxSupported(cover, letter, cv)) {
    throw new Error("Der DOCX-Referenzexport Warm benötigt die Vorlage Warm in allen drei Dossierteilen.");
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

export function downloadWarmDossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(createWarmDossierDocxBlob(cover, letter, cv), fileName);
}
