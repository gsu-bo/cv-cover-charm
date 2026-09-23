import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const section = readFileSync(
  new URL("../../src/components/cover/Section.tsx", import.meta.url),
  "utf8",
);
const sectionCss = readFileSync(
  new URL("../../src/components/cover/Section.css", import.meta.url),
  "utf8",
);
const cv = readFileSync(new URL("../../src/routes/lebenslauf.tsx", import.meta.url), "utf8");

describe("CV editor rubric orientation tones", () => {
  test("uses actual form order for alternating subtle rubric tones", () => {
    expect(section).toContain('data-editor-rubric-tone={isRubric ? "auto" : undefined}');
    expect(section).not.toContain("Math.abs(rubricTone)");
    expect(sectionCss).toContain(":nth-child(odd of [data-editor-rubric-tone])");
    expect(sectionCss).toContain(":nth-child(even of [data-editor-rubric-tone])");
    expect(sectionCss).toContain("rgb(240 249 255 / 0.8)");
    expect(sectionCss).toContain("rgb(245 243 255 / 0.75)");
  });

  test("document rubric order cannot reorder the editor form", () => {
    expect(section).toContain("order?: number");
    expect(section).not.toContain("style={order");
    expect(section).not.toContain("{ order }");
    expect(cv.match(/rubricTone=\{editorSectionOrder\(/g)).toHaveLength(8);
    expect(cv).toContain("rubricTone={editorSectionOrder(key)}");
  });
});
