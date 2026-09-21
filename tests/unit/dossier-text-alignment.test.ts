import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BODY_TEXT_ALIGNMENTS,
  isBodyTextAlignment,
  normalizeTextAlignment,
  TEXT_ALIGNMENTS,
} from "@/lib/text-alignment";
import { compatibleLetterTextAlign } from "@/components/letter/rich-text";

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

  test("body editors share the control while title-page alignment stays template-internal", () => {
    expect(elementBar).not.toContain("<TextAlignmentControl");
    expect(elementBar).not.toContain("TextAlignmentControl from");
    expect(letterEditor).toContain("<TextAlignmentControl");
    expect(cvPortal).toContain("<TextAlignmentControl");
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

  test("multi-column letter blocks never combine with justification", () => {
    expect(compatibleLetterTextAlign("justify", 1)).toBe("justify");
    expect(compatibleLetterTextAlign("justify", 2)).toBe("left");
    expect(compatibleLetterTextAlign("justify", "3")).toBe("left");
    expect(compatibleLetterTextAlign("left", 2)).toBe("left");
    expect(letterEditor).toContain('if (align === "justify") delete block.dataset.columns');
    expect(letterEditor).toContain('block.dataset.align = "left"');
    expect(letterCss).toContain('[data-columns="2"], [data-columns="3"]');
  });

  test("letter alignment is document-wide and normalized before persistence", () => {
    expect(letterEditor).toContain("function documentAlignment(editor: HTMLElement)");
    expect(letterEditor).toContain("normalizeEditableBlockAlignment(editor)");
    expect(letterEditor).toContain(
      "for (const block of editableBlocks(editor)) applyAlignment(block, align)",
    );
    expect(letterEditor).not.toContain(
      "const blocks = ensureSelectedBlocks(editor, range);\n    for (const block of blocks) applyAlignment",
    );
    expect(letterCss).toContain("text-justify: inter-word");
  });

  test("CV alignment lives in the Layout form and reaches preview/PDF body roles", () => {
    expect(section).toContain("data-editor-section-title={title}");
    expect(section).toContain("data-editor-section-body");
    expect(cvPortal).toContain('data-editor-section-title="Layout"');
    expect(cvPortal).not.toContain("Schrift und Layout");
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
