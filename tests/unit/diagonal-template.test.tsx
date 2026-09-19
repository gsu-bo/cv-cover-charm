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
  test("adds a new slot without replacing Frame", () => {
    const ids = TEMPLATES.map(({ id }) => id as string);
    expect(ids).toContain("frame");
    expect(ids).toContain("diagonal");
    expect(ids.indexOf("frame")).not.toBe(ids.indexOf("diagonal"));

    expect(FRESH_TEMPLATE_REGISTRY.find(({ id }) => id === "frame")).toMatchObject({
      name: "Frame",
      description: "Geometrischer Rahmen, ruhig und markant",
    });
    expect(FRESH_TEMPLATE_REGISTRY.map(({ id }) => id as string)).not.toContain("diagonal");

    const diagonal = TEMPLATES.find(({ id }) => (id as string) === "diagonal");
    expect(diagonal).toMatchObject({
      name: "Diagonal",
      description: "Klare Diagonalen in Blau und Teal, modern und editorial",
    });
  });

  test("cover gets its own blue/teal three-field scaffold and two-corner composition", () => {
    const template = "diagonal" as TemplateId;
    const definition = TEMPLATES.find(({ id }) => id === template);
    expect(definition).toBeTruthy();
    const colors = Object.fromEntries(
      (definition?.slots ?? []).map(({ key, default: value }) => [key, value]),
    );
    const markup = renderToStaticMarkup(createElement(CoverBackground, { template, colors }));

    expect(markup).toContain('data-fresh-cover-background="diagonal"');
    expect(markup).toContain('data-fresh-cover-field="primary"');
    expect(markup).toContain('data-fresh-cover-field="secondary"');
    expect(markup).toContain('data-fresh-cover-field="accent"');
    expect(css).toContain('data-dossier-template="diagonal"');
    expect(css).toContain("width: 92mm;");
    expect(css).toContain("height: 76mm;");
    expect(css).toContain("polygon(0 0, 100% 0, 0 100%)");
    expect(css).toContain("polygon(100% 0, 100% 100%, 0 100%)");
    expect(css).not.toContain('data-dossier-template="frame"');
  });

  test("editable cover defaults and export registration stay template-owned", () => {
    expect(defaults).toContain("DIAGONAL_COVER_DEFAULTS");
    expect(defaults).toContain('templateId === "diagonal"');
    expect(defaults).not.toContain('templateId === "frame"');
    expect(defaults).toContain("foto: {");
    expect(defaults).toContain("w: 34,");
    expect(defaults).toContain("radius: 999,");
    expect(defaults).toContain("if (custom[key] === undefined)");

    expect(dossierDocxTemplatePlan("diagonal")).toMatchObject({ family: "geometric" });
    expect(hasDossierDocxTemplateLoader("diagonal")).toBe(true);
  });

  test("CV and letter use restrained diagonal stationery without a third bar", () => {
    expect(css).toContain('[data-dossier-sheet-background="diagonal"]::before');
    expect(css).toContain('[data-dossier-sheet-background="diagonal"]::after');
    expect(css).toContain('[data-letter-template="diagonal"]');
    expect(css).toContain("width: 22mm;");
    expect(css).toContain("height: 15mm;");
    expect(css).toContain('[data-dossier-header-custom-surface="false"]');
    expect(css).toContain('[data-dossier-footer-custom-surface="false"]');
  });
});
