import { describe, expect, test } from "bun:test";
import "../../src/components/cover/fresh-templates";
import { FRESH_TEMPLATE_IDS } from "../../src/components/cover/fresh-templates";
import { TEMPLATES } from "../../src/components/cover/types";
import { freshLetterSpec } from "../../src/components/letter/fresh-letter-system";
import {
  LETTER_PAGE_MM,
  letterArchetypeFor,
  letterPageGeometry,
  type LetterArchetype,
} from "../../src/components/letter/layout-system";
import {
  DEMO_LETTER,
  defaultLetterColors,
  emptyLetterDesign,
  type LetterFooterMode,
  type LetterHeaderMode,
  type LetterTemplateId,
} from "../../src/components/letter/types";
import { WARM_FIRST_PAGE_HEADER_HEIGHT_MM } from "../../src/components/letter/warm-letter-layout";

const headerModes: LetterHeaderMode[] = ["compact", "contact", "none"];
const footerModes: LetterFooterMode[] = ["compact", "attachments", "none"];
const LETTER_TEMPLATE_IDS: LetterTemplateId[] = TEMPLATES.map(
  (template) => template.id as LetterTemplateId,
);
const FRESH_IDS = new Set<string>(FRESH_TEMPLATE_IDS);

function designFor(
  template: LetterTemplateId,
  headerMode: LetterHeaderMode,
  footerMode: LetterFooterMode,
) {
  return {
    ...emptyLetterDesign(),
    template,
    colors: defaultLetterColors(template),
    headerMode,
    footerMode,
  };
}

function minimumContentHeightFor(template: LetterTemplateId, headerMode: LetterHeaderMode) {
  if (template === "freundlich" && headerMode === "compact") {
    return 220;
  }
  if (headerMode === "contact") {
    return 230;
  }
  return 240;
}

describe("central motivation-letter layout system", () => {
  test("every selectable letter style and every header/footer mode yields one usable content box", () => {
    expect(TEMPLATES.length).toBe(41);
    expect(LETTER_TEMPLATE_IDS.length).toBe(41);

    for (const template of LETTER_TEMPLATE_IDS) {
      for (const headerMode of headerModes) {
        for (const footerMode of footerModes) {
          const geometry = letterPageGeometry(
            DEMO_LETTER,
            designFor(template, headerMode, footerMode),
          );

          expect(geometry.content.left).toBeGreaterThanOrEqual(20);
          expect(geometry.content.right).toBeGreaterThanOrEqual(20);
          expect(geometry.content.top).toBeGreaterThanOrEqual(16);
          expect(geometry.content.bottom).toBeGreaterThanOrEqual(10);
          expect(geometry.content.width).toBeGreaterThan(140);
          const minimumContentHeight = minimumContentHeightFor(template, headerMode);
          expect(geometry.content.height).toBeGreaterThan(minimumContentHeight);
          expect(geometry.content.left + geometry.content.width + geometry.content.right).toBe(
            LETTER_PAGE_MM.width,
          );
          expect(geometry.content.top + geometry.content.height + geometry.content.bottom).toBe(
            LETTER_PAGE_MM.height,
          );
        }
      }
    }
  });

  test("established templates stay archetype-based without copying per-template CV dimensions", () => {
    const groups = new Map<LetterArchetype, Set<string>>();

    for (const template of LETTER_TEMPLATE_IDS) {
      if (FRESH_IDS.has(template) || template === "freundlich") continue;

      const archetype = letterArchetypeFor(template);
      const geometry = letterPageGeometry(DEMO_LETTER, designFor(template, "compact", "compact"));
      const signature = `${geometry.content.left}/${geometry.content.right}/${geometry.content.top}/${geometry.content.bottom}`;
      const signatures = groups.get(archetype) ?? new Set<string>();
      signatures.add(signature);
      groups.set(archetype, signatures);
    }

    for (const signatures of groups.values()) expect(signatures.size).toBe(1);
  });

  test("Warm compact first page reserves its real visual masthead", () => {
    const compact = letterPageGeometry(DEMO_LETTER, designFor("freundlich", "compact", "compact"));
    const contact = letterPageGeometry(DEMO_LETTER, designFor("freundlich", "contact", "compact"));
    const continuation = letterPageGeometry(
      DEMO_LETTER,
      designFor("freundlich", "compact", "compact"),
      { pageIndex: 1 },
    );

    expect(compact.content.top).toBe(WARM_FIRST_PAGE_HEADER_HEIGHT_MM);
    expect(contact.content.top).toBeLessThan(compact.content.top);
    expect(continuation.content.top).toBeLessThan(compact.content.top);
  });

  test("Fresh templates use their explicit letter insets instead of a legacy CV fallback", () => {
    const signatures = new Set<string>();

    for (const id of FRESH_TEMPLATE_IDS) {
      const template = id as LetterTemplateId;
      const spec = freshLetterSpec(id);
      const geometry = letterPageGeometry(DEMO_LETTER, designFor(template, "compact", "compact"));

      expect(spec).not.toBeNull();
      expect(geometry.freshTemplate).toBe(true);
      expect(geometry.content.left).toBe(spec?.left);
      expect(geometry.content.right).toBe(spec?.right);
      signatures.add(`${geometry.content.left}/${geometry.content.right}`);
    }

    expect(signatures.size).toBeGreaterThan(5);
  });

  test("band, sidebar, frame, quiet and fresh references are all represented", () => {
    const archetypes = new Set(LETTER_TEMPLATE_IDS.map((template) => letterArchetypeFor(template)));

    expect(archetypes).toEqual(
      new Set<LetterArchetype>(["quiet", "band", "sidebar", "frame", "fresh"]),
    );

    for (const id of FRESH_TEMPLATE_IDS) {
      const geometry = letterPageGeometry(
        DEMO_LETTER,
        designFor(id as LetterTemplateId, "compact", "compact"),
      );
      expect(geometry.freshTemplate).toBe(true);
    }
  });

  test("fresh structural references are deterministic and independent of import order", () => {
    expect(letterArchetypeFor("glow" as LetterTemplateId)).toBe("fresh");
    expect(letterArchetypeFor("edge" as LetterTemplateId)).toBe("band");
    expect(letterArchetypeFor("horizon" as LetterTemplateId)).toBe("band");
    expect(letterArchetypeFor("verlauf2" as LetterTemplateId)).toBe("fresh");
    expect(letterArchetypeFor("verlauf3" as LetterTemplateId)).toBe("fresh");
  });

  test("a zero-height CV band remains a quiet letter reference", () => {
    expect(letterArchetypeFor("modern")).toBe("quiet");
  });

  test("legacy/SSR geometry reuses the shared semantic chrome heights", () => {
    const compact = letterPageGeometry(DEMO_LETTER, designFor("modern", "compact", "compact"));
    const stackedContact = letterPageGeometry(
      DEMO_LETTER,
      designFor("modern", "contact", "compact"),
    );
    const inlineContact = letterPageGeometry(DEMO_LETTER, {
      ...designFor("modern", "contact", "compact"),
      headerTextLayout: "inline",
    });

    expect(compact.footer.height).toBe(4);
    expect(compact.content.top).toBe(22);
    expect(stackedContact.content.top).toBe(41);
    expect(inlineContact.content.top).toBe(35);
  });

  test("no-footer and attachment-footer reserve only their functional bottom space", () => {
    const compact = letterPageGeometry(DEMO_LETTER, designFor("modern", "compact", "compact"));
    const attachments = letterPageGeometry(
      { ...DEMO_LETTER, beilagen: ["Lebenslauf", "Zeugnis", "Schnupperbericht"] },
      designFor("modern", "compact", "attachments"),
    );
    const none = letterPageGeometry(DEMO_LETTER, designFor("modern", "compact", "none"));

    expect(none.footer.height).toBe(0);
    expect(none.content.bottom).toBe(10);
    expect(none.content.height).toBeGreaterThan(compact.content.height);
    expect(attachments.footer.height).toBeGreaterThan(compact.footer.height);
    expect(attachments.content.bottom).toBe(attachments.footer.height + 7);
  });

  test("multi-page context repeats the selected contact header by default", () => {
    const design = designFor("modern", "contact", "attachments");
    const firstOfTwo = letterPageGeometry(DEMO_LETTER, design, {
      pageIndex: 0,
      finalPage: false,
    });
    const finalContinuation = letterPageGeometry(DEMO_LETTER, design, {
      pageIndex: 1,
      finalPage: true,
    });

    expect(firstOfTwo.firstPage).toBe(true);
    expect(firstOfTwo.effectiveHeaderMode).toBe("contact");
    expect(firstOfTwo.effectiveFooterMode).toBe("compact");
    expect(firstOfTwo.footer.showAttachments).toBe(false);

    expect(finalContinuation.firstPage).toBe(false);
    expect(finalContinuation.effectiveHeaderMode).toBe("contact");
    expect(finalContinuation.effectiveFooterMode).toBe("attachments");
    expect(finalContinuation.footer.showAttachments).toBe(true);
    expect(finalContinuation.content.top).toBe(firstOfTwo.content.top);
  });
});
