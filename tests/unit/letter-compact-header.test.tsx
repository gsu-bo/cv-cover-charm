import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "../../src/components/cover/fresh-templates";
import { TEMPLATES } from "../../src/components/cover/types";
import { LetterCanvas } from "../../src/components/letter/LetterCanvas";
import {
  DEMO_LETTER,
  defaultLetterColors,
  emptyLetterDesign,
  normalizeLetterDesign,
  type LetterData,
  type LetterFooterMode,
  type LetterHeaderMode,
  type LetterTemplateId,
} from "../../src/components/letter/types";

// Brief now lives in the shared dossier catalogue; never prepend it a second time here.
const LETTER_TEMPLATE_IDS: LetterTemplateId[] = TEMPLATES.map(
  (template) => template.id as LetterTemplateId,
);

function markupFor(
  template: LetterTemplateId,
  headerMode: LetterHeaderMode,
  footerMode: LetterFooterMode = "compact",
  data: LetterData = DEMO_LETTER,
) {
  const design = {
    ...emptyLetterDesign(),
    template,
    colors: defaultLetterColors(template),
    headerMode,
    footerMode,
  };
  return renderToStaticMarkup(createElement(LetterCanvas, { data, design }));
}

function footerHeight(markup: string): number {
  const value = markup.match(/data-letter-footer-height-mm="([^"]+)"/)?.[1];
  return value ? Number(value) : 0;
}

describe("compact letter presentation", () => {
  test("letter canvas renders shared dossier paper for every template", () => {
    expect(TEMPLATES.length).toBe(41);
    expect(LETTER_TEMPLATE_IDS.length).toBe(41);
    for (const template of LETTER_TEMPLATE_IDS) {
      const markup = markupFor(template, "compact");
      expect(markup).toContain('data-letter-header-mode="compact"');
      expect(markup).toContain('data-letter-footer="compact"');
      expect(markup).toContain('data-letter-footer-mode="compact"');
      expect(markup).toContain(`data-dossier-sheet-background="${template}"`);

      if (template === "brief") {
        expect(markup).toContain('data-letter-background="brief"');
        expect(markup).toContain("bg-white");
      } else {
        expect(markup).not.toContain('data-letter-background="brief"');
      }
    }
  });

  test("all header modes work for every selectable letter style", () => {
    for (const template of LETTER_TEMPLATE_IDS) {
      const compact = markupFor(template, "compact");
      const contact = markupFor(template, "contact");
      const none = markupFor(template, "none");

      expect(compact).toContain('data-letter-header-mode="compact"');
      expect(compact).toContain('data-letter-section="sender"');

      expect(contact).toContain('data-letter-header-mode="contact"');
      expect(contact).toContain("data-letter-integrated-contact");
      expect(contact).not.toContain('data-letter-section="sender"');
      expect(contact).toContain("top:43mm");

      expect(none).toContain('data-letter-header-mode="none"');
      expect(none).not.toContain("data-letter-integrated-contact");
      expect(none).toContain('data-letter-section="sender"');
      expect(none).toContain("top:18mm");
    }
  });

  test("all footer modes work for every selectable letter style without duplicating attachments", () => {
    for (const template of LETTER_TEMPLATE_IDS) {
      const compact = markupFor(template, "compact", "compact");
      const attachments = markupFor(template, "compact", "attachments");
      const none = markupFor(template, "compact", "none");

      expect(compact).toContain('data-letter-footer-mode="compact"');
      expect(compact).toContain('data-letter-footer="compact"');
      expect(compact).toContain('data-letter-pdf-text="attachments-heading"');

      expect(attachments).toContain('data-letter-footer-mode="attachments"');
      expect(attachments).toContain('data-letter-footer="attachments"');
      expect(attachments).toContain("data-letter-footer-attachments");
      expect(attachments.match(/data-letter-pdf-text="attachments-heading"/g)?.length).toBe(1);

      expect(none).toContain('data-letter-footer-mode="none"');
      expect(none).not.toContain("data-letter-footer=");
      expect(none).toContain("bottom:10mm");
      expect(none).toContain('data-letter-pdf-text="attachments-heading"');
    }
  });

  test("attachments footer grows with its editable attachment content", () => {
    const shortMarkup = markupFor("modern", "compact", "attachments");
    const longMarkup = markupFor("modern", "compact", "attachments", {
      ...DEMO_LETTER,
      beilagen: ["Lebenslauf", "Zeugnis", "Schnupperbericht", "Kursbestätigung"],
    });

    expect(footerHeight(shortMarkup)).toBeGreaterThan(0);
    expect(footerHeight(longMarkup)).toBeGreaterThan(footerHeight(shortMarkup));
    expect(longMarkup).toContain("Schnupperbericht");
    expect(longMarkup).toContain("Kursbestätigung");
  });

  test("attachments footer also grows when the item count stays the same but a label wraps", () => {
    const shortMarkup = markupFor("modern", "compact", "attachments", {
      ...DEMO_LETTER,
      beilagen: ["Lebenslauf", "Zeugnis"],
    });
    const wrappedMarkup = markupFor("modern", "compact", "attachments", {
      ...DEMO_LETTER,
      beilagen: [
        "Lebenslauf",
        "Bestätigung über die absolvierte mehrwöchige Schnupperlehre und den erfolgreichen Abschluss des Einführungskurses",
      ],
    });

    expect(footerHeight(wrappedMarkup)).toBeGreaterThan(footerHeight(shortMarkup));
  });

  test("contact header keeps long real-world contact values wrap-capable instead of truncating them", () => {
    const markup = markupFor("modern", "contact", "compact", {
      ...DEMO_LETTER,
      absenderName: "Lea Sophie Alexandra Müller-Winterberger-Schneider",
      absenderAdresse: "Sehrlangebeispielstrasse 123a Hinterhaus",
      absenderEmail: "lea.sophie.alexandra.mueller-winterberger-schneider@example-company.ch",
    });

    expect(markup).toContain("Lea Sophie Alexandra Müller-Winterberger-Schneider");
    expect(markup).toContain("overflow-wrap:anywhere");
    expect(markup).not.toContain("text-overflow:ellipsis");
    expect(markup).toContain("top:43mm");
  });

  test("meaningful contact and attachment chrome stays in the accessibility tree", () => {
    const markup = markupFor("modern", "contact", "attachments");
    const chromeTag = markup.match(/<div[^>]*data-letter-chrome[^>]*>/)?.[0];

    expect(chromeTag).toBeDefined();
    expect(chromeTag).not.toContain('aria-hidden="true"');
    expect(markup).toContain("data-letter-integrated-contact");
    expect(markup).toContain("data-letter-footer-attachments");
  });

  test("header and footer settings survive design normalization", () => {
    const normalized = normalizeLetterDesign({
      template: "modern",
      colors: defaultLetterColors("modern"),
      font: "freundlich",
      headerMode: "contact",
      headerShowName: false,
      headerShowAddress: true,
      headerShowPhone: false,
      headerShowEmail: true,
      footerMode: "attachments",
    });
    expect(normalized.headerMode).toBe("contact");
    expect(normalized.headerShowName).toBe(false);
    expect(normalized.headerShowAddress).toBe(true);
    expect(normalized.headerShowPhone).toBe(false);
    expect(normalized.headerShowEmail).toBe(true);
    expect(normalized.footerMode).toBe("attachments");

    const legacy = normalizeLetterDesign({
      template: "modern",
      colors: defaultLetterColors("modern"),
      font: "freundlich",
    });
    expect(legacy.headerMode).toBe("compact");
    expect(legacy.headerShowName).toBe(true);
    expect(legacy.headerShowAddress).toBe(true);
    expect(legacy.headerShowPhone).toBe(true);
    expect(legacy.headerShowEmail).toBe(true);
    expect(legacy.footerMode).toBe("compact");
  });

  test("retired Edel blockig and Bogen saves fall back instead of reviving removed templates", () => {
    expect(normalizeLetterDesign({ template: "edelBlockig" }).template).toBe("brief");
    expect(normalizeLetterDesign({ template: "sonnig" }).template).toBe("brief");
  });

  test("contact header uses automatic readable contrast on a light header color", () => {
    const design = {
      ...emptyLetterDesign(),
      template: "modern" as const,
      colors: { ...defaultLetterColors("modern"), primary: "#ffffff", accent: "#ffffff" },
      headerMode: "contact" as const,
    };
    const markup = renderToStaticMarkup(createElement(LetterCanvas, { data: DEMO_LETTER, design }));
    expect(markup).toContain("data-letter-integrated-contact");
    expect(markup).toContain("color:#18181b");
  });
});
