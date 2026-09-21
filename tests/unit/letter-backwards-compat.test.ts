import { describe, expect, test } from "bun:test";
import {
  EMPTY_LETTER,
  normalizeLetterDesign,
  normalizeLetterSpacingMm,
} from "@/components/letter/types";

describe("M7 legacy motivation-letter compatibility", () => {
  test("old designs without header/footer fields receive current safe defaults", () => {
    const legacy = normalizeLetterDesign({
      template: "brief",
      colors: {
        bg: "#ffffff",
        primary: "#111111",
        accent: "#111111",
      },
      font: "freundlich",
    });

    expect(legacy).toMatchObject({
      template: "brief",
      font: "freundlich",
      fontOverride: null,
      senderAlign: "left",
      recipientAlign: "left",
      dateAlign: "left",
      ruleAfterSender: false,
      ruleAfterRecipient: false,
      ruleAfterSubject: false,
      headerMode: "compact",
      headerShowName: true,
      headerShowAddress: true,
      headerShowPhone: true,
      headerShowEmail: true,
      headerDifferentFirstPage: false,
      footerMode: "compact",
      chromeBorderEnabled: false,
    });
  });

  test("legacy data gains additive fields without overwriting existing content", () => {
    const legacyData = {
      absenderName: "Lea Müller",
      betreff: "Bestehender Betreff",
      text: "Bestehender Brieftext",
      anrede: "Guten Tag",
      gruss: "Freundliche Grüsse",
    };

    const restored = { ...EMPTY_LETTER, ...legacyData };

    expect(restored.absenderName).toBe("Lea Müller");
    expect(restored.betreff).toBe("Bestehender Betreff");
    expect(restored.text).toBe("Bestehender Brieftext");
    expect(restored.richTextHtml).toBe("");
    expect(restored.images).toEqual([]);
    expect(restored.showBeilagen).toBe(true);
    expect(restored.beilagen).toEqual(["Lebenslauf", "Zeugnis"]);
    expect(normalizeLetterSpacingMm(restored.grussAbstandMm)).toBe(9);
    expect(normalizeLetterSpacingMm(restored.unterschriftAbstandMm)).toBe(9);
  });

  test("explicit modern header/footer choices remain unchanged", () => {
    const current = normalizeLetterDesign({
      template: "brief",
      colors: {},
      font: "freundlich",
      headerMode: "contact",
      headerShowAddress: false,
      headerShowEmail: false,
      footerMode: "attachments",
      chromeBorderEnabled: true,
    });

    expect(current.headerMode).toBe("contact");
    expect(current.headerShowName).toBe(true);
    expect(current.headerShowAddress).toBe(false);
    expect(current.headerShowPhone).toBe(true);
    expect(current.headerShowEmail).toBe(false);
    expect(current.footerMode).toBe("attachments");
    expect(current.chromeBorderEnabled).toBe(true);
  });

  test("an explicitly saved compact header remains compact", () => {
    const compact = normalizeLetterDesign({
      template: "brief",
      colors: {},
      font: "freundlich",
      headerMode: "compact",
    });

    expect(compact.headerMode).toBe("compact");
  });
});
