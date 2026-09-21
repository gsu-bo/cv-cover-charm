import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const form = readFileSync("src/components/cv/CvForm.tsx", "utf8");
const canvas = readFileSync("src/components/cv/CvCanvasBase.tsx", "utf8");

test("family editor does not expose the generic Zeitraum field", () => {
  expect(form).toContain(
    'const isFamily = placement === null && titelLabel === "Bezug" && ortLabel === "Name / Beruf";',
  );
  expect(form).toContain("{!isFamily && (");
  expect(form).toContain('{isFamily ? "+ Familienmitglied" : "+ Eintrag"}');
});

test("family rows render flush with the rubric instead of reserving a date rail", () => {
  expect(canvas).toContain("data-cv-family-entry");
  expect(canvas).toContain('custom.preset === "familie"');
  expect(canvas).toContain(
    'familyEntryRow(`${key}-${entry.id}`, entry.titel, entry.ort, entry.beschreibung)',
  );

  const start = canvas.indexOf("const familyEntryRow");
  const end = canvas.indexOf("const referenceRows", start);
  const familyRenderer = canvas.slice(start, end);
  expect(familyRenderer).not.toContain("data-cv-date");
  expect(familyRenderer).not.toContain("data-cv-rail");
});
