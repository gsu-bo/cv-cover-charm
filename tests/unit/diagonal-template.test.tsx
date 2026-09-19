import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverBackground } from "../../src/components/cover/CoverBackground";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";
import "../../src/components/cover/fresh-templates";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { dossierDocxTemplatePlan } from "../../src/lib/dossier-docx-family";
import { hasDossierDocxTemplateLoader } from "../../src/lib/dossier-docx-template-loader";

const css = readFileSync(
  new URL("../../src/components/cover/template-diagonal.css", import.meta.url),
  "utf8",
);
const defaults = readFileSync(
  new URL("../../src/components/cover/forest-flow-cover-defaults.ts", import.meta.url),
  "utf8",
);

describe("Diagonal standalone template", () => {
  test("is the sole active corner-diagonal template; Frame is retired", () => {
    const ids = TEMPLATES.map(({ id }) => id as string);
    expect(ids).not.toContain("frame");
    expect(ids).toContain("diagonal");
    expect(FRESH_TEMPLATE_REGISTRY.map(({ id }) => id as string)).not.toContain("frame");

    const diagonal = TEMPLATES.find(({ id }) => (id as string) === "diagonal");
    expect(diagonal).toMatchObject({
      name: "Diagonal",
      description: "Klare blaue Diagonalen, modern und editorial",
    });
  });

  test("cover uses two equal 20-percent-larger same-colour corner masses", () => {
    const template = "diagonal" as TemplateId;
    const definition = TEMPLATES.find(({ id }) => id === template);
    expect(definition).toBeTruthy();
    const colors = Object.fromEntries(
      (definition?.slots ?? []).map(({ key, default: value }) => [key, value]),
    );
    const markup = renderToStaticMarkup(createElement(CoverBackground, { template, colors }));

    expect(markup).toContain('data-fresh-cover-background="diagonal"');
    expect(css).toContain("width: 110.4mm;");
    expect(css).toContain("height: 91.2mm;");
    expect(css).toContain("width: 110.4mm !important;");
    expect(css).toContain("height: 91.2mm !important;");
    expect(css).toContain("background: var(--cover-primary) !important;");
    expect(css).toContain("polygon(0 0, 100% 0, 0 100%)");
    expect(css).toContain("polygon(100% 0, 100% 100%, 0 100%)");
    expect(css).not.toContain('data-dossier-template="frame"');
  });

  test("editable cover defaults keep lower-right metadata readable on colour", () => {
    expect(defaults).toContain("DIAGONAL_COVER_DEFAULTS");
    expect(defaults).toContain('templateId === "diagonal"');
    expect(defaults).not.toContain('templateId === "frame"');
    expect(defaults).toContain('color: "bg"');
    expect(defaults).toContain("if (custom[key] === undefined)");

    expect(dossierDocxTemplatePlan("diagonal")).toMatchObject({ family: "geometric" });
    expect(dossierDocxTemplatePlan("frame")).toBeNull();
    expect(hasDossierDocxTemplateLoader("diagonal")).toBe(true);
    expect(hasDossierDocxTemplateLoader("frame")).toBe(false);
  });

  test("CV and letter repeat the same-colour diagonal identity without a third bar", () => {
    expect(css).toContain('[data-dossier-sheet-background="diagonal"]::before');
    expect(css).toContain('[data-dossier-sheet-background="diagonal"]::after');
    expect(css).toContain('[data-letter-template="diagonal"]');
    expect(css).toContain("background: var(--cover-primary, #1d4ed8);");
    expect(css).toContain('[data-dossier-header-custom-surface="false"]');
    expect(css).toContain('[data-dossier-footer-custom-surface="false"]');
  });
});
