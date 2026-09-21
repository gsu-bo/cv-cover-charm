import { cvFrameFor, sidebarWidthMm } from "@/components/cv/archetype";
import { CV_SECTION_LABELS, type CvPlacements } from "@/components/cv/types";
import type { CvPdfDocument } from "@/lib/dossier-pdf-document";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { cvPersonalInfoLines } from "@/lib/cv-personal-info";

const twips = (mm: number) => Math.round((mm * 1440) / 25.4);
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (xml: string) =>
  [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("");

/** Read complete top-level paragraphs and tables, retaining nested tables. */
function blocks(xml: string) {
  let depth = 0,
    start = 0;
  const result: { start: number; end: number; xml: string }[] = [];
  for (const match of xml.matchAll(/<\/?w:(?:p|tbl)(?:\s[^>]*|)>/g)) {
    if (!match[0].startsWith("</")) {
      if (depth++ === 0) start = match.index!;
    } else if (depth > 0 && --depth === 0) {
      const end = match.index! + match[0].length;
      result.push({ start, end, xml: xml.slice(start, end) });
    }
  }
  return result;
}

/** Scale fixed table grids proportionally; leave text and automatic widths intact. */
export function fitDocxTablesToSection(source: string, availableTwips: number) {
  let cursor = 0,
    result = "";
  for (const block of blocks(source)) {
    let content = block.xml;
    if (content.startsWith("<w:tbl")) {
      const grid = content.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? "";
      const width = [...grid.matchAll(/w:w="(\d+)"/g)].reduce(
        (sum, item) => sum + Number(item[1]),
        0,
      );
      const ratio = width > availableTwips ? availableTwips / width : 1;
      if (ratio < 1)
        content = content.replace(/<w:(?:gridCol|tcW|tblW)\b[^>]*\/>/g, (tag) =>
          /w:type="(?:auto|pct)"/.test(tag)
            ? tag
            : tag.replace(
                /w:w="(\d+)"/,
                (_m, value) => `w:w="${Math.round(Number(value) * ratio)}"`,
              ),
        );
    }
    result += source.slice(cursor, block.start) + content;
    cursor = block.end;
  }
  return result + source.slice(cursor);
}

/** Reuse recipe blocks in two content columns without replacing template artwork. */
export function applyDocxSidebarXml(
  xml: string,
  document: CvPdfDocument,
  placements: CvPlacements,
) {
  const sections = [...xml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)];
  if (sections.length !== 3) throw new Error("Sidebar requires a three-section dossier");
  const section = sections[2];
  const start = sections[1].index! + sections[1][0].length;
  const source = xml.slice(start, section.index);
  const parts = blocks(source);
  if (!parts.length) return xml;
  const main: string[] = [],
    side: string[] = [],
    artwork: string[] = [];
  const headings = new Map<string, "main" | "side">();
  for (const key of [
    "schule",
    "erfahrung",
    "sprachen",
    "hobbys",
    "staerken",
    "referenzen",
  ] as const)
    headings.set(
      escape((document.data.labels?.[key] || CV_SECTION_LABELS[key]).toLocaleUpperCase("de-CH")),
      placements[key],
    );
  for (const custom of document.data.customSections ?? [])
    headings.set(escape((custom.title || "Weitere Angaben").toLocaleUpperCase("de-CH")), "main");
  const person = document.data.person;
  const contact = new Set(
    [
      [person.adresse, person.plzOrt].filter(Boolean).join(", "),
      [person.telefon, person.email].filter(Boolean).join(" · "),
      cvPersonalInfoLines(person, document.design).join(" · "),
    ]
      .filter(Boolean)
      .map(escape),
  );
  let destination: "main" | "side" = "main";
  for (const block of parts) {
    const value = text(block.xml);
    if (/<w:pict\b/.test(block.xml) && !value) {
      artwork.push(block.xml);
      continue;
    }
    const heading = headings.get(value);
    if (heading) destination = heading;
    const target = contact.has(value) ? placements.kontakt : destination;
    // Recipe headings use a label cell plus a decorative rule cell. In a
    // narrow column keep the editable heading paragraph at full column width.
    const content = heading
      ? [...block.xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
          .map((match) => match[0])
          .filter((value) => text(value))
          .join("")
      : block.xml;
    (target === "side" ? side : main).push(content);
  }
  const frame = cvFrameFor(document.design.template);
  const rail = sidebarWidthMm(frame, "modern", document.design.sidebarPct);
  const marginTag = section[0].match(/<w:pgMar\b[^>]*>/)?.[0] ?? "";
  const originalLeft = (Number(marginTag.match(/w:left="(\d+)"/)?.[1] ?? twips(20)) * 25.4) / 1440;
  const right = (Number(marginTag.match(/w:right="(\d+)"/)?.[1] ?? twips(20)) * 25.4) / 1440;
  const left = 10,
    sideGap = 10,
    mainGap = Math.max(10, originalLeft - rail);
  const sideWidth = rail - left,
    mainWidth = 210 - rail - right;
  const background = document.design.colors.primary ?? document.design.colors.accent ?? "#111111";
  const rgb = /^#[0-9a-f]{6}$/i.test(background)
    ? [1, 3, 5].map((offset) => parseInt(background.slice(offset, offset + 2), 16))
    : [17, 17, 17];
  const lightInk =
    frame.id === "column" && rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 148;
  const sideContent = fitDocxTablesToSection(side.join(""), twips(sideWidth - sideGap)).replace(
    /<w:color w:val="[^"]+"\/>/g,
    `<w:color w:val="${lightInk ? "FFFFFF" : "111111"}"/>`,
  );
  const mainContent = fitDocxTablesToSection(main.join(""), twips(mainWidth - mainGap));
  const sideFill = /^#[0-9a-f]{6}$/i.test(background)
    ? background.slice(1).toUpperCase()
    : "111111";
  const cell = (content: string, width: number, paddingSide: "left" | "right", gap: number) =>
    `<w:tc><w:tcPr>${paddingSide === "right" && frame.id === "column" ? `<w:shd w:val="clear" w:fill="${sideFill}"/>` : ""}<w:tcW w:w="${twips(width)}" w:type="dxa"/><w:tcMar><w:${paddingSide} w:w="${twips(gap)}" w:type="dxa"/></w:tcMar><w:vAlign w:val="top"/></w:tcPr>${content}<w:p/></w:tc>`;
  const table = `<w:tbl><w:tblPr><w:tblW w:w="${twips(sideWidth + mainWidth)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((edge) => `<w:${edge} w:val="nil"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${twips(sideWidth)}"/><w:gridCol w:w="${twips(mainWidth)}"/></w:tblGrid><w:tr>${cell(sideContent, sideWidth, "right", sideGap)}${cell(mainContent, mainWidth, "left", mainGap)}</w:tr></w:tbl>`;
  const properties = section[0].replace(/w:left="\d+"/, `w:left="${twips(left)}"`);
  const content =
    source.slice(0, parts[0].start) + artwork.join("") + table + source.slice(parts.at(-1)!.end);
  return xml.slice(0, start) + content + properties + xml.slice(section.index! + section[0].length);
}
export async function applyDossierDocxSidebar(
  blob: Blob,
  document: CvPdfDocument,
  placements: CvPlacements,
) {
  return transformStoredDocxDocumentXml(
    blob,
    (xml) => applyDocxSidebarXml(xml, document, placements),
    "Dossier CV sidebar",
  );
}
