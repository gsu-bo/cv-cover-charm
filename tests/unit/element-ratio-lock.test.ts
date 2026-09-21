import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { withoutBlockGeometry, type BlockStyle } from "../../src/components/cover/types";

const elementBarSource = readFileSync(
  new URL("../../src/components/cover/ElementBar.tsx", import.meta.url),
  "utf8",
);
const blockLayerSource = readFileSync(
  new URL("../../src/components/cover/BlockLayer.tsx", import.meta.url),
  "utf8",
);

describe("element proportion lock regression", () => {
  test("keeps the UI defaults and writes the persistent proportion control", () => {
    expect(elementBarSource).toContain("const lockRatio = st.lockRatio ?? (isPhoto || isImage);");
    expect(elementBarSource).toContain("checked={lockRatio}");
    expect(elementBarSource).toContain("lockRatio: e.target.checked");
    expect(elementBarSource).toContain('aria-label="Proportionen beibehalten"');
    expect(elementBarSource).toContain("accent-blue-600");
    expect(elementBarSource).toContain('{lockRatio ? "beibehalten" : "frei ändern"}');
    expect(elementBarSource).toContain(
      "onChange={(mm) => onChange(resizeHeight(block, mm, lockRatio))}",
    );

    const guardedWidthUpdates = elementBarSource.match(
      /\.\.\.\(lockRatio \? \{\} : keepHeight\(block, w\)\)/g,
    );
    expect(guardedWidthUpdates?.length).toBe(2);
  });

  test("guards direct preview resize handles with the same effective lock", () => {
    expect(blockLayerSource).toContain(
      'block.style.lockRatio ?? (block.kind === "photo" || block.kind === "image")',
    );
    expect(blockLayerSource).toContain("if (lockRatio) {");
    expect(blockLayerSource).toContain(
      "const lockedScale = Math.max(minScale, Math.min(maxScale, requestedScale));",
    );
  });

  test("persists explicit lock choices through saved layout data", () => {
    const locked: Partial<BlockStyle> = { lockRatio: true };
    const unlocked: Partial<BlockStyle> = { lockRatio: false };
    const saved = JSON.stringify({
      layoutByTemplate: { modern: { photo: locked, image: unlocked } },
    });
    const restored = JSON.parse(saved) as {
      layoutByTemplate: { modern: { photo: Partial<BlockStyle>; image: Partial<BlockStyle> } };
    };

    expect(restored.layoutByTemplate.modern.photo.lockRatio).toBe(true);
    expect(restored.layoutByTemplate.modern.image.lockRatio).toBe(false);
  });

  test("does not lose the lock choice when only geometry is reset", () => {
    const visual = withoutBlockGeometry({
      x: 10,
      y: 20,
      w: 50,
      h: 40,
      ratio: 0.8,
      lockRatio: false,
    });

    expect(visual.lockRatio).toBe(false);
    expect(visual.w).toBeUndefined();
    expect(visual.h).toBeUndefined();
    expect(visual.ratio).toBeUndefined();
  });
});
