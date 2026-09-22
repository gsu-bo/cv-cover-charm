import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildBlocks, resetCoverFooterGeometry } from "../../src/components/cover/layouts";
import { resolveLayout } from "../../src/components/cover/resolve";
import {
  DEFAULT_COVER_BEILAGEN,
  EMPTY_META,
  TEMPLATES,
  type CoverData,
} from "../../src/components/cover/types";

const DATA: CoverData = {
  kicker: "Bewerbung um eine Lehrstelle als",
  eyebrow: "",
  beruf: "Informatiker/in EFZ",
  lehrbeginn: "August 2027",
  vorname: "Lea",
  nachname: "Müller",
  adresse: "Dorfstrasse 12",
  plzOrt: "4535 Hubersdorf",
  telefon: "+41 79 123 45 67",
  email: "lea.mueller@example.ch",
  geburtsdatum: "14.03.2010",
  lehrbetrieb: "Beispiel AG",
  ansprechperson: "Herr Thomas Weber",
  betriebAdresse: "Industriestrasse 8, 4500 Solothurn",
  showBetriebOnCover: false,
  showBeilagenOnCover: true,
  beilagen: [...DEFAULT_COVER_BEILAGEN],
  ort: "Hubersdorf",
  datum: "05.09.2026",
  labelKontakt: "",
  labelEmpfaenger: "",
  foto: null,
  meta: EMPTY_META,
};

describe("global cover footer consistency", () => {
  test("Kontakt and Beilagen start at exactly the same resolved height in every template", () => {
    for (const template of TEMPLATES) {
      const blocks = buildBlocks(template.id, DATA, [], {}, template.slots);
      const layout = resolveLayout(blocks, 1);

      expect(layout.kontaktTitel, template.name).toBeDefined();
      expect(layout.beilagenTitel, template.name).toBeDefined();
      expect(layout.beilagen, template.name).toBeDefined();
      expect(layout.beilagenTitel.y, template.name).toBeCloseTo(layout.kontaktTitel.y, 5);
      expect(layout.beilagen.y, template.name).toBeGreaterThan(layout.beilagenTitel.y);
    }
  });

  test("empty contact keeps the default attachments inside the print-safe lower edge", () => {
    const emptyContact: CoverData = {
      ...DATA,
      adresse: "",
      plzOrt: "",
      telefon: "",
      email: "",
      geburtsdatum: "",
    };

    for (const template of TEMPLATES) {
      const blocks = buildBlocks(template.id, emptyContact, [], {}, template.slots);
      const contactTitle = blocks.find((block) => block.id === "kontaktTitel");
      const layout = resolveLayout(blocks, 1);

      expect(contactTitle?.lines, template.name).toHaveLength(0);
      expect(layout.beilagenTitel.y, template.name).toBeLessThan(layout.beilagen.y);
      expect(layout.beilagen.y + layout.beilagen.height, template.name).toBeLessThanOrEqual(
        276.001,
      );
    }
  });

  test("Kontakt and Beilagen share one uppercase, non-spaced label convention", () => {
    const css = readFileSync(
      new URL("../../src/components/cover/template-typography-fixes.css", import.meta.url),
      "utf8",
    );

    expect(css).toContain('[data-block-id="kontaktTitel"]');
    expect(css).toContain('[data-block-id="beilagenTitel"]');
    expect(css).toContain("text-transform: uppercase !important;");
    expect(css).toContain("letter-spacing: 0 !important;");
  });

  test("manual attachment positioning remains opt-out from automatic vertical synchronization", () => {
    const template = TEMPLATES[0];
    const blocks = buildBlocks(
      template.id,
      DATA,
      [],
      {
        beilagenTitel: { y: 210, above: null, follows: null, anchorBottom: false },
        beilagen: { y: 220, above: null, follows: null, anchorBottom: false },
      },
      template.slots,
    );
    const layout = resolveLayout(blocks, 1);

    expect(layout.beilagenTitel.y).toBe(210);
    expect(layout.beilagen.y).toBe(220);
  });

  test("footer realignment restores geometry links without deleting visual choices", () => {
    const overrides = resetCoverFooterGeometry({
      kontaktTitel: { x: 31, y: 190, w: 62, color: "#123456", weight: 800 },
      kontakt: { x: 31, y: 205, above: null, anchorBottom: false, font: "serif" },
      beilagenTitel: { x: 122, y: 214, follows: null, uppercase: false },
      beilagen: { x: 122, y: 228, w: 70, gap: 9, align: "left" },
      name: { x: 44, y: 88, color: "accent" },
    });

    expect(overrides.kontaktTitel).toEqual({ color: "#123456", weight: 800 });
    expect(overrides.kontakt).toEqual({ font: "serif" });
    expect(overrides.beilagenTitel).toEqual({ uppercase: false });
    expect(overrides.beilagen).toEqual({ align: "left" });
    expect(overrides.name).toEqual({ x: 44, y: 88, color: "accent" });
  });
});
