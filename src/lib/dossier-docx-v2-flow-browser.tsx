import { CvCanvas, type CvLayoutWarning } from "@/components/cv/CvCanvas";
import { LetterDocument } from "@/components/letter/LetterDocument";
import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";
import type { CvPdfDocument, LetterPdfDocument } from "@/lib/dossier-pdf-document";
import type {
  DossierDocxV2CvOverlay,
  DossierDocxV2CvPageArtwork,
  DossierDocxV2FlowBlock,
  DossierDocxV2FlowIssue,
  DossierDocxV2FlowParagraph,
  DossierDocxV2TextStyle,
} from "@/lib/dossier-docx-v2-flow-scene";
import { PAGE } from "@/default-config";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const PAGE_MM = { width: 210, height: 297 } as const;
const PX_TO_PT = 72 / 96;

export type DossierDocxV2MeasuredRect = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DossierDocxV2MeasuredText = {
  semantic: string;
  text: string;
  style: DossierDocxV2TextStyle;
  align: DossierDocxV2FlowParagraph["align"];
  lineHeight: number;
};

export type DossierDocxV2MeasuredLetterPage = {
  pageIndex: number;
  finalPage: boolean;
  contentBox: DossierDocxV2MeasuredRect | null;
  bodyBlocks: DossierDocxV2FlowBlock[];
  text: DossierDocxV2MeasuredText[];
};

export type DossierDocxV2MeasuredLetter = {
  measuredInBrowser: boolean;
  pageCount: number;
  pages: DossierDocxV2MeasuredLetterPage[];
  issues: DossierDocxV2FlowIssue[];
};

export type DossierDocxV2MeasuredCvPhoto = DossierDocxV2MeasuredRect & {
  borderWidth: number;
  borderColor: string;
};

export type DossierDocxV2MeasuredCvPage = {
  pageIndex: number;
  mainRows: string[];
  overlays: DossierDocxV2CvOverlay[];
};

export type DossierDocxV2MeasuredCv = {
  measuredInBrowser: boolean;
  pageCount: number;
  layout: "classic" | "modern" | null;
  pages: DossierDocxV2MeasuredCvPage[];
  artwork: DossierDocxV2CvPageArtwork[];
  photo: DossierDocxV2MeasuredCvPhoto | null;
  layoutWarnings: CvLayoutWarning[];
  issues: DossierDocxV2FlowIssue[];
};

export type DossierDocxV2MeasuredFlow = {
  letter: DossierDocxV2MeasuredLetter;
  cv: DossierDocxV2MeasuredCv;
};

type ChromeSnapshot = {
  letter: { options: DossierChromeOptions; contact: DossierChromeContact };
  cv: { options: DossierChromeOptions; contact: DossierChromeContact };
};

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function numeric(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function visible(element: HTMLElement) {
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function rgbToHex(value: string, fallback = "#111111") {
  const direct = value.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (direct) return `#${direct.toLowerCase()}`;
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return fallback;
  }
  return `#${channels
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function wordFontFromCss(value: string) {
  const first = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || "Arial";
  if (/serif/i.test(first) && !/sans/i.test(first)) return "Georgia";
  if (/mono|courier/i.test(first)) return "Courier New";
  if (/times/i.test(first)) return "Times New Roman";
  if (/verdana/i.test(first)) return "Verdana";
  if (/cabin/i.test(first)) return "Cabin";
  if (/impact/i.test(first)) return "Impact";
  return /arial narrow/i.test(first) ? "Arial Narrow" : "Arial";
}

function textStyle(element: HTMLElement): DossierDocxV2TextStyle {
  const style = getComputedStyle(element);
  const weight = Number.parseInt(style.fontWeight, 10);
  return {
    font: wordFontFromCss(style.fontFamily),
    fontSizePt: Math.max(1, numeric(style.fontSize) * PX_TO_PT),
    color: rgbToHex(style.color),
    bold: Number.isFinite(weight) ? weight >= 600 : /bold/i.test(style.fontWeight),
    italic: style.fontStyle === "italic" || style.fontStyle === "oblique",
    underline: style.textDecorationLine.includes("underline"),
  };
}

function wordAlign(value: string): DossierDocxV2FlowParagraph["align"] {
  if (value === "center" || value === "right" || value === "left") return value;
  return value === "justify" ? "both" : "left";
}

function lineHeight(element: HTMLElement) {
  const style = getComputedStyle(element);
  const font = numeric(style.fontSize);
  const line = numeric(style.lineHeight);
  return font > 0 && line > 0 ? line / font : 1.2;
}

function paragraph(element: HTMLElement, id: string): DossierDocxV2FlowParagraph {
  const style = getComputedStyle(element);
  const text = (element.innerText || element.textContent || "").replace(/\u00a0/g, " ").trim();
  return {
    kind: "paragraph",
    id,
    runs: text ? [{ text, ...textStyle(element) }] : [],
    align: wordAlign(style.textAlign),
    beforeMm: 0,
    afterMm: Math.max(0, numeric(style.marginBottom) * (25.4 / 96)),
    lineHeight: lineHeight(element),
  };
}

function measuredRect(element: HTMLElement, page: HTMLElement, pageIndex: number): DossierDocxV2MeasuredRect {
  const pageRect = page.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const mmX = PAGE_MM.width / pageRect.width;
  const mmY = PAGE_MM.height / pageRect.height;
  return {
    pageIndex,
    x: (rect.left - pageRect.left) * mmX,
    y: (rect.top - pageRect.top) * mmY,
    width: rect.width * mmX,
    height: rect.height * mmY,
  };
}

function bodyBlocks(page: HTMLElement, pageIndex: number): DossierDocxV2FlowBlock[] {
  const body = page.querySelector<HTMLElement>("[data-letter-pdf-richtext='body']");
  if (!body) return [];
  return Array.from(body.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && visible(child))
    .map((child, index) => paragraph(child, `body-measured-p${pageIndex + 1}-${index + 1}`));
}

const LETTER_SEMANTICS = [
  "sender",
  "recipient",
  "date",
  "subject",
  "salutation",
  "closing",
  "signature",
  "attachments-heading",
  "attachments-body",
] as const;

function measuredLetterText(page: HTMLElement): DossierDocxV2MeasuredText[] {
  const result: DossierDocxV2MeasuredText[] = [];
  for (const semantic of LETTER_SEMANTICS) {
    const root = page.querySelector<HTMLElement>(`[data-letter-pdf-text='${semantic}']`);
    if (!root || !visible(root)) continue;
    const text = (root.innerText || root.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const style = getComputedStyle(root);
    result.push({ semantic, text, style: textStyle(root), align: wordAlign(style.textAlign), lineHeight: lineHeight(root) });
  }
  return result;
}

function blocksFromCvContainer(container: HTMLElement, pageIndex: number, prefix: string): DossierDocxV2FlowBlock[] {
  const output: DossierDocxV2FlowBlock[] = [];
  let seq = 0;
  for (const child of Array.from(container.children)) {
    if (!(child instanceof HTMLElement) || !visible(child)) continue;
    seq += 1;
    if (child.matches("[data-cv-section-row]")) {
      const cells = Array.from(child.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement && visible(node),
      );
      if (cells.length) {
        output.push({
          kind: "table",
          id: `${prefix}-grid-${seq}`,
          rows: [
            {
              cantSplit: true,
              cells: cells.map((cell) => ({
                widthPct: 100 / cells.length,
                paddingMm: 1.5,
                blocks: blocksFromCvContainer(cell, pageIndex, `${prefix}-grid-${seq}`),
              })),
            },
          ],
          afterMm: 1,
        });
        continue;
      }
    }
    const nested = Array.from(child.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && visible(node),
    );
    const semantic = child.matches(
      "[data-cv-doc-title],[data-cv-name],[data-cv-subtitle],[data-cv-section-title],[data-cv-date],[data-cv-entry-title],[data-cv-body],[data-cv-muted]",
    );
    if (semantic || !nested.length) {
      const block = paragraph(child, `${prefix}-${seq}`);
      if (block.runs.length) output.push(block);
    } else {
      output.push(...blocksFromCvContainer(child, pageIndex, `${prefix}-${seq}`));
    }
  }
  return output;
}

function overlay(
  role: DossierDocxV2CvOverlay["role"],
  element: HTMLElement,
  page: HTMLElement,
  pageIndex: number,
): DossierDocxV2CvOverlay {
  const rect = measuredRect(element, page, pageIndex);
  const style = getComputedStyle(element);
  const pageRect = page.getBoundingClientRect();
  const mmX = PAGE_MM.width / pageRect.width;
  const mmY = PAGE_MM.height / pageRect.height;
  const background = /rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(style.backgroundColor)
    ? null
    : rgbToHex(style.backgroundColor, "#ffffff");
  return {
    ...rect,
    id: `cv-${role}-p${pageIndex + 1}`,
    role,
    background,
    insetMm: {
      top: numeric(style.paddingTop) * mmY,
      right: numeric(style.paddingRight) * mmX,
      bottom: numeric(style.paddingBottom) * mmY,
      left: numeric(style.paddingLeft) * mmX,
    },
    blocks: blocksFromCvContainer(element, pageIndex, `cv-${role}-p${pageIndex + 1}`),
  };
}

async function settleImages(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      try {
        await image.decode();
      } catch {
        // Dimensions are still usable when decode rejects for an already complete image.
      }
    }),
  );
}

async function waitForLetter(root: HTMLElement) {
  for (let frame = 0; frame < 180; frame += 1) {
    const issue = root.dataset.letterPaginationErrorMessage?.trim();
    if (issue) return issue;
    if (root.dataset.letterPaginationReady === "true" && root.querySelector("[data-letter-page]")) return null;
    await nextFrame();
  }
  return "Motivationsschreiben-Seitenumbruch wurde im DOCX-V2-Messlauf nicht rechtzeitig stabil.";
}

async function waitForCv(root: HTMLElement, reported: () => number) {
  let last = -1;
  let stable = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    await nextFrame();
    const count = root.querySelectorAll("[data-cv-page]").length;
    if (count > 0 && (!reported() || reported() === count) && count === last) stable += 1;
    else stable = 0;
    last = count;
    if (stable >= 4) return true;
  }
  return false;
}

async function artworkForPage(page: HTMLElement, pageIndex: number): Promise<DossierDocxV2CvPageArtwork | null> {
  try {
    const html2canvas = (await import("html2canvas-pro")).default;
    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      onclone: (doc) => {
        const clonePages = Array.from(doc.querySelectorAll<HTMLElement>("[data-cv-page]"));
        const clone = clonePages[pageIndex];
        if (!clone) return;
        for (const selector of [
          "[data-cv-main]",
          "[data-cv-sidebar]",
          "[data-cv-band-header]",
          "[data-cv-page-label]",
          "[data-cv-photo]",
          "[data-cv-elements]",
          "[data-dossier-chrome]",
        ]) {
          for (const node of clone.querySelectorAll<HTMLElement>(selector)) node.style.visibility = "hidden";
        }
      },
    });
    return { pageIndex, dataUrl: canvas.toDataURL("image/png"), x: 0, y: 0, width: 210, height: 297 };
  } catch {
    return null;
  }
}

function captureLetter(root: HTMLElement, issueMessage: string | null): DossierDocxV2MeasuredLetter {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-letter-page]"));
  const issues: DossierDocxV2FlowIssue[] = [];
  if (issueMessage) issues.push({ severity: "blocker", code: "letter-browser-pagination-error", scope: "letter", message: issueMessage });
  if (!pages.length) issues.push({ severity: "blocker", code: "letter-browser-pages-missing", scope: "letter", message: "DOCX V2 konnte keine echte LetterDocument-Seite vermessen." });
  return {
    measuredInBrowser: true,
    pageCount: pages.length,
    pages: pages.map((page, pageIndex) => {
      const layer = page.querySelector<HTMLElement>("[data-letter-text-layer]");
      return {
        pageIndex,
        finalPage: page.closest<HTMLElement>("[data-letter-document-page]")?.dataset.letterDocumentFinalPage === "true",
        contentBox: layer && visible(layer) ? measuredRect(layer, page, pageIndex) : null,
        bodyBlocks: bodyBlocks(page, pageIndex),
        text: measuredLetterText(page),
      };
    }),
    issues,
  };
}

async function captureCv(
  root: HTMLElement,
  stable: boolean,
  layoutWarnings: CvLayoutWarning[],
): Promise<DossierDocxV2MeasuredCv> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-cv-page]"));
  const issues: DossierDocxV2FlowIssue[] = [];
  if (!stable) issues.push({ severity: "blocker", code: "cv-browser-pagination-unstable", scope: "cv", message: "CV-Seitenumbruch wurde im DOCX-V2-Messlauf nicht rechtzeitig stabil." });
  if (!pages.length) issues.push({ severity: "blocker", code: "cv-browser-pages-missing", scope: "cv", message: "DOCX V2 konnte keine echte CvCanvas-Seite vermessen." });
  for (const warning of layoutWarnings) issues.push({ severity: "blocker", code: "cv-browser-layout-warning", scope: "cv", id: warning.id, message: warning.message });

  let photo: DossierDocxV2MeasuredCvPhoto | null = null;
  for (const [pageIndex, page] of pages.entries()) {
    const node = Array.from(page.querySelectorAll<HTMLElement>("[data-cv-photo]")).find(
      (candidate) => visible(candidate) && !!candidate.querySelector("img"),
    );
    if (!node) continue;
    const rect = measuredRect(node, page, pageIndex);
    const pageRect = page.getBoundingClientRect();
    const mmX = PAGE_MM.width / pageRect.width;
    const style = getComputedStyle(node);
    photo = { ...rect, borderWidth: Math.max(0, numeric(style.borderLeftWidth) * mmX), borderColor: rgbToHex(style.borderLeftColor) };
    break;
  }

  const layout = root.dataset.cvLayout === "modern" ? "modern" : root.dataset.cvLayout === "classic" ? "classic" : null;
  const measuredPages = pages.map((page, pageIndex) => {
    const main = page.querySelector<HTMLElement>("[data-cv-main]");
    const mainRows = main
      ? Array.from(main.children)
          .filter((child): child is HTMLElement => child instanceof HTMLElement && visible(child))
          .map((child) => (child.innerText || child.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
          .filter(Boolean)
      : [];
    const overlays: DossierDocxV2CvOverlay[] = [];
    const add = (role: DossierDocxV2CvOverlay["role"], selector: string) => {
      const element = page.querySelector<HTMLElement>(selector);
      if (element && visible(element)) overlays.push(overlay(role, element, page, pageIndex));
    };
    add("band-header", "[data-cv-band-header]");
    add("sidebar", "[data-cv-sidebar]");
    add("main", "[data-cv-main]");
    add("page-label", "[data-cv-page-label]");
    return { pageIndex, mainRows, overlays };
  });

  const captured = await Promise.all(pages.map((page, pageIndex) => artworkForPage(page, pageIndex)));
  const artwork = captured.filter((item): item is DossierDocxV2CvPageArtwork => item !== null);
  if (artwork.length !== pages.length) issues.push({ severity: "blocker", code: "cv-browser-artwork-missing", scope: "cv", message: "Der strukturelle CV-Hintergrund konnte nicht für jede Browser-Seite als Word-Artwork erfasst werden." });

  return { measuredInBrowser: true, pageCount: pages.length, layout, pages: measuredPages, artwork, photo, layoutWarnings, issues };
}

export async function resolveDossierDocxV2MeasuredFlow(
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  chrome: ChromeSnapshot,
): Promise<DossierDocxV2MeasuredFlow> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    const unavailable = (scope: "letter" | "cv"): DossierDocxV2FlowIssue => ({ severity: "blocker", code: `${scope}-browser-measurement-unavailable`, scope, message: "DOCX V2 Flow benötigt die echte Browser-Geometrie." });
    return {
      letter: { measuredInBrowser: false, pageCount: 0, pages: [], issues: [unavailable("letter")] },
      cv: { measuredInBrowser: false, pageCount: 0, layout: null, pages: [], artwork: [], photo: null, layoutWarnings: [], issues: [unavailable("cv")] },
    };
  }

  const host = document.createElement("div");
  host.dataset.docxV2FlowMeasurement = "true";
  Object.assign(host.style, { position: "fixed", left: "-50000px", top: "0", width: `${PAGE.WIDTH}px`, pointerEvents: "none", zIndex: "-2147483647", opacity: "1" });
  document.body.appendChild(host);
  const root = createRoot(host);
  let cvWarnings: CvLayoutWarning[] = [];
  let reportedCvPageCount = 0;

  try {
    flushSync(() => {
      root.render(
        <>
          <div data-docx-v2-letter-measurement>
            <LetterDocument data={letter.data} design={letter.design} exportMode chromeOptions={chrome.letter.options} chromeContact={chrome.letter.contact} />
          </div>
          <div data-docx-v2-cv-measurement>
            <CvCanvas
              data={cv.data}
              design={cv.design}
              elements={cv.elements}
              elementStyles={cv.elementStyles}
              exportMode
              chromeOptions={chrome.cv.options}
              chromeContact={chrome.cv.contact}
              onLayoutWarnings={(warnings) => { cvWarnings = warnings; }}
              onPageCount={(count) => { reportedCvPageCount = count; }}
            />
          </div>
        </>,
      );
    });
    await document.fonts?.ready;
    await settleImages(host);
    await nextFrame();
    await nextFrame();
    const letterRoot = host.querySelector<HTMLElement>("[data-letter-document-root]");
    const cvRoot = host.querySelector<HTMLElement>("[data-dossier-document='cv']");
    if (!letterRoot || !cvRoot) throw new Error("DOCX V2 Flow: versteckte Browser-Messansicht konnte nicht aufgebaut werden.");
    const [letterIssue, cvStable] = await Promise.all([waitForLetter(letterRoot), waitForCv(cvRoot, () => reportedCvPageCount)]);
    await settleImages(host);
    await nextFrame();
    return { letter: captureLetter(letterRoot, letterIssue), cv: await captureCv(cvRoot, cvStable, cvWarnings) };
  } finally {
    root.unmount();
    host.remove();
  }
}

export const dossierDocxV2FlowBrowserInternals = {
  rgbToHex,
  wordFontFromCss,
  paragraphFromElement: paragraph,
  cvOverlay: overlay,
};
