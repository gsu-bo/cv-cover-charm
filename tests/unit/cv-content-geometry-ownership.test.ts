import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const canvas = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");
const base = readFileSync("src/components/cv/CvCanvasBase.tsx", "utf8");
const contract = readFileSync("src/components/cv/content-geometry-contract.css", "utf8");

test("CV renderer owns vertical geometry globally and Sidebar horizontal clearance", () => {
  expect(canvas).toContain("--cv-modern-main-left");
  expect(canvas).toContain("--cv-modern-main-right");

  expect(base.match(/--cv-main-top/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(base.match(/--cv-main-bottom/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

  expect(contract).toContain("left: var(--cv-modern-main-left) !important;");
  expect(contract).toContain("right: var(--cv-modern-main-right) !important;");
  expect(contract).toContain("left: var(--cv-modern-main-right) !important;");
  expect(contract).toContain("right: var(--cv-modern-main-left) !important;");
  expect(contract).toContain("top: var(--cv-main-top) !important;");
  expect(contract).toContain("bottom: var(--cv-main-bottom) !important;");

  expect(contract).not.toContain("left: var(--cv-classic-main-left) !important;");
  expect(contract).not.toContain("right: var(--cv-classic-main-right) !important;");
});

test("Sidebar pinning owns an independent physical box and reacts to mirror state", () => {
  expect(canvas).toContain("getCvInfoPosition");
  expect(canvas).toContain('infoPosition === "mirrored"');
  expect(canvas).toContain("--cv-modern-physical-left");
  expect(canvas).toContain("--cv-modern-physical-right");
  expect(canvas).toContain("export function pinCvSidebarMainGeometry");
  expect(canvas).toContain('getPropertyValue("--cv-modern-physical-left")');
  expect(canvas).toContain('getPropertyValue("--cv-modern-physical-right")');
  expect(canvas).toContain('main.style.setProperty("left", left, "important")');
  expect(canvas).toContain('main.style.setProperty("right", right, "important")');
  expect(canvas).toContain("main.dataset.cvMainGeometryPinned");
  expect(canvas).toContain("new MutationObserver(schedulePin)");
  expect(canvas).toContain("window.addEventListener(CV_LAYOUT_EVENT, schedulePin)");
});
