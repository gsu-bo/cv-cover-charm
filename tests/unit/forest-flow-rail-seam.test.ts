import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../src/components/cover/templatefix-24-25.css", import.meta.url),
  "utf8",
);

const coverStart = css.indexOf('html[data-dossier-template="forestFlow"]\n  [data-dossier-document="cover"]');
const letterStart = css.indexOf("/* Letter:", coverStart);
const coverCss = css.slice(coverStart, letterStart);

test("Forest Flow cover rail keeps one straight 52 mm edge", () => {
  expect(coverCss).toContain("width: 52mm !important;");
  expect(coverCss).toContain("left: 52mm !important;");
  expect(coverCss).toContain("width: 0.8mm !important;");
  expect(coverCss).toContain("left: 52.6mm !important;");
  expect(coverCss).toContain("width: 157.4mm !important;");
  expect(coverCss).not.toContain("left: 51mm !important;");
  expect(coverCss).not.toContain("width: 1.4mm !important;");
});
