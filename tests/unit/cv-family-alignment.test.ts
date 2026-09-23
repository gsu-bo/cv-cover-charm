import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/components/cover/Section.css", import.meta.url), "utf8");
const form = readFileSync(new URL("../../src/components/cv/CvForm.tsx", import.meta.url), "utf8");
const types = readFileSync(new URL("../../src/components/cv/types.ts", import.meta.url), "utf8");
const canvas = readFileSync(new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url), "utf8");

describe("CV family compact rows", () => {
  test("defaults to one-line rows with colons, shared alignment and compact spacing", () => {
    expect(types).toContain('direction: "inline"');
    expect(types).toContain("showColons: true");
    expect(types).toContain("aligned: true");
    expect(types).toContain("columnGapMm: 2");
    expect(types).toContain("rowGapMm: 2");
  });

  test("keeps all family presentation controls together", () => {
    expect(form).toContain("Doppelpunkte anzeigen");
    expect(form).toContain("Gemeinsamer Abstand");
    expect(form).toContain("Abstand zwischen Bezug und Name");
    expect(form).toContain("Abstand zwischen Personen");
    expect(form).not.toContain("Name darunter");
  });

  test("renders colon and shared tab stop directly from family row state", () => {
    expect(canvas).toContain('data-cv-structured-row="inline"');
    expect(canvas).toContain("data-cv-family-aligned");
    expect(canvas).toContain("data-cv-family-colons");
    expect(canvas).toContain('"20mm minmax(0, 1fr)"');
    expect(canvas).toContain('nameAndJob && showColons ? ":" : ""');
  });

  test("keeps family layout out of generic editor section CSS", () => {
    expect(css).not.toContain("data-cv-family-entry");
  });
});
