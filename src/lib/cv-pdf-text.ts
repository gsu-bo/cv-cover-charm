import { jsPDF } from "jspdf";
import type { jsPDF as JsPdf } from "jspdf";

const MASK_STYLE_ID = "cv-pdf-raster-text-mask";
const PLUGIN_FLAG = "__cvPdfTextPluginInstalled";
const MM_PER_PT = 25.4 / 72;

type PdfFont = "helvetica" | "times" | "courier" | "Cabin";
type PdfFontStyle = "normal" | "bold" | "italic" | "bolditalic";
type UnknownFn = (...args: unknown[]) => unknown;
type PdfProperties = Record<string, string | undefined>;
type JsPdfApiRegistry = {
  events: Array<[string, (this: JsPdf) => void]>;
  [PLUGIN_FLAG]?: boolean;
};
type PdfFontMetadata = {
  ascender?: unknown;
};

const subjects = new WeakMap<object, string>();
const textLayerApplied = new WeakSet<object>();

function installRasterTextMask() {
  if (typeof document === "undefined" || document.getElementById(MASK_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = MASK_STYLE_ID;
  // Stable compatibility/diagnostic hook only. Visible CV typography belongs
  // to Chromium/html2canvas; hiding it here would force jsPDF to become a
  // second visible typography engine and reintroduce condensed/duplicate text.
  style.textContent = "";
  document.head.appendChild(style);
}

function withRasterTextVisible<T>(run: () => T): T {
  const mask =
    typeof document === "undefined"
      ? null
      : (document.getElementById(MASK_STYLE_ID) as HTMLStyleElement | null);
  const wasDisabled = mask?.disabled ?? false;
  if (mask) mask.disabled = true;
  try {
    return run();
  } finally {
    if (mask) mask.disabled = wasDisabled;
  }
}

function rgb(cssColor: string): [number, number, number] {
  const hex = cssColor.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }

  const values = cssColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!values || values.length !== 3 || !values.every(Number.isFinite)) return [17, 17, 17];
  if (/^color\(/i.test(cssColor) && values.every((value) => value >= 0 && value <= 1)) {
    return values.map((value) => Math.round(value * 255)) as [number, number, number];
  }
  return values as [number, number, number];
}

function pdfFontForFamily(value: string): PdfFont {
  const family = value.toLowerCase();
  if (family.includes("cabin")) return "Cabin";
  if (
    family.includes("serif") ||
    family.includes("georgia") ||
    family.includes("times") ||
    family.includes("garamond") ||
    family.includes("palatino") ||
    family.includes("book antiqua")
  ) {
    return "times";
  }
  if (
    family.includes("mono") ||
    family.includes("courier") ||
    family.includes("maschine")
  ) {
    return "courier";
  }
  return "helvetica";
}

function pdfFontFor(style: CSSStyleDeclaration): PdfFont {
  return pdfFontForFamily(style.fontFamily);
}

function pdfFontForText(
  parent: HTMLElement,
  page: HTMLElement,
  style: CSSStyleDeclaration,
): PdfFont {
  // Custom BlockLayer text may deliberately use a per-element font. Chrome can
  // also carry an explicit user-selected text font. Preserve both. Everything
  // else is native CV content and must use the one synchronized dossier font,
  // even if a legacy/Fresh heading has a stronger local family declaration.
  if (parent.closest("[data-block-id]") || parent.closest("[data-dossier-chrome]")) {
    return pdfFontFor(style);
  }

  const dossierFamily = window.getComputedStyle(page).getPropertyValue("--dossier-font").trim();
  return dossierFamily ? pdfFontForFamily(dossierFamily) : pdfFontFor(style);
}

function pdfFontStyle(style: CSSStyleDeclaration): PdfFontStyle {
  const weight = Number.parseInt(style.fontWeight, 10);
  const bold = Number.isFinite(weight) ? weight >= 600 : /bold/i.test(style.fontWeight);
  const italic = style.fontStyle === "italic" || style.fontStyle === "oblique";
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

function transformed(text: string, style: CSSStyleDeclaration): string {
  switch (style.textTransform) {
    case "uppercase":
      return text.toLocaleUpperCase("de-CH");
    case "lowercase":
      return text.toLocaleLowerCase("de-CH");
    case "capitalize":
      return text.replace(/(^|\s)(\p{L})/gu, (_, prefix: string, letter: string) =>
        `${prefix}${letter.toLocaleUpperCase("de-CH")}`,
      );
    default:
      return text;
  }
}

function visibleInsidePage(element: HTMLElement, page: HTMLElement): boolean {
  if (!page.contains(element)) return false;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(element.tagName)) return false;

  let current: HTMLElement | null = element;
  while (current && page.contains(current)) {
    if (current !== page && current.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number.parseFloat(style.opacity) === 0) return false;
    if (current === page) break;
    current = current.parentElement;
  }
  return true;
}

function activePdfFontAscentRatio(pdf: JsPdf): number {
  const activeFont = pdf.getFont();
  const metadata = activeFont.metadata as PdfFontMetadata | undefined;
  const ascender = Number(metadata?.ascender);
  if (Number.isFinite(ascender) && ascender > 0) {
    // jsPDF normalizes embedded TrueType ascenders to a 1000-unit em before
    // writing the FontDescriptor. PDF viewers use that same descriptor for the
    // selectable text layer, so using the same ratio removes our old 0.82
    // baseline guess.
    const ratio = ascender / 1000;
    if (ratio >= 0.4 && ratio <= 1.4) return ratio;
  }

  const name = activeFont.fontName.toLowerCase();
  if (name.includes("helvetica")) return 0.718;
  if (name.includes("times")) return 0.683;
  if (name.includes("courier")) return 0.629;
  return 0.8;
}

/**
 * Geometry used by the invisible PDF text layer.
 *
 * The visible glyphs stay browser-rasterized. For selection, the PDF font size
 * therefore follows the browser Range box height rather than the CSS font-size
 * declaration. PDF viewers then build a selectable box with the same height as
 * the text that the user actually sees.
 */
export function resolveCvPdfSelectionGeometry(
  topMm: number,
  rectHeightPx: number,
  mmY: number,
  fallbackFontSizePt: number,
  ascentRatio: number,
): { fontSizePt: number; baselineMm: number } {
  const measuredHeightMm = rectHeightPx * mmY;
  const measuredFontSizePt = measuredHeightMm / MM_PER_PT;
  const fontSizePt =
    Number.isFinite(measuredFontSizePt) && measuredFontSizePt > 0
      ? measuredFontSizePt
      : fallbackFontSizePt;
  const safeAscentRatio =
    Number.isFinite(ascentRatio) && ascentRatio > 0 ? ascentRatio : 0.8;

  return {
    fontSizePt,
    baselineMm: topMm + fontSizePt * MM_PER_PT * safeAscentRatio,
  };
}

function fittedHorizontalScale(pdf: JsPdf, text: string, targetWidthMm: number): number {
  const renderedWidthMm = pdf.getTextWidth(text);
  if (!Number.isFinite(renderedWidthMm) || renderedWidthMm <= 0 || targetWidthMm <= 0) return 1;

  // This text is invisible, so exact browser selection geometry matters more
  // than keeping the native font near its natural width. The old 0.5–1.5 clamp
  // left visibly misplaced selection boxes when browser/PDF metrics diverged.
  const scale = targetWidthMm / renderedWidthMm;
  return Math.max(0.1, Math.min(10, scale));
}

function unionRects(rects: DOMRect[]): DOMRect {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

function drawCvTextLayer(pdf: JsPdf, page: HTMLElement) {
  const pageRect = page.getBoundingClientRect();
  if (pageRect.width <= 0 || pageRect.height <= 0) {
    throw new Error("Lebenslauf konnte für den PDF-Text nicht vermessen werden");
  }

  const mmX = 210 / pageRect.width;
  const mmY = 297 / pageRect.height;
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node = walker.nextNode();

  while (node) {
    if (!(node instanceof Text)) {
      node = walker.nextNode();
      continue;
    }

    const raw = node.nodeValue ?? "";
    const parent = node.parentElement;
    if (!raw.trim() || !parent || !visibleInsidePage(parent, page)) {
      node = walker.nextNode();
      continue;
    }

    const style = window.getComputedStyle(parent);
    const fontSizePx = Number.parseFloat(style.fontSize) || 14;
    const fallbackFontSizePt = fontSizePx * (72 / 96);
    const [red, green, blue] = rgb(style.color);
    const font = pdfFontForText(parent, page, style);
    const fontStyle = pdfFontStyle(style);

    for (const match of raw.matchAll(/\S+/gu)) {
      const start = match.index ?? 0;
      const token = transformed(match[0], style);
      range.setStart(node, start);
      range.setEnd(node, start + match[0].length);
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );
      if (!rects.length) continue;

      const fragments: Array<{ text: string; rect: DOMRect }> = [];
      if (rects.length === 1) {
        fragments.push({ text: token, rect: rects[0] });
      } else {
        let fragment = "";
        let fragmentRects: DOMRect[] = [];
        let previousTop: number | null = null;

        const flushFragment = () => {
          if (fragment && fragmentRects.length) {
            fragments.push({ text: fragment, rect: unionRects(fragmentRects) });
          }
          fragment = "";
          fragmentRects = [];
        };

        for (let offset = 0; offset < match[0].length; offset += 1) {
          range.setStart(node, start + offset);
          range.setEnd(node, start + offset + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          const character = transformed(match[0][offset], style);
          if (previousTop !== null && Math.abs(rect.top - previousTop) > 1) {
            flushFragment();
          }
          fragment += character;
          fragmentRects.push(rect);
          previousTop = rect.top;
        }
        flushFragment();
      }

      for (const fragment of fragments) {
        const x = (fragment.rect.left - pageRect.left) * mmX;
        const top = (fragment.rect.top - pageRect.top) * mmY;

        pdf.setFont(font, fontStyle);
        const ascentRatio = activePdfFontAscentRatio(pdf);
        const { fontSizePt, baselineMm } = resolveCvPdfSelectionGeometry(
          top,
          fragment.rect.height,
          mmY,
          fallbackFontSizePt,
          ascentRatio,
        );
        pdf.setFontSize(fontSizePt);
        pdf.setTextColor(red, green, blue);
        const horizontalScale = fittedHorizontalScale(
          pdf,
          fragment.text,
          fragment.rect.width * mmX,
        );
        // Browser/html2canvas owns every visible glyph and decoration. The
        // native text exists only for search/copy/selection, with its box fitted
        // to the browser Range rectangle rather than a guessed baseline.
        pdf.text(fragment.text, x, baselineMm, {
          horizontalScale,
          renderingMode: "invisible",
        });
      }
    }

    node = walker.nextNode();
  }
}

/**
 * Ergänzt die aktuell sichtbare CV-Seite um eine unsichtbare, durchsuchbare
 * PDF-Textebene. Die sichtbare Typografie selbst bleibt Browser-Raster und ist
 * damit identisch zur Vorschau und zum Motivationsschreiben.
 */
export function addCvTextLayer(pdf: JsPdf, page: HTMLElement) {
  withRasterTextVisible(() => drawCvTextLayer(pdf, page));
}

function exportRoots(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-dossier-document="cv"][data-export-mode="true"]',
    ),
  );
}

function isDossierRoot(root: HTMLElement): boolean {
  // Each hidden export renderer lives inside its own aria-hidden boundary.
  // Inspect only that nearest boundary. Walking farther up the route used to
  // see the separate full-dossier renderer and misclassify the standalone CV
  // as a dossier CV whenever title page + letter were also present.
  const exportBoundary = root.closest<HTMLElement>("[aria-hidden]");
  if (!exportBoundary) return false;
  return Boolean(
    exportBoundary.querySelector('[data-dossier-document="cover"]') &&
      exportBoundary.querySelector('[data-dossier-document="letter"]'),
  );
}

function standalonePages(): HTMLElement[] | null {
  const root = exportRoots().find((candidate) => !isDossierRoot(candidate));
  if (!root) return null;
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-cv-page]"));
  return pages.length ? pages : null;
}

function applyStandaloneTextLayer(pdf: JsPdf): boolean {
  const pages = standalonePages();
  if (!pages) {
    throw new Error("PDF-Textquelle für Lebenslauf wurde nicht gefunden");
  }
  if (pages.length > pdf.getNumberOfPages()) {
    throw new Error(
      `PDF hat ${pdf.getNumberOfPages()} Seite(n), benötigt werden mindestens ${pages.length}`,
    );
  }

  const currentPage = pdf.getCurrentPageInfo().pageNumber;
  pages.forEach((page, index) => {
    pdf.setPage(index + 1);
    addCvTextLayer(pdf, page);
  });
  pdf.setPage(Math.min(currentPage, pdf.getNumberOfPages()));
  return true;
}

/**
 * Der separate CV-Download benutzt noch den bestehenden jsPDF-Ausgabepunkt.
 * Das Gesamtdossier ruft addCvTextLayer dagegen direkt im Exportpfad auf und
 * hängt damit nicht mehr an diesem Hook.
 */
function installJsPdfPlugin() {
  const api = jsPDF.API as unknown as JsPdfApiRegistry;
  if (api[PLUGIN_FLAG]) return;
  api[PLUGIN_FLAG] = true;

  api.events.push([
    "initialized",
    function initializedCvPdfTextPlugin(this: JsPdf) {
      const originalSetProperties = this.setProperties as unknown as UnknownFn;
      const originalOutput = this.output as unknown as UnknownFn;

      (this as unknown as { setProperties: UnknownFn }).setProperties = (...args: unknown[]) => {
        const properties = (args[0] ?? {}) as PdfProperties;
        if (typeof properties.subject === "string") subjects.set(this, properties.subject);
        return Reflect.apply(originalSetProperties, this, args);
      };

      (this as unknown as { output: UnknownFn }).output = (...args: unknown[]) => {
        if (!textLayerApplied.has(this) && subjects.get(this) === "Lebenslauf") {
          if (applyStandaloneTextLayer(this)) textLayerApplied.add(this);
        }
        return Reflect.apply(originalOutput, this, args);
      };
    },
  ]);

  installRasterTextMask();
}

if (typeof window !== "undefined") installJsPdfPlugin();
