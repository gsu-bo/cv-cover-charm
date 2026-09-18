import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const decorations = readFileSync(
  new URL("../../src/components/cover/template-decorations.ts", import.meta.url),
  "utf8",
);
const letterBackground = readFileSync(
  new URL("../../src/components/letter/LetterSheetBackground.tsx", import.meta.url),
  "utf8",
);

describe("templateFIX visual cleanup", () => {
  test("Colorful cover has no orphan accent bar", () => {
    const start = decorations.indexOf("  colorful: [");
    const end = decorations.indexOf("\n\n  blockig:", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const colorful = decorations.slice(start, end);
    expect(colorful).toContain("decor-top-band");
    expect(colorful).toContain("decor-left-field");
    expect(colorful).toContain("decor-middle-field");
    expect(colorful).toContain("decor-bottom-band");
    expect(colorful).not.toContain("decor-accent-bar");
  });

  test("Horizont motivation letter leaves footer ownership to shared chrome", () => {
    expect(letterBackground).toContain('data-letter-background-variant="quiet-horizon"');
    expect(letterBackground).toContain('if (template === "welle")');
    expect(letterBackground).toContain(
      "return <QuietHorizonLetterBackground colors={colors} paperColor={paperColor} />;",
    );
  });
});
