import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { createWarmDossierDocxBlob } from "@/lib/dossier-docx-warm";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import {
  dossierDocxTemplatePlan,
  type DossierDocxGeometryFamily,
} from "@/lib/dossier-docx-family";

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function hex(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function rgbLuminance(color: string) {
  const value = color.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function normalizedColors(colors: Record<string, string> | undefined) {
  const bg = hex(colors?.bg ?? colors?.sheet, "#ffffff");
  const fallbackInk = rgbLuminance(bg) < 0.46 ? "#f7f7f5" : "#1c2328";
  const ink = hex(colors?.ink ?? colors?.light, fallbackInk);
  const primary = hex(colors?.primary ?? colors?.accent, ink);
  const secondary = hex(colors?.secondary ?? colors?.accent, primary);
  const accent = hex(colors?.accent ?? colors?.secondary, secondary);
  return { bg, ink, primary, secondary, accent };
}

function warmCompatibleDocuments(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  return {
    cover: {
      ...cover,
      template: "freundlich",
      colors: normalizedColors(cover.colors),
    } as CoverPdfDocument,
    letter: {
      ...letter,
      design: {
        ...letter.design,
        template: "freundlich",
        colors: normalizedColors(letter.design.colors),
      },
    } as LetterPdfDocument,
    cv: {
      ...cv,
      design: {
        ...cv.design,
        template: "freundlich",
        colors: normalizedColors(cv.design.colors),
      },
    } as CvPdfDocument,
  };
}

function vmlStyle(x: number, y: number, width: number, height: number, z = -251658240) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${width}mm;height:${height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function rectRun(id: string, x: number, y: number, width: number, height: number, color: string) {
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, width, height)}" fillcolor="${color}" stroked="f"/></w:pict></w:r>`;
}

function frameRun(id: string, x: number, y: number, width: number, height: number, color: string) {
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, width, height)}" filled="f" strokecolor="${color}" strokeweight="0.9pt"/></w:pict></w:r>`;
}

function replaceDrawing(source: string, id: string, replacement: string, required = false) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<w:r><w:pict><v:(?:shape|rect|oval)[^>]*\\bid="${escaped}"[\\s\\S]*?</w:pict></w:r>`,
  );
  if (!pattern.test(source)) {
    if (required) throw new Error(`DOCX-Familienrenderer: Zeichnung fehlt: ${id}`);
    return source;
  }
  return source.replace(pattern, replacement);
}

function familyTransform(
  source: string,
  family: DossierDocxGeometryFamily,
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const coverColors = normalizedColors(cover.colors);
  const letterColors = normalizedColors(letter.design.colors);
  const cvColors = normalizedColors(cv.design.colors);
  let xml = source;

  if (family === "masthead") return xml;

  if (family === "plain") {
    for (const id of [
      "warm-cover-teal",
      "warm-cover-large-orb",
      "warm-cover-small-orb",
      "warm-letter-masthead",
      "warm-letter-ring",
      "warm-letter-orb",
      "warm-letter-footer",
      "warm-cv-top-band",
      "warm-cv-orb",
      "warm-cv-bottom-band",
    ]) {
      xml = replaceDrawing(xml, id, "");
    }
    return xml;
  }

  if (family === "editorial-frame") {
    xml = replaceDrawing(
      xml,
      "warm-cover-teal",
      frameRun("docx-family-cover-frame", 10, 10, 190, 277, coverColors.accent),
    );
    xml = replaceDrawing(xml, "warm-cover-large-orb", "");
    xml = replaceDrawing(xml, "warm-cover-small-orb", "");
    xml = replaceDrawing(xml, "warm-letter-masthead", "");
    xml = replaceDrawing(xml, "warm-letter-ring", "");
    xml = replaceDrawing(xml, "warm-letter-orb", "");
    xml = replaceDrawing(
      xml,
      "warm-letter-footer",
      rectRun("docx-family-letter-rule", 18, 286, 174, 1.2, letterColors.accent),
    );
    xml = replaceDrawing(xml, "warm-cv-top-band", "");
    xml = replaceDrawing(xml, "warm-cv-orb", "");
    xml = replaceDrawing(
      xml,
      "warm-cv-bottom-band",
      frameRun("docx-family-cv-frame", 10, 10, 190, 277, cvColors.accent),
    );
    return xml;
  }

  if (family === "side-rail") {
    xml = replaceDrawing(
      xml,
      "warm-cover-teal",
      rectRun("docx-family-cover-rail", 0, 0, 42, 297, coverColors.primary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cover-large-orb",
      rectRun("docx-family-cover-rail-accent", 0, 0, 42, 72, coverColors.secondary),
    );
    xml = replaceDrawing(xml, "warm-cover-small-orb", "");
    xml = replaceDrawing(
      xml,
      "warm-letter-masthead",
      rectRun("docx-family-letter-rail", 0, 0, 12, 297, letterColors.primary),
    );
    xml = replaceDrawing(xml, "warm-letter-ring", "");
    xml = replaceDrawing(xml, "warm-letter-orb", "");
    xml = replaceDrawing(xml, "warm-letter-footer", "");
    xml = replaceDrawing(
      xml,
      "warm-cv-top-band",
      rectRun("docx-family-cv-rail", 0, 0, 12, 297, cvColors.primary),
    );
    xml = replaceDrawing(xml, "warm-cv-orb", "");
    xml = replaceDrawing(xml, "warm-cv-bottom-band", "");
    return xml;
  }

  if (family === "banded") {
    xml = replaceDrawing(
      xml,
      "warm-cover-teal",
      rectRun("docx-family-cover-band", 0, 220, 210, 77, coverColors.primary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cover-large-orb",
      rectRun("docx-family-cover-top-rule", 0, 0, 210, 13, coverColors.secondary),
    );
    xml = replaceDrawing(xml, "warm-cover-small-orb", "");
    xml = replaceDrawing(
      xml,
      "warm-letter-masthead",
      rectRun("docx-family-letter-band", 0, 0, 210, 18, letterColors.primary),
    );
    xml = replaceDrawing(
      xml,
      "warm-letter-ring",
      rectRun("docx-family-letter-accent", 146, 0, 64, 18, letterColors.secondary),
    );
    xml = replaceDrawing(xml, "warm-letter-orb", "");
    xml = replaceDrawing(
      xml,
      "warm-letter-footer",
      rectRun("docx-family-letter-bottom", 0, 291, 210, 6, letterColors.secondary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cv-top-band",
      rectRun("docx-family-cv-band", 0, 0, 210, 20, cvColors.primary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cv-orb",
      rectRun("docx-family-cv-accent", 146, 0, 64, 20, cvColors.secondary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cv-bottom-band",
      rectRun("docx-family-cv-bottom", 0, 291, 210, 6, cvColors.accent),
    );
    return xml;
  }

  if (family === "geometric") {
    xml = replaceDrawing(
      xml,
      "warm-cover-teal",
      rectRun("docx-family-cover-block-a", 0, 0, 136, 108, coverColors.primary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cover-large-orb",
      rectRun("docx-family-cover-block-b", 136, 0, 74, 76, coverColors.secondary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cover-small-orb",
      rectRun("docx-family-cover-block-c", 0, 108, 54, 24, coverColors.accent),
    );
    xml = replaceDrawing(
      xml,
      "warm-letter-masthead",
      rectRun("docx-family-letter-block-a", 0, 0, 150, 28, letterColors.primary),
    );
    xml = replaceDrawing(
      xml,
      "warm-letter-ring",
      rectRun("docx-family-letter-block-b", 150, 0, 60, 28, letterColors.secondary),
    );
    xml = replaceDrawing(xml, "warm-letter-orb", "");
    xml = replaceDrawing(xml, "warm-letter-footer", "");
    xml = replaceDrawing(
      xml,
      "warm-cv-top-band",
      rectRun("docx-family-cv-block-a", 0, 0, 150, 38, cvColors.primary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cv-orb",
      rectRun("docx-family-cv-block-b", 150, 0, 60, 38, cvColors.secondary),
    );
    xml = replaceDrawing(
      xml,
      "warm-cv-bottom-band",
      rectRun("docx-family-cv-bottom", 0, 292, 210, 5, cvColors.accent),
    );
    return xml;
  }

  // Word/LibreOffice gradient compatibility is fragile. Use two large solid
  // fields as the stable family fallback; individual mappings can add richer
  // DrawingML later after visual QA.
  xml = replaceDrawing(
    xml,
    "warm-cover-teal",
    rectRun("docx-family-cover-gradient-a", 0, 0, 210, 116, coverColors.primary),
  );
  xml = replaceDrawing(
    xml,
    "warm-cover-large-orb",
    rectRun("docx-family-cover-gradient-b", 126, 0, 84, 116, coverColors.secondary),
  );
  xml = replaceDrawing(xml, "warm-cover-small-orb", "");
  xml = replaceDrawing(
    xml,
    "warm-letter-masthead",
    rectRun("docx-family-letter-gradient-a", 0, 0, 146, 34, letterColors.primary),
  );
  xml = replaceDrawing(
    xml,
    "warm-letter-ring",
    rectRun("docx-family-letter-gradient-b", 146, 0, 64, 34, letterColors.secondary),
  );
  xml = replaceDrawing(xml, "warm-letter-orb", "");
  xml = replaceDrawing(xml, "warm-letter-footer", "");
  xml = replaceDrawing(
    xml,
    "warm-cv-top-band",
    rectRun("docx-family-cv-gradient-a", 0, 0, 146, 42, cvColors.primary),
  );
  xml = replaceDrawing(
    xml,
    "warm-cv-orb",
    rectRun("docx-family-cv-gradient-b", 146, 0, 64, 42, cvColors.secondary),
  );
  xml = replaceDrawing(
    xml,
    "warm-cv-bottom-band",
    rectRun("docx-family-cv-accent", 0, 292, 210, 5, cvColors.accent),
  );
  return xml;
}

function sameTemplate(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const template = String(cover.template);
  return template === String(letter.design.template) && template === String(cv.design.template)
    ? template
    : null;
}

export function genericFamilyDossierDocxSupported(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  if (!cover || !letter || !cv) return false;
  const template = sameTemplate(cover, letter, cv);
  return !!template && !!dossierDocxTemplatePlan(template);
}

export async function createGenericFamilyDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const template = sameTemplate(cover, letter, cv);
  const plan = template ? dossierDocxTemplatePlan(template) : null;
  if (!template || !plan) {
    throw new Error("DOCX-Familienrenderer benötigt dieselbe unterstützte Vorlage in allen drei Dossierteilen.");
  }

  const compatible = warmCompatibleDocuments(cover, letter, cv);
  const base = createWarmDossierDocxBlob(compatible.cover, compatible.letter, compatible.cv);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => familyTransform(xml, plan.family, cover, letter, cv),
    `DOCX-Familie ${plan.family}`,
  );
}

// Exported for focused regression tests of the fallback geometry contract.
export const dossierDocxFamilyInternals = { twips };
