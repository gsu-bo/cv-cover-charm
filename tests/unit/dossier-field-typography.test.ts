import { describe, expect, test } from "bun:test";
import { applyDossierFieldTypographyToDocumentXml } from "@/lib/dossier-docx-field-typography";
import type { DossierFieldTypographyEntry } from "@/lib/dossier-field-typography";

function entry(
  scope: "letter" | "cv",
  value: string,
  style: DossierFieldTypographyEntry["style"],
): DossierFieldTypographyEntry {
  return { key: `${scope}-${value}`, scope, section: scope, label: value, value, style };
}

const xml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>Guten Tag</w:t></w:r></w:p>
<w:p><w:pPr><w:sectPr><w:pgSz/></w:sectPr></w:pPr></w:p>
<w:p><w:r><w:t>Guten Tag</w:t></w:r></w:p>
<w:p><w:pPr><w:sectPr><w:pgSz/></w:sectPr></w:pPr></w:p>
<w:p><w:r><w:t>Solothurn</w:t></w:r></w:p>
<w:sectPr><w:pgSz/></w:sectPr>
</w:body></w:document>`;

describe("dossier field typography DOCX pass", () => {
  test("formats letter and CV sections without touching the cover section", () => {
    const result = applyDossierFieldTypographyToDocumentXml(
      xml,
      [entry("letter", "Guten Tag", { bold: true, italic: true })],
      [entry("cv", "Solothurn", { underline: true })],
    );

    const occurrences = result.split("Guten Tag");
    expect(occurrences).toHaveLength(3);
    expect(occurrences[0]).not.toContain("<w:b/>");
    expect(occurrences[1]).toContain("<w:b/>");
    expect(occurrences[1]).toContain("<w:i/>");
    expect(result.slice(result.lastIndexOf("<w:p><w:r>")).toContain('<w:u w:val="single"/>');
  });

  test("supports explicit off overrides", () => {
    const result = applyDossierFieldTypographyToDocumentXml(
      xml,
      [entry("letter", "Guten Tag", { bold: false, underline: false })],
      [],
    );
    const letterPart = result.slice(result.indexOf("Guten Tag", result.indexOf("Guten Tag") + 1) - 120);
    expect(letterPart).toContain('<w:b w:val="0"/>');
    expect(letterPart).toContain('<w:u w:val="none"/>');
  });
});
