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

  test("Studio body is lifted close to the 10.5 pt letter without loose pagination", () => {
    expect(studioPdfScaleCss).toContain("font-size: 10.5pt !important;");
    expect(studioPdfScaleCss).toContain("font-size: 10.8pt !important;");
    expect(studioPdfScaleCss).toContain("font-size: 9.4pt !important;");
    expect(studioPdfScaleCss).toContain("line-height: 1.36 !important;");
    expect(studioPdfScaleCss).not.toContain("margin-top: 5.6mm !important;");
    expect(studioPdfScaleCss).toContain(
      '[data-cv-section-title]:not([data-cv-user-section-size="true"])',
    );
  });
});
