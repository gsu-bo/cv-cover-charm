import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url),
  "utf8",
);

// The exact second-column x position is verified in the browser geometry regression.
describe("CV contact tabulator layout", () => {
  test("pairs address/place and phone/email without legacy middle dots", () => {
    expect(source).toContain('{ key: "address", left: p.adresse, right: p.plzOrt }');
    expect(source).toContain('{ key: "contact", left: p.telefon, right: p.email }');
    expect(source).not.toContain('join(" · ")');
  });

  test("uses one shared grid axis for contact and personal values", () => {
    expect(source).toContain("data-cv-contact-grid");
    expect(source).toContain("data-cv-contact-value={key}");
    expect(source).toContain("data-cv-personal-value={row.key}");
    expect(source).toContain("data-cv-contact-grid-gap");
    expect(source).not.toContain(
      "{contactPairs.length > 0 && <div style={personalInfoGridStyle}>{contactRows()}</div>}",
    );
  });

  test("lets incomplete contact pairs span the full shared grid", () => {
    expect(source).toContain('gridColumn: "1 / -1"');
    expect(source).toContain("left || right");
  });
});
