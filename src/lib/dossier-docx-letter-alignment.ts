import {
  letterRichHtml,
  letterTextAlign,
  type LetterTextAlign,
} from "@/components/letter/rich-text";
import type { LetterPdfDocument } from "@/lib/dossier-pdf-document";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";

type LetterBodyParagraph = {
  text: string;
  align: LetterTextAlign;
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

function plainParagraphs(letter: LetterPdfDocument): LetterBodyParagraph[] {
  return letter.data.text
    .split(/\n\s*\n/g)
    .map((text) => normalizedText(text))
    .filter(Boolean)
    .map((text) => ({ text, align: "justify" as const }));
}

/**
 * Match the browser editor's top-level blocks to the paragraphs currently
 * produced by the DOCX renderers. Blank editor blocks delimit Word paragraphs;
 * consecutive non-empty blocks stay together, matching the existing plain-text
 * DOCX behaviour. Mixed alignment inside one generated Word paragraph falls
 * back to the letter default (Blocksatz).
 */
function richParagraphs(letter: LetterPdfDocument): LetterBodyParagraph[] {
  const fallback = plainParagraphs(letter);
  if (typeof document === "undefined" || !letter.data.richTextHtml?.trim()) return fallback;

  const template = document.createElement("template");
  template.innerHTML = letterRichHtml(letter.data.richTextHtml, letter.data.text);

  const groups: LetterBodyParagraph[] = [];
  let texts: string[] = [];
  let alignments: LetterTextAlign[] = [];

  const flush = () => {
    if (!texts.length) return;
    const first = alignments[0] ?? "justify";
    const align = alignments.every((value) => value === first) ? first : "justify";
    groups.push({ text: texts.join("\n"), align });
    texts = [];
    alignments = [];
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
    texts.push(text);
    alignments.push(letterTextAlign(child.dataset.align));
  }
  flush();

  if (groups.length !== fallback.length) return fallback;
  return fallback.map((paragraph, index) => {
    const candidate = groups[index];
    return candidate && normalizedText(candidate.text) === normalizedText(paragraph.text)
      ? candidate
      : paragraph;
  });
}

function wordAlignment(align: LetterTextAlign) {
  return align === "justify" ? "both" : align;
}

function patchParagraphAlignment(source: string, paragraph: LetterBodyParagraph) {
  const needle = `>${xmlEscape(paragraph.text)}</w:t>`;
  const textIndex = source.indexOf(needle);
  if (textIndex < 0) return source;

  const paragraphStart = source.lastIndexOf("<w:p>", textIndex);
  const propertiesStart = source.indexOf("<w:pPr>", paragraphStart);
  const propertiesEnd = source.indexOf("</w:pPr>", propertiesStart);
  if (
    paragraphStart < 0 ||
    propertiesStart < 0 ||
    propertiesEnd < 0 ||
    propertiesEnd > textIndex
  ) {
    return source;
  }

  const current = source.slice(propertiesStart + 7, propertiesEnd);
  const jc = `<w:jc w:val="${wordAlignment(paragraph.align)}"/>`;
  const next = /<w:jc w:val="[^"]+"\/>/.test(current)
    ? current.replace(/<w:jc w:val="[^"]+"\/>/, jc)
    : `${current}${jc}`;

  return source.slice(0, propertiesStart + 7) + next + source.slice(propertiesEnd);
}

/** Apply the motivation-letter alignment after every template-specific DOCX renderer. */
export async function applyLetterAlignmentToDocx(blob: Blob, letter: LetterPdfDocument) {
  const paragraphs = richParagraphs(letter);
  if (!paragraphs.length) return blob;
  return transformStoredDocxDocumentXml(
    blob,
    (documentXml) => paragraphs.reduce(patchParagraphAlignment, documentXml),
    "Dossier-DOCX Briefausrichtung",
  );
}
