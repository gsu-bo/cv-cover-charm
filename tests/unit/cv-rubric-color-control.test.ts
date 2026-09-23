import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chooser = readFileSync("src/components/cover/ColorChooser.tsx", "utf8");
const route = readFileSync("src/routes/lebenslauf.tsx", "utf8");

describe("CV rubric color discovery", () => {
  test("exposes the shared rubric color under the CV color controls", () => {
    expect(chooser).toContain("Weitere CV-Textfarben");
    expect(chooser).toContain('aria-label="Schriftfarbe der Rubriktitel"');
    expect(chooser).toContain("cvSectionTitleColor?.onAuto()");
    expect(route).toContain("cvSectionTitleColor={{");
    expect(route).toContain("sectionTitleColor: undefined");
  });
});
