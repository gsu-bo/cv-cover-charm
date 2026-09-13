import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";

const studioPdfScaleCss = readFileSync(
  new URL("../../src/components/cover/templatefix-studio-pdf-scale.css", import.meta.url),
  "utf8",
);
const freshTemplates = readFileSync(
  new URL("../../src/components/cover/fresh-templates.ts", import.meta.url),
  "utf8",
);

describe("final red dossier coherence fixes", () => {
  test("Glow keeps its CV accent inside the violet/blue cover family", () => {
    const glow = FRESH_TEMPLATE_REGISTRY.find(({ id }) => id === "glow");
    expect(glow).toBeDefined();
    const accent = glow?.slots.find(({ key }) => key === "accent")?.default;
    expect(accent).toBe("#4f46e5");
    expect(accent).not.toBe("#14b8a6");
  });

  test("Studio PDF scale targets the actual rendered CV root and loads last", () => {
    expect(studioPdfScaleCss).toContain('html[data-dossier-template="studio2"]');
    expect(studioPdfScaleCss).toContain('html[data-dossier-template="studio3"]');
    expect(studioPdfScaleCss).toContain('[data-dossier-document="cv"]');
    expect(freshTemplates).toContain('import "./templatefix-studio-pdf-scale.css";');
    expect(freshTemplates.indexOf('import "./templatefix-studio-pdf-scale.css";')).toBeGreaterThan(
      freshTemplates.indexOf('import "./warm2-redesign.css";'),
    );
  });

  test("Studio body is calibrated to the matching 10.5 pt letter scale", () => {
    expect(studioPdfScaleCss).toContain("font-size: 10.7pt !important;");
    expect(studioPdfScaleCss).toContain("font-size: 11pt !important;");
    expect(studioPdfScaleCss).toContain("font-size: 9.6pt !important;");
    expect(studioPdfScaleCss).toContain(
      '[data-cv-section-title]:not([data-cv-user-section-size="true"])',
    );
  });

  test("Studio default breathing room never overrides a user rubric-gap choice", () => {
    expect(studioPdfScaleCss).toContain(
      '[data-cv-section]:not([data-cv-user-section-margin="true"])',
    );
    expect(studioPdfScaleCss).toContain("margin-top: 5.6mm !important;");
  });
});
