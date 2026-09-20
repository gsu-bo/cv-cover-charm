import {
  getDossierFieldTypographyEntries,
  normalizeDossierFieldText,
  type DossierFieldTypographyEntry,
  type DossierFieldTypographyStyle,
} from "@/lib/dossier-field-typography";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizedText(value: string) {
  return normalizeDossierFieldText(xmlDecode(value)).toLocaleLowerCase("de-CH");
}

function visibleText(xml: string) {
  return normalizedText(
    Array.from(xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g), (match) => match[1]).join(""),
  );
}

function replaceToggleProperty(properties: string, tag: "b" | "i", value: boolean) {
  const expression = new RegExp(`<w:${tag}\\b[^>]*/>`, "g");
  const replacement = value ? `<w:${tag}/>` : `<w:${tag} w:val="0"/>`;
  return expression.test(properties)
    ? properties.replace(expression, replacement)
    : `${properties}${replacement}`;
}

function replaceUnderlineProperty(properties: string, value: boolean) {
  const replacement = `<w:u w:val="${value ? "single" : "none"}"/>`;
  return /<w:u\b[^>]*\/>/.test(properties)
    ? properties.replace(/<w:u\b[^>]*\/>/g, replacement)
    : `${properties}${replacement}`;
}

function ensureRunTypography(run: string, style: DossierFieldTypographyStyle) {
  const properties = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  let next = properties?.[1] ?? "";
  if (typeof style.bold === "boolean") next = replaceToggleProperty(next, "b", style.bold);
  if (typeof style.italic === "boolean") next = replaceToggleProperty(next, "i", style.italic);
  if (typeof style.underline === "boolean") next = replaceUnderlineProperty(next, style.underline);

  if (properties) return run.replace(properties[0], `<w:rPr>${next}</w:rPr>`);
  return run.replace(/<w:r(\s[^>]*)?>/, (open) => `${open}<w:rPr>${next}</w:rPr>`);
}

function legacyPatchRuns(source: string, entries: DossierFieldTypographyEntry[]) {
  if (!entries.length) return source;
  const targets = entries
    .map((entry) => ({ ...entry, target: normalizedText(entry.value) }))
    .filter((entry) => entry.target.length > 0);
  if (!targets.length) return source;

  return source.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => {
    const text = visibleText(run);
    if (!text) return run;
    let patched = run;
    for (const entry of targets) {
      const matches =
        text === entry.target ||
        (entry.target.length >= 2 && text.includes(entry.target)) ||
        (text.length >= 2 && entry.target.includes(text));
      if (matches) patched = ensureRunTypography(patched, entry.style);
    }
    return patched;
  });
}

type Paragraph = {
  start: number;
  end: number;
  xml: string;
  text: string;
};

function paragraphs(source: string): Paragraph[] {
  return Array.from(source.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g))
    .filter((match) => match.index !== undefined)
    .map((match) => ({
      start: match.index!,
      end: match.index! + match[0].length,
      xml: match[0],
      text: visibleText(match[0]),
    }));
}

function patchParagraphRuns(
  paragraph: string,
  target: string,
  style: DossierFieldTypographyStyle,
) {
  return paragraph.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => {
    const text = visibleText(run);
    if (!text) return run;
    const overlaps =
      text === target ||
      (target.length >= 2 && text.includes(target)) ||
      (text.length >= 2 && target.includes(text));
    return overlaps ? ensureRunTypography(run, style) : run;
  });
}

function contextualParagraphScore(
  list: Paragraph[],
  index: number,
  entry: DossierFieldTypographyEntry,
) {
  const contextValues = (entry.contextValues ?? [])
    .map((value) => normalizedText(value))
    .filter((value) => value.length >= 2);
  if (!contextValues.length) return 0;

  let score = 0;
  for (const value of contextValues) {
    // Editor groups normally serialize top-to-bottom. Prefer context that
    // precedes the target, but still accept following values as evidence.
    for (let distance = 1; distance <= 3; distance += 1) {
      const previous = list[index - distance]?.text ?? "";
      const following = list[index + distance]?.text ?? "";
      if (previous.includes(value)) score += 8 - distance;
      if (following.includes(value)) score += 4 - distance;
    }
  }
  return score;
}

function stablePatchEntry(source: string, entry: DossierFieldTypographyEntry) {
  const target = normalizedText(entry.value);
  if (!target) return source;

  const list = paragraphs(source);
  const exact = list
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph }) => paragraph.text === target);
  const candidates =
    exact.length > 0
      ? exact
      : list
          .map((paragraph, index) => ({ paragraph, index }))
          .filter(
            ({ paragraph }) =>
              target.length >= 2 &&
              (paragraph.text.includes(target) || target.includes(paragraph.text)),
          );
  if (!candidates.length) return source;

  let pool = candidates;
  if (entry.contextValues?.length) {
    const scored = candidates.map((candidate) => ({
      ...candidate,
      score: contextualParagraphScore(list, candidate.index, entry),
    }));
    const max = Math.max(...scored.map(({ score }) => score));
    if (max > 0) {
      pool = scored
        .filter(({ score }) => score === max)
        .map(({ paragraph, index }) => ({ paragraph, index }));
    }
  }

  const occurrence =
    typeof entry.docxOccurrence === "number" && entry.docxOccurrence >= 0
      ? entry.docxOccurrence
      : 0;
  const selected = pool[Math.min(occurrence, pool.length - 1)]?.paragraph;
  if (!selected) return source;

  const replacement = patchParagraphRuns(selected.xml, target, entry.style);
  return source.slice(0, selected.start) + replacement + source.slice(selected.end);
}

function hasStableIdentity(entry: DossierFieldTypographyEntry) {
  return (
    !!entry.fieldId ||
    !!entry.contextValues?.length ||
    typeof entry.docxOccurrence === "number"
  );
}

function patchRuns(source: string, entries: DossierFieldTypographyEntry[]) {
  if (!entries.length) return source;

  const legacy = entries.filter((entry) => !hasStableIdentity(entry));
  const stable = entries.filter(hasStableIdentity);

  let next = legacyPatchRuns(source, legacy);
  for (const entry of stable) next = stablePatchEntry(next, entry);
  return next;
}

type SectionBounds = { start: number; end: number };

function bodyStart(source: string) {
  const body = /<w:body(?:\s[^>]*)?>/.exec(source);
  return body?.index === undefined ? null : body.index + body[0].length;
}

function enclosingParagraph(source: string, index: number) {
  const before = source.slice(0, index);
  const paragraphStarts = [...before.matchAll(/<w:p(?:\s[^>]*)?>/g)];
  const start = paragraphStarts.at(-1)?.index ?? -1;
  const endTag = source.indexOf("</w:p>", index);
  if (start < 0 || endTag < 0) return null;
  return { start, end: endTag + "</w:p>".length };
}

function dossierSections(source: string): [SectionBounds, SectionBounds, SectionBounds] | null {
  const start = bodyStart(source);
  if (start === null) return null;
  const sectionProperties = [...source.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)];
  if (sectionProperties.length < 2) return null;
  const firstIndex = sectionProperties[0].index;
  const secondIndex = sectionProperties[1].index;
  if (firstIndex === undefined || secondIndex === undefined) return null;
  const firstBreak = enclosingParagraph(source, firstIndex);
  const secondBreak = enclosingParagraph(source, secondIndex);
  if (!firstBreak || !secondBreak) return null;
  const finalSectionIndex = sectionProperties.at(-1)?.index ?? source.length;
  return [
    { start, end: firstBreak.start },
    { start: firstBreak.end, end: secondBreak.start },
    { start: secondBreak.end, end: finalSectionIndex },
  ];
}

export function applyDossierFieldTypographyToDocumentXml(
  source: string,
  letterEntries: DossierFieldTypographyEntry[],
  cvEntries: DossierFieldTypographyEntry[],
) {
  if (!letterEntries.length && !cvEntries.length) return source;
  const bounds = dossierSections(source);
  if (!bounds) return source;

  let next = source;
  // Patch the later section first so offsets for the earlier section stay valid.
  for (const [index, entries] of [
    [2, cvEntries],
    [1, letterEntries],
  ] as const) {
    if (!entries.length) continue;
    const range = bounds[index];
    next =
      next.slice(0, range.start) +
      patchRuns(next.slice(range.start, range.end), entries) +
      next.slice(range.end);
  }
  return next;
}

export async function applyDossierFieldTypographyToDocx(blob: Blob) {
  const letterEntries = getDossierFieldTypographyEntries("letter");
  const cvEntries = getDossierFieldTypographyEntries("cv");
  if (!letterEntries.length && !cvEntries.length) return blob;
  return transformStoredDocxDocumentXml(
    blob,
    (xml) => applyDossierFieldTypographyToDocumentXml(xml, letterEntries, cvEntries),
    "DOCX Feldformatierung",
  );
}
