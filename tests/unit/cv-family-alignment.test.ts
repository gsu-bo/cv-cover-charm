import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/components/cover/Section.css", import.meta.url), "utf8");
const types = readFileSync(new URL("../../src/components/cv/types.ts", import.meta.url), "utf8");
const canvas = readFileSync(new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url), "utf8");

describe("CV family compact rows", () => {
  test("keeps the family default inline with a compact 2 mm row gap", () => {
    expect(types).toContain('direction: "inline"');
    expect(types).toContain("columnGapMm: 2");
    expect(types).toContain("rowGapMm: 2");
  });

  test("keeps relation and value on one row with a colon", () => {
    expect(canvas).toContain('data-cv-structured-row={rowLayout.direction}');
    expect(canvas).toContain('{nameAndJob ? ":" : ""}');
  });

  test("aligns all inline family values to one shared tab stop", () => {
    expect(css).toContain('[data-cv-family-entry][data-cv-structured-row="inline"]');
    expect(css).toContain("grid-template-columns: 20mm minmax(0, 1fr) !important");
  });
});
