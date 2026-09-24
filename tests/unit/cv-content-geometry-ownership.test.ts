import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const canvas = readFileSync("src/components/cv/CvCanvasBase.tsx", "utf8");
const contract = readFileSync("src/components/cv/content-geometry-contract.css", "utf8");

test("CvCanvasBase owns all four main-content edges on measurement and rendered pages", () => {
  expect(canvas.match(/--cv-main-left/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(canvas.match(/--cv-main-right/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(canvas.match(/--cv-main-top/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(canvas.match(/--cv-main-bottom/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

  expect(contract).toContain("left: var(--cv-main-left) !important;");
  expect(contract).toContain("right: var(--cv-main-right) !important;");
  expect(contract).toContain("top: var(--cv-main-top) !important;");
  expect(contract).toContain("bottom: var(--cv-main-bottom) !important;");
});
