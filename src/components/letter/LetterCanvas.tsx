import type { LetterFlowImage } from "./types";

export type LetterPageFragment = {
  pageIndex: number;
  finalPage: boolean;
  bodyHtml: string;
  images: LetterFlowImage[];
};

export type LetterPaginationIssue = {
  code: "measurement-failed" | "indivisible-block-too-tall" | "image-too-tall";
  message: string;
  blockType?: string;
};

export type LetterPaginationResult = {
  pages: LetterPageFragment[];
  issue: LetterPaginationIssue | null;
};

type BlockUnit = {
  kind: "block";
  html: string;
  splittable: boolean;
  label: string;
};

type TableRowUnit = {
  kind: "table-row";
  tableKey: string;
  rowHtml: string;
  label: string;
};

type PaginationUnit = BlockUnit | TableRowUnit;

type ImagePlacement = {
  image: LetterFlowImage;
  pageIndex: number;
  costPx: number;
};

const FIT_EPSILON_PX = 1;
const EMPTY_BODY_HTML = '<div data-align="justify"><br></div>';

function numericCss(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function visibleElementRect(element: Element): DOMRect | null {
  if (!(element instanceof HTMLElement)) return null;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : null;
}

function probe(root: HTMLElement, name: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-letter-pagination-probe="${name}"]`);
}

function bodyCapacityPx(root: HTMLElement, name: string, finalPage: boolean): number | null {
  const host = probe(root, name);
  const layer = host?.querySelector<HTMLElement>("[data-letter-text-layer]");
  const body = host?.querySelector<HTMLElement>("[data-letter-pdf-richtext='body']");
  if (!host || !layer || !body) return null;

  const layerRect = layer.getBoundingClientRect();
  const bodyRect = body.getBoundingClientRect();
  if (layerRect.height <= 0 || bodyRect.top < layerRect.top - FIT_EPSILON_PX) return null;

  if (!finalPage) return Math.max(0, layerRect.bottom - bodyRect.top);

  let tailBottom = bodyRect.bottom;
  let sibling = body.nextElementSibling;
  while (sibling) {
    const rect = visibleElementRect(sibling);
    if (rect) tailBottom = Math.max(tailBottom, rect.bottom);
    sibling = sibling.nextElementSibling;
  }

  // The final probes contain one normal body line. Add the free area below the
  // measured closing/signature/attachments tail to that measured body height.
  return Math.max(0, bodyRect.height + (layerRect.bottom - tailBottom));
}

function tableRows(table: HTMLTableElement, tableKey: string): TableRowUnit[] {
  return Array.from(table.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr, :scope > tr")).map(
    (row) => ({
      kind: "table-row",
      tableKey,
      rowHtml: row.outerHTML,
      label: "Tabellenzeile",
    }),
  );
}

function measuredUnits(sourceBody: HTMLElement): PaginationUnit[] {
  const units: PaginationUnit[] = [];
  Array.from(sourceBody.children).forEach((element, index) => {
    if (!(element instanceof HTMLElement)) return;
    if (element instanceof HTMLTableElement) {
      units.push(...tableRows(element, `table-${index}`));
      return;
    }

    const tag = element.tagName.toLowerCase();
    const list = !!element.dataset.list;
    const label =
      tag === "hr"
        ? "Trennlinie"
        : list
          ? "Listeneintrag"
          : tag === "div" || tag === "p"
            ? "Absatz"
            : "Inhaltsblock";
    units.push({
      kind: "block",
      html: element.outerHTML,
      splittable: (tag === "div" || tag === "p") && !list,
      label,
    });
  });
  return units;
}

function serializeUnits(units: PaginationUnit[]): string {
  if (!units.length) return "";
  let output = "";
  let index = 0;

  while (index < units.length) {
    const unit = units[index];
    if (unit.kind !== "table-row") {
      output += unit.html;
      index += 1;
      continue;
    }

    const rows: string[] = [];
    const tableKey = unit.tableKey;
    while (index < units.length) {
      const row = units[index];
      if (row.kind !== "table-row" || row.tableKey !== tableKey) break;
      rows.push(row.rowHtml);
      index += 1;
    }
    output += `<table data-letter-table><tbody>${rows.join("")}</tbody></table>`;
  }

  return output;
}

function createHeightMeasurer(sourceBody: HTMLElement) {
  const sourceRect = sourceBody.getBoundingClientRect();
  const sourceStyle = window.getComputedStyle(sourceBody);
  const sandbox = document.createElement("div");
  sandbox.dataset.letterPdfRichtext = "pagination-measure";
  sandbox.className = sourceBody.className;
  Object.assign(sandbox.style, {
    position: "fixed",
    left: "-50000px",
    top: "0",
    width: `${sourceRect.width}px`,
    height: "auto",
    minHeight: "0",
    maxHeight: "none",
    overflow: "visible",
    visibility: "hidden",
    pointerEvents: "none",
    fontFamily: sourceStyle.fontFamily,
    fontSize: sourceStyle.fontSize,
    fontWeight: sourceStyle.fontWeight,
    fontStyle: sourceStyle.fontStyle,
    lineHeight: sourceStyle.lineHeight,
    letterSpacing: sourceStyle.letterSpacing,
    color: sourceStyle.color,
  });
  document.body.appendChild(sandbox);

  const measure = (html: string): number => {
    if (!html.trim()) return 0;
    sandbox.innerHTML = html;
    const children = Array.from(sandbox.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (!children.length) return 0;

    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const child of children) {
      const rect = child.getBoundingClientRect();
      const style = window.getComputedStyle(child);
      top = Math.min(top, rect.top - numericCss(style.marginTop));
      bottom = Math.max(bottom, rect.bottom + numericCss(style.marginBottom));
    }
    return Number.isFinite(top) && Number.isFinite(bottom) ? Math.max(0, bottom - top) : 0;
  };

  return {
    measure,
    dispose: () => sandbox.remove(),
  };
}

type SplitPoint = { node: Text; offset: number };

function splitPoints(element: HTMLElement): SplitPoint[] {
  const points: SplitPoint[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const value = text.nodeValue ?? "";
    for (const match of value.matchAll(/\s+/g)) {
      const offset = (match.index ?? 0) + match[0].length;
      if (offset > 0 && offset < value.length) points.push({ node: text, offset });
    }
    if (value.length > 0) points.push({ node: text, offset: value.length });
    node = walker.nextNode();
  }
  return points;
}

function splitElementAt(
  element: HTMLElement,
  point: SplitPoint,
): { prefixHtml: string; suffixHtml: string } | null {
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(element);
  prefixRange.setEnd(point.node, point.offset);
  const suffixRange = document.createRange();
  suffixRange.selectNodeContents(element);
  suffixRange.setStart(point.node, point.offset);

  const prefix = element.cloneNode(false) as HTMLElement;
  const suffix = element.cloneNode(false) as HTMLElement;
  prefix.appendChild(prefixRange.cloneContents());
  suffix.appendChild(suffixRange.cloneContents());

  if (!prefix.textContent?.trim() || !suffix.textContent?.trim()) return null;
  return { prefixHtml: prefix.outerHTML, suffixHtml: suffix.outerHTML };
}

function splitBlockToFit(
  unit: BlockUnit,
  capacityPx: number,
  measure: (html: string) => number,
): { prefix: BlockUnit; suffix: BlockUnit } | null {
  if (!unit.splittable || capacityPx <= FIT_EPSILON_PX) return null;

  const template = document.createElement("template");
  template.innerHTML = unit.html;
  const element = template.content.firstElementChild;
  if (!(element instanceof HTMLElement)) return null;
  const points = splitPoints(element);
  if (!points.length) return null;

  let low = 0;
  let high = points.length - 1;
  let best: { prefixHtml: string; suffixHtml: string } | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const split = splitElementAt(element, points[mid]);
    if (!split) {
      high = mid - 1;
      continue;
    }
    if (measure(split.prefixHtml) <= capacityPx + FIT_EPSILON_PX) {
      best = split;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (!best) return null;
  return {
    prefix: { ...unit, html: best.prefixHtml },
    suffix: { ...unit, html: best.suffixHtml },
  };
}

function issueForUnit(unit: PaginationUnit): LetterPaginationIssue {
  return {
    code: "indivisible-block-too-tall",
    blockType: unit.label,
    message:
      unit.kind === "table-row"
        ? "Eine Tabellenzeile ist höher als der nutzbare Seitenbereich und kann nicht sicher geteilt werden. Verkleinere den Inhalt dieser Zeile."
        : `${unit.label} ist höher als der nutzbare Seitenbereich und kann nicht sicher geteilt werden. Teile oder verkleinere diesen Inhalt.`,
  };
}

function takePage(
  source: PaginationUnit[],
  capacityPx: number,
  measure: (html: string) => number,
): { taken: PaginationUnit[]; remaining: PaginationUnit[]; issue: LetterPaginationIssue | null } {
  const remaining = [...source];
  const taken: PaginationUnit[] = [];

  while (remaining.length) {
    const next = remaining[0];
    const candidate = [...taken, next];
    if (measure(serializeUnits(candidate)) <= capacityPx + FIT_EPSILON_PX) {
      taken.push(remaining.shift()!);
      continue;
    }

    // Prefer a semantic page break before the block. Only a block that cannot
    // fit on an otherwise empty page is split internally.
    if (taken.length) break;

    if (next.kind === "block" && next.splittable) {
      const split = splitBlockToFit(next, capacityPx, measure);
      if (split) {
        taken.push(split.prefix);
        remaining[0] = split.suffix;
        break;
      }
    }
    return { taken, remaining, issue: issueForUnit(next) };
  }

  return { taken, remaining, issue: null };
}

function measuredImagePlacements(
  root: HTMLElement,
  images: LetterFlowImage[],
  firstFlowCapacity: number,
  continuationFlowCapacity: number,
): { placements: ImagePlacement[]; issue: LetterPaginationIssue | null } {
  if (!images.length) return { placements: [], issue: null };
  const host = probe(root, "image-source");
  const body = host?.querySelector<HTMLElement>("[data-letter-pdf-richtext='body']");
  if (!host || !body) {
    return {
      placements: [],
      issue: { code: "measurement-failed", message: "Bilder konnten nicht für den Seitenumbruch vermessen werden." },
    };
  }

  const bodyTop = body.getBoundingClientRect().top;
  const nodes = new Map<string, HTMLElement>();
  for (const node of host.querySelectorAll<HTMLElement>("[data-letter-flow-image]")) {
    const id = node.dataset.letterFlowImage;
    if (id) nodes.set(id, node);
  }

  const placements: ImagePlacement[] = [];
  for (const image of images) {
    const node = nodes.get(image.id);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const costPx = rect.height + numericCss(style.marginTop) + numericCss(style.marginBottom);
    if (costPx > continuationFlowCapacity + FIT_EPSILON_PX) {
      return {
        placements: [],
        issue: {
          code: "image-too-tall",
          blockType: "Bild",
          message:
            "Ein eingebettetes Bild ist höher als der nutzbare Seitenbereich. Verkleinere das Bild; es wird nicht abgeschnitten.",
        },
      };
    }

    const topFromBody = Math.max(0, rect.top - bodyTop);
    const pageIndex = topFromBody + rect.height <= firstFlowCapacity + FIT_EPSILON_PX ? 0 : 1;
    placements.push({
      image: pageIndex === 0 ? image : { ...image, topMm: 0 },
      pageIndex,
      costPx,
    });
  }
  return { placements, issue: null };
}

function imagesForPage(placements: ImagePlacement[], pageIndex: number): LetterFlowImage[] {
  return placements.filter((placement) => placement.pageIndex === pageIndex).map(({ image }) => image);
}

function imageCostForPage(placements: ImagePlacement[], pageIndex: number): number {
  return placements
    .filter((placement) => placement.pageIndex === pageIndex)
    .reduce((sum, placement) => sum + placement.costPx, 0);
}

/**
 * Convert measured semantic body blocks into physical A4 page fragments.
 * Capacity is taken from live LetterCanvas probes; no character/word/page-size
 * constants decide where a break occurs.
 */
export function paginateMeasuredLetter(
  measurementRoot: HTMLElement,
  images: LetterFlowImage[] = [],
): LetterPaginationResult {
  const firstFlow = bodyCapacityPx(measurementRoot, "first-flow", false);
  const firstFinal = bodyCapacityPx(measurementRoot, "first-final", true);
  const continuationFlow = bodyCapacityPx(measurementRoot, "continuation-flow", false);
  const continuationFinal = bodyCapacityPx(measurementRoot, "continuation-final", true);
  const sourceBody = probe(measurementRoot, "source")?.querySelector<HTMLElement>(
    "[data-letter-pdf-richtext='body']",
  );

  if (
    firstFlow === null ||
    firstFinal === null ||
    continuationFlow === null ||
    continuationFinal === null ||
    !sourceBody
  ) {
    return {
      pages: [],
      issue: {
        code: "measurement-failed",
        message: "Der Seitenumbruch konnte nicht zuverlässig vermessen werden. Bitte lade die Ansicht neu.",
      },
    };
  }

  const measurer = createHeightMeasurer(sourceBody);
  try {
    const units = measuredUnits(sourceBody);
    const imageResult = measuredImagePlacements(
      measurementRoot,
      images,
      firstFlow,
      continuationFlow,
    );
    if (imageResult.issue) return { pages: [], issue: imageResult.issue };
    const placements = imageResult.placements;

    const capacity = (pageIndex: number, finalPage: boolean) => {
      const base =
        pageIndex === 0
          ? finalPage
            ? firstFinal
            : firstFlow
          : finalPage
            ? continuationFinal
            : continuationFlow;
      return Math.max(0, base - imageCostForPage(placements, pageIndex));
    };
    const fits = (candidate: PaginationUnit[], pageIndex: number, finalPage: boolean) =>
      measurer.measure(serializeUnits(candidate)) <=
      capacity(pageIndex, finalPage) + FIT_EPSILON_PX;

    // Preserve the exact legacy one-page contract whenever body + final tail
    // fit on page 1 and no image had to move to a continuation page.
    if (!placements.some((placement) => placement.pageIndex > 0) && fits(units, 0, true)) {
      return {
        pages: [
          {
            pageIndex: 0,
            finalPage: true,
            bodyHtml: serializeUnits(units) || EMPTY_BODY_HTML,
            images: imagesForPage(placements, 0),
          },
        ],
        issue: null,
      };
    }

    const pages: LetterPageFragment[] = [];
    let remaining = [...units];
    let pageIndex = 0;

    while (pageIndex < 100) {
      if (fits(remaining, pageIndex, true)) {
        pages.push({
          pageIndex,
          finalPage: true,
          bodyHtml: serializeUnits(remaining) || EMPTY_BODY_HTML,
          images: imagesForPage(placements, pageIndex),
        });
        return { pages, issue: null };
      }

      const page = takePage(remaining, capacity(pageIndex, false), measurer.measure);
      if (page.issue) return { pages: [], issue: page.issue };
      if (!page.taken.length) {
        return {
          pages: [],
          issue: {
            code: "measurement-failed",
            message: "Für diese Seite steht kein sicher nutzbarer Textbereich zur Verfügung.",
          },
        };
      }

      let taken = page.taken;
      let nextRemaining = page.remaining;

      // If non-final geometry swallowed the whole body only because it did not
      // reserve closing/signature space, keep at least the last semantic block
      // for the next page where possible. This avoids a gratuitous closing-only
      // page while still preferring block boundaries over paragraph splitting.
      if (!nextRemaining.length && taken.length > 1) {
        const last = taken[taken.length - 1];
        taken = taken.slice(0, -1);
        nextRemaining = [last];
      } else if (!nextRemaining.length && taken.length === 1 && taken[0].kind === "block") {
        const split = splitBlockToFit(taken[0], capacity(pageIndex, false), measurer.measure);
        if (
          split &&
          measurer.measure(serializeUnits([split.suffix])) <=
            capacity(pageIndex + 1, true) + FIT_EPSILON_PX
        ) {
          taken = [split.prefix];
          nextRemaining = [split.suffix];
        }
      }

      pages.push({
        pageIndex,
        finalPage: false,
        bodyHtml: serializeUnits(taken) || EMPTY_BODY_HTML,
        images: imagesForPage(placements, pageIndex),
      });
      remaining = nextRemaining;
      pageIndex += 1;
    }

    return {
      pages: [],
      issue: {
        code: "measurement-failed",
        message: "Der Brief würde unerwartet viele Seiten erzeugen. Prüfe den eingefügten Inhalt.",
      },
    };
  } finally {
    measurer.dispose();
  }
}
