import type { DossierChromeOptions, DossierHeaderMode } from "@/lib/dossier-chrome";
import { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";

/**
 * Most dossier templates read better with the quiet 3 mm signature band. Only
 * templates whose design genuinely benefits from an integrated contact masthead
 * opt into contact by default.
 *
 * `freundlich` (Warm 1) intentionally stays out of this set. Its dedicated
 * compact renderer owns the reviewed 52 mm teal / mustard first-page masthead,
 * while the CV keeps the quiet Warm continuation edge. Routing Warm through the
 * generic contact masthead creates a second, visually unrelated header system.
 *
 * `aurora` owns a deep cyan/violet first-page field. Its reviewed gallery
 * composition uses the shared contact masthead as the clean cyan sender strip;
 * Compact would drop normal black sender text into the decorative gradient.
 */
const CONTACT_HEADER_DEFAULT_TEMPLATES = new Set([
  "aurora",
  "horizon",
  "violetPulse",
  "studio",
  "studio2",
  "studio3",
  "warm2",
  "warm3",
  // Retired but still render-compatible; keep family behaviour coherent.
  "warm4",
  "warm5",
  "verlauf",
  "verlauf2",
  "verlauf3",
  "prism",
]);

const AUTO_GRADIENT_CONTACT_TEMPLATES = new Set([
  "horizon",
  "violetPulse",
  "verlauf",
  "verlauf2",
  "verlauf3",
  "prism",
]);

/**
 * Header mode chosen when a template is selected for the first time.
 *
 * Selection defaults are written only when a template is deliberately selected.
 * Warm's default compact mode drives its 52 mm letter masthead and quiet CV edge.
 * An explicit contact or none choice must remain authoritative afterwards.
 */
export function defaultHeaderModeForTemplate(template: string): DossierHeaderMode {
  if (template === CANONICAL_DOSSIER_PRESENTATION.template) {
    return CANONICAL_DOSSIER_PRESENTATION.letter.headerMode;
  }
  return CONTACT_HEADER_DEFAULT_TEMPLATES.has(template) ? "contact" : "compact";
}

/** Footer mode written when a template is deliberately selected. */
export function defaultFooterModeForTemplate(template: string): "none" | "compact" {
  return template === CANONICAL_DOSSIER_PRESENTATION.template
    ? CANONICAL_DOSSIER_PRESENTATION.letter.footerMode
    : "compact";
}

/**
 * Default whitespace after the selected template header. Contact mastheads
 * already carry substantial visual height, so they normally need much less
 * additional whitespace than the compact signature band. Aurora is the
 * exception: its reviewed deep first-page field relies on the original 12 mm
 * flow clearance so recipient text starts below the decorative masthead.
 * Values are written only when a template is selected; users remain free to
 * change them afterwards.
 */
export function defaultHeaderGapMmForTemplate(template: string): number {
  if (template === "aurora") return 12;
  return defaultHeaderModeForTemplate(template) === "contact" ? 4 : 12;
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
