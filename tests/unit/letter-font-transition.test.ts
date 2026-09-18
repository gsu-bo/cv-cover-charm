import { describe, expect, test } from "bun:test";
import {
  emptyLetterDesign,
  letterFontSelection,
  normalizeLetterDesign,
  withLetterFontSelection,
} from "../../src/components/letter/types";

describe("motivation-letter font template transitions", () => {
  test("a Brief font choice stays standalone instead of leaking into the next template", () => {
    const brief = withLetterFontSelection(emptyLetterDesign(), "times");

    expect(brief.font).toBe("times");
    expect(brief.fontOverride).toBeNull();

    const modern = { ...brief, template: "modern" as const };
    expect(letterFontSelection(modern)).toBe("template");
  });

  test("normalization removes buggy persisted Brief overrides", () => {
    const restored = normalizeLetterDesign({
      ...emptyLetterDesign(),
      template: "brief",
      font: "maschine",
      fontOverride: "maschine",
    });

    expect(restored.font).toBe("maschine");
    expect(restored.fontOverride).toBeNull();
  });
});
