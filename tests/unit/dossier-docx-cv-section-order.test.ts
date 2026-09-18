import { describe, expect, test } from "bun:test";
import { customSectionKey, DEMO_CV } from "../../src/components/cv/types";
import { applyCvSectionOrderToDocumentXml } from "../../src/lib/dossier-docx-cv-section-order";

const sectionBreak =
  '<w:p><w:pPr><w:sectPr><w:pgSz w:w="1" w:h="1"/></w:sectPr></w:pPr></w:p>';

function heading(label: string) {
  return `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>${label.toLocaleUpperCase("de-CH")}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
}

function block(label: string, marker: string) {
  return `${heading(label)}<w:p><w:r><w:t>${marker}</w:t></w:r></w:p>`;
}

function sourceWithFamilyLast() {
  return [
    "<w:document><w:body>",
    sectionBreak,
    sectionBreak,
    '<w:p><w:r><w:t>PERSON</w:t></w:r></w:p>',
    block("Schulbildung", "SCHOOL"),
    block("Praktika & Schnuppertage", "WORK"),
    block("Sprachen", "LANG"),
    block("Hobbys & Interessen", "HOBBY"),
    block("Stärken", "STRENGTH"),
    block("Referenzen", "REF"),
    block("Familie", "FAMILY"),
    '<w:sectPr><w:pgSz w:w="1" w:h="1"/></w:sectPr>',
    "</w:body></w:document>",
  ].join("");
}

describe("DOCX CV section order", () => {
  test("moves the fixed family rubric directly after personal data by default", () => {
    const reordered = applyCvSectionOrderToDocumentXml(sourceWithFamilyLast(), { data: DEMO_CV });

    expect(reordered.indexOf("PERSON")).toBeLessThan(reordered.indexOf("FAMILIE"));
    expect(reordered.indexOf("FAMILIE")).toBeLessThan(reordered.indexOf("SCHULBILDUNG"));
    expect(reordered.indexOf("FAMILY")).toBeLessThan(reordered.indexOf("SCHOOL"));
  });

  test("respects an explicitly saved rubric order instead of forcing family second", () => {
    const data = {
      ...DEMO_CV,
      sectionOrder: [
        "person" as const,
        "schule" as const,
        customSectionKey("familie"),
        "erfahrung" as const,
        "sprachen" as const,
        "hobbys" as const,
        "staerken" as const,
        "referenzen" as const,
      ],
    };
    const reordered = applyCvSectionOrderToDocumentXml(sourceWithFamilyLast(), { data });

    expect(reordered.indexOf("SCHULBILDUNG")).toBeLessThan(reordered.indexOf("FAMILIE"));
    expect(reordered.indexOf("FAMILIE")).toBeLessThan(
      reordered.indexOf("PRAKTIKA & SCHNUPPERTAGE"),
    );
  });

  test("never cuts nested sidebar tables while scanning rubric headings", () => {
    const nested = [
      "<w:document><w:body>",
      sectionBreak,
      sectionBreak,
      '<w:tbl><w:tr><w:tc>',
      block("Stärken", "STRENGTH"),
      "</w:tc><w:tc>",
      block("Schulbildung", "SCHOOL"),
      block("Familie", "FAMILY"),
      "</w:tc></w:tr></w:tbl>",
      '<w:sectPr><w:pgSz w:w="1" w:h="1"/></w:sectPr>',
      "</w:body></w:document>",
    ].join("");

    const reordered = applyCvSectionOrderToDocumentXml(nested, { data: DEMO_CV });

    expect(reordered).toBe(nested);
  });
});
