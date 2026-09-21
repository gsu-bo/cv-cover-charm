import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const dossierCss = readFileSync(
  new URL("../../src/components/dossier-theme.css", import.meta.url),
  "utf8",
);
const blockLayer = readFileSync(
  new URL("../../src/components/cover/BlockLayer.tsx", import.meta.url),
  "utf8",
);

describe("cover element typography precedence", () => {
  test("editable cover weight and uppercase stay owned by the element", () => {
    expect(blockLayer).toContain("fontWeight: st.weight");
    expect(blockLayer).toContain('textTransform: st.uppercase ? "uppercase" : "none"');

    expect(dossierCss).toContain(
      '[data-dossier-role="heading"] > div {\n  font-weight: var(--dossier-heading-weight);\n  text-transform: var(--dossier-heading-transform);\n}',
    );
    expect(dossierCss).not.toContain(
      '[data-dossier-role="heading"] > div {\n  font-weight: var(--dossier-heading-weight) !important;',
    );
  });

  test("CV typography contract remains hardened", () => {
    expect(dossierCss).toContain(
      '[data-cv-section-title] {\n  font-weight: var(--dossier-heading-weight) !important;\n  text-transform: var(--dossier-heading-transform) !important;\n}',
    );
    expect(dossierCss).toContain(
      '[data-cv-name] {\n  font-weight: var(--dossier-name-weight) !important;\n}',
    );
    expect(dossierCss).toContain(
      '[data-cv-subtitle] {\n  font-weight: var(--dossier-subtitle-weight) !important;\n}',
    );
  });
});
