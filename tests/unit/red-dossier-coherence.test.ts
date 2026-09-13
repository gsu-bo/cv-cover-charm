import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";

const studioCss = readFileSync(
  new URL("../../src/components/cover/templatefix-27-28.css", import.meta.url),
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

  test("Studio 2 and Studio 3 CV text is no longer smaller than the matching letter body", () => {
    expect(studioCss).toContain("font-size: 10.8pt !important;");
    expect(studioCss).toContain("font-size: 11.1pt !important;");
    expect(studioCss).toContain("font-size: 10.5pt !important;");
    expect(studioCss).toContain("font-size: 9.6pt !important;");
    expect(studioCss).toContain("font-size: 8.8pt !important;");
  });

  test("Studio default breathing room never overrides a user rubric-gap choice", () => {
    expect(studioCss).toContain(
      '[data-cv-section]:not([data-cv-user-section-margin="true"])',
    );
    expect(studioCss).toContain("margin-top: 6mm !important;");
    expect(studioCss).toContain("margin-top: 5.8mm !important;");
  });
});
