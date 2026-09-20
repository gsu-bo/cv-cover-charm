import { describe, expect, test } from "bun:test";
import { applyDossierFieldTypographyToDocumentXml } from "@/lib/dossier-docx-field-typography";
import {
  dossierFieldTypographyKey,
  normalizeDossierFieldTypographyState,
  type DossierFieldTypographyEntry,
} from "@/lib/dossier-field-typography";

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

const duplicateXml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>Cover</w:t></w:r></w:p>
<w:p><w:pPr><w:sectPr><w:pgSz/></w:sectPr></w:pPr></w:p>
<w:p><w:r><w:t>Sender AG</w:t></w:r></w:p>
<w:p><w:r><w:t>Hubersdorf</w:t></w:r></w:p>
<w:p><w:r><w:t>Empfänger AG</w:t></w:r></w:p>
<w:p><w:r><w:t>Hubersdorf</w:t></w:r></w:p>
<w:p><w:r><w:t>Guten Tag</w:t></w:r></w:p>
<w:p><w:pPr><w:sectPr><w:pgSz/></w:sectPr></w:pPr></w:p>
<w:p><w:r><w:t>CV</w:t></w:r></w:p>
<w:sectPr><w:pgSz/></w:sectPr>
</w:body></w:document>`;

describe("dossier field typography", () => {
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
    expect(result.slice(result.lastIndexOf("<w:p><w:r>"))).toContain('<w:u w:val="single"/>');
  });

  test("supports explicit off overrides", () => {
    const result = applyDossierFieldTypographyToDocumentXml(
      xml,
      [entry("letter", "Guten Tag", { bold: false, underline: false })],
      [],
    );
    const letterPart = result.slice(
      result.indexOf("Guten Tag", result.indexOf("Guten Tag") + 1) - 120,
    );
    expect(letterPart).toContain('<w:b w:val="0"/>');
    expect(letterPart).toContain('<w:u w:val="none"/>');
  });

  test("stable field ids keep equal visible text as different fields", () => {
    const sender = dossierFieldTypographyKey({
      scope: "letter",
      section: "Meine Kontaktdaten",
      label: "PLZ und Ort",
      value: "Hubersdorf",
      fieldId: "sender-place",
    });
    const recipient = dossierFieldTypographyKey({
      scope: "letter",
      section: "Firma / Lehrbetrieb",
      label: "PLZ und Ort",
      value: "Hubersdorf",
      fieldId: "recipient-place",
    });
    expect(sender).not.toBe(recipient);
  });

  test("normalizes portable stable-field metadata", () => {
    const state = normalizeDossierFieldTypographyState({
      version: 1,
      cv: {},
      letter: {
        "field:letter:recipient-place": {
          section: " Firma / Lehrbetrieb ",
          label: " PLZ und Ort ",
          value: " 4535   Hubersdorf ",
          fieldId: " recipient-place ",
          contextValues: [" Beispiel AG ", "4535 Hubersdorf", "Beispiel AG"],
          docxOccurrence: 1,
          style: { bold: true, ignored: true },
        },
      },
    });
    const saved = state.letter["field:letter:recipient-place"];
    expect(saved).toEqual({
      section: "Firma / Lehrbetrieb",
      label: "PLZ und Ort",
      value: "4535 Hubersdorf",
      fieldId: "recipient-place",
      contextValues: ["Beispiel AG"],
      docxOccurrence: 1,
      style: { bold: true },
    });
  });

  test("context selects only the intended duplicate DOCX paragraph", () => {
    const result = applyDossierFieldTypographyToDocumentXml(
      duplicateXml,
      [
        {
          key: "field:letter:recipient-place",
          scope: "letter",
          section: "Firma / Lehrbetrieb",
          label: "PLZ und Ort",
          value: "Hubersdorf",
          fieldId: "recipient-place",
          contextValues: ["Empfänger AG"],
          docxOccurrence: 1,
          style: { bold: true },
        },
      ],
      [],
    );

    const first = result.indexOf("Hubersdorf");
    const second = result.indexOf("Hubersdorf", first + 1);
    const firstParagraph = result.slice(result.lastIndexOf("<w:p>", first), result.indexOf("</w:p>", first));
    const secondParagraph = result.slice(
      result.lastIndexOf("<w:p>", second),
      result.indexOf("</w:p>", second),
    );
    expect(firstParagraph).not.toContain("<w:b/>");
    expect(secondParagraph).toContain("<w:b/>");
  });
});
