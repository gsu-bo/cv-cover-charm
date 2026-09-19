import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  normalizeDossierChromeState,
  setDossierChromeSyncState,
} from "../../src/lib/dossier-chrome";

const controls = readFileSync(
  new URL("../../src/components/dossier/DossierChromeControls.tsx", import.meta.url),
  "utf8",
);
const letterLayoutControls = readFileSync(
  new URL("../../src/components/letter/LetterLayoutControls.tsx", import.meta.url),
  "utf8",
);
const chrome = readFileSync(
  new URL("../../src/components/dossier/DossierHeaderFooterChrome.tsx", import.meta.url),
  "utf8",
);
const letter = readFileSync(
  new URL("../../src/components/letter/LetterCanvas.tsx", import.meta.url),
  "utf8",
);
const cvRoute = readFileSync(new URL("../../src/routes/lebenslauf.tsx", import.meta.url), "utf8");
const letterRoute = readFileSync(
  new URL("../../src/routes/anschreiben.tsx", import.meta.url),
  "utf8",
);

describe("dossier vertical positioning", () => {
  test("signed offsets default to zero and clamp to safe ranges", () => {
    const defaults = normalizeDossierChromeState(null);
    expect(defaults.shared.headerContentOffsetYMm).toBe(0);
    expect(defaults.shared.footerContentOffsetYMm).toBe(0);
    expect(defaults.shared.letterRecipientOffsetYMm).toBe(0);

    const state = normalizeDossierChromeState({
      sync: true,
      shared: {
        headerContentOffsetYMm: 99,
        footerContentOffsetYMm: -99,
        letterRecipientOffsetYMm: 4.4,
      },
    });
    expect(state.shared.headerContentOffsetYMm).toBe(12);
    expect(state.shared.footerContentOffsetYMm).toBe(-8);
    expect(state.shared.letterRecipientOffsetYMm).toBe(4.4);
  });

  test("letter recipient offset survives re-enabling sync from the CV", () => {
    const split = normalizeDossierChromeState({
      sync: false,
      shared: {},
      cv: { letterRecipientOffsetYMm: 0 },
      letter: { letterRecipientOffsetYMm: 7 },
    });
    const synced = setDossierChromeSyncState(split, "cv", true);
    expect(synced.shared.letterRecipientOffsetYMm).toBe(7);
  });

  test("shared chrome exposes only shared content positioning", () => {
    expect(controls).toContain("Header-Inhalt – vertikale Position");
    expect(controls).toContain("Footer-Inhalt – vertikale Position");
    expect(controls).not.toContain("Eigene Anschrift – vertikale Position");
    expect(controls).not.toContain("Firma / Lehrbetrieb – vertikale Position");
    expect(controls).toContain("Standardposition");
  });

  test("letter-only recipient positioning lives in the letter-specific layout block", () => {
    expect(letterLayoutControls).toContain("Briefspezifische Positionen");
    expect(letterLayoutControls).toContain("Firma / Lehrbetrieb – vertikale Position");
    expect(letterLayoutControls).toContain("data-letter-recipient-offset-control");
  });

  test("both editors expose their vertical-position controls in the visible UI", () => {
    expect(letterRoute).toContain("<LetterLayoutControls");
    expect(cvRoute).toContain(
      'import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";',
    );
    expect(cvRoute).toContain('title="Header & Footer"');
    expect(cvRoute).toContain('<DossierChromeControls scope="cv" />');
  });

  test("renderers move content rather than header/footer surfaces", () => {
    expect(chrome).toContain("headerContentTransform");
    expect(chrome).toContain("footerContentTransform");
    expect(letter).toContain("senderTransform");
    expect(letter).toContain("recipientTransform");
    expect(letter).toContain("transform: senderTransform");
    expect(letter).toContain("transform: recipientTransform");
  });
});
