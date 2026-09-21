import { CoverCanvas } from "@/components/cover/CoverCanvas";
import { isFreshTemplate } from "@/components/cover/fresh-templates";
import type { TemplateId } from "@/components/cover/types";
import { PAGE, PDF } from "@/default-config";
import type { CoverPdfDocument } from "@/lib/dossier-pdf-document";
import {
  buildDossierDocxV2CoverScene,
  type DossierDocxV2CoverNode,
  type DossierDocxV2CoverScene,
} from "@/lib/dossier-docx-v2-cover-scene";
import {
  auditDossierDocxV2Cover,
  type DossierDocxV2CoverQaReport,
} from "@/lib/dossier-docx-v2-cover-qa";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const MM_X = 210;
const MM_Y = 297;
const STRUCTURAL_BACKGROUND_TEMPLATES = new Set<TemplateId>([
  "klassisch",
  "edel",
  "sonnig",
  "aurora",
  "verlauf",
  "citrus",
  "pastell",
]);

export type DossierDocxV2RenderedCover = {
  scene: DossierDocxV2CoverScene;
  structuralBackgroundDataUrl: string | null;
  qa: DossierDocxV2CoverQaReport;
};

function needsStructuralBackground(template: TemplateId) {
  return isFreshTemplate(template) || STRUCTURAL_BACKGROUND_TEMPLATES.has(template);
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function rgbToHex(value: string, fallback: string) {
  if (!value || value === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(value)) {
    return fallback;
  }
  const hex = value.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) return `#${hex.toLowerCase()}`;
  const rgb = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!rgb) return fallback;
  const channel = (input: string) =>
    Math.max(0, Math.min(255, Math.round(Number.parseFloat(input))))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb[1])}${channel(rgb[2])}${channel(rgb[3])}`;
}

function px(styleValue: string) {
  const amount = Number.parseFloat(styleValue);
  return Number.isFinite(amount) ? amount : 0;
}

function transformScale(style: CSSStyleDeclaration) {
  if (!style.transform || style.transform === "none") return 1;
  const match2d = style.transform.match(/^matrix\(([^)]+)\)$/);
  if (match2d) {
    const values = match2d[1].split(",").map(Number);
    if (values.length >= 4 && values.every(Number.isFinite)) {
      return Math.max(0.01, Math.hypot(values[0], values[1]));
    }
  }
  const match3d = style.transform.match(/^matrix3d\(([^)]+)\)$/);
  if (match3d) {
    const values = match3d[1].split(",").map(Number);
    if (values.length >= 16 && values.every(Number.isFinite)) {
      return Math.max(0.01, Math.hypot(values[0], values[1], values[2]));
    }
  }
  return 1;
}

function fontFamily(value: string, fallback: string) {
  const first = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || fallback;
}

function textAlign(value: string, fallback: DossierDocxV2CoverNode["align"]) {
  if (value === "center" || value === "right" || value === "left" || value === "justify") {
    return value;
  }
  return fallback;
}

function measuredTextLines(
  node: DossierDocxV2CoverNode,
  inner: HTMLElement,
  defaultColor: string,
  defaultWeight: number,
) {
  const lines = Array.from(inner.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  if (!lines.length) return node.lines;

  return lines.map((line, lineIndex) => {
    const runs: DossierDocxV2CoverNode["lines"][number]["runs"] = [];
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      const raw = textNode.nodeValue ?? "";
      if (raw) {
        const parent = textNode.parentElement ?? line;
        const style = getComputedStyle(parent);
        const transformed = style.textTransform === "uppercase" ? raw.toUpperCase() : raw;
        const color = rgbToHex(style.color, defaultColor);
        const parsedWeight = Number.parseInt(style.fontWeight, 10);
        const weight = Number.isFinite(parsedWeight) ? parsedWeight : defaultWeight;
        const previous = runs.at(-1);
        if (previous && previous.color === color && previous.weight === weight) {
          previous.text += transformed;
        } else {
          runs.push({ text: transformed, color, weight });
        }
      }
      textNode = walker.nextNode();
    }

    // DOM text nodes are the rendered authority for palette overrides and
    // segmented copy. Keep the model line only when a browser produced no text
    // at all (for example an intentionally empty spacer line).
    return runs.length ? { runs } : (node.lines[lineIndex] ?? { runs: [] });
  });
}

function badgeRects(
  pageRect: DOMRect,
  inner: HTMLElement,
  mmX: number,
  mmY: number,
) {
  const badges = Array.from(inner.children).flatMap((line) => {
    const span = line.querySelector<HTMLElement>(":scope > span");
    if (!span) return [];
    const style = getComputedStyle(span);
    const background = rgbToHex(style.backgroundColor, "");
    if (!background) return [];
    const rect = span.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    const radiusPx = px(style.borderTopLeftRadius);
    return [
      {
        x: (rect.left - pageRect.left) * mmX,
        y: (rect.top - pageRect.top) * mmY,
        width: rect.width * mmX,
        height: rect.height * mmY,
        color: background,
        radius: radiusPx >= 1000 ? 999 : radiusPx * mmX,
      },
    ];
  });
  return badges;
}

function measureNode(
  node: DossierDocxV2CoverNode,
  element: HTMLElement,
  pageRect: DOMRect,
  mmX: number,
  mmY: number,
): DossierDocxV2CoverNode {
  const rect = element.getBoundingClientRect();
  const next: DossierDocxV2CoverNode = {
    ...node,
    x: (rect.left - pageRect.left) * mmX,
    y: (rect.top - pageRect.top) * mmY,
    width: rect.width * mmX,
    height: rect.height * mmY,
    layer:
      element.dataset.elementLayer === "back"
        ? "back"
        : element.dataset.elementLayer === "front"
          ? "front"
          : node.layer,
  };

  const inner = element.firstElementChild;
  if (!(inner instanceof HTMLElement)) return next;
  const style = getComputedStyle(inner);
  const elementStyle = getComputedStyle(element);
  const innerOpacity = Number.parseFloat(style.opacity);
  const outerOpacity = Number.parseFloat(elementStyle.opacity);
  next.opacity = Math.max(
    0,
    Math.min(
      1,
      (Number.isFinite(innerOpacity) ? innerOpacity : 1) *
        (Number.isFinite(outerOpacity) ? outerOpacity : 1),
    ),
  );

  if (node.kind === "text") {
    const scale = transformScale(elementStyle);
    const fontPx = px(style.fontSize) * scale;
    const weight = Number.parseInt(style.fontWeight, 10);
    const resolvedWeight = Number.isFinite(weight) ? weight : node.fontWeight;
    const resolvedColor = rgbToHex(style.color, node.color);
    const lineHeightPx = px(style.lineHeight);
    const trackingPx = style.letterSpacing === "normal" ? 0 : px(style.letterSpacing);
    const borderPx = px(style.borderLeftWidth);
    next.font = fontFamily(style.fontFamily, node.font);
    next.fontSizePt = fontPx > 0 ? fontPx * (72 / 96) : node.fontSizePt;
    next.fontWeight = resolvedWeight;
    next.italic = style.fontStyle === "italic" || style.fontStyle === "oblique";
    next.underline = style.textDecorationLine.includes("underline");
    next.trackingEm = fontPx > 0 ? trackingPx / fontPx : node.trackingEm;
    next.lineHeight = fontPx > 0 && lineHeightPx > 0 ? lineHeightPx / fontPx : node.lineHeight;
    next.align = textAlign(style.textAlign, node.align);
    next.color = resolvedColor;
    next.lines = measuredTextLines(node, inner, resolvedColor, resolvedWeight);
    next.padX = px(style.paddingLeft) * mmX * scale;
    next.padY = px(style.paddingTop) * mmY * scale;
    next.borderWidth = borderPx * mmX * scale;
    next.borderColor = rgbToHex(style.borderLeftColor, node.borderColor);
    next.boxRadius = px(style.borderTopLeftRadius) * mmX * scale;
    next.badgeRects = badgeRects(pageRect, inner, mmX, mmY);
    if (next.badgeRects.length) next.background = null;
  } else if (node.kind === "photo" || node.kind === "image") {
    const scale = transformScale(elementStyle);
    const radiusPx = px(style.borderTopLeftRadius);
    next.radius = radiusPx >= 1000 ? 999 : radiusPx * mmX * scale;
    next.borderWidth = node.borderWidth * scale;
  }

  return next;
}

async function captureStructuralBackground(page: HTMLElement, token: string) {
  const html2canvas = (await import("html2canvas-pro")).default;
  const canvas = await html2canvas(page, {
    scale: PDF.SCALE,
    backgroundColor: null,
    useCORS: true,
    width: PAGE.WIDTH,
    height: PAGE.HEIGHT,
    windowWidth: PAGE.WIDTH,
    windowHeight: PAGE.HEIGHT,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument) => {
      const clone = clonedDocument.querySelector<HTMLElement>(`[data-docx-v2-capture="${token}"]`);
      if (!clone) return;
      for (const element of clone.querySelectorAll<HTMLElement>("[data-block-id]")) {
        element.style.setProperty("visibility", "hidden", "important");
      }
    },
  });
  return canvas.toDataURL("image/png");
}

/**
 * Resolve the actual browser-rendered cover before translating it to Word.
 * This is the bridge that removes the last parallel-layout trap: Fresh/legacy
 * CSS transforms, footer sync and template typography are measured after the
 * same CoverCanvas used by PDF/preview has finished layout.
 */
export async function resolveDossierDocxV2RenderedCover(
  cover: CoverPdfDocument,
): Promise<DossierDocxV2RenderedCover> {
  const fallback = buildDossierDocxV2CoverScene(cover);
  const structuralBackgroundRequired = needsStructuralBackground(cover.template);
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      scene: fallback,
      structuralBackgroundDataUrl: null,
      qa: auditDossierDocxV2Cover({
        baseline: fallback,
        rendered: fallback,
        measuredInBrowser: false,
        structuralBackgroundRequired,
      }),
    };
  }

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${PAGE.WIDTH}px`;
  host.style.height = `${PAGE.HEIGHT}px`;
  host.style.pointerEvents = "none";
  host.style.zIndex = "-2147483647";
  document.body.appendChild(host);
  const root = createRoot(host);
  const pageRef: { current: HTMLDivElement | null } = { current: null };
  const token = `docx-v2-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    flushSync(() => {
      root.render(
        <CoverCanvas
          ref={(node) => {
            pageRef.current = node;
          }}
          template={cover.template}
          data={cover.data}
          colors={cover.colors}
          blocks={cover.blocks}
          selected={null}
          onSelect={() => {}}
          onMove={() => {}}
          fontScale={cover.fontScale}
          editable={false}
        />,
      );
    });
    await document.fonts?.ready;
    await nextFrame();
    await nextFrame();
    const page = pageRef.current as HTMLDivElement | null;
    if (!page) throw new Error("DOCX V2 hidden CoverCanvas did not mount.");
    page.dataset.docxV2Capture = token;

    const pageRect = page.getBoundingClientRect();
    if (pageRect.width <= 0 || pageRect.height <= 0) {
      throw new Error("DOCX V2 hidden CoverCanvas could not be measured.");
    }
    const mmX = MM_X / pageRect.width;
    const mmY = MM_Y / pageRect.height;
    const elements = new Map(
      Array.from(page.querySelectorAll<HTMLElement>("[data-block-id]")).map((element) => [
        element.dataset.blockId ?? "",
        element,
      ]),
    );
    const unmeasuredNodeIds = fallback.nodes
      .filter((node) => !elements.has(node.id))
      .map((node) => node.id);
    const scene: DossierDocxV2CoverScene = {
      ...fallback,
      nodes: fallback.nodes.map((node) => {
        const element = elements.get(node.id);
        return element ? measureNode(node, element, pageRect, mmX, mmY) : node;
      }),
    };

    const structuralBackgroundDataUrl = structuralBackgroundRequired
      ? await captureStructuralBackground(page, token)
      : null;
    const qa = auditDossierDocxV2Cover({
      baseline: fallback,
      rendered: scene,
      measuredInBrowser: true,
      unmeasuredNodeIds,
      structuralBackgroundRequired,
      structuralBackgroundDataUrl,
    });
    return { scene, structuralBackgroundDataUrl, qa };
  } finally {
    root.unmount();
    host.remove();
  }
}
