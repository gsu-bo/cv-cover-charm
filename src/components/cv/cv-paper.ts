import { cvPalette, type CvPalette } from "./palette";
import type { CvDesign } from "./types";

export function normalizeCvPaperColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

/** Tatsächlich sichtbare Schreibfläche des Lebenslaufs. */
export function resolveCvPaperColor(design: CvDesign): string {
  return normalizeCvPaperColor(design.paperColor) ?? cvPalette(design.colors).paper;
}

/**
 * Eine bewusst gewählte Papierfarbe erhält immer eine automatisch lesbare
 * Grundpalette. Explizite Rubrik- und Dokumenttitel-Farben bleiben davon
 * unberührt, weil sie eigene, bewusste Formatierungen sind.
 */
export function resolveCvPalette(design: CvDesign): CvPalette {
  const override = normalizeCvPaperColor(design.paperColor);
  if (!override) return cvPalette(design.colors);

  return cvPalette({ ...design.colors, sheet: override });
}
