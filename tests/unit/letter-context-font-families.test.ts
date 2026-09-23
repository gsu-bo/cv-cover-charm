import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const control = readFileSync(
  new URL("../../src/components/letter/LetterFontSizeControl.tsx", import.meta.url),
  "utf8",
);
const chrome = readFileSync(
  new URL("../../src/components/dossier/DossierHeaderFooterChrome.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../../src/components/letter/letter-user-typography.css", import.meta.url),
  "utf8",
);

describe("contextual letter font families", () => {
  test("offers the font selector beside every contextual size control", () => {
    expect(control).toContain("data-letter-context-font-family");
    expect(control).toContain("Wie Vorlage");
    expect(control).toContain("FONT_LABELS");
  });

  test("keeps contact header and attachment footer font overrides independent", () => {
    expect(chrome).toContain("headerFontOverride?: FontKey");
    expect(chrome).toContain("footerFontOverride?: FontKey");
    expect(chrome).toContain("fontFamily: headerTextFontFamily");
    expect(chrome).toContain("fontFamily: footerTextFontFamily");
  });

  test("forces an explicit body font through rich text descendants", () => {
    expect(css).toContain('data-letter-user-body-font="true"');
    expect(css).toContain("font-family: var(--letter-user-body-font) !important;");
  });
});
