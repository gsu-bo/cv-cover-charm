import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const canvas = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");
const base = readFileSync("src/components/cv/CvCanvasBase.tsx", "utf8");
const contract = readFileSync("src/components/cv/content-geometry-contract.css", "utf8");

test("CV renderer owns all four main-content edges across layouts and mirror states", () => {
  for (const variable of [
    "--cv-classic-main-left",
    "--cv-classic-main-right",
    "--cv-modern-main-left",
    "--cv-modern-main-right",
  ]) {
    expect(canvas).toContain(variable);
  }

  expect(base.match(/--cv-main-top/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(base.match(/--cv-main-bottom/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

  expect(contract).toContain("left: var(--cv-classic-main-left) !important;");
  expect(contract).toContain("right: var(--cv-classic-main-right) !important;");
  expect(contract).toContain("left: var(--cv-modern-main-left) !important;");
  expect(contract).toContain("right: var(--cv-modern-main-right) !important;");
  expect(contract).toContain("left: var(--cv-modern-main-right) !important;");
  expect(contract).toContain("right: var(--cv-modern-main-left) !important;");
  expect(contract).toContain("top: var(--cv-main-top) !important;");
  expect(contract).toContain("bottom: var(--cv-main-bottom) !important;");
});
