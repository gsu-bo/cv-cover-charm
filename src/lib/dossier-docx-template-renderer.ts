import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { createWarmDossierDocxBlob } from "@/lib/dossier-docx-warm";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import {
  dossierDocxTemplateRecipe,
  type DossierDocxColorRole,
  type DossierDocxRecipePage,
  type DossierDocxRecipeShape,
  type DossierDocxTemplateRecipe,
} from "@/lib/dossier-docx-template-recipe";

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function hex(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function luminance(color: string) {
  const raw = color.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function palette(colors: Record<string, string> | undefined) {
  const paper = hex(colors?.bg ?? colors?.sheet, "#ffffff");
  const fallbackInk = luminance(paper) < 0.46 ? "#f7f7f5" : "#1c2328";
  const ink = hex(colors?.ink ?? colors?.light, fallbackInk);
  const primary = hex(colors?.primary ?? colors?.accent, ink);
  const secondary = hex(colors?.secondary ?? colors?.accent, primary);
  const accent = hex(colors?.accent ?? colors?.secondary, secondary);
  return { paper, ink, primary, secondary, accent };
}

type Palette = ReturnType<typeof palette>;

function roleColor(colors: Palette, role: DossierDocxColorRole) {
  return colors[role];
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
      colors: palette(cover.colors),
    } as CoverPdfDocument,
    letter: {
      ...letter,
      design: {
        ...letter.design,
        template: "freundlich",
        colors: palette(letter.design.colors),
      },
    } as LetterPdfDocument,
    cv: {
      ...cv,
      design: {
        ...cv.design,
        template: "freundlich",
        colors: palette(cv.design.colors),
      },
    } as CvPdfDocument,
  };
}

function vmlStyle(x: number, y: number, width: number, height: number, z = -251658240) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${width}mm;height:${height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function fillOpacity(opacity = 1) {
  return opacity < 0.999 ? `<v:fill opacity="${Math.round(opacity * 100)}%"/>` : "";
}

function shapeRun(shape: DossierDocxRecipeShape, colors: Palette) {
  const color = roleColor(colors, shape.color);
  const opacity = shape.opacity ?? 1;
  if (shape.kind === "line") {
    return `<w:r><w:pict><v:rect id="${shape.id}" style="${vmlStyle(shape.x, shape.y, shape.w, shape.strokeMm ?? 0.4)}" fillcolor="${color}" stroked="f">${fillOpacity(opacity)}</v:rect></w:pict></w:r>`;
  }
  if (shape.kind === "frame") {
    return `<w:r><w:pict><v:rect id="${shape.id}" style="${vmlStyle(shape.x, shape.y, shape.w, shape.h)}" filled="f" strokecolor="${color}" strokeweight="${shape.strokeMm ?? 0.4}mm" opacity="${opacity}"/></w:pict></w:r>`;
  }
  const tag = shape.kind === "oval" ? "oval" : shape.kind === "roundrect" ? "roundrect" : "rect";
  return `<w:r><w:pict><v:${tag} id="${shape.id}" style="${vmlStyle(shape.x, shape.y, shape.w, shape.h)}" fillcolor="${color}" stroked="f">${fillOpacity(opacity)}</v:${tag}></w:pict></w:r>`;
}

function recipeShapes(page: DossierDocxRecipePage, colors: Palette) {
  return page.shapes.map((shape) => shapeRun(shape, colors)).join("");
}

function replaceDrawing(source: string, id: string, replacement: string, required = false) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<w:r><w:pict><v:(?:shape|rect|oval|roundrect)[^>]*\\bid="${escaped}"[\\s\\S]*?</w:pict></w:r>`,
  );
  if (!pattern.test(source)) {
    if (required) throw new Error(`DOCX-Rezept: Zeichnung fehlt: ${id}`);
    return source;
  }
  return source.replace(pattern, replacement);
}

function replacePageShapes(
  source: string,
  ids: readonly string[],
  shapes: string,
) {
  let xml = source;
  ids.forEach((id, index) => {
    xml = replaceDrawing(xml, id, index === 0 ? shapes : "");
  });
  return xml;
}

function patchSectionMargins(
  source: string,
  sectionIndex: number,
  margins: DossierDocxRecipePage["margins"],
) {
  if (!margins) return source;
  const pattern = /<w:sectPr>[\s\S]*?<\/w:sectPr>/g;
  const matches = [...source.matchAll(pattern)];
  const match = matches[sectionIndex];
  if (!match || match.index === undefined) return source;
  const block = match[0];
  const next = block.replace(/<w:pgMar\b[^>]*\/>/, (pgMar) => {
    let value = pgMar;
    const attrs = {
      top: twips(margins.top),
      right: twips(margins.right),
      bottom: twips(margins.bottom),
      left: twips(margins.left),
    };
    for (const [name, amount] of Object.entries(attrs)) {
      const attribute = new RegExp(`w:${name}="\\d+"`);
      value = attribute.test(value)
        ? value.replace(attribute, `w:${name}="${amount}"`)
        : value.replace("/>", ` w:${name}="${amount}"/>`);
    }
    return value;
  });
  return source.slice(0, match.index) + next + source.slice(match.index + block.length);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function patchFirstParagraphContaining(
  source: string,
  text: string,
  mutate: (paragraph: string) => string,
) {
  if (!text) return source;
  const needle = `>${xmlEscape(text)}</w:t>`;
  const textIndex = source.indexOf(needle);
  if (textIndex < 0) return source;
  const start = source.lastIndexOf("<w:p>", textIndex);
  const end = source.indexOf("</w:p>", textIndex);
  if (start < 0 || end < 0) return source;
  const paragraph = source.slice(start, end + 6);
  return source.slice(0, start) + mutate(paragraph) + source.slice(end + 6);
}

function setParagraphHorizontal(
  source: string,
  text: string,
  align: "left" | "center" | "right",
  leftMm = 0,
  rightMm = 0,
) {
  return patchFirstParagraphContaining(source, text, (paragraph) => {
    const jc = `<w:jc w:val="${align}"/>`;
    let next = /<w:jc w:val="[^"]+"\/>/.test(paragraph)
      ? paragraph.replace(/<w:jc w:val="[^"]+"\/>/, jc)
      : paragraph.replace("</w:pPr>", `${jc}</w:pPr>`);
    if (leftMm || rightMm) {
      const indent = `<w:ind${leftMm ? ` w:left="${twips(leftMm)}"` : ""}${rightMm ? ` w:right="${twips(rightMm)}"` : ""}/>`;
      next = /<w:ind\b[^>]*\/>/.test(next)
        ? next.replace(/<w:ind\b[^>]*\/>/, indent)
        : next.replace("</w:pPr>", `${indent}</w:pPr>`);
    }
    return next;
  });
}

function setParagraphColor(source: string, text: string, color: string) {
  const wordColor = color.replace("#", "").toUpperCase();
  return patchFirstParagraphContaining(source, text, (paragraph) => {
    if (/<w:color w:val="[^"]+"\/>/.test(paragraph)) {
      return paragraph.replace(/<w:color w:val="[^"]+"\/>/g, `<w:color w:val="${wordColor}"/>`);
    }
    return paragraph.replace(/<w:rPr>/g, `<w:rPr><w:color w:val="${wordColor}"/>`);
  });
}

function frameRun(
  id: string,
  kind: "oval" | "rect",
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  return `<w:r><w:pict><v:${kind} id="${id}" style="${vmlStyle(x, y, w, h, 251657900)}" filled="f" strokecolor="${color}" strokeweight="0.8pt"/></w:pict></w:r>`;
}

function patchPhotoFrame(
  source: string,
  recipe: DossierDocxTemplateRecipe,
  colors: Palette,
) {
  const frame = recipe.cover.photoFrame;
  if (!frame) return source;
  let xml = replaceDrawing(
    source,
    "warm-cover-photo-mat",
    frameRun(
      "docx-recipe-cover-photo-mat",
      frame.kind,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      roleColor(colors, frame.stroke),
    ),
  );

  const style = vmlStyle(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2, 251658000);
  const photoPattern = /(<v:oval id="warm-cover-photo"[^>]*\bstyle=")[^"]+("[^>]*>)/;
  xml = xml.replace(photoPattern, `$1${style}$2`);
  return xml;
}

function patchCoverHero(
  source: string,
  recipe: DossierDocxTemplateRecipe,
  cover: CoverPdfDocument,
) {
  const align = recipe.cover.heroAlign;
  if (!align) return source;
  const left = recipe.cover.heroLeftMm ?? 0;
  const right = recipe.cover.heroRightMm ?? 0;
  const fullName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
  const texts = [
    fullName,
    cover.data.beruf,
    cover.data.lehrbeginn?.trim() ? `Lehrbeginn · ${cover.data.lehrbeginn}` : "",
  ];
  let xml = source;
  for (const text of texts) {
    if (text) xml = setParagraphHorizontal(xml, text, align, left, right);
  }
  return xml;
}

function patchCoverContact(
  source: string,
  recipe: DossierDocxTemplateRecipe,
  cover: CoverPdfDocument,
  colors: Palette,
) {
  if (!recipe.cover.lightCoverContact) return source;
  const light = colors.paper;
  const texts = [
    "KONTAKT",
    cover.data.adresse,
    cover.data.plzOrt,
    cover.data.telefon,
    cover.data.email,
    "BEILAGEN",
    ...(cover.data.beilagen ?? []),
  ].filter(Boolean) as string[];
  let xml = source;
  for (const text of texts) xml = setParagraphColor(xml, text, light);
  return xml;
}

function patchRecipeDocumentXml(
  source: string,
  recipe: DossierDocxTemplateRecipe,
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const coverColors = palette(cover.colors);
  const letterColors = palette(letter.design.colors);
  const cvColors = palette(cv.design.colors);
  let xml = source;

  xml = replacePageShapes(
    xml,
    ["warm-cover-teal", "warm-cover-large-orb", "warm-cover-small-orb"],
    recipeShapes(recipe.cover, coverColors),
  );
  xml = replacePageShapes(
    xml,
    ["warm-letter-masthead", "warm-letter-ring", "warm-letter-orb", "warm-letter-footer"],
    recipeShapes(recipe.letter, letterColors),
  );
  xml = replacePageShapes(
    xml,
    ["warm-cv-top-band", "warm-cv-orb", "warm-cv-bottom-band"],
    recipeShapes(recipe.cv, cvColors),
  );

  xml = patchPhotoFrame(xml, recipe, coverColors);
  xml = patchCoverHero(xml, recipe, cover);
  xml = patchCoverContact(xml, recipe, cover, coverColors);

  // Warm's three A4 parts are emitted as three Word sections in this order.
  xml = patchSectionMargins(xml, 0, recipe.cover.margins);
  xml = patchSectionMargins(xml, 1, recipe.letter.margins);
  xml = patchSectionMargins(xml, 2, recipe.cv.margins);

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

export function individualRecipeDossierDocxSupported(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  if (!cover || !letter || !cv) return false;
  const template = sameTemplate(cover, letter, cv);
  return !!template && !!dossierDocxTemplateRecipe(template);
}

export async function createIndividualRecipeDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const template = sameTemplate(cover, letter, cv);
  const recipe = template ? dossierDocxTemplateRecipe(template) : null;
  if (!template || !recipe) {
    throw new Error("DOCX-Einzelrezept benötigt dieselbe gemappte Vorlage in allen drei Dossierteilen.");
  }

  const compatible = warmCompatibleDocuments(cover, letter, cv);
  const base = createWarmDossierDocxBlob(compatible.cover, compatible.letter, compatible.cv);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => patchRecipeDocumentXml(xml, recipe, cover, letter, cv),
    `DOCX-Einzelrezept ${recipe.label}`,
  );
}
