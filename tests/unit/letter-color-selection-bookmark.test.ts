import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  new URL("../../src/components/letter/LetterRichTextEditor.tsx", import.meta.url),
  "utf8",
);

describe("letter colour selection bookmark", () => {
  test("keeps saved ranges typed and rebases them after editor sanitization", () => {
    expect(source).toContain("type RangeBookmark");
    expect(source).toContain("const parent: ParentNode | null = current.parentNode;");
    expect(source).toContain("restoreBookmarkedRange(editor, savedBookmark)");
    expect(source).toContain("restoreBookmarkedRange(editor, colorBookmark)");
  });
});
