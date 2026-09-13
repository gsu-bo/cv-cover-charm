export type DossierDocxGeometryFamily =
  | "plain"
  | "editorial-frame"
  | "side-rail"
  | "masthead"
  | "banded"
  | "geometric"
  | "gradient";

export type DossierDocxTemplatePlan = {
  label: string;
  family: DossierDocxGeometryFamily;
  /**
   * Family rendering is attempted first. `individual` is the safety valve:
   * visual QA may promote one template to a dedicated mapper without changing
   * the rest of its family.
   */
  fallback: "individual";
  /** Existing, visually audited DOCX implementations. */
  audited?: boolean;
};

/**
 * Word needs a much more concrete geometry classification than the product's
 * broad typography families. Keep every selectable dossier template here so
 * adding DOCX coverage is an explicit, reviewable decision.
 */
export const DOSSIER_DOCX_TEMPLATE_PLANS: Readonly<Record<string, DossierDocxTemplatePlan>> = {
  brief: { label: "Brief", family: "plain", fallback: "individual", audited: true },
  klassisch: { label: "Editorial", family: "editorial-frame", fallback: "individual" },
  modern: { label: "Modern", family: "geometric", fallback: "individual" },
  freundlich: { label: "Warm", family: "masthead", fallback: "individual", audited: true },
  edel: { label: "Edel", family: "editorial-frame", fallback: "individual" },
  colorful: { label: "Colorful", family: "geometric", fallback: "individual" },
  blockig: { label: "Blockig", family: "geometric", fallback: "individual" },
  serioes: { label: "Seriös", family: "plain", fallback: "individual" },
  human: { label: "Human", family: "masthead", fallback: "individual" },
  welle: { label: "Horizont", family: "banded", fallback: "individual" },
  terracotta: { label: "Kolumne", family: "side-rail", fallback: "individual" },
  pastell: { label: "Rahmen", family: "editorial-frame", fallback: "individual" },
  sonne: { label: "Sonne", family: "banded", fallback: "individual" },
  studio: { label: "Studio", family: "side-rail", fallback: "individual" },
  neon: { label: "Neon", family: "gradient", fallback: "individual" },
  aurora: { label: "Aurora", family: "gradient", fallback: "individual" },
  verlauf: { label: "Verlauf", family: "gradient", fallback: "individual" },
  citrus: { label: "Citrus", family: "gradient", fallback: "individual" },
  edelDark: { label: "Edel Dark", family: "editorial-frame", fallback: "individual" },

  edge: { label: "Edge", family: "side-rail", fallback: "individual" },
  glow: { label: "Glow", family: "gradient", fallback: "individual" },
  frame: { label: "Frame", family: "editorial-frame", fallback: "individual" },
  monoLuxe: { label: "Mono Luxe", family: "editorial-frame", fallback: "individual" },
  horizon: { label: "Horizon", family: "banded", fallback: "individual" },
  sunrise: { label: "Sunrise", family: "gradient", fallback: "individual" },
  forestFlow: { label: "Forest Flow", family: "gradient", fallback: "individual" },
  violetPulse: { label: "Violet Pulse", family: "gradient", fallback: "individual" },
  studio2: { label: "Studio 2", family: "side-rail", fallback: "individual" },
  studio3: { label: "Studio 3", family: "masthead", fallback: "individual", audited: true },
  warm2: { label: "Warm 2", family: "masthead", fallback: "individual" },
  warm3: { label: "Warm 3", family: "masthead", fallback: "individual" },
  verlauf2: { label: "Verlauf 2", family: "gradient", fallback: "individual" },
  verlauf3: { label: "Verlauf 3", family: "gradient", fallback: "individual" },
  ledger: { label: "Ledger", family: "masthead", fallback: "individual" },
  prism: { label: "Prism", family: "geometric", fallback: "individual" },
  gallery: { label: "Gallery", family: "side-rail", fallback: "individual" },
  orbit: { label: "Orbit", family: "geometric", fallback: "individual" },
  ribbon: { label: "Ribbon", family: "banded", fallback: "individual" },
  cove: { label: "Cove", family: "masthead", fallback: "individual" },
};

export function dossierDocxTemplatePlan(templateId: string) {
  return DOSSIER_DOCX_TEMPLATE_PLANS[templateId] ?? null;
}

export function dossierDocxTemplatesForFamily(family: DossierDocxGeometryFamily) {
  return Object.entries(DOSSIER_DOCX_TEMPLATE_PLANS)
    .filter(([, plan]) => plan.family === family)
    .map(([templateId]) => templateId);
}
