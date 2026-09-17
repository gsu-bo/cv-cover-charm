import {
  CV_SECTION_LABELS,
  type CvData,
  type CvDesign,
  type CvSectionKey,
} from "@/components/cv/types";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import type { CvPdfDocument } from "@/lib/dossier-pdf-document";

const PX_TO_HALF_POINTS = 1.5;
const PX_TO_TWIPS = 15;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wordColor(value: string | undefined) {
  const normalized = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : null;
}

function sectionLabels(data: CvData) {
  const labels = (Object.keys(CV_SECTION_LABELS) as CvSectionKey[]).map(
    (key) => data.labels?.[key]?.trim() || CV_SECTION_LABELS[key],
  );
  for (const section of data.customSections ?? []) {
    const title = section.title.trim();
    if (title) labels.push(title);
  }
  return [...new Set(labels.filter(Boolean))];
}

function headingTextSet(data: CvData) {
  const result = new Set<string>();
  for (const label of sectionLabels(data)) {
    result.add(xmlEscape(label));
    result.add(xmlEscape(label.toLocaleUpperCase("de-CH")));
  }
  return result;
}

function paragraphTextXml(paragraph: string) {
  return Array.from(paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g), (match) => match[1]).join("");
}

function ensureRunProperties(run: string, mutate: (properties: string) => string) {
  const match = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (match) {
    const next = mutate(match[1]);
    return run.replace(match[0], `<w:rPr>${next}</w:rPr>`);
  }
  return run.replace(/<w:r(\s[^>]*)?>/, (open) => `${open}<w:rPr>${mutate("")}</w:rPr>`);
}

function replaceOrAppendTag(properties: string, pattern: RegExp, tag: string) {
  return pattern.test(properties) ? properties.replace(pattern, tag) : `${properties}${tag}`;
}

function setBooleanRunProperty(
  properties: string,
  tag: "b" | "bCs" | "i" | "iCs",
  value: boolean,
) {
  const pattern = new RegExp(`<w:${tag}(?:\\s[^>]*)?\\/>`, "g");
  const cleaned = properties.replace(pattern, "");
  return `${cleaned}<w:${tag}${value ? "" : ' w:val="0"'}/>`;
}

function patchRun(run: string, design: CvDesign) {
  return ensureRunProperties(run, (initial) => {
    let properties = initial;

    if (typeof design.sectionTitleFontSizePx === "number" && Number.isFinite(design.sectionTitleFontSizePx)) {
      const halfPoints = Math.max(1, Math.round(design.sectionTitleFontSizePx * PX_TO_HALF_POINTS));
      properties = replaceOrAppendTag(properties, /<w:sz\b[^>]*\/>/g, `<w:sz w:val="${halfPoints}"/>`);
      properties = replaceOrAppendTag(properties, /<w:szCs\b[^>]*\/>/g, `<w:szCs w:val="${halfPoints}"/>`);
    }

    const color = wordColor(design.sectionTitleColor);
    if (color) {
      properties = replaceOrAppendTag(properties, /<w:color\b[^>]*\/>/g, `<w:color w:val="${color}"/>`);
    }

    if (design.sectionTitleBold !== undefined) {
      properties = setBooleanRunProperty(properties, "b", design.sectionTitleBold);
      properties = setBooleanRunProperty(properties, "bCs", design.sectionTitleBold);
    }

    if (design.sectionTitleItalic !== undefined) {
      properties = setBooleanRunProperty(properties, "i", design.sectionTitleItalic);
      properties = setBooleanRunProperty(properties, "iCs", design.sectionTitleItalic);
    }

    if (design.sectionTitleUnderline !== undefined) {
      properties = properties.replace(/<w:u\b[^>]*\/>/g, "");
      properties += design.sectionTitleUnderline
        ? '<w:u w:val="single"/>'
        : '<w:u w:val="none"/>';
    }

    return properties;
  });
}

function patchParagraphSpacing(paragraph: string, px: number) {
  const after = Math.max(0, Math.round(px * PX_TO_TWIPS));
  const spacing = paragraph.match(/<w:spacing\b[^>]*\/>/);
  if (spacing) {
    const next = /w:after="\d+"/.test(spacing[0])
      ? spacing[0].replace(/w:after="\d+"/, `w:after="${after}"`)
      : spacing[0].replace("/>", ` w:after="${after}"/>`);
    return paragraph.replace(spacing[0], next);
  }
  return paragraph.replace(/<w:pPr>/, `<w:pPr><w:spacing w:after="${after}"/>`);
}

function patchParagraphBorder(paragraph: string, design: CvDesign) {
  let next = paragraph;
  if (design.headingRule === "none") {
    next = next.replace(/<w:pBdr>[\s\S]*?<\/w:pBdr>/g, "");
  }
  const color = wordColor(design.sectionTitleColor);
  if (color && design.headingRule !== "none") {
    next = next.replace(/(<w:bottom\b[^>]*\bw:color=")[^"]+("[^>]*\/>)/g, `$1${color}$2`);
  }
  return next;
}

function patchHeadingParagraph(paragraph: string, design: CvDesign) {
  let next = paragraph.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => patchRun(run, design));
  if (
    typeof design.sectionTitleMarginBottomPx === "number" &&
    Number.isFinite(design.sectionTitleMarginBottomPx)
  ) {
    next = patchParagraphSpacing(next, design.sectionTitleMarginBottomPx);
  }
  return patchParagraphBorder(next, design);
}

function patchHeadingTable(table: string, design: CvDesign) {
  let next = table;
  if (
    typeof design.sectionTitleMarginBottomPx === "number" &&
    Number.isFinite(design.sectionTitleMarginBottomPx)
  ) {
    next = next.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) =>
      patchParagraphSpacing(paragraph, design.sectionTitleMarginBottomPx!),
    );
  }
  if (design.headingRule === "none") {
    next = next.replace(/<w:pBdr>[\s\S]*?<\/w:pBdr>/g, "");
  }
  const color = wordColor(design.sectionTitleColor);
  if (color && design.headingRule !== "none") {
    next = next.replace(/(<w:bottom\b[^>]*\bw:color=")[^"]+("[^>]*\/>)/g, `$1${color}$2`);
  }
  return next;
}

function cvDocumentStart(source: string) {
  let cursor = 0;
  for (let section = 0; section < 2; section += 1) {
    const end = source.indexOf("</w:sectPr>", cursor);
    if (end < 0) return 0;
    cursor = end + "</w:sectPr>".length;
  }
  return cursor;
}

/**
 * Apply only explicit rubric-title overrides to the editable Word XML.
 * Missing fields intentionally do nothing so each DOCX recipe keeps its own
 * template defaults. The CV is the third dossier section, which also prevents
 * coincidental matching words in the motivation letter from being restyled.
 */
export function applyCvSectionTitleStyleToDocumentXml(
  source: string,
  cv: Pick<CvPdfDocument, "data" | "design">,
) {
  const headings = headingTextSet(cv.data);
  if (!headings.size) return source;

  const start = cvDocumentStart(source);
  const prefix = source.slice(0, start);
  let body = source.slice(start);

  body = body.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (table) => {
    const containsHeading = Array.from(
      table.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g),
      (match) => paragraphTextXml(match[0]),
    ).some((text) => headings.has(text));
    return containsHeading ? patchHeadingTable(table, cv.design) : table;
  });

  body = body.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) =>
    headings.has(paragraphTextXml(paragraph)) ? patchHeadingParagraph(paragraph, cv.design) : paragraph,
  );

  return prefix + body;
}

export async function applyCvSectionTitleStyleToDocx(blob: Blob, cv: CvPdfDocument) {
  return transformStoredDocxDocumentXml(
    blob,
    (xml) => applyCvSectionTitleStyleToDocumentXml(xml, cv),
    "DOCX CV-Rubriktitel",
  );
}
