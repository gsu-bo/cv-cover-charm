import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const form = readFileSync(new URL("../../src/components/cv/CvForm.tsx", import.meta.url), "utf8");
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

  test("keeps custom rubrics out of the fixed Side/Main placement model", () => {
    expect(controls).toContain("placementKey: CvPlacementKey | null");
    expect(controls).toContain(
      "Object.prototype.hasOwnProperty.call(DEFAULT_CV_PLACEMENTS, section)",
    );
    expect(controls).toContain('cvLayout === "modern" && placementKey');
  });

  test("removes the duplicated standalone position control", () => {
    expect(form).not.toContain("function BlockPlacementControl");
    expect(form).not.toContain("<BlockPlacementControl");
  });
});
