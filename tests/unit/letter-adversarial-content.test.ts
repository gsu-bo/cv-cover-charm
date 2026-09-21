import { describe, expect, test } from "bun:test";
import {
  letterFooterHeightMm,
  letterPageGeometry,
  visibleLetterAttachments,
} from "../../src/components/letter/layout-system";
import {
  normalizeLetterInlineColor,
  plainTextToRichHtml,
} from "../../src/components/letter/rich-text";
import { DEMO_LETTER, emptyLetterDesign, type LetterData } from "../../src/components/letter/types";

function letter(patch: Partial<LetterData> = {}): LetterData {
  return {
    ...DEMO_LETTER,
    ...patch,
    images: [...(patch.images ?? DEMO_LETTER.images ?? [])],
    beilagen: [...(patch.beilagen ?? DEMO_LETTER.beilagen ?? [])],
  };
}

describe("M8 adversarial motivation-letter boundaries", () => {
  test("filters blank attachments without losing real Unicode labels", () => {
    const data = letter({
      beilagen: ["", "  ", "Zeugnis – Frühling 2026", "Référence école", "Lebenslauf"],
    });

    expect(visibleLetterAttachments(data)).toEqual([
      "Zeugnis – Frühling 2026",
      "Référence école",
      "Lebenslauf",
    ]);
  });

  test("many and very long attachment names reserve space but stay capped inside A4", () => {
    const data = letter({
      beilagen: Array.from(
        { length: 12 },
        (_, index) =>
          `Beilage ${index + 1}: Ausführliche Bestätigung für Schnupperlehre, Schulprojekt und zusätzliche Arbeitsprobe`,
      ),
    });
    const design = { ...emptyLetterDesign(), footerMode: "attachments" as const };
    const geometry = letterPageGeometry(data, design);

    expect(letterFooterHeightMm(data, "attachments")).toBe(30);
    expect(geometry.footer.height).toBe(30);
    expect(geometry.content.bottom).toBe(37);
    expect(geometry.content.height).toBeGreaterThan(220);
    expect(geometry.content.top + geometry.content.height + geometry.content.bottom).toBe(297);
  });

  test("an attachment footer with intentionally hidden attachments collapses to its minimum band", () => {
    const data = letter({ showBeilagen: false, beilagen: [] });
    const design = { ...emptyLetterDesign(), footerMode: "attachments" as const };
    const geometry = letterPageGeometry(data, design);

    expect(letterFooterHeightMm(data, "attachments")).toBe(4);
    expect(geometry.footer.showAttachments).toBe(false);
    expect(geometry.footer.height).toBe(4);
  });

  test("plain-text conversion preserves accents while escaping user-supplied markup", () => {
    const html = plainTextToRichHtml(
      "Zoë-Anouk D’Ávila-Müller <script>alert('x')</script>\nÉlodie O'Connor-García",
    );

    expect(html).toContain("Zoë-Anouk D’Ávila-Müller");
    expect(html).toContain("Élodie O&#039;Connor-García");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;");
  });

  test("inline letter colors accept only canonical opaque RGB values", () => {
    expect(normalizeLetterInlineColor("#A3C")).toBe("#aa33cc");
    expect(normalizeLetterInlineColor("rgb(12, 34, 56)")).toBe("#0c2238");
    expect(normalizeLetterInlineColor("rgba(12, 34, 56, 0)")).toBeUndefined();
    expect(normalizeLetterInlineColor("rgba(12, 34, 56, 0.5)")).toBeUndefined();
    expect(normalizeLetterInlineColor("url(javascript:alert(1))")).toBeUndefined();
  });
});
