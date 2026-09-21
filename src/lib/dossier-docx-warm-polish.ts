import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { downloadBlob } from "@/lib/download";
import {
  createWarmDossierDocxBlob,
  warmDossierDocxSupported,
} from "@/lib/dossier-docx-warm";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";

export { warmDossierDocxSupported };

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function wordColor(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
}

function replaceFirst(source: string, search: string, replacement: string) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error("Warm DOCX polish target missing.");
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceFirstAfter(source: string, anchor: string, search: string, replacement: string) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`Warm DOCX polish anchor missing: ${anchor}`);
  const index = source.indexOf(search, anchorIndex);
  if (index < 0) throw new Error(`Warm DOCX polish target missing after ${anchor}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function reclaimWarmCvPaginationSlack(source: string) {
  const sections = [...source.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)];
  const cvSection = sections.at(-1);
  if (!cvSection || cvSection.index === undefined) return source;

  const sectionStart = cvSection.index;
  const section = cvSection[0];
  const topMargin = section.match(/w:top="(\d+)"/);
  if (!topMargin) return source;

  // The intentional 32 mm contact masthead leaves Warm exactly on a
  // LibreOffice pagination boundary. Keep the masthead unchanged and reclaim
  // only 0.35 mm of the body safety gap in the final (CV) section so the last
  // reference phone number remains on page three.
  const compactTop = Math.max(0, Number(topMargin[1]) - twips(0.35));
  const compactSection = section.replace(topMargin[0], `w:top="${compactTop}"`);
  return source.slice(0, sectionStart) + compactSection + source.slice(sectionStart + section.length);
}

function polishDocumentXml(source: string, cover: CoverPdfDocument) {
  const primary = wordColor(cover.colors.primary, "0F766E");
  const secondary = wordColor(cover.colors.secondary, "F59E0B");

  let xml = source.replace(
    /(<v:oval id="warm-cover-photo-mat"[^>]*?fillcolor="#[0-9A-Fa-f]{6}") stroked="f"/,
    `$1 strokecolor="#${primary}" strokeweight="1pt"`,
  );

  const oldHeroSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(62)}" w:lineRule="exact"/>`;
  const newHeroSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(cover.data.foto ? 109 : 88)}" w:lineRule="exact"/>`;
  xml = replaceFirstAfter(xml, 'id="warm-cover-photo-mat"', oldHeroSpacer, newHeroSpacer);

  if (!cover.data.foto) {
    const oldInitialSpacing = `<w:spacing w:before="0" w:after="${twips(10)}" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin" w:eastAsia="Cabin"/><w:sz w:val="52"`;
    const newInitialSpacing = `<w:spacing w:before="0" w:after="${twips(31)}" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin" w:eastAsia="Cabin"/><w:sz w:val="52"`;
    xml = replaceFirstAfter(xml, 'id="warm-cover-photo-mat"', oldInitialSpacing, newInitialSpacing);
  }

  if (cover.data.lehrbeginn?.trim()) {
    const centerWidth = twips(78);
    const sideWidth = twips(50);
    const insetY = twips(1.8);
    const insetX = twips(4);
    const oldOpen = `<w:tc><w:tcPr><w:tcW w:w="${centerWidth}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr><w:tc><w:tcPr><w:shd w:fill="${secondary}"/><w:tcMar><w:top w:w="${insetY}" w:type="dxa"/><w:left w:w="${insetX}" w:type="dxa"/><w:bottom w:w="${insetY}" w:type="dxa"/><w:right w:w="${insetX}" w:type="dxa"/></w:tcMar></w:tcPr>`;
    const newOpen = `<w:tc><w:tcPr><w:tcW w:w="${centerWidth}" w:type="dxa"/><w:vAlign w:val="top"/><w:shd w:fill="${secondary}"/><w:tcMar><w:top w:w="${insetY}" w:type="dxa"/><w:left w:w="${insetX}" w:type="dxa"/><w:bottom w:w="${insetY}" w:type="dxa"/><w:right w:w="${insetX}" w:type="dxa"/></w:tcMar></w:tcPr>`;
    xml = replaceFirst(xml, oldOpen, newOpen);

    const oldClose = `</w:t></w:r></w:p></w:tc></w:tc><w:tc><w:tcPr><w:tcW w:w="${sideWidth}"`;
    const newClose = `</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="${sideWidth}"`;
    xml = replaceFirstAfter(xml, "Lehrbeginn", oldClose, newClose);

    const oldBottomSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(48)}" w:lineRule="exact"/>`;
    const newBottomSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(56)}" w:lineRule="exact"/>`;
    xml = replaceFirstAfter(xml, "Lehrbeginn", oldBottomSpacer, newBottomSpacer);
  }

  return reclaimWarmCvPaginationSlack(xml);
}

export async function createPolishedWarmDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const base = createWarmDossierDocxBlob(cover, letter, cv);
  return transformStoredDocxDocumentXml(
    base,
    (documentXml) => polishDocumentXml(documentXml, cover),
    "Warm DOCX polish",
  );
}

export async function downloadPolishedWarmDossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(await createPolishedWarmDossierDocxBlob(cover, letter, cv), fileName);
}
