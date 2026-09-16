import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BODY_TEXT_ALIGNMENTS,
  isBodyTextAlignment,
  normalizeTextAlignment,
  TEXT_ALIGNMENTS,
} from "@/lib/text-alignment";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const sharedControl = read("src/components/dossier/TextAlignmentControl.tsx");
const elementBar = read("src/components/cover/ElementBar.tsx");
const coverTypes = read("src/components/cover/types.ts");
const letterEditor = read("src/components/letter/LetterRichTextEditor.tsx");
const letterCss = read("src/components/letter/letter-alignment.css");
const letterRichText = read("src/components/letter/rich-text.ts");
const cvPortal = read("src/components/cv/CvTextAlignmentPortal.tsx");
const cvCanvas = read("src/components/cv/CvCanvas.tsx");
const cvCss = read("src/components/cv/user-typography.css");
const cvAlignment = read("src/components/cv/text-alignment.ts");
const portableCv = read("src/components/cv/portable-state.ts");
const section = read("src/components/cover/Section.tsx");
const docxExport = read("src/lib/dossier-docx-export.ts");
const docxLetterAlignment = read("src/lib/dossier-docx-letter-alignment.ts");
const docxCvAlignment = read("src/lib/dossier-docx-cv-alignment.ts");

describe("shared dossier text alignment", () => {
  test("global layout stays four-way while body prose is exactly left or justify", () => {
    expect(TEXT_ALIGNMENTS).toEqual(["left", "center", "right", "justify"]);
    expect(BODY_TEXT_ALIGNMENTS).toEqual(["left", "justify"]);
    expect(isBodyTextAlignment("left")).toBe(true);
    expect(isBodyTextAlignment("justify")).toBe(true);
    expect(isBodyTextAlignment("center")).toBe(false);
    expect(isBodyTextAlignment("right")).toBe(false);
    expect(normalizeTextAlignment("justify")).toBe("justify");
    expect(normalizeTextAlignment("invalid", "center")).toBe("center");
    for (const label of ["Linksbündig", "Zentriert", "Rechtsbündig", "Blocksatz"]) {
      expect(sharedControl).toContain(label);
    }
    expect(sharedControl).toContain("data-text-alignment-control");
    expect(sharedControl).toContain("data-alignment={alignment}");
    expect(sharedControl).toContain("TextAlignmentControlProps<T extends TextAlignment>");
  });

  test("title page, motivation letter and CV all use the same visual control", () => {
    expect(elementBar).toContain("<TextAlignmentControl");
    expect(letterEditor).toContain("<TextAlignmentControl");
    expect(cvPortal).toContain("<TextAlignmentControl");
    expect(elementBar).not.toContain('(["left", "center", "right"] as const).map');
    expect(elementBar).not.toContain("function AlignIcon");
    expect(coverTypes).toContain("align: TextAlignment");
  });

  test("CV and motivation-letter body controls and models expose only left and justify", () => {
    expect(cvPortal).toContain("alignments={BODY_TEXT_ALIGNMENTS}");
    expect(letterEditor).toContain("alignments={BODY_TEXT_ALIGNMENTS}");
    expect(letterCss).not.toContain('data-align="center"');
    expect(letterCss).not.toContain('data-align="right"');
    expect(letterCss).not.toContain("display: none");
    expect(letterRichText).toContain("export type LetterTextAlign = BodyTextAlignment");
    expect(cvAlignment).toContain("BodyTextAlignment");
    expect(cvAlignment).not.toContain("normalizeTextAlignment");
  });

  test("CV alignment lives in the typography form and reaches preview/PDF body roles", () => {
    expect(section).toContain("data-editor-section-title={title}");
    expect(section).toContain("data-editor-section-body");
    expect(cvPortal).toContain("Schrift und Layout");
    expect(cvPortal).toContain("Fliesstext ausrichten");
    expect(cvCanvas).toContain("data-cv-body-align={bodyAlignment}");
    for (const alignment of BODY_TEXT_ALIGNMENTS) {
      expect(cvCss).toContain(`[data-cv-body-align="${alignment}"] [data-cv-body]`);
    }
    expect(cvCss).not.toContain('[data-cv-body-align="center"]');
    expect(cvCss).not.toContain('[data-cv-body-align="right"]');
  });

  test("CV choice is portable and DOCX maps justification to Word both", () => {
    expect(portableCv).toContain("CV_TEXT_ALIGNMENT_STORAGE_KEY");
    expect(portableCv).toContain("textAlign?: BodyTextAlignment");
    expect(portableCv).toContain("setCvTextAlignment(state.textAlign)");
    expect(docxExport).toContain("applyLetterAlignmentToDocx");
    expect(docxExport).toContain("applyCvTextAlignmentToDocx");
    expect(docxLetterAlignment).toContain('align === "justify" ? "both" : align');
    expect(docxLetterAlignment).toContain("patchLetterAlignmentGroups");
    expect(docxCvAlignment).toContain('align === "justify" ? "both" : align');
    expect(docxCvAlignment).toContain("BodyTextAlignment");
    expect(docxCvAlignment).toContain("readPersistedCvTextAlignment");
  });
});
