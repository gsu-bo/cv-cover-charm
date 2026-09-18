import type { LetterFlowImage } from "./types";
import {
  LETTER_IMAGE_MAX_TOP_MM,
  LETTER_IMAGE_MAX_WIDTH_MM,
  LETTER_IMAGE_MIN_WIDTH_MM,
  clampLetterImageValue,
  letterImagePlacementPatch,
  normalizeLetterImageGeometry,
  type LetterImagePlacement,
} from "./letter-image-geometry";

type Props = {
  images: LetterFlowImage[];
  contentWidthMm: number;
  exportMode?: boolean;
  onChange?: (id: string, patch: Partial<LetterFlowImage>) => void;
  onRemove?: (id: string) => void;
};

const PLACEMENT_LABEL: Record<LetterImagePlacement, string> = {
  left: "Links mit Textfluss",
  right: "Rechts mit Textfluss",
  free: "Frei positionieren",
};

/**
 * Left/right use a real CSS float so text deliberately wraps around the image.
 * Once an image gets an explicit x-coordinate it is truly free: x/y are then
 * measured from the letter body zone and PDF renders exactly that geometry.
 * The same normalized geometry is reused by the DOCX postprocessor.
 */
export function LetterFlowImages({
  images,
  contentWidthMm,
  exportMode = false,
  onChange,
  onRemove,
}: Props) {
  const valid = images.filter(
    (image) =>
      image &&
      typeof image.id === "string" &&
      typeof image.src === "string" &&
      image.src.startsWith("data:"),
  );

  const startMove = (image: LetterFlowImage) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (exportMode || !onChange || event.button !== 0) return;
    const zone = event.currentTarget.closest<HTMLElement>("[data-letter-body-zone]");
    if (!zone) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = zone.getBoundingClientRect();
    if (!rect.width) return;
    const mmPerPx = contentWidthMm / rect.width;
    const imageRect = event.currentTarget.getBoundingClientRect();
    const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
    const maxX = Math.max(0, contentWidthMm - geometry.widthMm);
    const grabOffsetX = event.clientX - imageRect.left;
    const grabOffsetY = event.clientY - imageRect.top;
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    target.setPointerCapture(pointerId);

    const move = (moveEvent: PointerEvent) => {
      const nextX = clampLetterImageValue(
        (moveEvent.clientX - rect.left - grabOffsetX) * mmPerPx,
        0,
        maxX,
      );
      const nextTop = clampLetterImageValue(
        (moveEvent.clientY - rect.top - grabOffsetY) * mmPerPx,
        0,
        LETTER_IMAGE_MAX_TOP_MM,
      );
      const side = nextX + geometry.widthMm / 2 < contentWidthMm / 2 ? "left" : "right";
      onChange(image.id, {
        xMm: Math.round(nextX * 10) / 10,
        topMm: Math.round(nextTop * 10) / 10,
        side,
      });
    };

    const up = () => {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };

    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const startResize =
    (image: LetterFlowImage) => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (exportMode || !onChange || event.button !== 0) return;
      const zone = event.currentTarget.closest<HTMLElement>("[data-letter-body-zone]");
      if (!zone) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = zone.getBoundingClientRect();
      if (!rect.width) return;
      const mmPerPx = contentWidthMm / rect.width;
      const startX = event.clientX;
      const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
      const pointerId = event.pointerId;
      const target = event.currentTarget;
      target.setPointerCapture(pointerId);

      const move = (moveEvent: PointerEvent) => {
        const rawDelta = (moveEvent.clientX - startX) * mmPerPx;
        if (geometry.placement === "free") {
          const available = contentWidthMm - geometry.xMm;
          const widthMm = clampLetterImageValue(
            geometry.widthMm + rawDelta,
            LETTER_IMAGE_MIN_WIDTH_MM,
            Math.min(LETTER_IMAGE_MAX_WIDTH_MM, available),
          );
          onChange(image.id, { widthMm: Math.round(widthMm * 10) / 10 });
          return;
        }

        const direction = geometry.placement === "right" ? -1 : 1;
        const delta = rawDelta * direction;
        const fixedEdge = geometry.xMm + geometry.widthMm;
        const available =
          geometry.placement === "right" ? fixedEdge : contentWidthMm - geometry.xMm;
        const widthMm = clampLetterImageValue(
          geometry.widthMm + delta,
          LETTER_IMAGE_MIN_WIDTH_MM,
          Math.min(LETTER_IMAGE_MAX_WIDTH_MM, available),
        );
        onChange(image.id, { widthMm: Math.round(widthMm * 10) / 10 });
      };

      const up = () => {
        if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
      };

      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    };

  return (
    <>
      {valid.map((image) => {
        const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
        const free = geometry.placement === "free";

        return (
          <div
            key={image.id}
            data-letter-flow-image={image.id}
            data-letter-image-placement={geometry.placement}
            data-wrap={free ? "none" : "square"}
            data-aspect="original"
            data-side={geometry.side}
            data-x-mm={geometry.xMm}
            data-top-mm={geometry.topMm}
            data-width-mm={geometry.widthMm}
            onPointerDown={startMove(image)}
            title={exportMode ? undefined : "Bild ziehen = frei positionieren"}
            className={
              exportMode
                ? free
                  ? "absolute"
                  : "relative"
                : free
                  ? "absolute cursor-move touch-none"
                  : "relative cursor-move touch-none"
            }
            style={
              free
                ? {
                    left: `${geometry.xMm}mm`,
                    top: `${geometry.topMm}mm`,
                    width: `${geometry.widthMm}mm`,
                    zIndex: 6,
                  }
                : {
                    float: geometry.placement,
                    width: `${geometry.widthMm}mm`,
                    marginTop: `${geometry.topMm}mm`,
                    marginBottom: `${geometry.gapMm}mm`,
                    marginLeft: geometry.placement === "right" ? `${geometry.gapMm}mm` : 0,
                    marginRight: geometry.placement === "left" ? `${geometry.gapMm}mm` : 0,
                    shapeOutside: "margin-box",
                    zIndex: 3,
                  }
            }
          >
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="block h-auto w-full select-none"
            />

            {!exportMode && onChange ? (
              <>
                <div
                  data-letter-image-placement-controls
                  className="absolute -top-8 left-0 flex overflow-hidden rounded-md border bg-background shadow"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {(["left", "right", "free"] as const).map((placement) => (
                    <button
                      key={placement}
                      type="button"
                      aria-label={PLACEMENT_LABEL[placement]}
                      title={PLACEMENT_LABEL[placement]}
                      aria-pressed={geometry.placement === placement}
                      onClick={(event) => {
                        event.stopPropagation();
                        onChange(
                          image.id,
                          letterImagePlacementPatch(image, placement, contentWidthMm),
                        );
                      }}
                      className={`min-w-7 px-1.5 py-1 text-[10px] font-semibold ${
                        geometry.placement === placement
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {placement === "left" ? "L" : placement === "right" ? "R" : "F"}
                    </button>
                  ))}
                </div>

                {onRemove ? (
                  <button
                    type="button"
                    aria-label="Bild entfernen"
                    title="Bild entfernen"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(image.id);
                    }}
                    className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border bg-background text-xs font-bold shadow"
                  >
                    ×
                  </button>
                ) : null}
                <button
                  type="button"
                  data-letter-flow-resize
                  aria-label="Bild proportional skalieren"
                  title="Bild proportional skalieren"
                  onPointerDown={startResize(image)}
                  className={`absolute -bottom-2 grid h-5 w-5 touch-none place-items-center rounded border bg-background text-[10px] shadow ${
                    free || geometry.placement === "left"
                      ? "-right-2 cursor-nwse-resize"
                      : "-left-2 cursor-nesw-resize"
                  }`}
                >
                  ↘
                </button>
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
