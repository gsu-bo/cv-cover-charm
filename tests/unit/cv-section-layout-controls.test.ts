import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const form = readFileSync(new URL("../../src/components/cv/CvForm.tsx", import.meta.url), "utf8");
const canvas = readFileSync(
  new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url),
  "utf8",
);
const portable = readFileSync(
  new URL("../../src/components/cv/portable-state.ts", import.meta.url),
  "utf8",
);
const controls = form.slice(
  form.indexOf("export function SectionLayoutControls"),
  form.indexOf("export function SectionOptions"),
);

describe("CV section position and layout controls", () => {
  test("combines placement and layout in one always-visible panel", () => {
    expect(controls).toContain("Position &amp; Layout");
    expect(controls).toContain("<PlacementToggle");
    expect(controls).toContain('section === "person"');
    expect(controls).toContain('? "kontakt"');
    expect(controls).not.toContain("<details");
    expect(controls).not.toContain("<summary");
  });

  test("gives fixed and custom rubrics the same Side/Main placement model", () => {
    expect(controls).toContain("placementKey: CvPlacementKey");
    expect(controls).toContain('section === "person" ? "kontakt" : section');
    expect(controls).toContain("resolveCvPlacement(placements, placementKey)");
    expect(controls).toContain('cvLayout === "modern"');
    expect(controls).not.toContain("hasOwnProperty.call(DEFAULT_CV_PLACEMENTS, section)");
  });

  test("renders custom rubrics in the sidebar and preserves their portable placement", () => {
    expect(canvas).toContain("customSideKeys");
    expect(canvas).toContain("sideCustomEntries(key)");
    expect(canvas).toContain("resolveCvPlacement(placements, key)");
    expect(portable).toContain("Object.entries(parsed)");
    expect(portable).toContain("isCustomSectionKey(key)");
  });

  test("removes the duplicated standalone position control", () => {
    expect(form).not.toContain("function BlockPlacementControl");
    expect(form).not.toContain("<BlockPlacementControl");
  });
});
