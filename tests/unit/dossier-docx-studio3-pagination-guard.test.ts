import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/lib/dossier-docx-studio3-polish.ts", import.meta.url),
  "utf8",
);

describe("Studio 3 DOCX CV pagination polish", () => {
  test("compacts the masthead intro instead of consuming a fourth dossier page", () => {
    expect(source).toContain("xml = replaceParagraphBefore(xml, cvTitle, 0);");
    expect(source).toContain("if (cvPersonal) xml = replaceParagraphBefore(xml, cvPersonal, 0);");
    expect(source).toContain(
      "xml = replaceSpacerAfter(xml, 'id=\"studio3-cv-primary\"', 29, 20);",
    );
  });

  test("keeps the pagination correction isolated to the Studio 3 polish layer", () => {
    expect(source).toContain('rectRun("studio3-cv-primary", 0, 0, 210, 58, cvPrimary)');
    expect(source).toContain("retain a 20 mm hand-off to the first section");
  });
});
