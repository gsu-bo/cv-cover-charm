import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cleanup = readFileSync(
  new URL("../../src/components/cover/fresh-cover-visual-cleanup.css", import.meta.url),
  "utf8",
);
const legacyFresh = readFileSync(
  new URL("../../src/components/cover/fresh-templates.css", import.meta.url),
  "utf8",
);

describe("Fresh cover acceptance repair", () => {
  test("the late acceptance layer neutralizes shared negative title transforms", () => {
    for (const template of ["edge", "glow", "monoLuxe"]) {
      expect(cleanup).toContain(`data-dossier-template="${template}"`);
    }
    expect(cleanup).not.toContain('data-dossier-template="frame"');
    expect(cleanup).toContain(
      ':is([data-block-id="name"], [data-block-id="beruf"], [data-block-id="lehrbeginn"])',
    );
    expect(cleanup).toContain("transform: none !important;");

    // Keep this regression meaningful: the acceptance layer exists specifically
    // because the older family stylesheet still contains historic offsets.
    expect(legacyFresh).toContain("translate(-34mm");
  });

  test("Glow gets a saturated bounded masthead and stronger stationery echoes", () => {
    const glow = cleanup.slice(
      cleanup.indexOf("/* Glow: the previous"),
      cleanup.indexOf("/* Forest Flow used to live here"),
    );
    expect(glow).toContain(
      "background: linear-gradient(100deg, var(--cover-primary), var(--cover-secondary)) !important;",
    );
    expect(glow).toContain("height: 30mm !important;");
    expect(glow).toContain('data-letter-motif="glow-capsule"');
    expect(glow).toContain("opacity: 0.22 !important;");
  });
});
