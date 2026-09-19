const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type DragBoundsInput = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Keep content on the paper, but let template decorations retain the visual
 * bleed used by their original compositions. Half of a decoration always
 * remains visible, so it cannot be dragged completely out of reach.
 */
export function clampBlockDragPosition({ id, x, y, width, height }: DragBoundsInput) {
  const allowsBleed = id.startsWith("decor-");
  const horizontalBleed = allowsBleed ? width / 2 : 0;
  const verticalBleed = allowsBleed ? height / 2 : 0;
  const minX = allowsBleed ? -horizontalBleed : 0;
  const minY = allowsBleed ? -verticalBleed : 0;

  return {
    x: clamp(x, minX, PAGE_WIDTH_MM - width + horizontalBleed),
    y: clamp(y, minY, PAGE_HEIGHT_MM - height + verticalBleed),
  };
}
