import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const route = readFileSync(
  new URL("../../src/routes/lebenslauf.tsx", import.meta.url),
  "utf8",
);

const resetPositionsOnly = route.match(
  /const resetPositionsOnly = \(\) => \{([\s\S]*?)\n {2}\};\n\n {2}const resetEverything/,
)?.[1];

describe("CV position reset", () => {
  test("returns free sections to flow and clears only their geometry", () => {
    expect(resetPositionsOnly).toBeDefined();
    expect(resetPositionsOnly).toContain('positioning: "flow"');
    expect(resetPositionsOnly).toContain("x: null");
    expect(resetPositionsOnly).toContain("y: null");
    expect(resetPositionsOnly).toContain("widthMm: null");
    expect(resetPositionsOnly).toContain("heightMm: null");
    expect(resetPositionsOnly).toContain("withoutBlockGeometry");

    // Keep the user's page, width and rubric order intact. This action only
    // restores automatic positioning and default geometry.
    expect(resetPositionsOnly).not.toContain("page: 1");
    expect(resetPositionsOnly).not.toContain('width: "full"');
    expect(resetPositionsOnly).not.toContain("sectionOrder:");
  });
});
