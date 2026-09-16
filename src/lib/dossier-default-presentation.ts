/**
 * Canonical fallback presentation for a dossier with no explicit user design.
 *
 * Renderers must consume the resolved document state and must not invent their
 * own fallback template, chrome, continuation chrome or CV layout.
 */
export const CANONICAL_DOSSIER_PRESENTATION = {
  template: "brief",
  letter: {
    headerMode: "none",
    footerMode: "none",
    continuationHeaderMode: "none",
    continuationFooterMode: "none",
  },
  cv: {
    layout: "classic",
    headerMode: "none",
    footerMode: "none",
  },
} as const;
