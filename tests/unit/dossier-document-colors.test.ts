import { describe, expect, test } from "bun:test";
import {
  COVER_DOCUMENT_COLOR_KEYS,
  CV_DOCUMENT_COLOR_KEYS,
  preserveDocumentColors,
} from "../../src/lib/dossier-document-colors";

describe("semantic document color precedence", () => {
  test("carries explicit title-page paper and text colors into a new template palette", () => {
    const next = preserveDocumentColors(
      { bg: "#ffffff", primary: "#123456", ink: "#111111" },
      {
        bg: "#f5f5f5",
        primary: "#654321",
        coverPaper: "#fff3dd",
        coverInk: "#24364b",
      },
      COVER_DOCUMENT_COLOR_KEYS,
    );

    expect(next).toEqual({
      bg: "#ffffff",
      primary: "#123456",
      ink: "#111111",
      coverPaper: "#fff3dd",
      coverInk: "#24364b",
    });
  });

  test("keeps CV text overrides while allowing the next template to own its accents", () => {
    const next = preserveDocumentColors(
      { bg: "#ffffff", primary: "#334155", accent: "#38bdf8" },
      {
        primary: "#111827",
        accent: "#f43f5e",
        cvInk: "#182230",
        cvMuted: "#51606f",
        cvHeading: "#24364b",
      },
      CV_DOCUMENT_COLOR_KEYS,
    );

    expect(next.primary).toBe("#334155");
    expect(next.accent).toBe("#38bdf8");
    expect(next.cvInk).toBe("#182230");
    expect(next.cvMuted).toBe("#51606f");
    expect(next.cvHeading).toBe("#24364b");
  });

  test("does not preserve automatic empty overrides", () => {
    const next = preserveDocumentColors(
      { bg: "#ffffff", ink: "#111111" },
      { coverPaper: "", coverInk: "", cvInk: "" },
      [...COVER_DOCUMENT_COLOR_KEYS, ...CV_DOCUMENT_COLOR_KEYS],
    );

    expect(next).toEqual({ bg: "#ffffff", ink: "#111111" });
  });
});
