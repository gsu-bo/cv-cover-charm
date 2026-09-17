import { describe, expect, test } from "bun:test";
import { emptyCv, type CvDesign } from "../../src/components/cv/types";
import { applyCvSectionTitleStyleToDocumentXml } from "../../src/lib/dossier-docx-cv-section-titles";
import { createDossierProject, parseDossierProject } from "../../src/lib/dossier-project";
import type { CvPdfDocument } from "../../src/lib/dossier-pdf-document";

const baseDesign: CvDesign = {
  template: "freundlich",
  colors: {},
  bgOpacity: 0.25,
  useElements: false,
};

const cvWith = (design: CvDesign): Pick<CvPdfDocument, "data" | "design"> => ({
  data: {
    ...emptyCv,
    labels: { ...emptyCv.labels, schule: "Schulbildung" },
  },
  design,
});

const documentXml = `<?xml version="1.0"?><w:document><w:body>
<w:p><w:pPr><w:sectPr><w:pgSz/></w:sectPr></w:pPr></w:p>
<w:p><w:pPr><w:sectPr><w:pgSz/></w:sectPr></w:pPr></w:p>
<w:tbl><w:tr>
<w:tc><w:p><w:pPr><w:spacing w:after="68"/></w:pPr><w:r><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="0F766E"/><w:b/><w:bCs/></w:rPr><w:t>SCHULBILDUNG</w:t></w:r></w:p></w:tc>
<w:tc><w:p><w:pPr><w:spacing w:after="68"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:color="0F766E"/></w:pBdr></w:pPr><w:r/></w:p></w:tc>
</w:tr></w:tbl>
</w:body></w:document>`;

const documentXmlWithoutRule = documentXml.replace(
  '<w:pBdr><w:bottom w:val="single" w:sz="8" w:color="0F766E"/></w:pBdr>',
  "",
);

describe("CV rubric title styling", () => {
  test("explicit text overrides beat DOCX template defaults and line none stays independent", () => {
    const xml = applyCvSectionTitleStyleToDocumentXml(
      documentXml,
      cvWith({
        ...baseDesign,
        sectionTitleFontSizePx: 20,
        sectionTitleColor: "#123456",
        sectionTitleBold: false,
        sectionTitleItalic: true,
        sectionTitleUnderline: true,
        sectionTitleMarginBottomPx: 10,
        headingRule: "none",
      }),
    );

    expect(xml).toContain('<w:sz w:val="30"/>');
    expect(xml).toContain('<w:szCs w:val="30"/>');
    expect(xml).toContain('<w:color w:val="123456"/>');
    expect(xml).toContain('<w:b w:val="0"/>');
    expect(xml).toContain('<w:bCs w:val="0"/>');
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:iCs/>");
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('w:after="150"');
    expect(xml).not.toContain("<w:pBdr>");
    expect(xml).not.toContain('<w:bottom w:val="single"');
  });

  test("explicit underline off does not disable the right rule", () => {
    const xml = applyCvSectionTitleStyleToDocumentXml(
      documentXml,
      cvWith({
        ...baseDesign,
        sectionTitleColor: "#AABBCC",
        sectionTitleUnderline: false,
        headingRule: "full",
      }),
    );

    expect(xml).toContain('<w:u w:val="none"/>');
    expect(xml).toContain("<w:pBdr>");
    expect(xml).toContain('w:color="AABBCC"');
  });

  test("explicit full creates a Word rubric rule when the template has none", () => {
    const xml = applyCvSectionTitleStyleToDocumentXml(
      documentXmlWithoutRule,
      cvWith({
        ...baseDesign,
        colors: { accent: "#445566" },
        headingRule: "full",
      }),
    );

    expect(xml).toContain("<w:pBdr>");
    expect(xml).toContain(
      '<w:bottom w:val="single" w:sz="8" w:space="1" w:color="445566"/>',
    );
    expect(xml.match(/<w:bottom\b/g)?.length).toBe(1);
  });

  test("missing rubric overrides preserve the DOCX template exactly", () => {
    expect(applyCvSectionTitleStyleToDocumentXml(documentXml, cvWith(baseDesign))).toBe(documentXml);
  });

  test("rubric overrides survive dossier JSON export and import", () => {
    const design: CvDesign = {
      ...baseDesign,
      sectionTitleFontSizePx: 19,
      sectionTitleColor: "#8844CC",
      sectionTitleBold: false,
      sectionTitleItalic: true,
      sectionTitleUnderline: true,
      sectionTitleMarginBottomPx: 12,
      headingRule: "none",
    };
    const cv = { version: 6, data: emptyCv, design, elements: [] };
    const exported = createDossierProject({ cv });
    const imported = parseDossierProject(JSON.parse(JSON.stringify(exported)));
    const importedDesign = imported?.cv?.design as CvDesign | undefined;

    expect(importedDesign?.sectionTitleFontSizePx).toBe(19);
    expect(importedDesign?.sectionTitleColor).toBe("#8844CC");
    expect(importedDesign?.sectionTitleBold).toBe(false);
    expect(importedDesign?.sectionTitleItalic).toBe(true);
    expect(importedDesign?.sectionTitleUnderline).toBe(true);
    expect(importedDesign?.sectionTitleMarginBottomPx).toBe(12);
    expect(importedDesign?.headingRule).toBe("none");
  });
});
