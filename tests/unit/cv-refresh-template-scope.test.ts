import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");

test("CV template scope is installed before pagination layout effects", () => {
  expect(source).toContain("useInsertionEffect(() => {");
  expect(source).toContain("applyDossierTheme(design.template);");
  expect(source.indexOf("useInsertionEffect(() => {")).toBeLessThan(
    source.indexOf("useLayoutEffect(() => {"),
  );
});
