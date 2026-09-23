import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const section = readFileSync(
  new URL("../../src/components/cover/Section.tsx", import.meta.url),
  "utf8",
);
const cv = readFileSync(new URL("../../src/routes/lebenslauf.tsx", import.meta.url), "utf8");

describe("CV editor rubric orientation tones", () => {
  test("uses alternating subtle tones for rubric headers and open bodies", () => {
    expect(section).toContain("rubricTone?: number");
    expect(section).toContain("const headerTone");
    expect(section).toContain("const bodyTone");
    expect(section).toContain("bg-sky-50/80");
    expect(section).toContain("bg-violet-50/75");
  });

  test("applies the tone to fixed, personal and custom CV rubrics", () => {
    expect(cv.match(/rubricTone=\{editorSectionOrder\(/g)).toHaveLength(8);
    expect(cv).toContain("rubricTone={editorSectionOrder(key)}");
  });
});
