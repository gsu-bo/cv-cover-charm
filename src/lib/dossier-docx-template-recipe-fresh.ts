import {
  FRESH_TEMPLATE_REGISTRY,
  type FreshTemplateId,
} from "@/components/cover/fresh-template-registry";
import {
  FRESH_LETTER_SPECS,
  type FreshLetterMotif,
} from "@/components/letter/fresh-letter-system";
import type {
  DossierDocxColorRole,
  DossierDocxRecipeShape,
  DossierDocxTemplateRecipe,
} from "@/lib/dossier-docx-template-recipe";

type RuntimePage = DossierDocxTemplateRecipe["letter"] & { contentSurface?: "light" };
type RuntimeCover = DossierDocxTemplateRecipe["cover"] & { contentSurface?: "light" };
type RuntimeRecipe = Omit<DossierDocxTemplateRecipe, "cover" | "letter" | "cv"> & {
  cover: RuntimeCover;
  letter: RuntimePage;
  cv: RuntimePage;
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

const roundrect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: DossierDocxColorRole,
  opacity = 1,
): DossierDocxRecipeShape => ({ kind: "roundrect", id, x, y, w, h, color, opacity });

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

const line = (
  id: string,
  x: number,
  y: number,
  w: number,
  color: DossierDocxColorRole,
  strokeMm = 0.5,
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

function motifShape(prefix: string, motif: FreshLetterMotif): DossierDocxRecipeShape {
  const id = `${prefix}-${motif.id}`;
  const opacity = motif.opacity ?? 1;
  if (motif.borderMm) {
    return frame(id, motif.x, motif.y, motif.w, motif.h, motif.color, motif.borderMm, opacity);
  }
  if (motif.radiusMm && motif.radiusMm >= Math.min(motif.w, motif.h) * 0.45) {
    if (Math.abs(motif.w - motif.h) < 3) {
      return oval(id, motif.x, motif.y, motif.w, motif.h, motif.color, opacity);
    }
    return roundrect(id, motif.x, motif.y, motif.w, motif.h, motif.color, opacity);
  }
  return rect(id, motif.x, motif.y, motif.w, motif.h, motif.color, opacity);
}

function motifShapes(template: FreshTemplateId, prefix: "letter" | "cv") {
  return FRESH_LETTER_SPECS[template].motifs.map((motif) => motifShape(`${template}-${prefix}`, motif));
}

type CoverSpec = RuntimeCover;

const COVER: Record<FreshTemplateId, CoverSpec> = {
  edge: {
    shapes: [
      rect("edge-cover-band", 0, 0, 210, 24, "primary"),
      rect("edge-cover-signal", 0, 0, 6, 24, "secondary"),
      line("edge-cover-rule", 24, 21.5, 52, "accent", 1.5),
    ],
    photoFrame: { kind: "oval", x: 138, y: 48, w: 42, h: 42, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 20,
  },
  glow: {
    shapes: [
      roundrect("glow-cover-capsule", 126, 12, 72, 24, "primary", 0.16),
      oval("glow-cover-orb", -18, 10, 32, 32, "secondary", 0.2),
      line("glow-cover-rule", 8, 27, 50, "accent", 1.4, 0.88),
    ],
    photoFrame: { kind: "oval", x: 140, y: 50, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 20,
  },
  monoLuxe: {
    shapes: [
      rect("mono-cover-band", 0, 0, 210, 32, "primary"),
      line("mono-cover-gold-rule", 28, 31.2, 154, "secondary", 0.8, 0.9),
      rect("mono-cover-mark", 28, 17, 5, 5, "accent"),
    ],
    photoFrame: { kind: "rect", x: 142, y: 52, w: 38, h: 38, stroke: "secondary" },
    heroAlign: "left",
    heroLeftMm: 20,
  },
  horizon: {
    shapes: [
      rect("horizon-cover-band-a", 0, 0, 138, 42, "primary"),
      rect("horizon-cover-band-b", 138, 0, 72, 42, "secondary"),
      line("horizon-cover-rule", 24, 48, 30, "accent", 1.3),
    ],
    photoFrame: { kind: "oval", x: 140, y: 54, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 20,
  },
  sunrise: {
    shapes: [
      rect("sunrise-cover-band", 0, 0, 210, 44, "primary"),
      oval("sunrise-cover-sun", 156, 12, 62, 62, "secondary", 0.55),
      line("sunrise-cover-rule", 24, 50, 28, "accent", 1.3),
    ],
    photoFrame: { kind: "oval", x: 139, y: 62, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 20,
  },
  forestFlow: {
    shapes: [
      rect("forest-cover-rail", 0, 0, 46, 297, "primary"),
      oval("forest-cover-orb", 16, 16, 50, 50, "secondary", 0.34),
      line("forest-cover-rule", 50, 36, 28, "accent", 1.2),
    ],
    photoFrame: { kind: "oval", x: 14, y: 26, w: 28, h: 28, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 50,
    lightCoverContact: true,
  },
  violetPulse: {
    shapes: [
      roundrect("violet-cover-field", 118, -12, 112, 78, "primary", 0.22),
      oval("violet-cover-orb", 154, 18, 72, 72, "secondary", 0.2),
      line("violet-cover-rule", 22, 32, 34, "accent", 1.5),
    ],
    photoFrame: { kind: "oval", x: 139, y: 62, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 20,
  },
  studio2: {
    shapes: [
      rect("studio2-cover-rail", 0, 0, 52, 297, "primary"),
      rect("studio2-cover-signal", 0, 36, 76, 24, "secondary"),
      line("studio2-cover-rule", 62, 72, 22, "accent", 1.2),
    ],
    photoFrame: { kind: "rect", x: 10, y: 18, w: 32, h: 32, stroke: "secondary" },
    heroAlign: "left",
    heroLeftMm: 64,
    lightCoverContact: true,
  },
  studio3: {
    shapes: [
      rect("studio3-cover-rail", 0, 0, 44, 297, "primary"),
      rect("studio3-cover-field", 44, 0, 82, 38, "secondary"),
      line("studio3-cover-rule", 58, 48, 26, "accent", 1.2),
    ],
    photoFrame: { kind: "oval", x: 142, y: 52, w: 38, h: 38, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 56,
  },
  warm2: {
    shapes: [
      rect("warm2-cover-field", 0, 0, 210, 76, "primary"),
      oval("warm2-cover-orb", 142, -20, 92, 92, "secondary", 0.72),
      oval("warm2-cover-dot", 170, 52, 18, 18, "accent", 0.75),
    ],
    photoFrame: { kind: "oval", x: 80, y: 52, w: 50, h: 50, stroke: "accent" },
  },
  warm3: {
    shapes: [
      rect("warm3-cover-band", 0, 0, 210, 30, "primary"),
      oval("warm3-cover-orb", 154, 10, 82, 82, "secondary", 0.4),
      line("warm3-cover-rule", 24, 44, 28, "accent", 1.2),
    ],
    photoFrame: { kind: "oval", x: 136, y: 56, w: 42, h: 42, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 22,
  },
  warm4: {
    shapes: [
      rect("warm4-cover-rail", 0, 0, 58, 297, "primary"),
      oval("warm4-cover-sand", 30, 24, 82, 82, "secondary", 0.72),
      line("warm4-cover-rule", 72, 42, 28, "accent", 1.2),
    ],
    photoFrame: { kind: "oval", x: 28, y: 32, w: 46, h: 46, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 72,
    lightCoverContact: true,
  },
  warm5: {
    shapes: [
      rect("warm5-cover-band", 0, 0, 210, 34, "primary"),
      roundrect("warm5-cover-honey", 148, 12, 62, 26, "secondary", 0.72),
      line("warm5-cover-rule", 24, 46, 30, "accent", 1.2),
    ],
    photoFrame: { kind: "oval", x: 138, y: 58, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 22,
  },
  verlauf2: {
    shapes: [
      rect("verlauf2-cover-a", 0, 0, 126, 108, "primary"),
      rect("verlauf2-cover-b", 126, 0, 84, 108, "secondary"),
      oval("verlauf2-cover-light", 148, 22, 76, 76, "accent", 0.28),
    ],
    photoFrame: { kind: "oval", x: 138, y: 62, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 20,
    contentSurface: "light",
  },
  verlauf3: {
    shapes: [
      rect("verlauf3-cover-a", 0, 0, 122, 108, "primary"),
      rect("verlauf3-cover-b", 122, 0, 88, 108, "secondary"),
      oval("verlauf3-cover-light", 150, 20, 78, 78, "accent", 0.3),
    ],
    photoFrame: { kind: "oval", x: 138, y: 62, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 20,
    contentSurface: "light",
  },
  ledger: {
    shapes: [
      rect("ledger-cover-masthead", 0, 0, 210, 34, "primary"),
      rect("ledger-cover-index", 12, 34, 18, 263, "secondary", 0.54),
      line("ledger-cover-rule", 38, 46, 142, "accent", 0.7),
    ],
    photoFrame: { kind: "rect", x: 142, y: 56, w: 38, h: 38, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 38,
  },
  prism: {
    shapes: [
      rect("prism-cover-wedge", 112, 0, 98, 52, "primary"),
      rect("prism-cover-signal", 142, 52, 68, 12, "secondary"),
      line("prism-cover-rule", 24, 42, 26, "accent", 1.2),
    ],
    photoFrame: { kind: "rect", x: 142, y: 70, w: 38, h: 38, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 22,
  },
  gallery: {
    shapes: [
      rect("gallery-cover-rail", 0, 0, 54, 297, "primary"),
      roundrect("gallery-cover-portrait", 10, 24, 50, 72, "secondary"),
      rect("gallery-cover-signal", 48, 104, 10, 10, "accent"),
    ],
    photoFrame: { kind: "rect", x: 16, y: 32, w: 38, h: 50, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 70,
    lightCoverContact: true,
  },
  orbit: {
    shapes: [
      oval("orbit-cover-outer", 132, -30, 112, 112, "primary", 0.2),
      oval("orbit-cover-inner", 156, 18, 54, 54, "secondary", 0.36),
      line("orbit-cover-rule", 24, 42, 28, "accent", 1.2),
    ],
    photoFrame: { kind: "oval", x: 138, y: 64, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 22,
  },
  ribbon: {
    shapes: [
      roundrect("ribbon-cover-top", 0, 0, 210, 30, "primary"),
      roundrect("ribbon-cover-signal", 18, 30, 144, 12, "secondary"),
      rect("ribbon-cover-bottom", 0, 292, 210, 5, "accent"),
    ],
    photoFrame: { kind: "oval", x: 138, y: 64, w: 40, h: 40, stroke: "secondary" },
    heroAlign: "left",
    heroLeftMm: 22,
  },
  cove: {
    shapes: [
      roundrect("cove-cover-top", 0, 0, 210, 38, "primary"),
      oval("cove-cover-right", 158, 12, 74, 74, "secondary", 0.86),
      line("cove-cover-rule", 24, 48, 30, "accent", 1.3),
    ],
    photoFrame: { kind: "oval", x: 138, y: 64, w: 40, h: 40, stroke: "accent" },
    heroAlign: "left",
    heroLeftMm: 22,
  },
};

function freshRecipe(template: FreshTemplateId, label: string): RuntimeRecipe {
  const spec = FRESH_LETTER_SPECS[template];
  const lightContentSurface = template === "verlauf2" || template === "verlauf3";
  return {
    templateId: template,
    label,
    cover: COVER[template],
    letter: {
      shapes: motifShapes(template, "letter"),
      margins: { top: 26, right: spec.right, bottom: 23, left: spec.left },
      contentSurface: lightContentSurface ? "light" : undefined,
    },
    cv: {
      shapes: motifShapes(template, "cv"),
      margins: { top: 24, right: Math.max(20, spec.right), bottom: 20, left: Math.max(20, spec.left) },
      contentSurface: lightContentSurface ? "light" : undefined,
    },
  };
}

/**
 * Every Fresh template gets its own Word recipe. The geometry is intentionally
 * Word-safe (rectangles, ovals, frames, rounded rectangles) rather than a raw
 * CSS translation, while the template-specific motifs and margins remain
 * individually configurable for later visual QA.
 */
export const FRESH_DOSSIER_DOCX_RECIPES: Readonly<Record<string, RuntimeRecipe>> = Object.fromEntries(
  FRESH_TEMPLATE_REGISTRY.map(({ id, name }) => [id, freshRecipe(id as FreshTemplateId, name)]),
);
