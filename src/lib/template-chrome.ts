import type { DossierChromeOptions, DossierHeaderMode } from "@/lib/dossier-chrome";
import { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";

/**
 * Normal visual templates default to the quiet compact header. Warm and Citrus
 * are the two reviewed exceptions whose composition depends on a stacked
 * contact masthead.
 *
 * IMPORTANT — USER-APPROVED WARM CONTRACT, DO NOT NORMALIZE OR REMOVE:
 * `freundlich` (Warm 1) defaults to the stacked contact header. Its renderer
 * owns the integrated teal / mustard decoration. Future AI changes must keep
 * this template-specific recommendation instead of replacing it with generic
 * compact chrome.
 *
 * Citrus intentionally shares that recommendation so the contact block stays
 * clear of its right-hand citrus slice. Explicit user choices remain
 * authoritative when switching between all other templates.
 */
const STACKED_CONTACT_RECOMMENDED_TEMPLATES = new Set(["freundlich", "citrus"]);

const AUTO_GRADIENT_CONTACT_TEMPLATES = new Set([
  "horizon",
  "violetPulse",
  "verlauf",
  "verlauf2",
  "verlauf3",
  "prism",
]);

export function recommendsStackedContactHeader(template: string): boolean {
  return STACKED_CONTACT_RECOMMENDED_TEMPLATES.has(template);
}

/**
 * Header mode used for a brand-new/template-default state.
 *
 * `brief` remains the canonical neutral fallback. Every selectable visual
 * template defaults to compact except Warm and Citrus, which intentionally
 * recommend the stacked contact masthead.
 */
export function defaultHeaderModeForTemplate(template: string): DossierHeaderMode {
  if (template === CANONICAL_DOSSIER_PRESENTATION.template) {
    return CANONICAL_DOSSIER_PRESENTATION.letter.headerMode;
  }
  return recommendsStackedContactHeader(template) ? "contact" : "compact";
}

/** Footer mode written for a brand-new template-default state. */
export function defaultFooterModeForTemplate(template: string): "none" | "compact" {
  return template === CANONICAL_DOSSIER_PRESENTATION.template
    ? CANONICAL_DOSSIER_PRESENTATION.letter.footerMode
    : "compact";
}

/**
 * Header height used only for a template recommendation/default.
 * Warm keeps the reviewed 44 mm masthead. Citrus uses the normal automatic
 * stacked-contact height. Afterwards the value remains ordinary user state.
 */
export function defaultHeaderHeightMmForTemplate(template: string): number | null {
  return template === "freundlich" ? 44 : null;
}

/**
 * Default whitespace after a template-default header. Stacked contact
 * mastheads need less extra whitespace than compact signature bands.
 */
export function defaultHeaderGapMmForTemplate(template: string): number {
  return defaultHeaderModeForTemplate(template) === "contact" ? 4 : 12;
}

/**
 * Patch applied only when a deliberate template switch has an explicit visual
 * recommendation. Returning null for normal templates is intentional: it
 * preserves the user's current header choice instead of silently resetting it.
 */
export function recommendedHeaderPatchForTemplate(
  template: string,
): Partial<DossierChromeOptions> | null {
  if (!recommendsStackedContactHeader(template)) return null;
  return {
    headerMode: "contact",
    headerTextLayout: "stacked",
    headerHeightMm: defaultHeaderHeightMmForTemplate(template),
    headerGapMm: defaultHeaderGapMmForTemplate(template),
  };
}

/**
 * Template-owned chrome styling without disabling the shared chrome controls.
 * Explicit user colours always win: template-derived contact gradients are only
 * supplied while both header colour controls remain on "Wie Vorlage".
 */
export function resolveTemplateChromeOptions(
  template: string,
  colors: Record<string, string>,
  options: DossierChromeOptions,
): DossierChromeOptions {
  const primary = colors.primary ?? colors.ink ?? "#334155";
  const secondary = colors.secondary ?? colors.accent ?? primary;

  // Modes and geometry are resolved user intent. Template styling must not replace them.
  const resolvedOptions = options;

  if (
    resolvedOptions.headerMode === "contact" &&
    AUTO_GRADIENT_CONTACT_TEMPLATES.has(template) &&
    resolvedOptions.headerBackgroundColor === null &&
    resolvedOptions.headerGradientColor === null
  ) {
    return {
      ...resolvedOptions,
      headerBackgroundColor: primary,
      headerGradientColor: secondary,
    };
  }

  if (template !== "modern") return resolvedOptions;
  if (resolvedOptions.headerMode !== "compact" || resolvedOptions.footerMode !== "compact") {
    return resolvedOptions;
  }

  const accent = colors.accent ?? colors.secondary ?? "#f43f5e";

  return {
    ...resolvedOptions,
    // Keep the canonical mode and geometry values untouched. Only the visual
    // treatment changes while both compact zones are active.
    headerBackgroundColor: primary,
    headerGradientColor: null,
    footerBackgroundColor: primary,
    footerGradientColor: null,
    borderEnabled: true,
    borderColor: accent,
    borderWidthMm: 0.6,
  };
}
