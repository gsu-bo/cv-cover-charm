import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/routes/lebenslauf.tsx", "utf8");

describe("CV editor top-area copy", () => {
  test("keeps title and autosave status while removing redundant copy", () => {
    expect(source).toContain(">Lebenslauf</h1>");
    expect(source).toContain("<SaveStatus state={saveState} />");
    expect(source).not.toContain("Teil deines Bewerbungsdossiers");
    expect(source).not.toContain("Alles ausfüllen, dann als PDF.");
  });
});
