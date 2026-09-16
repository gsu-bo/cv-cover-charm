import { describe, expect, test } from "bun:test";
import {
  patchLetterAlignmentGroups,
  type LetterParagraphGroup,
} from "@/lib/dossier-docx-letter-alignment";

const paragraph = (text: string, align = "left") =>
  [
    "<w:p><w:pPr>",
    `<w:spacing w:before="100" w:after="200"/><w:jc w:val="${align}"/>`,
    "</w:pPr><w:r>",
    `<w:t xml:space="preserve">${text}</w:t>`,
    "</w:r></w:p>",
  ].join("");

const sectionBreak = () =>
  '<w:p><w:pPr><w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:pPr></w:p>';

describe("DOCX body alignment output parity", () => {
  test("different letter alignments split without leaking into CV", () => {
    const merged = "Erste Zeile\nZweite Zeile";
    const source = [
      "<w:document><w:body>",
      paragraph("Cover"),
      sectionBreak(),
      paragraph(merged),
      sectionBreak(),
      paragraph(merged),
      "</w:body></w:document>",
    ].join("");
    const groups: LetterParagraphGroup[] = [
      {
        sourceText: merged,
        blocks: [
          { text: "Erste Zeile", align: "left" },
          { text: "Zweite Zeile", align: "justify" },
        ],
      },
    ];

    const patched = patchLetterAlignmentGroups(source, groups);
    const letterStart = patched.indexOf("</w:sectPr>") + "</w:sectPr>".length;
    const cvStart = patched.indexOf("<w:sectPr>", letterStart);
    const letterXml = patched.slice(letterStart, cvStart);
    const cvXml = patched.slice(cvStart);

    expect(letterXml).toContain(">Erste Zeile</w:t>");
    expect(letterXml).toContain('<w:jc w:val="left"/>');
    expect(letterXml).toContain(">Zweite Zeile</w:t>");
    expect(letterXml).toContain('<w:jc w:val="both"/>');
    expect(letterXml).toContain('w:after="0"');
    expect(letterXml).toContain('w:before="0"');
    expect(cvXml).toContain(`>${merged}</w:t>`);
    expect(cvXml).toContain('<w:jc w:val="left"/>');
  });

  test("uniform Blocksatz stays one Word paragraph and maps to both", () => {
    const merged = "Zeile eins\nZeile zwei";
    const source = [
      "<w:document><w:body>",
      paragraph("Cover"),
      sectionBreak(),
      paragraph(merged),
      sectionBreak(),
      paragraph("CV"),
      "</w:body></w:document>",
    ].join("");
    const groups: LetterParagraphGroup[] = [
      {
        sourceText: merged,
        blocks: [
          { text: "Zeile eins", align: "justify" },
          { text: "Zeile zwei", align: "justify" },
        ],
      },
    ];

    const patched = patchLetterAlignmentGroups(source, groups);
    expect(patched).toContain(`>${merged}</w:t>`);
    expect(patched).toContain('<w:jc w:val="both"/>');
  });
});
