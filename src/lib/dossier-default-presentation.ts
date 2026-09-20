/**
 * Canonical fallback presentation for a dossier with no explicit user design.
 *
 * Renderers must consume the resolved document state and must not invent their
 * own fallback template, chrome, continuation chrome or CV layout.
 */
export const CANONICAL_DOSSIER_PRESENTATION = {
  template: "brief",
  letter: {
    headerMode: "compact",
    footerMode: "compact",
    continuationHeaderMode: "compact",
    continuationFooterMode: "compact",
  },
  cv: {
    layout: "classic",
    headerMode: "compact",
    footerMode: "compact",
  },
} as const;
