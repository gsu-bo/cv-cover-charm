import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const canvas = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");
const titleOverride = readFileSync(
  "src/components/cv/document-title-user-override.css",
  "utf8",
);
const geometryContract = readFileSync("src/components/cv/content-geometry-contract.css", "utf8");
const titleSpacingControl = readFileSync(
  "src/components/dossier/DossierHyphenationControl.tsx",
  "utf8",
);
const titleSpacingStore = readFileSync("src/lib/cv-document-title-spacing.ts", "utf8");

describe("CV document title style controls", () => {
  test("loads the explicit user title override after the shared CV geometry contract", () => {
    expect(canvas.indexOf('import "./document-title-user-override.css";')).toBeGreaterThan(
      canvas.indexOf('import "./content-geometry-contract.css";'),
    );
  });

  test("shared chrome geometry owns CV main top instead of template-specific offsets", () => {
    expect(geometryContract).toContain("top: var(--cv-main-top) !important");
    expect(geometryContract).toContain("bottom: var(--cv-main-bottom) !important");
    expect(geometryContract).toContain(":is([data-cv-page], [data-cv-measure-page])");
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

  test("offers one global document-title top-spacing control for all header modes", () => {
    expect(titleSpacingControl).toContain("Dokumenttitel – Abstand nach oben");
    expect(titleSpacingControl).toContain('aria-label="Dokumenttitel Abstand nach oben"');
    expect(titleSpacingControl).toContain("CV_DOC_TITLE_MARGIN_TOP_MAX_PX");
    expect(titleSpacingStore).toContain("CV_DOC_TITLE_MARGIN_TOP_DEFAULT_PX = 0");
    expect(titleSpacingStore).toContain("CV_DOC_TITLE_MARGIN_TOP_MAX_PX = 100");
    expect(titleOverride).toContain("margin-top: var(--cv-doc-title-margin-top, 0px) !important");
  });
});
