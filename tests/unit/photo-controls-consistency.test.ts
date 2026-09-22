import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const shared = readFileSync("src/components/photo/PhotoStyleControls.tsx", "utf8");
const cvForm = readFileSync("src/components/cv/CvForm.tsx", "utf8");
const coverAdapter = readFileSync("src/components/cover/PhotoControls.tsx", "utf8");

describe("shared cover and CV photo controls", () => {
  test("keeps crop and directional controls in the shared component", () => {
    expect(shared).toContain("Foto zuschneiden");
    expect(shared).toContain("Ausschnitt links / rechts");
    expect(shared).toContain("Ausschnitt oben / unten");
    expect(shared).toContain('aria-label="Ausschnitt nach links"');
    expect(shared).toContain('aria-label="Ausschnitt nach rechts"');
    expect(shared).toContain('aria-label="Ausschnitt nach oben"');
    expect(shared).toContain('aria-label="Ausschnitt nach unten"');
  });

  test("uses the same control surface in title page and CV", () => {
    expect(coverAdapter).toContain("<PhotoStyleControls");
    expect(cvForm).toContain("<PhotoStyleControls");
    expect(cvForm).toContain("Der Ausschnitt wird direkt in der Vorschau");
  });
});
