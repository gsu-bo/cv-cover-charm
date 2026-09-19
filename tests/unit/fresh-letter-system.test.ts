import { describe, expect, test } from "bun:test";
import { FRESH_TEMPLATE_IDS } from "../../src/components/cover/fresh-template-registry";
import {
  FRESH_LETTER_SPECS,
  LETTER_SHEET_MM,
  freshLetterSpec,
  motifIntersectsReadingBox,
} from "../../src/components/letter/fresh-letter-system";

describe("Fresh motivation-letter visual system", () => {
  test("all 21 active Fresh templates have one dedicated letter specification", () => {
    expect(FRESH_TEMPLATE_IDS).toHaveLength(21);
    expect(Object.keys(FRESH_LETTER_SPECS)).toHaveLength(21);

    for (const id of FRESH_TEMPLATE_IDS) {
      const spec = freshLetterSpec(id);
      expect(spec).not.toBeNull();
      expect(spec?.motifs.length).toBeGreaterThan(0);
      expect(spec?.left).toBeGreaterThanOrEqual(24);
      expect(spec?.right).toBeGreaterThanOrEqual(23);
    }
  });

  test("every Fresh motif stays on-page and outside the maximal reading box", () => {
    for (const id of FRESH_TEMPLATE_IDS) {
      const spec = FRESH_LETTER_SPECS[id];

      for (const motif of spec.motifs) {
        expect(motif.x, `${id}/${motif.id} x`).toBeGreaterThanOrEqual(0);
        expect(motif.y, `${id}/${motif.id} y`).toBeGreaterThanOrEqual(0);
        expect(motif.x + motif.w, `${id}/${motif.id} right`).toBeLessThanOrEqual(
          LETTER_SHEET_MM.width,
        );
        expect(motif.y + motif.h, `${id}/${motif.id} bottom`).toBeLessThanOrEqual(
          LETTER_SHEET_MM.height,
        );
        expect(motifIntersectsReadingBox(motif, spec), `${id}/${motif.id}`).toBe(false);
      }
    }
  });

  test("Fresh identity is varied without using cover-sized decoration", () => {
    const archetypes = new Set(FRESH_TEMPLATE_IDS.map((id) => FRESH_LETTER_SPECS[id].archetype));
    expect(archetypes).toEqual(new Set(["fresh", "sidebar", "band"]));

    for (const id of FRESH_TEMPLATE_IDS) {
      for (const motif of FRESH_LETTER_SPECS[id].motifs) {
        const fullHeightRail = motif.h === LETTER_SHEET_MM.height;
        const restrainedHeaderBand = motif.w >= 180 && motif.h <= 12;

        if (fullHeightRail || restrainedHeaderBand) continue;
        expect(motif.w * motif.h, `${id}/${motif.id}`).toBeLessThan(1800);
      }
    }
  });
});
