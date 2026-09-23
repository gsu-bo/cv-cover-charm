import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CV_STRUCTURED_ROW_LAYOUT,
  normalizeCvStructuredRowLayout,
} from "../../src/components/cv/types";

const form = readFileSync("src/components/cv/CvForm.tsx", "utf8");
const canvas = readFileSync("src/components/cv/CvCanvasBase.tsx", "utf8");
const route = readFileSync("src/routes/lebenslauf.tsx", "utf8");

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
  expect(canvas).toContain("familyEntryRow(");
  expect(canvas).toContain("normalizeCvStructuredRowLayout(custom.rowLayout)");

  const start = canvas.indexOf("const familyEntryRow");
  const end = canvas.indexOf("const referenceRows", start);
  const familyRenderer = canvas.slice(start, end);
  expect(familyRenderer).not.toContain("data-cv-date");
  expect(familyRenderer).not.toContain("data-cv-rail");
});

test("family uses one compact control block for labels and spacing", () => {
  expect(form).toContain("export function StructuredRowLayoutControls");
  expect(form).toContain("Doppelpunkte anzeigen");
  expect(form).toContain("Gemeinsamer Abstand");
  expect(form).toContain("Abstand zwischen Bezug und Name");
  expect(form).toContain("Abstand zwischen Personen");
  expect(form).not.toContain("Name darunter");
  expect(route).toContain("<StructuredRowLayoutControls");
  expect(canvas).toContain('data-cv-structured-row="inline"');
});

test("structured family rows default and migrate to the compact one-line contract", () => {
  expect(normalizeCvStructuredRowLayout()).toEqual(DEFAULT_CV_STRUCTURED_ROW_LAYOUT);
  expect(
    normalizeCvStructuredRowLayout({
      direction: "stacked",
      showColons: false,
      aligned: false,
      columnGapMm: 99,
      rowGapMm: -5,
    }),
  ).toEqual({
    direction: "inline",
    showColons: false,
    aligned: false,
    columnGapMm: 8,
    rowGapMm: 0,
  });
});
