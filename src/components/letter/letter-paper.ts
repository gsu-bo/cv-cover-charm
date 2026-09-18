import { cvPalette, type CvPalette } from "@/components/cv/palette";
import type { LetterDesign } from "./types";

export const DEFAULT_LETTER_PAPER_COLOR = "#ffffff";

export function normalizeLetterPaperColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

/** Tatsächlich sichtbare Papierfarbe des Anschreibens. */
export function resolveLetterPaperColor(design: LetterDesign): string {
  const override = normalizeLetterPaperColor(design.paperColor);
  if (override) return override;
  if (design.template === "brief") return DEFAULT_LETTER_PAPER_COLOR;
  return cvPalette(design.colors).paper;
}

/**
 * Eine bewusst gewählte Papierfarbe darf nie zu unsichtbarem Brieftext führen.
 * Ohne Override bleibt die bisherige, vorlagenspezifische Textlogik unverändert.
 */
export function resolveLetterPalette(design: LetterDesign): CvPalette {
  const override = normalizeLetterPaperColor(design.paperColor);
  if (override) {
    const letterColors = Object.fromEntries(
      Object.entries(design.colors).filter(
        ([key]) => key !== "cvInk" && key !== "cvMuted" && key !== "cvHeading",
      ),
    );
    return cvPalette({ ...letterColors, sheet: override });
  }

  const source = cvPalette(design.colors);
  if (design.template === "brief") {
    return {
      ink: "#111111",
      muted: "#4b5563",
      accent: "#111111",
      paper: DEFAULT_LETTER_PAPER_COLOR,
    };
  }
  if (design.colors.sheet) return source;
  return {
    ink: "#111111",
    muted: "#4b5563",
    accent: source.accent,
    paper: DEFAULT_LETTER_PAPER_COLOR,
  };
}
