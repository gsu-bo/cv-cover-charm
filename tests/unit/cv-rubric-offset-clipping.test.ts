import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const css = readFileSync(
  new URL("../../src/components/cv/citrus-rubric.css", import.meta.url),
  "utf8",
);

describe("CV rubric horizontal offset clipping", () => {
  test("lets rubric rows cross the main box without changing pagination geometry", () => {
    expect(css).toContain('[data-cv-rubric-offset="custom"]');
    expect(css).toContain("[data-cv-page]");
    expect(css).toContain("> [data-cv-main]");
    expect(css).toContain("overflow-x: visible !important;");
    expect(css).toContain("overflow-y: clip !important;");
    expect(css).toContain("translate: var(--cv-rubric-x, 0mm) 0;");

    // The measurement surface must keep its original width/flow so a visual
    // rubric offset cannot add pages or change wrapping.
    expect(css).not.toContain("[data-cv-measure-page]");
    expect(css).not.toContain("--cv-rubric-left-bleed");
    expect(css).not.toContain("--cv-rubric-right-bleed");
  });
});
