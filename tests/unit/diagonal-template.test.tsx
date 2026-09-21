import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverBackground } from "../../src/components/cover/CoverBackground";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";
import "../../src/components/cover/fresh-templates";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { templateDecorations } from "../../src/components/cover/template-decorations";
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

  test("cover exposes two Word-sized same-colour triangles as editable blocks", () => {
    const template = "diagonal" as TemplateId;
    const definition = TEMPLATES.find(({ id }) => id === template);
    expect(definition).toBeTruthy();
    const colors = Object.fromEntries(
      (definition?.slots ?? []).map(({ key, default: value }) => [key, value]),
    );
    const markup = renderToStaticMarkup(createElement(CoverBackground, { template, colors }));

    expect(markup).toContain('data-fresh-cover-background="diagonal"');
    const [top, bottom] = templateDecorations(template, {});
    expect(top).toMatchObject({
      id: "decor-diagonal-top",
      shape: "path",
      path: "M0 0 H100 L0 100 Z",
      style: { x: 0, y: 0, w: 210, ratio: 191 / 210, fill: "primary" },
    });
    expect(bottom).toMatchObject({
      id: "decor-diagonal-bottom",
      shape: "path",
      path: "M100 0 V100 H0 Z",
      style: { x: 62, y: 159, w: 148, ratio: 138 / 148, fill: "primary" },
    });
    expect(css).toContain("display: none !important;");
    expect(definition?.slots.find(({ key }) => key === "primary")?.default).toBe("#156082");
    expect(css).not.toContain('data-dossier-template="frame"');
  });

  test("manual triangle geometry and colour overrides remain authoritative", () => {
    const [top] = templateDecorations("diagonal" as TemplateId, {
      "decor-diagonal-top": { x: 12, y: 8, w: 170, fill: "#123456" },
    });

    expect(top.style).toMatchObject({ x: 12, y: 8, w: 170, fill: "#123456" });
  });

  test("editable cover defaults keep lower-right metadata readable on colour", () => {
    expect(defaults).toContain("DIAGONAL_COVER_DEFAULTS");
    expect(defaults).toContain('templateId === "diagonal"');
    expect(defaults).not.toContain('templateId === "frame"');
    expect(defaults).toContain('color: "bg"');
    expect(defaults).toContain("x: 84");
    expect(defaults).toContain("y: 120");
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
