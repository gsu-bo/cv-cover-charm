import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { LetterSheetBackground } from "../../src/components/letter/LetterSheetBackground";
import { LetterTemplatePicker } from "../../src/components/letter/LetterTemplatePicker";
import {
  DEFAULT_LETTER_MOTIF_OPACITY,
  emptyLetterDesign,
  normalizeLetterDesign,
  normalizeLetterMotifOpacity,
} from "../../src/components/letter/types";

const colors = {
  bg: "#ffffff",
  ink: "#111111",
  primary: "#14532d",
  secondary: "#f59e0b",
  accent: "#0f766e",
};

describe("CV / letter background motif parity", () => {
  test("keeps the established CV 0-100 motif control", () => {
    const source = readFileSync("src/routes/lebenslauf.tsx", "utf8");
    expect(source).toContain("Hintergrund-Motiv");
    expect(source).toContain("min={0}");
    expect(source).toContain("max={100}");
    expect(source).toContain("value={Math.round(design.bgOpacity * 100)}");
  });

  test("letter exposes the same semantic 0-100 control", () => {
    const markup = renderToStaticMarkup(
      <LetterTemplatePicker
        value="freundlich"
        onChange={() => undefined}
        motifOpacity={0.5}
        onMotifOpacityChange={() => undefined}
      />,
    );
    expect(markup).toContain("Hintergrund-Motiv 50 % sichtbar");
    expect(markup).toContain('aria-label="Hintergrund-Motiv"');
    expect(markup).toContain('min="0"');
    expect(markup).toContain('max="100"');
    expect(markup).toContain('value="50"');
  });

  test("normalizes motif visibility and migrates old letter saves to 25 percent", () => {
    expect(DEFAULT_LETTER_MOTIF_OPACITY).toBe(0.25);
    expect(normalizeLetterMotifOpacity(-1)).toBe(0);
    expect(normalizeLetterMotifOpacity(0.25)).toBe(0.25);
    expect(normalizeLetterMotifOpacity(0.5)).toBe(0.5);
    expect(normalizeLetterMotifOpacity(2)).toBe(1);
    expect(normalizeLetterMotifOpacity(Number.NaN)).toBe(0.25);
    expect(emptyLetterDesign().bgOpacity).toBe(0.25);
    expect(normalizeLetterDesign({ ...emptyLetterDesign(), bgOpacity: 0 }).bgOpacity).toBe(0);
    expect(normalizeLetterDesign({ ...emptyLetterDesign(), bgOpacity: 1 }).bgOpacity).toBe(1);
  });

  test("Warm keeps its band structural and its authored decorative baseline", () => {
    const markup = renderToStaticMarkup(
      <LetterSheetBackground
        template="freundlich"
        colors={colors}
        pageIndex={0}
        headerMode="compact"
      />,
    );
    expect(markup).toContain('data-letter-structural-surface="warm-band"');
    expect(markup).toContain('data-letter-decorative-motif-layer="warm-ring"');
    expect(markup).toContain('data-letter-decorative-motif-layer="warm-orb"');
    expect(markup).toContain("opacity:0.78");
    expect(markup).toContain("opacity:0.72");
    expect(markup).toContain("var(--dossier-motif-opacity, 1)");
  });

  test("Fresh keeps full-height rails structural while motifs remain user-controlled", () => {
    const markup = renderToStaticMarkup(
      <LetterSheetBackground template={"forestFlow" as never} colors={colors} pageIndex={0} />,
    );
    expect(markup).toContain('data-letter-structural-surface="rail"');
    expect(markup).toContain('data-letter-decorative-motif-layer="soft-orb"');
    expect(markup).toContain("opacity:0.22");
  });

  test("generic dossier backgrounds remain on the shared motif layer", () => {
    const markup = renderToStaticMarkup(
      <LetterSheetBackground template="modern" colors={colors} pageIndex={0} />,
    );
    expect(markup).toContain("data-dossier-sheet-motif");
  });

  test("letter canvas, pagination/export and dossier transfer share bgOpacity", () => {
    const canvas = readFileSync("src/components/letter/LetterCanvas.tsx", "utf8");
    const documentSource = readFileSync("src/components/letter/LetterDocument.tsx", "utf8");
    const transfer = readFileSync("src/components/letter/dossier-transfer.ts", "utf8");
    const route = readFileSync("src/routes/anschreiben.tsx", "utf8");

    expect(canvas).toContain('"--dossier-motif-opacity": String(motifOpacity)');
    expect(canvas).toContain("data-letter-motif-opacity={motifOpacity}");
    expect(documentSource).toContain("<LetterCanvas");
    expect(documentSource).toContain("data-letter-pagination-measurements");
    expect(route).toContain("data-letter-standalone-export");
    expect(route).toContain("motifOpacity={design.bgOpacity}");
    expect(transfer).toContain("normalizeLetterMotifOpacity(incoming.bgOpacity)");
    expect(transfer).toContain("bgOpacity: fromCv.bgOpacity");
  });
});
