import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../src/components/dossier/header-production-polish.css", import.meta.url),
  "utf8",
);

const quickWins = css.split("COMPACT HEADER QUICK WINS — EDGE / FOREST FLOW / LEDGER")[1] ?? "";

describe("compact header quick wins", () => {
  test("package is limited to Edge, Forest Flow and Ledger", () => {
    expect(quickWins).toContain('[data-cv-template="edge"]');
    expect(quickWins).toContain('[data-cv-template="forestFlow"]');
    expect(quickWins).toContain('[data-cv-template="ledger"]');

    for (const deferred of ["prism", "neon", "sonne", "citrus"]) {
      expect(quickWins).not.toContain(`[data-cv-template="${deferred}"]`);
      expect(quickWins).not.toContain(`[data-dossier-template-chrome="${deferred}"]`);
    }
  });

  test("Edge rebuild stays compact-only and preserves geometry", () => {
    const edge = quickWins.match(/\/\* EDGE —([\s\S]*?)\/\* FOREST FLOW —/)?.[1];
    expect(edge).toBeDefined();
    expect(edge).toContain('data-dossier-effective-header-mode="compact"');
    expect(edge).toContain("[data-dossier-compact-header]::before");
    expect(edge).toContain("[data-dossier-compact-header]::after");
    expect(edge).not.toContain("height: 22mm");
    expect(edge).not.toContain("padding-top");
    expect(edge).not.toContain("margin-top");
  });

  test("Forest uses one family treatment for compact and contact", () => {
    const forest = quickWins.match(/\/\* FOREST FLOW —([\s\S]*?)\/\* LEDGER —/)?.[1];
    expect(forest).toBeDefined();
    expect(forest).toContain("[data-dossier-compact-header]");
    expect(forest).toContain("[data-dossier-contact-header-background]");
    expect(forest).toContain("[data-dossier-continuation-contact-header]");
    expect(forest).toContain("[data-dossier-integrated-contact]");
    expect(forest).toContain("padding-left: 38mm !important");
    expect(forest).toContain("background: var(--chrome-secondary)");
    expect(forest).toContain("background: var(--chrome-accent)");
  });

  test("Ledger compact echoes the existing book spine and ruled paper", () => {
    const ledger = quickWins.match(/\/\* LEDGER —([\s\S]*?)$/)?.[1];
    expect(ledger).toBeDefined();
    expect(ledger).toContain('data-dossier-effective-header-mode="compact"');
    expect(ledger).toContain("0 9mm");
    expect(ledger).toContain("left: 10mm");
    expect(ledger).toContain("left: 20mm");
    expect(ledger).toContain("box-shadow: 0 2.2mm 0");
    expect(ledger).not.toContain("[data-dossier-contact-header-background]");
  });
});
