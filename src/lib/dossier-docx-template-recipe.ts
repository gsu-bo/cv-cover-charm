export type DossierDocxColorRole = "primary" | "secondary" | "accent" | "paper" | "ink";

export type DossierDocxRecipeShape = {
  kind: "rect" | "oval" | "frame" | "line" | "roundrect";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: DossierDocxColorRole;
  opacity?: number;
  strokeMm?: number;
};

export type DossierDocxRecipePage = {
  shapes: readonly DossierDocxRecipeShape[];
  margins?: { top: number; right: number; bottom: number; left: number };
};

export type DossierDocxTemplateRecipe = {
  templateId: string;
  label: string;
  cover: DossierDocxRecipePage & {
    photoFrame?: {
      kind: "oval" | "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      stroke: DossierDocxColorRole;
    };
    heroAlign?: "left" | "center" | "right";
    heroLeftMm?: number;
    heroRightMm?: number;
    lightCoverContact?: boolean;
  };
  letter: DossierDocxRecipePage;
  cv: DossierDocxRecipePage;
};

const rect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: DossierDocxColorRole,
  opacity = 1,
): DossierDocxRecipeShape => ({ kind: "rect", id, x, y, w, h, color, opacity });

const oval = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: DossierDocxColorRole,
  opacity = 1,
): DossierDocxRecipeShape => ({ kind: "oval", id, x, y, w, h, color, opacity });

const line = (
  id: string,
  x: number,
  y: number,
  w: number,
  color: DossierDocxColorRole,
  strokeMm = 0.4,
  opacity = 1,
): DossierDocxRecipeShape => ({
  kind: "line",
  id,
  x,
  y,
  w,
  h: 0,
  color,
  strokeMm,
  opacity,
});

const frame = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: DossierDocxColorRole,
  strokeMm = 0.4,
  opacity = 1,
): DossierDocxRecipeShape => ({
  kind: "frame",
  id,
  x,
  y,
  w,
  h,
  color,
  strokeMm,
  opacity,
});

/**
 * Individual Word recipes are deliberately small data objects. They preserve
 * the real template signature while all OpenXML/ZIP/text/image machinery stays
 * shared. A template only gets a recipe after visual QA shows that the broad
 * family fallback is not close enough.
 */
export const DOSSIER_DOCX_TEMPLATE_RECIPES: Readonly<
  Record<string, DossierDocxTemplateRecipe>
> = {
  serioes: {
    templateId: "serioes",
    label: "Seriös",
    cover: {
      shapes: [
        rect("serioes-cover-top", 0, 0, 210, 6, "primary"),
        line("serioes-cover-rule", 20, 36, 170, "accent", 0.35),
        rect("serioes-cover-bottom", 0, 294, 210, 3, "primary"),
      ],
      photoFrame: { kind: "rect", x: 82, y: 70, w: 46, h: 46, stroke: "primary" },
    },
    letter: {
      shapes: [
        rect("serioes-letter-top", 0, 0, 210, 6, "primary"),
        rect("serioes-letter-bottom", 0, 294, 210, 3, "primary"),
      ],
      margins: { top: 25, right: 22, bottom: 22, left: 24 },
    },
    cv: {
      shapes: [
        rect("serioes-cv-top", 0, 0, 210, 6, "primary"),
        rect("serioes-cv-bottom", 0, 294, 210, 3, "primary"),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  pastell: {
    templateId: "pastell",
    label: "Rahmen",
    cover: {
      shapes: [
        frame("pastell-cover-frame", 12, 12, 186, 273, "secondary", 0.4, 0.5),
        rect("pastell-cover-top", 12, 12, 186, 3, "secondary", 0.72),
      ],
      photoFrame: { kind: "rect", x: 82, y: 70, w: 46, h: 46, stroke: "secondary" },
    },
    letter: {
      shapes: [frame("pastell-letter-frame", 11, 11, 188, 275, "secondary", 0.32, 0.42)],
      margins: { top: 25, right: 26, bottom: 23, left: 26 },
    },
    cv: {
      shapes: [
        frame("pastell-cv-frame", 12, 12, 186, 273, "secondary", 0.35, 0.45),
        rect("pastell-cv-top", 12, 12, 186, 2.4, "secondary", 0.65),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  terracotta: {
    templateId: "terracotta",
    label: "Kolumne",
    cover: {
      shapes: [
        rect("terracotta-cover-column", 0, 0, 70, 297, "primary"),
        rect("terracotta-cover-edge", 66, 0, 1.2, 297, "secondary", 0.9),
        line("terracotta-cover-accent", 82, 190, 30, "primary", 0.4, 0.5),
      ],
      photoFrame: { kind: "oval", x: 18, y: 18, w: 34, h: 34, stroke: "secondary" },
      heroAlign: "left",
      heroLeftMm: 78,
      lightCoverContact: true,
    },
    letter: {
      shapes: [
        rect("terracotta-letter-rail", 0, 0, 17, 297, "primary"),
        rect("terracotta-letter-rule", 6, 20, 0.5, 38, "secondary", 0.82),
      ],
      margins: { top: 24, right: 22, bottom: 22, left: 34 },
    },
    cv: {
      shapes: [rect("terracotta-cv-column", 0, 0, 70, 297, "primary")],
      margins: { top: 24, right: 20, bottom: 18, left: 78 },
    },
  },

  human: {
    templateId: "human",
    label: "Human",
    cover: {
      shapes: [
        oval("human-cover-top", -40, -70, 190, 150, "secondary", 0.85),
        oval("human-cover-bottom", 135, 222, 120, 120, "secondary", 0.6),
        line("human-cover-accent", 20, 140, 30, "primary", 1.2, 0.7),
      ],
    },
    letter: {
      shapes: [
        oval("human-letter-top", 158, -18, 70, 70, "secondary", 0.22),
        oval("human-letter-bottom", -18, 242, 46, 46, "secondary", 0.16),
        line("human-letter-accent", 25, 18, 24, "primary", 0.8, 0.7),
      ],
      margins: { top: 24, right: 23, bottom: 22, left: 25 },
    },
    cv: {
      shapes: [
        oval("human-cv-top", 160, -20, 68, 68, "secondary", 0.18),
        line("human-cv-accent", 20, 18, 28, "primary", 0.8, 0.7),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },

  welle: {
    templateId: "welle",
    label: "Horizont",
    cover: {
      shapes: [
        rect("welle-cover-field", 0, 176, 210, 121, "primary"),
        line("welle-cover-horizon", 0, 176, 210, "secondary", 0.6),
        line("welle-cover-accent", 22, 22, 24, "secondary", 0.8),
      ],
      lightCoverContact: true,
    },
    letter: {
      shapes: [
        rect("welle-letter-top", 0, 0, 210, 3, "primary"),
        rect("welle-letter-bottom", 0, 294, 210, 3, "secondary"),
      ],
      margins: { top: 24, right: 23, bottom: 31, left: 25 },
    },
    cv: {
      shapes: [
        rect("welle-cv-top", 0, 0, 210, 3, "primary"),
        rect("welle-cv-bottom", 0, 294, 210, 3, "secondary"),
      ],
      margins: { top: 24, right: 20, bottom: 24, left: 20 },
    },
  },

  modern: {
    templateId: "modern",
    label: "Modern",
    cover: {
      shapes: [
        rect("modern-cover-top", 0, 0, 210, 1.2, "primary"),
        oval("modern-cover-orb", 118, 30, 74, 74, "accent", 0.1),
        rect("modern-cover-bottom", 0, 295.8, 210, 1.2, "primary"),
      ],
      photoFrame: { kind: "oval", x: 139, y: 46, w: 40, h: 40, stroke: "accent" },
      heroAlign: "left",
      heroLeftMm: 20,
    },
    letter: {
      shapes: [
        rect("modern-letter-top", 0, 0, 210, 1.2, "primary"),
        rect("modern-letter-bottom", 0, 295.8, 210, 1.2, "primary"),
      ],
      margins: { top: 24, right: 22, bottom: 22, left: 24 },
    },
    cv: {
      shapes: [
        rect("modern-cv-top", 0, 0, 210, 1.2, "primary"),
        oval("modern-cv-orb", 164, -16, 62, 62, "accent", 0.08),
        rect("modern-cv-bottom", 0, 295.8, 210, 1.2, "primary"),
      ],
      margins: { top: 24, right: 20, bottom: 18, left: 20 },
    },
  },
};

export function dossierDocxTemplateRecipe(templateId: string) {
  return DOSSIER_DOCX_TEMPLATE_RECIPES[templateId] ?? null;
}
