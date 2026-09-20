import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/letter/LetterRichTextEditor.tsx", "utf8");

test("letter inline typography appears only for a real text selection", () => {
  expect(source).toContain("data-letter-selection-toolbar");
  expect(source).toContain('aria-label="Textauswahl formatieren"');
  expect(source).toContain("range.collapsed");
  expect(source).toContain("range.getBoundingClientRect()");
  expect(source).toContain('window.addEventListener("scroll", onSelectionChange, true)');
  expect(source).toContain("window.innerHeight - bubbleEdge");
  expect(source).toContain("window.innerHeight - bubbleHeight - bubbleEdge");

  const permanentStart = source.indexOf("data-letter-rich-toolbar");
  const permanentEnd = source.indexOf("data-letter-column-control", permanentStart);
  const permanentToolbar = source.slice(permanentStart, permanentEnd);
  expect(permanentToolbar).not.toContain('aria-label="Fett"');
  expect(permanentToolbar).not.toContain('aria-label="Kursiv"');
  expect(permanentToolbar).not.toContain('aria-label="Unterstrichen"');
});
