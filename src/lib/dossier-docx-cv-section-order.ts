import {
  CV_SECTION_LABELS,
  customSectionForKey,
  cvSectionOrder,
  isCustomSectionKey,
  type CvData,
  type CvLayoutSectionKey,
  type CvSectionKey,
} from "@/components/cv/types";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import type { CvPdfDocument } from "@/lib/dossier-pdf-document";

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizedText(value: string) {
  return xmlDecode(value).replace(/\s+/g, " ").trim().toLocaleLowerCase("de-CH");
}

function blockText(block: string) {
  return normalizedText(
    Array.from(block.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g), (match) => match[1]).join(""),
  );
}

type XmlBlock = {
  start: number;
  end: number;
  xml: string;
};

/**
 * Read complete top-level WordprocessingML paragraphs/tables without cutting
 * nested tables at the first inner closing tag.
 */
function topLevelBlocks(xml: string): XmlBlock[] {
  const result: XmlBlock[] = [];
  let depth = 0;
  let start = -1;

  for (const match of xml.matchAll(/<\/?w:(?:p|tbl)(?:\s[^>]*|)>/g)) {
    const closing = match[0].startsWith("</");
    if (!closing) {
      if (depth === 0) start = match.index!;
      depth += 1;
      continue;
    }

    if (depth === 0) continue;
    depth -= 1;
    if (depth === 0 && start >= 0) {
      const end = match.index! + match[0].length;
      result.push({ start, end, xml: xml.slice(start, end) });
      start = -1;
    }
  }

  return result;
}

function cvDocumentStart(source: string): number | null {
  let cursor = 0;
  for (let section = 0; section < 2; section += 1) {
    const end = source.indexOf("</w:sectPr>", cursor);
    if (end < 0) return null;
    cursor = end + "</w:sectPr>".length;
  }
  return cursor;
}

function finalSectionStart(body: string) {
  const sectionStart = body.lastIndexOf("<w:sectPr");
  if (sectionStart < 0) return body.length;

  const beforeSection = body.slice(0, sectionStart);
  const paragraphMatches = Array.from(beforeSection.matchAll(/<w:p(?:\s[^>]*)?>/g));
  const paragraphStart = paragraphMatches.at(-1)?.index ?? -1;
  if (paragraphStart >= 0) {
    const paragraphEnd = body.indexOf("</w:p>", paragraphStart);
    if (paragraphEnd >= sectionStart) return paragraphStart;
  }
  return sectionStart;
}

function labelForKey(data: CvData, key: CvLayoutSectionKey): string | null {
  if (key === "person") return null;
  if (isCustomSectionKey(key)) {
    const title = customSectionForKey(data, key)?.title.trim();
    return title || null;
  }
  const standardKey = key as CvSectionKey;
  return data.labels?.[standardKey]?.trim() || CV_SECTION_LABELS[standardKey];
}

function headingQueues(data: CvData) {
  const queues = new Map<string, CvLayoutSectionKey[]>();
  for (const key of cvSectionOrder(data)) {
    const label = labelForKey(data, key);
    if (!label) continue;
    const normalized = normalizedText(label);
    const queue = queues.get(normalized) ?? [];
    queue.push(key);
    queues.set(normalized, queue);
  }
  return queues;
}

type HeadingMatch = {
  key: CvLayoutSectionKey;
  start: number;
};

/**
 * DOCX recipes historically rendered standard CV rubrics first and appended custom
 * sections afterwards. Reorder only complete rubric chunks in the third dossier
 * section so Word follows the same persisted `sectionOrder` as Web/PDF.
 */
export function applyCvSectionOrderToDocumentXml(
  source: string,
  cv: Pick<CvPdfDocument, "data">,
) {
  const start = cvDocumentStart(source);
  if (start === null) return source;

  const body = source.slice(start);
  const end = finalSectionStart(body);
  const content = body.slice(0, end);
  const suffix = body.slice(end);
  const queues = headingQueues(cv.data);
  if (!queues.size) return source;

  const matches: HeadingMatch[] = [];
  for (const block of topLevelBlocks(content)) {
    const queue = queues.get(blockText(block.xml));
    if (!queue?.length) continue;
    matches.push({ key: queue.shift()!, start: block.start });
  }
  if (matches.length < 2) return source;

  const chunks = matches.map((match, index) => ({
    key: match.key,
    xml: content.slice(match.start, matches[index + 1]?.start ?? content.length),
  }));
  const byKey = new Map(chunks.map((chunk) => [chunk.key, chunk.xml]));
  const desiredKeys = cvSectionOrder(cv.data).filter((key) => byKey.has(key));
  const originalKeys = chunks.map((chunk) => chunk.key);
  if (
    desiredKeys.length === originalKeys.length &&
    desiredKeys.every((key, index) => key === originalKeys[index])
  ) {
    return source;
  }

  const desiredSet = new Set(desiredKeys);
  const ordered = desiredKeys.map((key) => byKey.get(key) ?? "").join("");
  const unmatched = chunks
    .filter((chunk) => !desiredSet.has(chunk.key))
    .map((chunk) => chunk.xml)
    .join("");
  const prefix = content.slice(0, matches[0].start);

  return source.slice(0, start) + prefix + ordered + unmatched + suffix;
}

export async function applyCvSectionOrderToDocx(blob: Blob, cv: CvPdfDocument) {
  return transformStoredDocxDocumentXml(
    blob,
    (xml) => applyCvSectionOrderToDocumentXml(xml, cv),
    "DOCX CV-Rubrikenreihenfolge",
  );
}
