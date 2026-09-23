import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const css = readFileSync(
  new URL("../../src/components/cv/citrus-rubric.css", import.meta.url),
  "utf8",
);

describe("CV rubric horizontal offset clipping", () => {
  test("reserves directional bleed so moved rubric titles are clipped only by the page", () => {
    expect(css).toContain(
      "--cv-rubric-left-bleed: max(0mm, calc(0mm - var(--cv-rubric-x, 0mm)));",
    );
    expect(css).toContain(
      "--cv-rubric-right-bleed: max(0mm, var(--cv-rubric-x, 0mm));",
    );
    expect(css).toContain(
      "left: calc(var(--cv-rubric-main-left) - var(--cv-rubric-left-bleed)) !important;",
    );
    expect(css).toContain(
      "right: calc(var(--cv-rubric-main-right) - var(--cv-rubric-right-bleed)) !important;",
    );
    expect(css).toContain("padding-left: var(--cv-rubric-left-bleed) !important;");
    expect(css).toContain("padding-right: var(--cv-rubric-right-bleed) !important;");
    expect(css).toContain('[data-cv-info-position="mirrored"]');
    expect(css).toContain(":is([data-cv-page], [data-cv-measure-page])");
  });
});
