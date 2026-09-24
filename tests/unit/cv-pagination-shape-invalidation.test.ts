import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/cv/CvCanvasBase.tsx", "utf8");

test("persisted CV layout sidecars invalidate cached pagination after hydration", () => {
  expect(source).toContain("const shape =");
  expect(source).toContain("|photo:${photoPosition}|info:${infoPosition}|");
  expect(source).toContain("|${placementShape}|${sectionLayoutShape}|");
  expect(source).toMatch(/pal\.muted,\s*measuredAt,\s*shape,\s*\]\);/);
});
