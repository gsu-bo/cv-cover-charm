import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { emptyCv } from "../../src/components/cv/types";

const route = readFileSync(new URL("../../src/routes/lebenslauf.tsx", import.meta.url), "utf8");
const canvas = readFileSync(new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url), "utf8");

describe("CV reference columns", () => {
  test("defaults side-by-side references to on", () => {
    expect(emptyCv.referencesSideBySide).toBe(true);
    expect(route).toContain("checked={data.referencesSideBySide !== false}");
  });

  test("places the control in the references section and explains the half-width fallback", () => {
    expect(route).toContain("data-cv-reference-columns-control");
    expect(route).toContain("Referenzen nebeneinander");
    expect(route).toContain("Bei halber Breite");
  });

  test("renders pairs only when references have full section width", () => {
    expect(canvas).toContain('data.referencesSideBySide !== false');
    expect(canvas).toContain('cvSectionLayout(data, "referenzen").width === "full"');
    expect(canvas).toContain("data-cv-reference-grid");
    expect(canvas).toContain('gridTemplateColumns: "repeat(2, minmax(0, 1fr))"');
  });
});
