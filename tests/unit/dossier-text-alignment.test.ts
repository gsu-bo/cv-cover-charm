import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { normalizeTextAlignment, TEXT_ALIGNMENTS } from "@/lib/text-alignment";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const sharedControl = read("src/components/dossier/TextAlignmentControl.tsx");
const elementBar = read("src/components/cover/ElementBar.tsx");
const coverTypes = read("src/components/cover/types.ts");
const letterEditor = read("src/components/letter/LetterRichTextEditor.tsx");
const letterCss = read("src/components/letter/letter-alignment.css");
const cvPortal = read("src/components/cv/CvTextAlignmentPortal.tsx");
const cvCanvas = read("src/components/cv/CvCanvas.tsx");
const cvCss = read("src/components/cv/user-typography.css");
const portableCv = read("src/components/cv/portable-state.ts");
const section = read("src/components/cover/Section.tsx");
const docxExport = read("src/lib/dossier-docx-export.ts");
const docxLetterAlignment = read("src/lib/dossier-docx-letter-alignment.ts");
const docxCvAlignment = read("src/lib/dossier-docx-cv-alignment.ts");

describe("shared dossier text alignment", () => {
  test("the shared contract exposes exactly left, center, right and justify", () => {
    expect(TEXT_ALIGNMENTS).toEqual(["left", "center", "right", "justify"]);
    expect(normalizeTextAlignment("justify")).toBe("justify");
    expect(normalizeTextAlignment("invalid", "center")).toBe("center");
    for (const label of ["Linksbündig", "Zentriert", "Rechtsbündig", "Blocksatz"]) {
      expect(sharedControl).toContain(label);
    }
    expect(sharedControl).toContain("data-text-alignment-control");
    expect(sharedControl).toContain("data-alignment={alignment}");
    expect(sharedControl).toContain("alignments = TEXT_ALIGNMENTS");
  });

  test("title page, motivation letter and CV all use the same visual control", () => {
    expect(elementBar).toContain("<TextAlignmentControl");
    expect(letterEditor).toContain("<TextAlignmentControl");
    expect(cvPortal).toContain("<TextAlignmentControl");
    expect(elementBar).not.toContain('(["left", "center", "right"] as const).map');
    expect(elementBar).not.toContain("function AlignIcon");
    expect(coverTypes).toContain("align: TextAlignment");
  });

  test("CV and motivation-letter body controls expose only left and justify", () => {
    expect(cvPortal).toContain('alignments={["left", "justify"] as const}');
    expect(letterCss).toContain('data-alignment="center"');
    expect(letterCss).toContain('data-alignment="right"');
    expect(letterCss).toContain("display: none");
  });

  test("CV alignment lives in the typography form and reaches preview/PDF body roles", () => {
    expect(section).toContain("data-editor-section-title={title}");
    expect(section).toContain("data-editor-section-body");
    expect(cvPortal).toContain('Schrift und Layout');
    expect(cvPortal).toContain("Fliesstext ausrichten");
    expect(cvCanvas).toContain("data-cv-body-align={bodyAlignment}");
    for (const alignment of TEXT_ALIGNMENTS) {
      expect(cvCss).toContain(`[data-cv-body-align="${alignment}"] [data-cv-body]`);
    }
  });

  test("CV choice is portable and DOCX maps justification to Word both", () => {
    expect(portableCv).toContain("CV_TEXT_ALIGNMENT_STORAGE_KEY");
    expect(portableCv).toContain("textAlign?: TextAlignment");
    expect(portableCv).toContain("setCvTextAlignment(state.textAlign)");
    expect(docxExport).toContain("applyLetterAlignmentToDocx");
    expect(docxExport).toContain("applyCvTextAlignmentToDocx");
    expect(docxLetterAlignment).toContain('align === "justify" ? "both" : align');
    expect(docxLetterAlignment).toContain("patchLetterAlignmentGroups");
    expect(docxCvAlignment).toContain('align === "justify" ? "both" : align');
    expect(docxCvAlignment).toContain("readPersistedCvTextAlignment");
  });
});
