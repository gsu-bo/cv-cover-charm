import { resolveLayout } from "@/components/cover/resolve";
import type { Block, FontKey, Line, ShapeKind } from "@/components/cover/types";
import { FRAME } from "@/default-config";
import type { CoverPdfDocument } from "@/lib/dossier-pdf-document";

export type DossierDocxV2TextRun = {
  text: string;
  color: string;
  weight: number;
};

export type DossierDocxV2TextLine = {
  runs: DossierDocxV2TextRun[];
};

export type DossierDocxV2BadgeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  radius: number;
};

export type DossierDocxV2CoverNode = {
  id: string;
  kind: Block["kind"];
  layer: "decor" | "back" | "content" | "front";
  shape?: ShapeKind;
  path?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  color: string;
  fill: string | null;
  strokeWidth: number;
  borderWidth: number;
  borderColor: string;
  radius: number;
  boxRadius: number;
  font: string;
  fontSizePt: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  trackingEm: number;
  lineHeight: number;
  align: "left" | "center" | "right" | "justify";
  padX: number;
  padY: number;
  background: string | null;
  backgroundRadius: number;
  badgeRects: DossierDocxV2BadgeRect[];
  mediaDataUrl: string | null;
  imageZoom: number;
  imageX: number;
  imageY: number;
  gradient: null | {
    from: string;
    to: string;
    start: number;
    end: number;
    angle: number;
  };
  lines: DossierDocxV2TextLine[];
  source: Block;
};

export type DossierDocxV2CoverScene = {
  templateId: string;
  paperColor: string;
  nodes: DossierDocxV2CoverNode[];
};

const WORD_FONT_BY_KEY: Record<FontKey, string> = {
  sans: "Arial",
  serif: "Georgia",
  times: "Times New Roman",
  humanist: "Verdana",
  freundlich: "Cabin",
  schmal: "Arial Narrow",
  maschine: "Courier New",
  plakativ: "Impact",
};

function validHex(value: string | null | undefined): value is string {
  return /^#[0-9a-f]{6}$/i.test((value ?? "").trim());
}

/** Resolve a canonical editor color slot without re-encoding template palettes. */
export function dossierDocxV2ResolveColor(
  value: string | null | undefined,
  colors: Record<string, string>,
  fallback = "#111111",
) {
  if (!value) return fallback;
  const resolved = colors[value] ?? value;
  return validHex(resolved) ? resolved.toLowerCase() : fallback;
}

function resolveCoverColorToken(
  value: string | null | undefined,
  cover: CoverPdfDocument,
  text = false,
) {
  if (text && value === "ink" && validHex(cover.colors.coverInk)) {
    return cover.colors.coverInk.toLowerCase();
  }
  return dossierDocxV2ResolveColor(value, cover.colors);
}

function lineRuns(
  line: Line,
  block: Block,
  cover: CoverPdfDocument,
): DossierDocxV2TextRun[] {
  if (typeof line === "string") {
    return [
      {
        text: block.style.uppercase ? line.toUpperCase() : line,
        color: resolveCoverColorToken(block.style.color, cover, true),
        weight: block.style.weight,
      },
    ];
  }
  return line.map((segment) => ({
    text: block.style.uppercase ? segment.t.toUpperCase() : segment.t,
    color: resolveCoverColorToken(segment.color ?? block.style.color, cover, true),
    weight: segment.weight ?? block.style.weight,
  }));
}

function marker(block: Block, index: number) {
  switch (block.style.list) {
    case "bullet":
      return "• ";
    case "dash":
      return "– ";
    case "number":
      return `${index + 1}. `;
    default:
      return "";
  }
}

function withMarker(runs: DossierDocxV2TextRun[], prefix: string) {
  if (!prefix || !runs.length) return runs;
  return [{ ...runs[0], text: `${prefix}${runs[0].text}` }, ...runs.slice(1)];
}

function visualHeight(block: Block, resolvedHeight: number) {
  if (block.kind === "text") {
    const mediaHeight = block.src ? block.style.w * (block.style.ratio ?? 0.6) : 0;
    return Math.max(block.style.h ?? 0, resolvedHeight, mediaHeight, 0.1);
  }
  return Math.max(block.style.w * (block.style.ratio ?? 1), 0.1);
}

function blockLayer(block: Block): DossierDocxV2CoverNode["layer"] {
  if (block.id.startsWith("decor-")) return "decor";
  if (!block.id.startsWith("custom-")) return "content";
  const layer = (block.style as typeof block.style & { layer?: "back" | "front" }).layer;
  return layer === "back" ? "back" : "front";
}

function nodeFromBlock(
  block: Block,
  cover: CoverPdfDocument,
  layout: ReturnType<typeof resolveLayout>,
): DossierDocxV2CoverNode {
  const st = block.style;
  const resolved = layout[block.id];
  const fill = st.fill ? dossierDocxV2ResolveColor(st.fill, cover.colors, "#ffffff") : null;
  const gradient = st.gradFrom
    ? {
        from: dossierDocxV2ResolveColor(st.gradFrom, cover.colors, fill ?? "#111111"),
        to: dossierDocxV2ResolveColor(st.gradTo ?? st.gradFrom, cover.colors, fill ?? "#111111"),
        start: st.gradStart ?? 0,
        end: st.gradEnd ?? 100,
        angle: st.gradAngle ?? 135,
      }
    : null;
  const primaryColor = resolveCoverColorToken(block.style.color, cover, block.kind === "text");
  const lines = block.lines.map((line, index) => ({
    runs: withMarker(lineRuns(line, block, cover), marker(block, index)),
  }));

  return {
    id: block.id,
    kind: block.kind,
    layer: blockLayer(block),
    shape: block.shape,
    path: block.path,
    x: st.x,
    y: resolved?.y ?? st.y,
    width: st.w,
    height: visualHeight(block, resolved?.height ?? 0),
    opacity: Math.max(0, Math.min(1, st.opacity)),
    color: primaryColor,
    fill,
    strokeWidth: Math.max(0, st.strokeWidth ?? 0),
    borderWidth: Math.max(0, st.borderWidth ?? (block.kind === "photo" ? FRAME.PHOTO_WIDTH : 0)),
    borderColor: dossierDocxV2ResolveColor(st.borderColor ?? st.color, cover.colors),
    radius: st.radius ?? 0,
    boxRadius: st.boxRadius ?? 0,
    font: WORD_FONT_BY_KEY[st.font],
    fontSizePt: resolved?.size ?? st.size * cover.fontScale,
    fontWeight: st.weight,
    italic: st.italic,
    underline: st.underline,
    uppercase: st.uppercase,
    trackingEm: st.tracking,
    lineHeight: st.lineHeight,
    align: st.align,
    padX: st.borderWidth || block.src ? st.padX : 0,
    padY: st.borderWidth || block.src ? st.padY : 0,
    background: st.bg ? dossierDocxV2ResolveColor(st.bg, cover.colors, "#ffffff") : null,
    backgroundRadius: st.bgRadius,
    badgeRects: [],
    mediaDataUrl:
      block.kind === "photo"
        ? cover.data.foto
        : block.kind === "image" || block.kind === "text"
          ? (block.src ?? null)
          : null,
    imageZoom: Math.max(1, st.imgZoom ?? 1),
    imageX: Math.max(0, Math.min(100, st.imgX ?? 50)),
    imageY: Math.max(0, Math.min(100, st.imgY ?? 50)),
    gradient,
    lines,
    source: block,
  };
}

function blockRendersOnCover(block: Block, cover: CoverPdfDocument) {
  if (block.style.hidden) return false;
  if (block.kind === "shape" || block.kind === "image") return true;
  if (block.kind === "photo") {
    const hasInitials = [cover.data.vorname, cover.data.nachname].some((value) =>
      Boolean(value?.trim()),
    );
    return Boolean(cover.data.foto) || hasInitials;
  }
  return Boolean(block.src) || block.lines.length > 0;
}

/**
 * Baseline DOCX V2 cover scene.
 *
 * `CoverPdfDocument.blocks` is the persisted semantic/editor contract (template
 * defaults + user overrides), so V2 starts here instead of rebuilding geometry
 * from Warm/recipe constants. It is deliberately *not* treated as final visual
 * geometry: the browser bridge measures the real CoverCanvas afterwards because
 * a few current templates still apply late CSS transforms and structural art.
 */
export function buildDossierDocxV2CoverScene(cover: CoverPdfDocument): DossierDocxV2CoverScene {
  const layout = resolveLayout(cover.blocks, cover.fontScale);
  const nodes = cover.blocks
    .filter((block) => blockRendersOnCover(block, cover))
    .map((block) => nodeFromBlock(block, cover, layout));

  return {
    templateId: String(cover.template),
    paperColor: dossierDocxV2ResolveColor(
      cover.colors.coverPaper ?? cover.colors.bg ?? cover.colors.sheet,
      cover.colors,
      "#ffffff",
    ),
    nodes,
  };
}
