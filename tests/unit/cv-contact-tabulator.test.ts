import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/components/cv/CvCanvasBase.tsx", import.meta.url),
  "utf8",
);

describe("CV contact tabulator layout", () => {
  test("pairs address/place and phone/email without legacy middle dots", () => {
    expect(source).toContain('{ key: "address", left: p.adresse, right: p.plzOrt }');
    expect(source).toContain('{ key: "contact", left: p.telefon, right: p.email }');
    expect(source).not.toContain('join(" · ")');
  });

  test("reuses the personal-info grid and lets incomplete pairs span safely", () => {
    expect(source).toContain("{contactPairs.length > 0 && <div style={personalInfoGridStyle}>{contactRows()}</div>}");
    expect(source).toContain('gridColumn: "1 / -1"');
    expect(source).toContain("...personalInfoGridStyle");
  });
});
