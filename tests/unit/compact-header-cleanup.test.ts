import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../src/components/dossier/motif-visibility.css", import.meta.url),
  "utf8",
);

describe("compact CV header cleanup", () => {
  test("full motif suppression is compact-only and limited to the approved five templates", () => {
    const fullSuppression = css.match(
      /FULL COMPACT MOTIF SUPPRESSION:([\s\S]*?)SELECTIVE COMPACT CLEANUP/,
    )?.[1];

    expect(fullSuppression).toBeDefined();
    for (const template of ["orbit", "prism", "frame", "ribbon", "monoLuxe"]) {
      expect(fullSuppression).toContain(`[data-cv-template="${template}"]`);
    }
    for (const template of ["glow", "colorful", "cove", "aurora", "edel"]) {
      expect(fullSuppression).not.toContain(`[data-cv-template="${template}"]`);
    }
    expect(fullSuppression).toContain('data-dossier-effective-header-mode="compact"');
    expect(fullSuppression).toContain("opacity: 0 !important");
  });

  test("presentation override never rewrites the user's motif state", () => {
    expect(css).toContain("opacity: var(--dossier-motif-opacity, 1) !important");
    expect(css).not.toContain("--dossier-motif-opacity: 0");
    expect(css).not.toContain("localStorage");
    expect(css).not.toContain("bgOpacity = 0");
  });

  test("selective compact cleanup preserves Glow/Cove/Aurora/Colorful identity", () => {
    expect(css).toContain('[data-cv-template="glow"]');
    expect(css).toContain("> div:nth-child(3)");
    expect(css).toContain('[data-cv-template="colorful"]');
    expect(css).toContain("[data-cv-header]::after");
    expect(css).toContain('[data-cv-template="cove"]');
    expect(css).toContain("[data-dossier-compact-header]::after");
    expect(css).toContain('[data-cv-template="aurora"]');
    expect(css).toContain("[data-dossier-compact-header]::before");
  });

  test("Edel Light adds only an absolute full-width top gold treatment", () => {
    const edel = css.match(/Edel Light:([\s\S]*?)$/)?.[1];
    expect(edel).toBeDefined();
    expect(edel).toContain('[data-cv-template="edel"]');
    expect(edel).toContain('data-dossier-effective-header-mode="compact"');
    expect(edel).toContain("inset-inline: 0");
    expect(edel).toContain("top: 0");
    expect(edel).toContain("height: 0.55mm");
    expect(edel).toContain("background: var(--chrome-accent)");
    expect(edel).not.toContain("margin");
    expect(edel).not.toContain("padding");
  });
});
