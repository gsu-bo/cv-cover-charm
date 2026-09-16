import { cvFrameFor, cvSafePageMarginMinimums } from "@/components/cv/archetype";
import { getCvLayout } from "@/components/cv/layout";
import { letterSafePageMarginMinimums } from "@/components/letter/layout-system";
import type { LetterDesign } from "@/components/letter/types";
import {
  getDossierChromeOptions,
  type DossierChromeOptions,
} from "@/lib/dossier-chrome";
import type { CvPdfDocument, LetterPdfDocument } from "@/lib/dossier-pdf-document";
import {
  clampDossierPageMarginsToMinimums,
  getDossierPageMarginsState,
  type DossierPageMargins,
  type DossierPageMarginsState,
} from "@/lib/dossier-page-margins";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { resolveTemplateChromeOptions } from "@/lib/template-chrome";

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);
const SECTION_PATTERN = /<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g;
const PAGE_MARGIN_TAG_PATTERN = /<w:pgMar\b[^>]*\/?>/;

function marginAttributes(margins: DossierPageMargins) {
  return {
    top: twips(margins.top),
    right: twips(margins.right),
    bottom: twips(margins.bottom),
    left: twips(margins.left),
  };
}

function patchTagAttribute(tag: string, name: string, amount: number) {
  const attribute = new RegExp(`\\bw:${name}=(['"])-?\\d+\\1`);
  if (attribute.test(tag)) return tag.replace(attribute, `w:${name}="${amount}"`);

  const closingLength = tag.endsWith("/>") ? 2 : 1;
  const insertionIndex = tag.length - closingLength;
  return `${tag.slice(0, insertionIndex)} w:${name}="${amount}"${tag.slice(insertionIndex)}`;
}

function patchPageMarginTag(tag: string, margins: DossierPageMargins) {
  let value = tag;
  for (const [name, amount] of Object.entries(marginAttributes(margins))) {
    value = patchTagAttribute(value, name, amount);
  }
  return value;
}

function createPageMarginTag(margins: DossierPageMargins) {
  const attrs = marginAttributes(margins);
  return `<w:pgMar w:top="${attrs.top}" w:right="${attrs.right}" w:bottom="${attrs.bottom}" w:left="${attrs.left}"/>`;
}

function patchSectionBlock(block: string, margins: DossierPageMargins) {
  if (PAGE_MARGIN_TAG_PATTERN.test(block)) {
    return block.replace(PAGE_MARGIN_TAG_PATTERN, (tag) => patchPageMarginTag(tag, margins));
  }
  return block.replace("</w:sectPr>", `${createPageMarginTag(margins)}</w:sectPr>`);
}

function patchSectionMargins(source: string, sectionIndex: number, margins: DossierPageMargins) {
  const matches = [...source.matchAll(SECTION_PATTERN)];
  const match = matches[sectionIndex];
  if (!match || match.index === undefined) return source;

  const block = match[0];
  const next = patchSectionBlock(block, margins);
  return source.slice(0, match.index) + next + source.slice(match.index + block.length);
}

function maximumMargins(...values: DossierPageMargins[]): DossierPageMargins {
  return values.reduce((result, value) => ({
    top: Math.max(result.top, value.top),
    right: Math.max(result.right, value.right),
    bottom: Math.max(result.bottom, value.bottom),
    left: Math.max(result.left, value.left),
  }));
}

function letterDesignForChrome(
  design: LetterDesign,
  chrome: DossierChromeOptions,
): LetterDesign {
  return {
    ...design,
    headerMode: chrome.headerMode,
    headerHeightMm: chrome.headerHeightMm,
    footerMode:
      chrome.footerMode === "details"
        ? "attachments"
        : chrome.footerMode === "none"
          ? "none"
          : "compact",
    footerHeightMm: chrome.footerHeightMm,
  };
}

/**
 * Resolve the margins that Word may actually receive. Stored/imported values
 * remain portable raw user intent; export clamps them again against the current
 * template, chrome and CV layout so a later template/header/layout change can
 * never make an old margin unsafe.
 */
export function resolveSafeDossierDocxPageMargins(
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
): DossierPageMarginsState {
  const state = getDossierPageMarginsState();
  const result: DossierPageMarginsState = {};

  if (state.letter) {
    const chrome = resolveTemplateChromeOptions(
      letter.design.template,
      letter.design.colors,
      getDossierChromeOptions("letter"),
    );
    const design = letterDesignForChrome(letter.design, chrome);
    const minimums = maximumMargins(
      letterSafePageMarginMinimums(letter.data, design, { pageIndex: 0, finalPage: true }),
      letterSafePageMarginMinimums(letter.data, design, { pageIndex: 1, finalPage: true }),
    );
    const safe = clampDossierPageMarginsToMinimums(state.letter, minimums);
    if (safe) result.letter = safe;
  }

  if (state.cv) {
    const chrome = resolveTemplateChromeOptions(
      cv.design.template,
      cv.design.colors,
      getDossierChromeOptions("cv"),
    );
    const frame = cvFrameFor(cv.design.template);
    const layout = cv.design.template === "terracotta" ? "modern" : getCvLayout();
    const minimums = maximumMargins(
      cvSafePageMarginMinimums(frame, 0, layout, cv.design.sidebarPct, chrome),
      cvSafePageMarginMinimums(frame, 1, layout, cv.design.sidebarPct, chrome),
    );
    const safe = clampDossierPageMarginsToMinimums(state.cv, minimums);
    if (safe) result.cv = safe;
  }

  return result;
}

/**
 * Dossier renderers place the motivation letter and CV in the final two Word
 * sections. Earlier sections belong to the cover and stay untouched. Matching
 * tolerates sectPr attributes and both compact/expanded pgMar serialization.
 */
export function patchDossierDocxPageMarginsXml(
  source: string,
  state: DossierPageMarginsState,
) {
  const sectionCount = [...source.matchAll(SECTION_PATTERN)].length;
  if (sectionCount < 3) return source;

  let xml = source;
  if (state.letter) xml = patchSectionMargins(xml, sectionCount - 2, state.letter);
  if (state.cv) xml = patchSectionMargins(xml, sectionCount - 1, state.cv);
  return xml;
}

export async function applyDossierPageMarginsToDocx(
  blob: Blob,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const state = resolveSafeDossierDocxPageMargins(letter, cv);
  if (!state.letter && !state.cv) return blob;
  return transformStoredDocxDocumentXml(
    blob,
    (documentXml) => patchDossierDocxPageMarginsXml(documentXml, state),
    "Dossier-DOCX Seitenränder",
  );
}
