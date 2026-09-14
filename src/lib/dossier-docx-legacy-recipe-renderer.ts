import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { createWarmDossierDocxBlob } from "@/lib/dossier-docx-warm";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { ALL_DOSSIER_DOCX_TEMPLATE_RECIPES } from "@/lib/dossier-docx-template-recipes";
import type {
  DossierDocxColorRole,
  DossierDocxRecipeShape,
  DossierDocxTemplateRecipe,
} from "@/lib/dossier-docx-template-recipe";

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);
const CONTACT_ONLY_COVER_TEMPLATES = new Set(["forestFlow", "studio2", "warm4", "gallery"]);

type RuntimeShape = DossierDocxRecipeShape & { fillHex?: string };
type RuntimePage = DossierDocxTemplateRecipe["letter"] & { contentSurface?: "light" };
type RuntimeRecipe = DossierDocxTemplateRecipe & {
  cover: DossierDocxTemplateRecipe["cover"] & { contentSurface?: "light" };
  letter: RuntimePage;
  cv: RuntimePage;
};

type Palette = {
  paper: string;
  ink: string;
  primary: string;
  secondary: string;
  accent: string;
};

function hex(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function luminance(color: string) {
  const raw = color.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function palette(colors: Record<string, string> | undefined): Palette {
  const paper = hex(colors?.bg ?? colors?.sheet, "#ffffff");
  const fallbackInk = luminance(paper) < 0.46 ? "#f7f7f5" : "#1c2328";
  const ink = hex(colors?.ink ?? colors?.light, fallbackInk);
  const primary = hex(colors?.primary ?? colors?.accent, ink);
  const secondary = hex(colors?.secondary ?? colors?.accent, primary);
  const accent = hex(colors?.accent ?? colors?.secondary, secondary);
  return { paper, ink, primary, secondary, accent };
}

function warmColors(colors: Record<string, string> | undefined) {
  const p = palette(colors);
  return {
    bg: p.paper,
    ink: p.ink,
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
  };
}

function warmInteriorColors(colors: Record<string, string> | undefined, templateId: string) {
  const next = warmColors(colors);
  return templateId === "sonne" ? { ...next, bg: "#ffffff" } : next;
}

function roleColor(colors: Palette, role: DossierDocxColorRole) {
  return colors[role];
}

function warmCompatibleDocuments(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const templateId = String(cover.template);
  return {
    cover: { ...cover, template: "freundlich", colors: warmColors(cover.colors) } as CoverPdfDocument,
    letter: {
      ...letter,
      design: {
        ...letter.design,
        template: "freundlich",
        colors: warmInteriorColors(letter.design.colors, templateId),
      },
    } as LetterPdfDocument,
    cv: {
      ...cv,
      design: {
        ...cv.design,
        template: "freundlich",
        colors: warmInteriorColors(cv.design.colors, templateId),
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

function shapeRun(shape: RuntimeShape, colors: Palette, templateId: string) {
  const neonPageBackground =
    templateId === "neon" && /neon-(?:cover|letter|cv)-bg$/.test(shape.id);
  const sonneCvAccent = templateId === "sonne" && shape.id === "sonne-cv-light";
  const color =
    shape.fillHex ??
    (neonPageBackground
      ? colors.paper
      : sonneCvAccent
        ? colors.accent
        : roleColor(colors, shape.color));
  const opacity = sonneCvAccent ? 0.26 : (shape.opacity ?? 1);
  if (shape.kind === "line") {
    return `<w:r><w:pict><v:rect id="${shape.id}" style="${vmlStyle(shape.x, shape.y, shape.w, shape.strokeMm ?? 0.4)}" fillcolor="${color}" stroked="f">${fillOpacity(opacity)}</v:rect></w:pict></w:r>`;
  }
  if (shape.kind === "frame") {
    return `<w:r><w:pict><v:rect id="${shape.id}" style="${vmlStyle(shape.x, shape.y, shape.w, shape.h)}" filled="f" strokecolor="${color}" strokeweight="${shape.strokeMm ?? 0.4}mm" opacity="${opacity}"/></w:pict></w:r>`;
  }
  const tag = shape.kind === "oval" ? "oval" : shape.kind === "roundrect" ? "roundrect" : "rect";
  return `<w:r><w:pict><v:${tag} id="${shape.id}" style="${vmlStyle(shape.x, shape.y, shape.w, shape.h)}" fillcolor="${color}" stroked="f">${fillOpacity(opacity)}</v:${tag}></w:pict></w:r>`;
}

function recipeShapes(shapes: readonly DossierDocxRecipeShape[], colors: Palette, templateId: string) {
  return shapes.map((shape) => shapeRun(shape as RuntimeShape, colors, templateId)).join("");
}

function replaceDrawing(source: string, id: string, replacement: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<w:r><w:pict><v:(?:shape|rect|oval|roundrect)[^>]*\\bid="${escaped}"[\\s\\S]*?</w:pict></w:r>`,
  );
  return pattern.test(source) ? source.replace(pattern, replacement) : source;
}

function replacePageShapes(source: string, ids: readonly string[], shapes: string) {
  let xml = source;
  ids.forEach((id, index) => {
    xml = replaceDrawing(xml, id, index === 0 ? shapes : "");
  });
  return xml;
}

function patchSectionMargins(
  source: string,
  sectionIndex: number,
  margins: DossierDocxTemplateRecipe["letter"]["margins"],
) {
  if (!margins) return source;
  const matches = [...source.matchAll(/<w:sectPr>[\s\S]*?<\/w:sectPr>/g)];
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
  return patchFirstParagraphContaining(source, text, (paragraph) =>
    paragraph.replace(/<w:color w:val="[^"]+"\/>/g, `<w:color w:val="${wordColor}"/>`),
  );
}

function initials(vorname: string, nachname: string) {
  return `${vorname.trim().charAt(0)}${nachname.trim().charAt(0)}`.toUpperCase();
}

function clearFirstText(source: string, text: string) {
  if (!text) return source;
  const escaped = xmlEscape(text);
  const pattern = new RegExp(`(<w:t(?: xml:space="preserve")?>)${escaped}(</w:t>)`);
  return source.replace(pattern, "$1$2");
}

function photoFrameRun(
  recipe: RuntimeRecipe,
  colors: Palette,
  cover: CoverPdfDocument,
) {
  const frame = recipe.cover.photoFrame;
  if (!frame) return "";
  const tag = frame.kind === "oval" ? "oval" : "rect";
  const stroke = roleColor(colors, frame.stroke);
  const coverInitials = initials(cover.data.vorname, cover.data.nachname);
  const textBox = cover.data.foto
    ? ""
    : `<v:textbox inset="0,0,0,0"><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin"/><w:sz w:val="42"/><w:szCs w:val="42"/><w:color w:val="${colors.ink.replace("#", "").toUpperCase()}"/><w:b/><w:bCs/></w:rPr><w:t>${xmlEscape(coverInitials)}</w:t></w:r></w:p></w:txbxContent></v:textbox>`;
  const style = `${vmlStyle(frame.x, frame.y, frame.w, frame.h, 251657900)};v-text-anchor:middle`;
  return `<w:r><w:pict><v:${tag} id="docx-recipe-cover-photo-mat" style="${style}" fillcolor="${colors.paper}" strokecolor="${stroke}" strokeweight="0.8pt">${textBox}</v:${tag}></w:pict></w:r>`;
}

function patchPhotoFrame(
  source: string,
  recipe: RuntimeRecipe,
  colors: Palette,
  cover: CoverPdfDocument,
) {
  const frame = recipe.cover.photoFrame;
  if (!frame) return source;
  let xml = replaceDrawing(source, "warm-cover-photo-mat", photoFrameRun(recipe, colors, cover));
  if (cover.data.foto) {
    const photoStyle = vmlStyle(
      frame.x + 1,
      frame.y + 1,
      Math.max(1, frame.w - 2),
      Math.max(1, frame.h - 2),
      251658000,
    );
    xml = xml.replace(
      /(<v:oval id="warm-cover-photo"[^>]*\bstyle=")[^"]+("[^>]*>)/,
      `$1${photoStyle}$2`,
    );
  } else {
    xml = clearFirstText(xml, initials(cover.data.vorname, cover.data.nachname));
  }
  return xml;
}

function patchCoverHero(source: string, recipe: RuntimeRecipe, cover: CoverPdfDocument) {
  const align = recipe.cover.heroAlign;
  if (!align) return source;
  const fullName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
  const texts = [
    fullName,
    cover.data.beruf,
    cover.data.lehrbeginn?.trim() ? `Lehrbeginn · ${cover.data.lehrbeginn}` : "",
  ];
  let xml = source;
  for (const text of texts) {
    if (text) {
      xml = setParagraphHorizontal(
        xml,
        text,
        align,
        recipe.cover.heroLeftMm ?? 0,
        recipe.cover.heroRightMm ?? 0,
      );
    }
  }
  return xml;
}

function patchCoverContact(
  source: string,
  recipe: RuntimeRecipe,
  cover: CoverPdfDocument,
  colors: Palette,
) {
  const forceSonneContrast = recipe.templateId === "sonne";
  if (!recipe.cover.lightCoverContact && !forceSonneContrast) return source;
  const contactTexts = [
    "KONTAKT",
    cover.data.adresse,
    cover.data.plzOrt,
    cover.data.telefon,
    cover.data.email,
  ].filter(Boolean) as string[];
  const attachmentTexts = CONTACT_ONLY_COVER_TEMPLATES.has(recipe.templateId)
    ? []
    : (["BEILAGEN", ...(cover.data.beilagen ?? [])].filter(Boolean) as string[]);
  const contactColor = forceSonneContrast ? "#ffffff" : colors.paper;
  let xml = source;
  for (const text of [...contactTexts, ...attachmentTexts]) {
    xml = setParagraphColor(xml, text, contactColor);
  }
  return xml;
}

function patchLightCoverContent(
  source: string,
  recipe: RuntimeRecipe,
  cover: CoverPdfDocument,
) {
  if (recipe.cover.contentSurface !== "light") return source;
  const fullName = [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ");
  const texts = [
    fullName,
    cover.data.beruf,
    cover.data.lehrbeginn?.trim() ? `Lehrbeginn · ${cover.data.lehrbeginn}` : "",
    "KONTAKT",
    cover.data.adresse,
    cover.data.plzOrt,
    cover.data.telefon,
    cover.data.email,
    "BEILAGEN",
    ...(cover.data.beilagen ?? []),
  ].filter(Boolean) as string[];
  let xml = source;
  for (const text of texts) xml = setParagraphColor(xml, text, "#1c2328");
  return xml;
}

function sectionBounds(source: string) {
  const matches = [...source.matchAll(/<w:sectPr>[\s\S]*?<\/w:sectPr>/g)];
  if (
    matches.length < 2 ||
    matches[0].index === undefined ||
    matches[1].index === undefined
  ) {
    return null;
  }
  const firstIndex = matches[0].index;
  const secondIndex = matches[1].index;
  const firstEnd = firstIndex + matches[0][0].length;
  const secondEnd = secondIndex + matches[1][0].length;
  return [
    { start: 0, end: firstIndex },
    { start: firstEnd, end: secondIndex },
    { start: secondEnd, end: source.length },
  ] as const;
}

function recolorSection(source: string, sectionIndex: 0 | 1 | 2, color: string) {
  const bounds = sectionBounds(source);
  if (!bounds) return source;
  const range = bounds[sectionIndex];
  const wordColor = color.replace("#", "").toUpperCase();
  const middle = source
    .slice(range.start, range.end)
    .replace(/<w:color w:val="[^"]+"\/>/g, `<w:color w:val="${wordColor}"/>`);
  return source.slice(0, range.start) + middle + source.slice(range.end);
}

function patchContentSurfaces(
  source: string,
  recipe: RuntimeRecipe,
  coverColors: Palette,
) {
  let xml = source;
  if (["neon", "verlauf", "edelDark"].includes(recipe.templateId)) {
    xml = recolorSection(xml, 0, coverColors.ink);
  }
  if (recipe.letter.contentSurface === "light") {
    xml = recolorSection(xml, 1, "#1c2328");
  }
  if (recipe.cv.contentSurface === "light") {
    xml = recolorSection(xml, 2, "#1c2328");
  }
  return xml;
}

function patchRecipeDocumentXml(
  source: string,
  recipe: RuntimeRecipe,
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
    recipeShapes(recipe.cover.shapes, coverColors, recipe.templateId),
  );
  xml = replacePageShapes(
    xml,
    ["warm-letter-masthead", "warm-letter-ring", "warm-letter-orb", "warm-letter-footer"],
    recipeShapes(recipe.letter.shapes, letterColors, recipe.templateId),
  );
  xml = replacePageShapes(
    xml,
    ["warm-cv-top-band", "warm-cv-orb", "warm-cv-bottom-band"],
    recipeShapes(recipe.cv.shapes, cvColors, recipe.templateId),
  );

  xml = patchPhotoFrame(xml, recipe, coverColors, cover);
  xml = patchCoverHero(xml, recipe, cover);
  xml = patchCoverContact(xml, recipe, cover, coverColors);
  xml = patchLightCoverContent(xml, recipe, cover);
  xml = patchContentSurfaces(xml, recipe, coverColors);
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

export function legacyRecipeDossierDocxSupported(
  cover: CoverPdfDocument | null,
  letter: LetterPdfDocument | null,
  cv: CvPdfDocument | null,
) {
  if (!cover || !letter || !cv) return false;
  const template = sameTemplate(cover, letter, cv);
  return !!template && !!ALL_DOSSIER_DOCX_TEMPLATE_RECIPES[template];
}

export async function createLegacyRecipeDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const template = sameTemplate(cover, letter, cv);
  const recipe = template
    ? (ALL_DOSSIER_DOCX_TEMPLATE_RECIPES[template] as RuntimeRecipe | undefined)
    : undefined;
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
