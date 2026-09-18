import { cvPalette, type CvPalette } from "@/components/cv/palette";
import type { LetterDesign } from "./types";

export const DEFAULT_LETTER_PAPER_COLOR = "#ffffff";

export function normalizeLetterPaperColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

export function normalizeLetterTextColor(value: unknown): string | null {
  return normalizeLetterPaperColor(value);
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
  const textOverride = normalizeLetterTextColor(design.textColor);
  let palette: CvPalette;
  if (override) {
    const letterColors = Object.fromEntries(
      Object.entries(design.colors).filter(
        ([key]) => key !== "cvInk" && key !== "cvMuted" && key !== "cvHeading",
      ),
    );
    palette = cvPalette({ ...letterColors, sheet: override });
  } else {
    const source = cvPalette(design.colors);
    if (design.template === "brief") {
      palette = {
        ink: "#111111",
        muted: "#4b5563",
        accent: "#111111",
        paper: DEFAULT_LETTER_PAPER_COLOR,
      };
    } else if (design.colors.sheet) {
      palette = source;
    } else {
      palette = {
        ink: "#111111",
        muted: "#4b5563",
        accent: source.accent,
        paper: DEFAULT_LETTER_PAPER_COLOR,
      };
    }
  }

  return textOverride ? { ...palette, ink: textOverride } : palette;
}
