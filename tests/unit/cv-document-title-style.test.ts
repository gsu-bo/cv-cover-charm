import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const canvas = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");
const titleOverride = readFileSync(
  "src/components/cv/document-title-user-override.css",
  "utf8",
);

describe("CV document title style controls", () => {
  test("loads the explicit user title override after the other CV style layers", () => {
    expect(canvas.indexOf('import "./document-title-user-override.css";')).toBeGreaterThan(
      canvas.indexOf('import "./content-geometry-contract.css";'),
    );
  });

  test("explicit Fett, Kursiv and Unterstrichen choices outrank template defaults", () => {
    expect(titleOverride).toContain('[data-cv-user-doc-weight="true"]');
    expect(titleOverride).toContain("font-weight: var(--cv-user-doc-weight) !important");

    expect(titleOverride).toContain('[data-cv-user-doc-style="true"]');
    expect(titleOverride).toContain("font-style: var(--cv-user-doc-style) !important");

    expect(titleOverride).toContain('[data-cv-user-doc-decoration="true"]');
    expect(titleOverride).toContain(
      "text-decoration: var(--cv-user-doc-decoration) !important",
    );
  });
});
