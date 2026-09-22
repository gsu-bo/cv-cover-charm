import { useRef, useState } from "react";
import type { Block, BlockStyle, CoverData, Line } from "./types";
import { FONT_STACKS } from "./types";
import { resolveColor } from "./layouts";
import { ShapeElement } from "./ShapeElement";
import { resolveLayout } from "./resolve";
import { clampBlockDragPosition } from "./drag-bounds";
import { hasUserStyle } from "./user-style-precedence";
import { FRAME, PAGE } from "@/default-config";

const MM = 96 / 25.4; // px pro mm bei 96dpi
const { WIDTH: PAGE_W } = PAGE;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const EDGE_EPSILON_MM = 0.05;
const EDGE_BLEED_PX = 1;

type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const RESIZE_HANDLES: Array<{
  direction: ResizeDirection;
  left: string;
  top: string;
  cursor: string;
}> = [
  { direction: "nw", left: "0%", top: "0%", cursor: "nwse-resize" },
  { direction: "n", left: "50%", top: "0%", cursor: "ns-resize" },
  { direction: "ne", left: "100%", top: "0%", cursor: "nesw-resize" },
  { direction: "e", left: "100%", top: "50%", cursor: "ew-resize" },
  { direction: "se", left: "100%", top: "100%", cursor: "nwse-resize" },
  { direction: "s", left: "50%", top: "100%", cursor: "ns-resize" },
  { direction: "sw", left: "0%", top: "100%", cursor: "nesw-resize" },
  { direction: "w", left: "0%", top: "50%", cursor: "ew-resize" },
];

const RESIZE_DIRECTION_LABEL: Record<ResizeDirection, string> = {
  n: "oben",
  ne: "oben rechts",
  e: "rechts",
  se: "unten rechts",
  s: "unten",
  sw: "unten links",
  w: "links",
  nw: "oben links",
};

export type Point = { x: number; y: number };

type DossierTextRole = "name" | "subtitle" | "heading" | "body" | "muted";
type LayeredStyle = BlockStyle & { layer?: "back" | "front" };

/** Gemeinsame semantische Hierarchie für Titelblatt und Lebenslauf. */
function dossierRole(block: Block): DossierTextRole | undefined {
  if (block.kind !== "text") return undefined;
  if (block.id === "name") return "name";
  if (block.id === "beruf") return "subtitle";
  if (["eyebrow", "kicker", "kontaktTitel", "anTitel", "beilagenTitel"].includes(block.id))
    return "heading";
  if (["ortDatum", "lehrbeginn"].includes(block.id)) return "muted";
  if (["kontakt", "empfaenger", "beilagen"].includes(block.id)) return "body";
  return undefined;
}

function initials(data: CoverData) {
  return [data.vorname, data.nachname]
    .map((s) => s?.[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
}

function textStyle(
  st: BlockStyle,
  size: number,
  colors: Record<string, string>,
): React.CSSProperties {
  return {
    fontSize: `${size}pt`,
    lineHeight: st.lineHeight,
    color: resolveColor(st.color, colors),
    textAlign: st.align,
    fontWeight: st.weight,
    fontStyle: st.italic ? "italic" : "normal",
    textDecoration: st.underline ? "underline" : "none",
    textTransform: st.uppercase ? "uppercase" : "none",
    letterSpacing: `${st.tracking}em`,
    opacity: st.opacity,
    fontFamily: FONT_STACKS[st.font],
    whiteSpace: "pre-wrap",
  };
}

/**
 * Rahmen um Foto und Bilder.
 *
 * Bewusst als `box-shadow` und nicht als `border`: der Rahmen liegt damit
 * ausserhalb der Box, die eingestellte Bildgrösse bleibt also exakt erhalten.
 * `fallback` ist die Vorgabe, solange niemand am Regler war.
 */
function frameShadow(
  st: BlockStyle,
  colors: Record<string, string>,
  fallback: number,
): string | undefined {
  const mm = st.borderWidth ?? fallback;
  if (mm <= 0) return undefined;
  const color = resolveColor(st.borderColor ?? st.color, colors);
  const gap = FRAME.GAP_PX;
  return `0 0 0 ${gap}px ${colors.bg}, 0 0 0 ${gap + mm * MM}px ${color}`;
}

/** Eckenradius des Fotorahmens: 999 = Kreis, sonst mm. */
export function photoRadius(st: BlockStyle): string | number {
  const r = st.radius ?? 0;
  if (r >= 999) return "9999px";
  return r > 0 ? `${r}mm` : 0;
}

/**
 * Bildausschnitt wie in Word: `imgZoom` vergrössert, `imgX`/`imgY` verschieben
 * den sichtbaren Ausschnitt innerhalb des Rahmens.
 */
export function crop(st: BlockStyle): React.CSSProperties {
  const zoom = Math.max(1, st.imgZoom ?? 1);
  const x = st.imgX ?? 50;
  const y = st.imgY ?? 50;
  return {
    position: "absolute",
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
    left: `${-(zoom - 1) * x}%`,
    top: `${-(zoom - 1) * y}%`,
    objectFit: "cover",
  };
}

function marker(st: BlockStyle, index: number): string {
  switch (st.list) {
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

function renderLine(line: Line, colors: Record<string, string>) {
  if (typeof line === "string") return line;
  return line.map((seg, i) => (
    <span
      key={i}
      style={{
        color: seg.color ? resolveColor(seg.color, colors) : undefined,
        fontWeight: seg.weight,
      }}
    >
      {seg.t}
    </span>
  ));
}

type Props = {
  blocks: Block[];
  colors: Record<string, string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, patch: Partial<BlockStyle>) => void;
  /** Gemeinsame berechnete Dossier-Schrift für semantische Titelblattrollen. */
  dossierFont?: string;
  /** Globale Schriftskalierung (1 = Vorlagen-Standard). */
  fontScale?: number;
  editable?: boolean;
  /** Zeichenmodus: Ziehen erzeugt eine Freihandform statt zu verschieben. */
  drawing?: boolean;
  onDrawn?: (points: Point[]) => void;
  /**
   * Nur das Titelblatt hat einen Fotoblock unter seinen Elementen. Ohne Daten
   * wird er übersprungen – der Lebenslauf setzt sein Foto selbst.
   */
  data?: CoverData;
};

/**
 * Die bedienbare Ebene über einem A4-Blatt: Elemente zeichnen, auswählen, mit
 * der Maus verschieben und freihand neue Formen ziehen.
 *
 * Sie sass früher fest in `CoverCanvas`. Der Lebenslauf braucht dieselbe
 * Bedienung, und zwei Kopien davon würden sofort auseinanderlaufen – darum
 * steht sie hier für beide Blätter.
 */
export function BlockLayer({
  blocks,
  colors,
  selected,
  onSelect,
  onMove,
  dossierFont,
  fontScale = 1,
  editable = true,
  drawing = false,
  onDrawn,
  data,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  const layout = resolveLayout(blocks, fontScale);
  const [stroke, setStroke] = useState<Point[]>([]);

  /** Zeigerposition in mm auf dem Blatt. */
  const toMm = (e: { clientX: number; clientY: number }): Point => {
    const rect = pageRef.current!.getBoundingClientRect();
    const scale = rect.width / PAGE_W;
    return {
      x: (e.clientX - rect.left) / scale / MM,
      y: (e.clientY - rect.top) / scale / MM,
    };
  };

  const startDraw = (e: React.PointerEvent) => {
    if (!pageRef.current) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const points: Point[] = [toMm(e)];
    setStroke(points);

    const move = (ev: PointerEvent) => {
      const p = toMm(ev);
      const last = points[points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.6) return;
      points.push(p);
      setStroke([...points]);
    };
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setStroke([]);
      if (points.length > 1) onDrawn?.(points);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  /**
   * Verkettete Vorlagenblöcke an ihrer sichtbaren Position einfrieren. So
   * verändert das freie Ziehen oder Skalieren nur das bewusst gewählte Feld.
   */
  const detachBlocksDependingOn = (targetId: string) => {
    const byId = new Map(blocks.map((candidate) => [candidate.id, candidate]));

    const dependsOnTarget = (candidate: Block): boolean => {
      let link = candidate.style.follows || candidate.style.above || null;
      const seen = new Set<string>();
      while (link && !seen.has(link)) {
        if (link === targetId) return true;
        seen.add(link);
        const parent = byId.get(link);
        link = parent ? parent.style.follows || parent.style.above || null : null;
      }
      return false;
    };

    for (const candidate of blocks) {
      if (candidate.id === targetId || !dependsOnTarget(candidate)) continue;
      onMove(candidate.id, {
        y: layout[candidate.id]?.y ?? candidate.style.y,
        follows: null,
        above: null,
        anchorBottom: false,
      });
    }
  };

  const startDrag = (e: React.PointerEvent, block: Block) => {
    if (!editable || drawing) return;
    e.preventDefault();
    onSelect(block.id);
    const page = pageRef.current;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const scale = rect.width / PAGE_W;
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = block.style.x;
    const oy = layout[block.id]?.y ?? block.style.y;
    const el = e.currentTarget as HTMLElement;
    const elementRect = el.getBoundingClientRect();
    const heightMm = elementRect.height / scale / MM;
    el.setPointerCapture(e.pointerId);
    let detachedDependents = false;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale / MM;
      const dy = (ev.clientY - startY) / scale / MM;
      if (!detachedDependents && Math.hypot(dx, dy) >= 0.05) {
        detachBlocksDependingOn(block.id);
        detachedDependents = true;
      }
      const position = clampBlockDragPosition({
        id: block.id,
        x: ox + dx,
        y: oy + dy,
        width: block.style.w,
        height: heightMm,
      });
      onMove(block.id, {
        x: Math.round(position.x * 10) / 10,
        y: Math.round(position.y * 10) / 10,
        ...(block.style.follows ? { follows: null } : {}),
        ...(block.style.above ? { above: null } : {}),
        ...(block.style.anchorBottom ? { anchorBottom: false } : {}),
      });
    };
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const startResize = (e: React.PointerEvent, block: Block, direction: ResizeDirection) => {
    if (!editable || drawing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(block.id);
    const page = pageRef.current;
    const element = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-block-id]");
    if (!page || !element) return;
    const pageRect = page.getBoundingClientRect();
    const scale = pageRect.width / PAGE_W;
    const elementRect = element.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const fromX = block.style.x;
    const fromY = layout[block.id]?.y ?? block.style.y;
    const fromWidth = block.style.w;
    const fromHeight = elementRect.height / scale / MM;
    const originalRight = fromX + fromWidth;
    const originalBottom = fromY + fromHeight;
    const minWidth = 5;
    const minHeight = block.kind === "text" ? 6 : 5;
    const lockRatio =
      block.kind !== "text" &&
      block.shape !== "line" &&
      (block.style.lockRatio ?? (block.kind === "photo" || block.kind === "image"));
    let detachedDependents = false;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale / MM;
      const dy = (ev.clientY - startY) / scale / MM;
      if (!detachedDependents && Math.hypot(dx, dy) >= 0.05) {
        detachBlocksDependingOn(block.id);
        detachedDependents = true;
      }

      let left = fromX;
      let top = fromY;
      let right = originalRight;
      let bottom = originalBottom;
      if (direction.includes("e")) {
        right = Math.max(left + minWidth, Math.min(PAGE_W_MM, originalRight + dx));
      }
      if (direction.includes("w")) {
        left = Math.max(0, Math.min(right - minWidth, fromX + dx));
      }
      if (direction.includes("s")) {
        bottom = Math.max(top + minHeight, Math.min(PAGE_H_MM, originalBottom + dy));
      }
      if (direction.includes("n")) {
        top = Math.max(0, Math.min(bottom - minHeight, fromY + dy));
      }

      if (lockRatio) {
        const horizontal = direction.includes("e") || direction.includes("w");
        const vertical = direction.includes("n") || direction.includes("s");
        const rawWidthScale = (right - left) / Math.max(fromWidth, 0.1);
        const rawHeightScale = (bottom - top) / Math.max(fromHeight, 0.1);
        let requestedScale = 1;
        if (horizontal && vertical) {
          requestedScale =
            Math.abs(rawWidthScale - 1) >= Math.abs(rawHeightScale - 1)
              ? rawWidthScale
              : rawHeightScale;
        } else if (horizontal) {
          requestedScale = rawWidthScale;
        } else if (vertical) {
          requestedScale = rawHeightScale;
        }

        const centerX = fromX + fromWidth / 2;
        const centerY = fromY + fromHeight / 2;
        let maxScale = Number.POSITIVE_INFINITY;
        if (horizontal && vertical) {
          const maxWidth = direction.includes("w") ? originalRight : PAGE_W_MM - fromX;
          const maxHeight = direction.includes("n") ? originalBottom : PAGE_H_MM - fromY;
          maxScale = Math.min(maxWidth / fromWidth, maxHeight / fromHeight);
        } else if (horizontal) {
          const maxWidth = direction.includes("w") ? originalRight : PAGE_W_MM - fromX;
          const maxCenteredHeight = 2 * Math.min(centerY, PAGE_H_MM - centerY);
          maxScale = Math.min(maxWidth / fromWidth, maxCenteredHeight / fromHeight);
        } else if (vertical) {
          const maxHeight = direction.includes("n") ? originalBottom : PAGE_H_MM - fromY;
          const maxCenteredWidth = 2 * Math.min(centerX, PAGE_W_MM - centerX);
          maxScale = Math.min(maxHeight / fromHeight, maxCenteredWidth / fromWidth);
        }

        const minScale = Math.max(minWidth / fromWidth, minHeight / fromHeight);
        const lockedScale = Math.max(minScale, Math.min(maxScale, requestedScale));
        const width = Math.round(fromWidth * lockedScale * 10) / 10;
        const visualRatio = fromHeight / Math.max(fromWidth, 0.1);
        const height = width * visualRatio;

        if (horizontal) {
          left = direction.includes("w") ? originalRight - width : fromX;
        } else {
          left = centerX - width / 2;
        }
        if (vertical) {
          top = direction.includes("n") ? originalBottom - height : fromY;
        } else {
          top = centerY - height / 2;
        }

        onMove(block.id, {
          x: Math.round(left * 10) / 10,
          y: Math.round(top * 10) / 10,
          w: width,
          ...(block.style.follows ? { follows: null } : {}),
          ...(block.style.above ? { above: null } : {}),
          ...(block.style.anchorBottom ? { anchorBottom: false } : {}),
        });
        return;
      }

      const width = Math.round((right - left) * 10) / 10;
      const height = Math.round((bottom - top) * 10) / 10;
      const patch: Partial<BlockStyle> = {
        x: Math.round(left * 10) / 10,
        y: Math.round(top * 10) / 10,
        w: width,
        ...(block.style.follows ? { follows: null } : {}),
        ...(block.style.above ? { above: null } : {}),
        ...(block.style.anchorBottom ? { anchorBottom: false } : {}),
      };
      if (block.kind === "text") patch.h = height;
      else patch.ratio = height / Math.max(width, 0.1);
      onMove(block.id, patch);
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <div ref={pageRef} className="absolute inset-0">
      {blocks.map((b) => {
        if (b.style.hidden) return null;
        const isPhoto = b.kind === "photo";
        const isShape = b.kind === "shape";
        const isImage = b.kind === "image";
        const isText = b.kind === "text";
        const isLine = isShape && b.shape === "line";
        if (isPhoto && !data) return null;
        const empty = isPhoto
          ? !data!.foto && !initials(data!)
          : !isShape && !isImage && !b.src && b.lines.length === 0;
        if (empty) return null;
        const active = editable && selected === b.id;
        const st = b.style;
        const { size, y } = layout[b.id];
        const hasBadge = b.kind === "text" && !!st.bg;
        const textBorder = st.borderWidth ?? 0;
        const role = dossierRole(b);
        const customLayer = b.id.startsWith("custom-")
          ? ((st as LayeredStyle).layer ?? "front")
          : "content";
        const zIndex = customLayer === "back" ? 1 : customLayer === "front" ? 7 : 5;

        /*
         * A4 uses integer source pixels (794 × 1123), while millimetres resolve
         * to fractional CSS pixels. Edge-aligned editable decorations can
         * therefore stop a fraction of a pixel before the clipped page edge
         * and expose a visible hairline after preview scaling. Keep the stored
         * millimetre geometry exact and add one render-only source pixel.
         */
        const shapeHeightMm = isShape && !isLine ? st.w * (st.ratio ?? 1) : 0;
        const isDecoration = b.id.startsWith("decor-");
        const bleedRight = isDecoration && Math.abs(st.x + st.w - PAGE_W_MM) <= EDGE_EPSILON_MM;
        const bleedBottom =
          isDecoration &&
          isShape &&
          !isLine &&
          Math.abs(y + shapeHeightMm - PAGE_H_MM) <= EDGE_EPSILON_MM;
        const renderedShapeStyle =
          bleedBottom && st.w > 0
            ? { ...st, ratio: (shapeHeightMm + EDGE_BLEED_PX / MM) / st.w }
            : st;

        return (
          <div
            key={b.id}
            data-block-id={b.id}
            data-element-selected={active ? "true" : undefined}
            data-element-layer={customLayer}
            data-dossier-role={role}
            data-dossier-accent={b.id === "trenner" ? "rule" : undefined}
            data-dossier-photo={isPhoto ? "applicant" : undefined}
            data-cover-user-weight={isText && hasUserStyle(b, "weight") ? "true" : undefined}
            data-cover-user-uppercase={isText && hasUserStyle(b, "uppercase") ? "true" : undefined}
            data-cover-user-font={isText && hasUserStyle(b, "font") ? "true" : undefined}
            data-cover-user-size={isText && hasUserStyle(b, "size") ? "true" : undefined}
            data-cover-user-tracking={isText && hasUserStyle(b, "tracking") ? "true" : undefined}
            data-cover-user-line-height={
              isText && hasUserStyle(b, "lineHeight") ? "true" : undefined
            }
            data-cover-user-color={isText && hasUserStyle(b, "color") ? "true" : undefined}
            data-cover-user-opacity={isText && hasUserStyle(b, "opacity") ? "true" : undefined}
            data-cover-user-italic={isText && hasUserStyle(b, "italic") ? "true" : undefined}
            data-cover-user-underline={isText && hasUserStyle(b, "underline") ? "true" : undefined}
            data-cover-user-align={isText && hasUserStyle(b, "align") ? "true" : undefined}
            onPointerDown={(e) => startDrag(e, b)}
            className="absolute"
            style={{
              left: `${st.x}mm`,
              top: `${y}mm`,
              width: bleedRight ? `calc(${st.w}mm + ${EDGE_BLEED_PX}px)` : `${st.w}mm`,
              ["--dossier-font" as string]:
                role && dossierFont ? dossierFont : FONT_STACKS[st.font],
              ["--cover-user-font-weight" as string]: `${st.weight}`,
              ["--cover-user-text-transform" as string]: st.uppercase ? "uppercase" : "none",
              ["--cover-user-font-family" as string]: FONT_STACKS[st.font],
              ["--cover-user-font-size" as string]: `${size}pt`,
              ["--cover-user-letter-spacing" as string]: `${st.tracking}em`,
              ["--cover-user-line-height" as string]: `${st.lineHeight}`,
              ["--cover-user-color" as string]: resolveColor(st.color, colors),
              ["--cover-user-opacity" as string]: `${st.opacity}`,
              ["--cover-user-font-style" as string]: st.italic ? "italic" : "normal",
              ["--cover-user-text-decoration" as string]: st.underline ? "underline" : "none",
              ["--cover-user-text-align" as string]: st.align,
              zIndex,
              pointerEvents: isShape && b.shape === "path" ? "none" : undefined,
              cursor: editable && !drawing ? "move" : "default",
              touchAction: "none",
              outline: active ? "1px dashed rgba(59,130,246,0.9)" : "none",
              outlineOffset: "2px",
              boxShadow: active ? "0 0 0 4px rgba(59,130,246,0.12)" : "none",
            }}
          >
            {isShape ? (
              <ShapeElement
                shape={b.shape ?? "rect"}
                path={b.path}
                style={renderedShapeStyle}
                colors={colors}
              />
            ) : isImage ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: `${st.w * (st.ratio ?? 1)}mm`,
                  overflow: "hidden",
                  borderRadius: photoRadius(st),
                  border: b.src ? "none" : `1px dashed ${resolveColor(st.color, colors)}`,
                  boxShadow: b.src ? frameShadow(st, colors, 0) : undefined,
                  opacity: st.opacity,
                }}
              >
                {b.src ? (
                  <img src={b.src} alt="" draggable={false} style={crop(st)} />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      color: resolveColor(st.color, colors),
                      fontFamily: FONT_STACKS[st.font],
                      fontSize: `${Math.max(7, st.w * 0.13)}pt`,
                      textAlign: "center",
                      padding: "2mm",
                    }}
                  >
                    Bild wählen
                  </div>
                )}
              </div>
            ) : isPhoto ? (
              data!.foto ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: `${st.w * (st.ratio ?? 1)}mm`,
                    overflow: "hidden",
                    borderRadius: photoRadius(st),
                    boxShadow: frameShadow(st, colors, FRAME.PHOTO_WIDTH),
                  }}
                >
                  <img src={data!.foto} alt="Bewerbungsfoto" draggable={false} style={crop(st)} />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "100%",
                    height: `${st.w * (st.ratio ?? 1)}mm`,
                    borderRadius: photoRadius(st),
                    background: st.fill ? resolveColor(st.fill, colors) : "transparent",
                    border: `1px solid ${resolveColor(st.color, colors)}`,
                    color: resolveColor(st.color, colors),
                    fontFamily: FONT_STACKS[st.font],
                    fontWeight: st.weight >= 600 ? st.weight : 400,
                    fontSize: `${Math.max(14, st.w * 0.42) * fontScale}pt`,
                  }}
                >
                  {initials(data!)}
                </div>
              )
            ) : (
              <div
                style={{
                  ...textStyle(st, size, colors),
                  boxSizing: "border-box",
                  minHeight:
                    Math.max(st.h ?? 0, b.src ? st.w * (st.ratio ?? 0.6) : 0) > 0
                      ? `${Math.max(st.h ?? 0, b.src ? st.w * (st.ratio ?? 0.6) : 0)}mm`
                      : undefined,
                  ...(textBorder > 0 || b.src
                    ? {
                        position: "relative",
                        overflow: b.src ? "hidden" : undefined,
                        borderRadius: `${st.boxRadius ?? 0}mm`,
                        border:
                          textBorder > 0
                            ? `${textBorder}mm solid ${resolveColor(st.borderColor ?? st.color, colors)}`
                            : undefined,
                        padding: `${st.padY}mm ${st.padX}mm`,
                      }
                    : {}),
                }}
              >
                {b.src && <img src={b.src} alt="" draggable={false} style={crop(st)} />}
                {b.lines.map((l, i) => (
                  <div key={i} style={b.src ? { position: "relative" } : undefined}>
                    {hasBadge ? (
                      <span
                        style={{
                          display: "inline-block",
                          background: resolveColor(st.bg as string, colors),
                          padding: `${st.padY}mm ${st.padX}mm`,
                          borderRadius: st.bgRadius >= 999 ? "9999px" : `${st.bgRadius}mm`,
                        }}
                      >
                        {marker(st, i)}
                        {renderLine(l, colors)}
                      </span>
                    ) : (
                      <>
                        {marker(st, i)}
                        {renderLine(l, colors)}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {active
              ? RESIZE_HANDLES.filter(
                  (handle) => !isLine || ["e", "w"].includes(handle.direction),
                ).map((handle) => (
                  <span
                    key={handle.direction}
                    data-element-resize-handle={handle.direction}
                    role="button"
                    tabIndex={-1}
                    aria-label={`${b.label}: Grösse ${RESIZE_DIRECTION_LABEL[handle.direction]} ändern`}
                    onPointerDown={(event) => startResize(event, b, handle.direction)}
                    style={{
                      position: "absolute",
                      left: handle.left,
                      top: handle.top,
                      width: "9px",
                      height: "9px",
                      transform: "translate(-50%, -50%)",
                      border: "1.5px solid rgb(37,99,235)",
                      borderRadius: "2px",
                      background: "white",
                      boxShadow: "0 1px 3px rgba(15,23,42,0.28)",
                      cursor: handle.cursor,
                      touchAction: "none",
                      pointerEvents: "auto",
                      zIndex: 20,
                    }}
                  />
                ))
              : null}
          </div>
        );
      })}

      {drawing && (
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: "crosshair", touchAction: "none" }}
          onPointerDown={startDraw}
        >
          {stroke.length > 1 && (
            <svg
              className="pointer-events-none absolute inset-0"
              width="100%"
              height="100%"
              viewBox="0 0 210 297"
              preserveAspectRatio="none"
            >
              <polyline
                points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="rgb(59,130,246)"
                strokeWidth={0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
