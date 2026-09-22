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
const userOverrideCss = readFileSync(
  new URL("../../src/components/cover/cover-user-style-precedence.css", import.meta.url),
  "utf8",
);
const layouts = readFileSync(
  new URL("../../src/components/cover/layouts.ts", import.meta.url),
  "utf8",
);
const coverCanvas = readFileSync(
  new URL("../../src/components/cover/CoverCanvas.tsx", import.meta.url),
  "utf8",
);

describe("cover element typography precedence", () => {
  test("untouched cover roles stay owned by the dossier family", () => {
    expect(dossierCss).toContain(
      '[data-dossier-role="heading"] > div {\n  font-weight: var(--dossier-heading-weight) !important;\n  text-transform: var(--dossier-heading-transform) !important;\n}',
    );
    expect(dossierCss).toContain(
      '[data-dossier-role="name"] > div {\n  font-weight: var(--dossier-name-weight) !important;\n}',
    );
    expect(dossierCss).toContain(
      '[data-dossier-role="body"] > div {\n  font-weight: var(--dossier-body-weight) !important;\n}',
    );
  });

  test("explicit element edits receive a higher-priority cover-only contract", () => {
    for (const key of [
      "weight",
      "uppercase",
      "font",
      "size",
      "tracking",
      "line-height",
      "color",
      "opacity",
      "italic",
      "underline",
      "align",
    ]) {
      expect(blockLayer).toContain(`data-cover-user-${key}`);
      expect(userOverrideCss).toContain(`data-cover-user-${key}="true"`);
    }

    expect(blockLayer).toContain('["--cover-user-font-weight" as string]');
    expect(blockLayer).toContain('["--cover-user-font-family" as string]');
    expect(blockLayer).toContain('["--cover-user-font-size" as string]');
    expect(userOverrideCss).toContain("font-weight: var(--cover-user-font-weight) !important");
    expect(userOverrideCss).toContain("font-family: var(--cover-user-font-family) !important");
    expect(userOverrideCss).toContain("font-size: var(--cover-user-font-size) !important");
    expect(userOverrideCss).toContain("filter: none !important");
  });

  test("late layout defaults no longer overwrite deliberate user typography", () => {
    expect(layouts).toContain('lineHeight: hasUserStyle(block, "lineHeight")');
    expect(layouts).toContain(
      "weight: titleOverride.weight ?? Math.max(600, titleBase.weight)",
    );
    expect(layouts).toContain("withUserStyleKeys(block, overrides[block.id])");
  });

  test("one custom element font does not cancel the document-wide font", () => {
    expect(coverCanvas).toContain('!hasUserStyle(block, "font")');
    expect(coverCanvas).toContain('import "./cover-user-style-precedence.css"');
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
