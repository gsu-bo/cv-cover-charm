import { describe, expect, test } from "bun:test";
import { DEMO_DATA } from "../../src/components/cover/types";
import { DEMO_CV } from "../../src/components/cv/types";
import { DEMO_LETTER } from "../../src/components/letter/types";

const FORMER_DEMO_PLACES = ["Solothurn", "Zuchwil"] as const;

describe("editor demo place consistency", () => {
  test("title page, letter and CV use the same Hubersdorf example world", () => {
    expect(DEMO_DATA.plzOrt).toBe("4535 Hubersdorf");
    expect(DEMO_DATA.ort).toBe("Hubersdorf");
    expect(DEMO_DATA.datum).toBe("15.11.2026");
    expect(DEMO_DATA.betriebAdresse).toBe("Industriestrasse 8, 4535 Hubersdorf");

    expect(DEMO_LETTER.absenderPlzOrt).toBe("4535 Hubersdorf");
    expect(DEMO_LETTER.empfaengerPlzOrt).toBe("4535 Hubersdorf");
    expect(DEMO_LETTER.ort).toBe("Hubersdorf");
    expect(DEMO_LETTER.datum).toBe("15.11.2026");

    expect(DEMO_CV.person.plzOrt).toBe("4535 Hubersdorf");
    expect(DEMO_CV.schule.map((entry) => entry.ort)).toEqual([
      "Schulhaus Zentrum, Hubersdorf",
      "Primarschule Hubersdorf",
    ]);
    expect(DEMO_CV.erfahrung.map((entry) => entry.ort)).toEqual([
      "Beispiel AG, Hubersdorf",
      "Muster GmbH, Hubersdorf",
    ]);
    expect(DEMO_CV.referenzen[0]?.funktion).toBe("Klassenlehrer, Schulhaus Zentrum");
  });

  test("former mixed demo locations cannot return", () => {
    const serialized = JSON.stringify({ cover: DEMO_DATA, letter: DEMO_LETTER, cv: DEMO_CV });
    expect(serialized).toContain("Hubersdorf");
    for (const place of FORMER_DEMO_PLACES) expect(serialized).not.toContain(place);
  });
});
