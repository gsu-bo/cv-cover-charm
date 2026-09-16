import {
  letterRichHtml,
  letterTextAlign,
  type LetterTextAlign,
} from "@/components/letter/rich-text";
import type { LetterPdfDocument } from "@/lib/dossier-pdf-document";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";

type LetterBodyBlock = {
  text: string;
  align: LetterTextAlign;
};

export type LetterParagraphGroup = {
  sourceText: string;
  blocks: LetterBodyBlock[];
};

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function normalizedText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\r/g, "").trim();
}

function plainParagraphGroups(letter: LetterPdfDocument): LetterParagraphGroup[] {
  return letter.data.text
    .split(/\n\s*\n/g)
    .map((text) => normalizedText(text))
    .filter(Boolean)
    .map((text) => ({
      sourceText: text,
      blocks: [{ text, align: "justify" as const }],
    }));
}

/**
 * Match the browser editor's top-level blocks to the paragraphs emitted by the
 * DOCX renderers. Blank editor blocks delimit Word paragraph groups. Inside one
 * group, each editor block stays available so different alignments can become
 * separate Word paragraphs instead of collapsing to one fallback alignment.
 */
function richParagraphGroups(letter: LetterPdfDocument): LetterParagraphGroup[] {
  const fallback = plainParagraphGroups(letter);
  if (typeof document === "undefined" || !letter.data.richTextHtml?.trim()) return fallback;

  const template = document.createElement("template");
  template.innerHTML = letterRichHtml(letter.data.richTextHtml, letter.data.text);

  const groups: LetterParagraphGroup[] = [];
  let blocks: LetterBodyBlock[] = [];

  const flush = () => {
    if (!blocks.length) return;
    groups.push({
      sourceText: blocks.map((block) => block.text).join("\n"),
      blocks,
    });
    blocks = [];
  };

  for (const child of Array.from(template.content.children)) {
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.tagName.toLowerCase();
    if (tag !== "div" && tag !== "p") continue;
    const text = normalizedText(child.innerText || child.textContent || "");
    if (!text) {
      flush();
      continue;
    }
    blocks.push({ text, align: letterTextAlign(child.dataset.align) });
  }
  flush();

  if (groups.length !== fallback.length) return fallback;
  return fallback.map((paragraph, index) => {
    const candidate = groups[index];
    return candidate &&
      normalizedText(candidate.sourceText) === normalizedText(paragraph.sourceText)
      ? candidate
      : paragraph;
  });
}

function wordAlignment(align: LetterTextAlign) {
  return align === "justify" ? "both" : align;
}

function withAlignment(paragraph: string, align: LetterTextAlign) {
  const jc = `<w:jc w:val="${wordAlignment(align)}"/>`;
  if (/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/.test(paragraph)) {
    return paragraph.replace(/<w:pPr(?:\s[^>]*)?>([\s\S]*?)<\/w:pPr>/, (all, inner: string) => {
      const next = /<w:jc\b[^>]*\/>/.test(inner)
        ? inner.replace(/<w:jc\b[^>]*\/>/, jc)
        : `${inner}${jc}`;
      return all.replace(inner, next);
    });
  }
  return paragraph.replace(/<w:p(?:\s[^>]*)?>/, (open) => `${open}<w:pPr>${jc}</w:pPr>`);
}

function withSplitSpacing(paragraph: string, index: number, lastIndex: number) {
  return paragraph.replace(/<w:spacing\b([^>]*)\/>/, (_all, attrs: string) => {
    let next = attrs;
    if (index > 0) {
      next = /w:before="[^"]*"/.test(next)
        ? next.replace(/w:before="[^"]*"/, 'w:before="0"')
        : `${next} w:before="0"`;
    }
    if (index < lastIndex) {
      next = /w:after="[^"]*"/.test(next)
        ? next.replace(/w:after="[^"]*"/, 'w:after="0"')
        : `${next} w:after="0"`;
    }
    return `<w:spacing${next}/>`;
  });
}

function paragraphStartBefore(source: string, index: number) {
  let start = source.lastIndexOf("<w:p", index);
  while (start >= 0) {
    const openEnd = source.indexOf(">", start);
    if (openEnd >= 0 && /^<w:p(?:\s[^>]*)?>$/.test(source.slice(start, openEnd + 1))) {
      return start;
    }
    start = source.lastIndexOf("<w:p", start - 1);
  }
  return -1;
}

function paragraphBounds(source: string, text: string) {
  const needle = `>${xmlEscape(text)}</w:t>`;
  const textIndex = source.indexOf(needle);
  if (textIndex < 0) return null;
  const start = paragraphStartBefore(source, textIndex);
  const end = source.indexOf("</w:p>", textIndex);
  if (start < 0 || end < 0) return null;
  return { start, end: end + 6 };
}

function replaceParagraphText(paragraph: string, sourceText: string, nextText: string) {
  const sourceNeedle = `>${xmlEscape(sourceText)}</w:t>`;
  const nextNeedle = `>${xmlEscape(nextText)}</w:t>`;
  return paragraph.replace(sourceNeedle, nextNeedle);
}

function patchParagraphGroup(source: string, group: LetterParagraphGroup) {
  const bounds = paragraphBounds(source, group.sourceText);
  if (!bounds) return source;
  const paragraph = source.slice(bounds.start, bounds.end);
  const alignments = Array.from(new Set(group.blocks.map((block) => block.align)));

  if (group.blocks.length === 1 || alignments.length === 1) {
    return (
      source.slice(0, bounds.start) +
      withAlignment(paragraph, alignments[0] ?? "justify") +
      source.slice(bounds.end)
    );
  }

  const lastIndex = group.blocks.length - 1;
  const replacement = group.blocks
    .map((block, index) => {
      let next = replaceParagraphText(paragraph, group.sourceText, block.text);
      next = withSplitSpacing(next, index, lastIndex);
      return withAlignment(next, block.align);
    })
    .join("");

  return source.slice(0, bounds.start) + replacement + source.slice(bounds.end);
}

function letterSectionBounds(source: string) {
  const firstSection = source.indexOf("<w:sectPr>");
  if (firstSection < 0) return null;
  const firstSectionEnd = source.indexOf("</w:sectPr>", firstSection);
  if (firstSectionEnd < 0) return null;
  const start = firstSectionEnd + "</w:sectPr>".length;
  const secondSection = source.indexOf("<w:sectPr>", start);
  if (secondSection < 0) return null;
  return { start, end: secondSection };
}

export function patchLetterAlignmentGroups(
  source: string,
  groups: LetterParagraphGroup[],
) {
  if (!groups.length) return source;
  const bounds = letterSectionBounds(source);
  if (!bounds) return groups.reduce(patchParagraphGroup, source);

  let letterXml = source.slice(bounds.start, bounds.end);
  letterXml = groups.reduce(patchParagraphGroup, letterXml);
  return source.slice(0, bounds.start) + letterXml + source.slice(bounds.end);
}

/** Apply the motivation-letter alignment after every template-specific DOCX renderer. */
export async function applyLetterAlignmentToDocx(blob: Blob, letter: LetterPdfDocument) {
  const groups = richParagraphGroups(letter);
  if (!groups.length) return blob;
  return transformStoredDocxDocumentXml(
    blob,
    (documentXml) => patchLetterAlignmentGroups(documentXml, groups),
    "Dossier-DOCX Briefausrichtung",
  );
}

export const dossierDocxLetterAlignmentInternals = {
  wordAlignment,
  patchParagraphGroup,
  patchLetterAlignmentGroups,
};
