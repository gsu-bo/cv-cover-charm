import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { applyForestFlowCoverDefaults } from "../../src/components/cover/forest-flow-cover-defaults";
import type { StyleOverrides } from "../../src/components/cover/layouts-base";
import type { Block, TemplateId } from "../../src/components/cover/types";

const forest = "forestFlow" as TemplateId;
const edge = "edge" as TemplateId;

function block(id: string): Block {
  return {
    id,
    label: id,
    kind: "text",
    lines: [id],
    style: {
      x: 1,
      y: 2,
      w: 3,
      follows: "name",
      above: null,
      anchorBottom: true,
    },
  } as unknown as Block;
}

describe("Forest Flow cover editability", () => {
  test("keeps the reviewed cover composition as normal editor defaults", () => {
    const expected = {
      eyebrow: [7, 17, 38],
      ortDatum: [7, 268, 38],
      name: [72, 111, 112],
      beruf: [72, 137, 112],
      lehrbeginn: [72, 159, 112],
      kontaktTitel: [7, 192, 38],
      kontakt: [7, 203, 38],
      anTitel: [72, 239, 112],
      empfaenger: [72, 250, 112],
    } as const;

    for (const [id, [x, y, w]] of Object.entries(expected)) {
      const resolved = applyForestFlowCoverDefaults(forest, block(id), {});
      expect([resolved.style.x, resolved.style.y, resolved.style.w]).toEqual([x, y, w]);
      expect(resolved.style.follows).toBeNull();
      expect(resolved.style.above).toBeNull();
      expect(resolved.style.anchorBottom).toBe(false);
    }

    const photo = applyForestFlowCoverDefaults(forest, block("foto"), {});
    expect([photo.style.x, photo.style.y]).toEqual([143, 27]);

    for (const id of ["eyebrow", "ortDatum", "kontaktTitel", "kontakt"]) {
      expect(applyForestFlowCoverDefaults(forest, block(id), {}).style.align).toBe("center");
    }
  });

  test("Edge uses its editorial grid as editable defaults", () => {
    const expected = {
      eyebrow: [16, 10, 62],
      ortDatum: [124, 10, 70],
      foto: [151, 43, 38],
      name: [20, 124, 112],
      beruf: [20, 146, 112],
      lehrbeginn: [20, 174, 112],
      kontakt: [20, 277, 74],
      empfaenger: [116, 277, 74],
    } as const;

    for (const [id, [x, y, w]] of Object.entries(expected)) {
      const resolved = applyForestFlowCoverDefaults(edge, block(id), {});
      expect([resolved.style.x, resolved.style.y, resolved.style.w]).toEqual([x, y, w]);
    }
  });

  test("explicit user drag and resize geometry already merged into the block always wins", () => {
    const overrides: StyleOverrides = {
      name: {
        x: 101.5,
        y: 123.4,
        w: 76.2,
        follows: null,
        above: null,
        anchorBottom: false,
      },
    };
    const edited = block("name");
    edited.style = { ...edited.style, ...overrides.name };

    const resolved = applyForestFlowCoverDefaults(forest, edited, overrides);
    expect([resolved.style.x, resolved.style.y, resolved.style.w]).toEqual([101.5, 123.4, 76.2]);
  });

  test("late Forest CSS no longer owns editable cover geometry", () => {
    const css = readFileSync(
      new URL("../../src/components/cover/templatefix-24-25.css", import.meta.url),
      "utf8",
    );
    const forestCover = css.split("/* 25 FOREST FLOW")[1]?.split("/* Letter:")[0] ?? "";

    expect(forestCover).not.toContain("left: 7mm !important");
    expect(forestCover).not.toContain("left: 72mm !important");
    expect(forestCover).not.toContain("left: 143mm !important");
    expect(forestCover).not.toContain("top: 111mm !important");
    expect(forestCover).not.toContain("top: 203mm !important");
    expect(forestCover).toContain("forest-flow-cover-defaults.ts");
  });

  test("explicit Forest Flow alignment overrides remain authoritative", () => {
    const overrides: StyleOverrides = { kontakt: { align: "right" } };
    const edited = block("kontakt");
    edited.style = { ...edited.style, ...overrides.kontakt };

    expect(applyForestFlowCoverDefaults(forest, edited, overrides).style.align).toBe("right");
  });
});
