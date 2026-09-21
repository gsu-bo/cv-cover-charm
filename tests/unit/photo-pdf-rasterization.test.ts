import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const imageReader = readFileSync("src/lib/image.ts", "utf8");
const html2canvasExport = readFileSync("src/lib/html2canvas-export.ts", "utf8");

test("uploaded CV photos are always browser-normalized before they enter saved state", () => {
  expect(imageReader).not.toContain("src.length < 600_000");
  expect(imageReader).toContain('ctx.fillStyle = "#ffffff"');
  expect(imageReader).toContain('canvas.toDataURL("image/jpeg", PHOTO.QUALITY)');
  expect(imageReader).toContain("img.naturalWidth || img.width");
});

test("html2canvas clone re-encodes already-decoded JPEG data URLs for legacy JSON", () => {
  expect(html2canvasExport).toContain("normalizeDataUrlJpegsForHtml2Canvas(root)");
  expect(html2canvasExport).toContain("image.complete");
  expect(html2canvasExport).toContain("image.naturalWidth");
  expect(html2canvasExport).toContain('canvas.toDataURL("image/jpeg", 0.94)');
  expect(html2canvasExport).toContain("image.src = normalized");
});
