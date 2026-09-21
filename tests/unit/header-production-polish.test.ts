import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const controls = readFileSync(
  new URL("../../src/components/dossier/DossierChromeControls.tsx", import.meta.url),
  "utf8",
);
const picker = readFileSync(
  new URL("../../src/components/cover/TemplatePicker.tsx", import.meta.url),
  "utf8",
);
const letterPicker = readFileSync(
  new URL("../../src/components/letter/LetterTemplatePicker.tsx", import.meta.url),
  "utf8",
);
const polishCss = readFileSync(
  new URL("../../src/components/dossier/header-production-polish.css", import.meta.url),
  "utf8",
);
const chromePolicyCss = readFileSync(
  new URL("../../src/components/dossier/chrome-policy.css", import.meta.url),
  "utf8",
);

describe("header production polish", () => {
  test("icon separator is no longer user-selectable and old values migrate to midpoint", () => {
    expect(controls).not.toContain('<option value="icons">');
    expect(controls).not.toContain("Symbole: Handy + Brief");
    expect(controls).toContain('options.headerInlineSeparator === "icons" ? "dot"');
    expect(controls).toContain('options.headerInlineSeparator !== "icons"');
    expect(controls).toContain('headerInlineSeparator: "dot"');
  });

  test("normal template switches preserve chrome while Warm alone uses shared recommendation", () => {
    expect(picker).toContain("recommendedHeaderPatchForTemplate(template)");
    expect(picker).toContain("if (!patch) return;");
    expect(letterPicker).toContain("recommendedHeaderPatchForTemplate(template)");
    expect(letterPicker).toContain("if (recommendation) patchDossierChrome");
  });

  test("Citrus keeps its light contact text without overriding Edel's compact standard", () => {
    expect(polishCss).toContain('[data-dossier-template-chrome="citrus"]');
    expect(polishCss).toContain("color: #ffffff !important");
    expect(polishCss).not.toContain('[data-dossier-template-chrome="edel"]');
    expect(chromePolicyCss).toContain('[data-dossier-template-chrome="edel"]');
    expect(chromePolicyCss).toContain("border-bottom: 0.28mm solid var(--chrome-accent)");
    expect(chromePolicyCss).toContain("inset 0 -1.52mm 0 var(--chrome-accent)");
    expect(chromePolicyCss).toContain("width: 2.2mm");
    expect(polishCss).not.toContain("freundlich");
  });
});
