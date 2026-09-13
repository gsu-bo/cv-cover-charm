import type {
  DossierDocxColorRole,
  DossierDocxRecipeShape,
  DossierDocxTemplateRecipe,
} from "@/lib/dossier-docx-template-recipe";

type RuntimeShape = DossierDocxRecipeShape & { fillHex?: string };
type RuntimeRecipe = DossierDocxTemplateRecipe & {
  cover: DossierDocxTemplateRecipe["cover"] & { contentSurface?: "light" };
  letter: DossierDocxTemplateRecipe["letter"] & { contentSurface?: "light" };
  cv: DossierDocxTemplateRecipe["cv"] & { contentSurface?: "light" };
};

const rect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: DossierDocxColorRole,
  opacity = 1,
): RuntimeShape => ({ kind: "rect", id, x, y, w, h, color, opacity });

const oval = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: DossierDocxColorRole,
  opacity = 1,
): RuntimeShape => ({ kind: "oval", id, x, y, w, h, color, opacity });

const roundrect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fillHex = "#ffffff",
): RuntimeShape => ({
  kind: "roundrect",
  id,
  x,
  y,
  w,
  h,
  color: "paper",
  fillHex,
});

const line = (
  id: string,
  x: number,
  y: number,
  w: number,
  color: DossierDocxColorRole,
  strokeMm = 0.4,
  opacity = 1,
): RuntimeShape => ({ kind: "line", id, x, y, w, h: 0, color, strokeMm, opacity });

const frame = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: DossierDocxColorRole,
  strokeMm = 0.4,
  opacity = 1,
): RuntimeShape => ({ kind: "frame", id, x, y, w, h, color, strokeMm, opacity });

export const LEGACY_EXTRA_DOCX_RECIPES: Readonly<Record<string, RuntimeRecipe>> = {
  klassisch: {
    templateId: "klassisch",
    label: "Editorial",
    cover: {
      shapes: [frame("klassisch-cover-frame", 10, 10, 190, 277, "ink", 0.35, 0.22)],
      photoFrame: { kind: "rect", x: 82, y: 68, w: 46, h: 46, stroke: "ink" },
    },
    letter: {
      shapes: [frame("klassisch-letter-frame", 10, 10, 190, 277, "ink", 0.3, 0.18)],
      margins: { top: 24, right: 25, bottom: 22, left: 25 },
    },
    cv: {
      shapes: [frame("klassisch-cv-frame", 10, 10, 190, 277, "ink", 0.3, 0.18)],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  edel: {
    templateId: "edel",
    label: "Edel",
    cover: {
      shapes: [
        frame("edel-cover-frame-a", 12, 12, 186, 273, "accent", 0.6, 0.5),
        frame("edel-cover-frame-b", 15, 15, 180, 267, "accent", 0.4, 0.28),
        line("edel-cover-center", 85, 196, 40, "accent", 0.32, 0.72),
      ],
      photoFrame: { kind: "rect", x: 82, y: 68, w: 46, h: 46, stroke: "accent" },
    },
    letter: {
      shapes: [
        frame("edel-letter-frame-a", 12, 12, 186, 273, "accent", 0.48, 0.45),
        frame("edel-letter-frame-b", 15, 15, 180, 267, "accent", 0.28, 0.25),
      ],
      margins: { top: 25, right: 27, bottom: 24, left: 27 },
    },
    cv: {
      shapes: [
        frame("edel-cv-frame-a", 12, 12, 186, 273, "accent", 0.48, 0.45),
        frame("edel-cv-frame-b", 15, 15, 180, 267, "accent", 0.28, 0.25),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  colorful: {
    templateId: "colorful",
    label: "Colorful",
    cover: {
      shapes: [
        rect("colorful-cover-top", 0, 0, 210, 28, "primary"),
        rect("colorful-cover-left", 0, 28, 70, 80, "secondary"),
        rect("colorful-cover-mid", 70, 28, 45, 80, "accent"),
        rect("colorful-cover-bottom", 0, 289, 210, 8, "secondary"),
      ],
      photoFrame: { kind: "oval", x: 133, y: 42, w: 46, h: 46, stroke: "accent" },
      heroAlign: "left",
      heroLeftMm: 22,
    },
    letter: {
      shapes: [
        rect("colorful-letter-top", 0, 0, 146, 13, "primary"),
        rect("colorful-letter-top-accent", 146, 0, 64, 13, "secondary"),
        rect("colorful-letter-bottom", 0, 293, 210, 4, "secondary"),
      ],
      margins: { top: 30, right: 22, bottom: 22, left: 24 },
    },
    cv: {
      shapes: [
        rect("colorful-cv-top", 0, 0, 146, 40, "primary"),
        rect("colorful-cv-top-accent", 146, 0, 64, 40, "secondary"),
        rect("colorful-cv-bottom", 0, 289, 210, 8, "secondary"),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  blockig: {
    templateId: "blockig",
    label: "Blockig",
    cover: {
      shapes: [
        rect("blockig-cover-main", 0, 0, 72, 105, "primary"),
        rect("blockig-cover-accent", 72, 0, 44, 52, "accent"),
        rect("blockig-cover-corner", 174, 0, 36, 18, "primary"),
        rect("blockig-cover-contact", 0, 244, 72, 53, "primary"),
      ],
      photoFrame: { kind: "rect", x: 132, y: 56, w: 46, h: 46, stroke: "accent" },
      heroAlign: "left",
      heroLeftMm: 82,
      lightCoverContact: true,
    },
    letter: {
      shapes: [
        rect("blockig-letter-rail", 0, 0, 19, 297, "primary"),
        rect("blockig-letter-accent", 0, 46, 19, 72, "accent", 0.9),
      ],
      margins: { top: 24, right: 22, bottom: 22, left: 35 },
    },
    cv: {
      shapes: [
        rect("blockig-cv-rail", 0, 0, 19, 297, "primary"),
        rect("blockig-cv-accent", 0, 46, 19, 72, "accent", 0.9),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 27 },
    },
  },

  sonne: {
    templateId: "sonne",
    label: "Sonne",
    cover: {
      shapes: [
        rect("sonne-cover-top", 0, 0, 210, 118, "primary"),
        oval("sonne-cover-light", 104, 6, 98, 98, "paper"),
      ],
      photoFrame: { kind: "oval", x: 129, y: 28, w: 48, h: 48, stroke: "secondary" },
    },
    letter: {
      shapes: [
        rect("sonne-letter-top", 0, 0, 210, 15, "primary"),
        rect("sonne-letter-bottom", 0, 293, 210, 4, "secondary"),
      ],
      margins: { top: 32, right: 23, bottom: 24, left: 25 },
    },
    cv: {
      shapes: [
        rect("sonne-cv-top", 0, 0, 210, 54, "primary"),
        oval("sonne-cv-light", 154, -10, 68, 68, "paper", 0.8),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  studio: {
    templateId: "studio",
    label: "Studio",
    cover: {
      shapes: [
        rect("studio-cover-column", 0, 0, 72, 297, "primary"),
        rect("studio-cover-name", 72, 24, 138, 38, "accent"),
        oval("studio-cover-soft", 112, 128, 92, 92, "accent", 0.22),
        rect("studio-cover-bottom", 72, 291, 138, 6, "accent"),
      ],
      photoFrame: { kind: "oval", x: 17, y: 20, w: 38, h: 38, stroke: "accent" },
      heroAlign: "left",
      heroLeftMm: 80,
      lightCoverContact: true,
    },
    letter: {
      shapes: [
        rect("studio-letter-rail", 0, 0, 20, 297, "primary"),
        rect("studio-letter-accent", 0, 20, 20, 14, "accent"),
        rect("studio-letter-rule", 6, 43, 8, 2, "secondary"),
      ],
      margins: { top: 25, right: 22, bottom: 23, left: 36 },
    },
    cv: {
      shapes: [
        rect("studio-cv-column", 0, 0, 72, 297, "primary"),
        rect("studio-cv-accent", 0, 38, 72, 13, "accent"),
        rect("studio-cv-bottom", 72, 291, 138, 6, "accent"),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 80 },
    },
  },

  neon: {
    templateId: "neon",
    label: "Neon",
    cover: {
      shapes: [
        rect("neon-cover-bg", 0, 0, 210, 297, "primary"),
        oval("neon-cover-blob-a", -45, -40, 150, 130, "secondary", 0.75),
        oval("neon-cover-blob-b", 126, 138, 112, 108, "accent", 0.62),
        oval("neon-cover-blob-c", 20, 196, 36, 36, "secondary", 0.45),
      ],
      photoFrame: { kind: "oval", x: 133, y: 48, w: 46, h: 46, stroke: "accent" },
    },
    letter: {
      shapes: [
        rect("neon-letter-bg", 0, 0, 210, 297, "primary"),
        oval("neon-letter-glow", 154, -16, 74, 74, "secondary", 0.35),
        roundrect("neon-letter-card", 12, 12, 186, 273),
      ],
      margins: { top: 27, right: 28, bottom: 26, left: 28 },
      contentSurface: "light",
    },
    cv: {
      shapes: [
        rect("neon-cv-bg", 0, 0, 210, 297, "primary"),
        oval("neon-cv-glow", 154, -18, 74, 74, "secondary", 0.3),
        roundrect("neon-cv-card", 12, 12, 186, 273),
        line("neon-cv-accent", 25, 23, 36, "accent", 1.2),
      ],
      margins: { top: 27, right: 28, bottom: 26, left: 28 },
      contentSurface: "light",
    },
  },

  aurora: {
    templateId: "aurora",
    label: "Aurora",
    cover: {
      shapes: [
        rect("aurora-cover-hero", 0, 0, 210, 128, "primary"),
        oval("aurora-cover-light", 128, -38, 120, 120, "secondary", 0.5),
        line("aurora-cover-accent", 20, 150, 26, "accent", 1.6),
        rect("aurora-cover-bottom", 0, 292, 210, 5, "secondary"),
      ],
      photoFrame: { kind: "oval", x: 132, y: 52, w: 46, h: 46, stroke: "accent" },
    },
    letter: {
      shapes: [
        rect("aurora-letter-top", 0, 0, 146, 16, "primary"),
        rect("aurora-letter-top-b", 146, 0, 64, 16, "secondary"),
        rect("aurora-letter-bottom", 0, 294, 210, 3, "accent"),
      ],
      margins: { top: 33, right: 23, bottom: 24, left: 25 },
    },
    cv: {
      shapes: [
        rect("aurora-cv-top", 0, 0, 146, 56, "primary"),
        rect("aurora-cv-top-b", 146, 0, 64, 56, "secondary"),
        rect("aurora-cv-bottom", 0, 292, 210, 5, "accent"),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  verlauf: {
    templateId: "verlauf",
    label: "Verlauf",
    cover: {
      shapes: [
        rect("verlauf-cover-a", 0, 0, 122, 297, "primary"),
        rect("verlauf-cover-b", 122, 0, 88, 297, "secondary"),
        oval("verlauf-cover-soft-a", -30, 168, 150, 150, "paper", 0.1),
        oval("verlauf-cover-soft-b", 128, -24, 110, 110, "paper", 0.12),
      ],
      contentSurface: "light",
    },
    letter: {
      shapes: [
        rect("verlauf-letter-a", 0, 0, 122, 297, "primary"),
        rect("verlauf-letter-b", 122, 0, 88, 297, "secondary"),
        roundrect("verlauf-letter-card", 12, 12, 186, 273),
      ],
      margins: { top: 27, right: 28, bottom: 26, left: 28 },
      contentSurface: "light",
    },
    cv: {
      shapes: [
        rect("verlauf-cv-a", 0, 0, 122, 297, "primary"),
        rect("verlauf-cv-b", 122, 0, 88, 297, "secondary"),
        roundrect("verlauf-cv-card", 12, 12, 186, 273),
      ],
      margins: { top: 27, right: 28, bottom: 26, left: 28 },
      contentSurface: "light",
    },
  },

  citrus: {
    templateId: "citrus",
    label: "Citrus",
    cover: {
      shapes: [
        rect("citrus-cover-a", 0, 0, 116, 297, "primary"),
        rect("citrus-cover-b", 116, 0, 94, 297, "secondary"),
        roundrect("citrus-cover-card", 14, 50, 182, 233),
      ],
      contentSurface: "light",
    },
    letter: {
      shapes: [
        rect("citrus-letter-a", 0, 0, 116, 297, "primary"),
        rect("citrus-letter-b", 116, 0, 94, 297, "secondary"),
        roundrect("citrus-letter-card", 12, 12, 186, 273),
      ],
      margins: { top: 27, right: 28, bottom: 26, left: 28 },
      contentSurface: "light",
    },
    cv: {
      shapes: [
        rect("citrus-cv-a", 0, 0, 116, 297, "primary"),
        rect("citrus-cv-b", 116, 0, 94, 297, "secondary"),
        roundrect("citrus-cv-card", 12, 12, 186, 273),
      ],
      margins: { top: 27, right: 28, bottom: 26, left: 28 },
      contentSurface: "light",
    },
  },

  edelDark: {
    templateId: "edelDark",
    label: "Edel Dark",
    cover: {
      shapes: [
        frame("edel-dark-cover-a", 12, 12, 186, 273, "accent", 0.6, 0.68),
        frame("edel-dark-cover-b", 15, 15, 180, 267, "secondary", 0.35, 0.42),
        line("edel-dark-center", 85, 196, 40, "accent", 0.35, 0.75),
      ],
    },
    letter: {
      shapes: [
        frame("edel-dark-letter-a", 12, 12, 186, 273, "accent", 0.5, 0.6),
        frame("edel-dark-letter-b", 15, 15, 180, 267, "secondary", 0.3, 0.38),
      ],
      margins: { top: 25, right: 27, bottom: 24, left: 27 },
    },
    cv: {
      shapes: [
        frame("edel-dark-cv-a", 12, 12, 186, 273, "accent", 0.5, 0.6),
        frame("edel-dark-cv-b", 15, 15, 180, 267, "secondary", 0.3, 0.38),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },
};
