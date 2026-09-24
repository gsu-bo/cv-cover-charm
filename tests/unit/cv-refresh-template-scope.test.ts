import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const canvasSource = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");
const routeSource = readFileSync("src/routes/lebenslauf.tsx", "utf8");

test("CvCanvas is the single live CV template-theme authority before pagination", () => {
  expect(canvasSource).toContain("useInsertionEffect(() => {");
  expect(canvasSource).toContain("applyDossierTheme(design.template);");
  expect(canvasSource.indexOf("useInsertionEffect(() => {")).toBeLessThan(
    canvasSource.indexOf("useLayoutEffect(() => {"),
  );
  expect(routeSource).not.toContain('import { applyDossierTheme } from "@/lib/dossier-theme";');
  expect(routeSource).not.toContain("applyDossierTheme(design.template);");
});
