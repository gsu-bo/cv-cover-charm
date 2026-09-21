import { describe, expect, test } from "bun:test";
import { buildBlocks } from "../../src/components/cover/layouts";
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

describe("optional cover attachments", () => {
  test("hidden company keeps attachments in the bottom-right cover slot for every template", () => {
    for (const template of TEMPLATES) {
      const blocks = buildBlocks(template.id, DATA, [], {}, template.slots);
      const contact = blocks.find((block) => block.id === "kontakt");
      const title = blocks.find((block) => block.id === "beilagenTitel");
      const body = blocks.find((block) => block.id === "beilagen");

      expect(title, template.name).toBeDefined();
      expect(body, template.name).toBeDefined();
      expect(title!.style.above, template.name).toBe("beilagen");
      expect(title!.style.align, template.name).toBe("right");
      const expectedX = template.id === "diagonal" ? 132 : 110;
      const expectedWidth = template.id === "diagonal" ? 58 : 80;
      expect(title!.style.x, template.name).toBe(expectedX);
      expect(title!.style.w, template.name).toBe(expectedWidth);

      expect(body!.style.align, template.name).toBe("right");
      expect(body!.style.x, template.name).toBe(expectedX);
      expect(body!.style.w, template.name).toBe(expectedWidth);
      expect(body!.style.anchorBottom, template.name).toBe(true);
      expect(body!.style.follows, template.name).toBeNull();
      expect(body!.style.above, template.name).toBeNull();
      expect(body!.style.y, template.name).toBe(
        Math.min(contact?.style.anchorBottom === true ? contact.style.y : 276, 276),
      );
      expect(body!.style.y, template.name).toBeLessThanOrEqual(276);
    }
  });

  test("the existing checkbox still removes cover attachments completely", () => {
    for (const template of TEMPLATES) {
      const blocks = buildBlocks(
        template.id,
        { ...DATA, showBeilagenOnCover: false },
        [],
        {},
        template.slots,
      );

      expect(
        blocks.some((block) => block.id === "beilagenTitel"),
        template.name,
      ).toBe(false);
      expect(
        blocks.some((block) => block.id === "beilagen"),
        template.name,
      ).toBe(false);
    }
  });
});
