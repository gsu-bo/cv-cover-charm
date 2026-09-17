import { describe, expect, test } from "bun:test";
import { coverAttachmentValues, DEFAULT_COVER_BEILAGEN } from "../../src/components/cover/types";
import { DEFAULT_LETTER_BEILAGEN, letterAttachmentValues } from "../../src/components/letter/types";

describe("custom attachment lists", () => {
  test("keeps every user-defined cover attachment", () => {
    const values = ["Motivationsschreiben", "Lebenslauf", "Zeugnis", "Schnupperbericht"];
    expect(coverAttachmentValues({ beilagen: values })).toEqual(values);
  });

  test("keeps every user-defined letter attachment", () => {
    const values = ["Lebenslauf", "Zeugnis", "Kursbestätigung", "Referenzschreiben"];
    expect(letterAttachmentValues({ beilagen: values })).toEqual(values);
  });

  test("respects an explicitly empty attachment list", () => {
    expect(coverAttachmentValues({ beilagen: [] })).toEqual([]);
    expect(letterAttachmentValues({ beilagen: [] })).toEqual([]);
  });

  test("migrates old documents without an attachment field", () => {
    expect(coverAttachmentValues({})).toEqual([...DEFAULT_COVER_BEILAGEN]);
    expect(letterAttachmentValues({})).toEqual([...DEFAULT_LETTER_BEILAGEN]);
  });
});
