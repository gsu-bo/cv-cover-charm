import type {
  DossierDocxDocuments,
  DossierDocxTemplateModule,
} from "@/lib/dossier-docx-template-types";
import { DOSSIER_DOCX_TEMPLATE_PLANS } from "@/lib/dossier-docx-family";

type DossierDocxTemplateLoader = () => Promise<DossierDocxTemplateModule>;

const DOSSIER_DOCX_TEMPLATE_LOADERS = {
  brief: () => import("./dossier-docx-templates/brief"),
  klassisch: () => import("./dossier-docx-templates/klassisch"),
  modern: () => import("./dossier-docx-templates/modern"),
  freundlich: () => import("./dossier-docx-templates/freundlich"),
  edel: () => import("./dossier-docx-templates/edel"),
  colorful: () => import("./dossier-docx-templates/colorful"),
  blockig: () => import("./dossier-docx-templates/blockig"),
  serioes: () => import("./dossier-docx-templates/serioes"),
  human: () => import("./dossier-docx-templates/human"),
  welle: () => import("./dossier-docx-templates/welle"),
  terracotta: () => import("./dossier-docx-templates/terracotta"),
  pastell: () => import("./dossier-docx-templates/pastell"),
  sonne: () => import("./dossier-docx-templates/sonne"),
  studio: () => import("./dossier-docx-templates/studio"),
  neon: () => import("./dossier-docx-templates/neon"),
  aurora: () => import("./dossier-docx-templates/aurora"),
  verlauf: () => import("./dossier-docx-templates/verlauf"),
  citrus: () => import("./dossier-docx-templates/citrus"),
  edelDark: () => import("./dossier-docx-templates/edelDark"),
  edge: () => import("./dossier-docx-templates/edge"),
  glow: () => import("./dossier-docx-templates/glow"),
  frame: () => import("./dossier-docx-templates/frame"),
  monoLuxe: () => import("./dossier-docx-templates/monoLuxe"),
  horizon: () => import("./dossier-docx-templates/horizon"),
  sunrise: () => import("./dossier-docx-templates/sunrise"),
  forestFlow: () => import("./dossier-docx-templates/forestFlow"),
  violetPulse: () => import("./dossier-docx-templates/violetPulse"),
  studio2: () => import("./dossier-docx-templates/studio2-refined"),
  studio3: () => import("./dossier-docx-templates/studio3"),
  warm2: () => import("./dossier-docx-templates/warm2"),
  warm3: () => import("./dossier-docx-templates/warm3"),
  verlauf2: () => import("./dossier-docx-templates/verlauf2"),
  verlauf3: () => import("./dossier-docx-templates/verlauf3"),
  ledger: () => import("./dossier-docx-templates/ledger"),
  prism: () => import("./dossier-docx-templates/prism"),
  gallery: () => import("./dossier-docx-templates/gallery"),
  orbit: () => import("./dossier-docx-templates/orbit"),
  ribbon: () => import("./dossier-docx-templates/ribbon"),
  cove: () => import("./dossier-docx-templates/cove"),
  warm4: () => import("./dossier-docx-templates/warm4"),
  warm5: () => import("./dossier-docx-templates/warm5"),
} satisfies Record<string, DossierDocxTemplateLoader>;

export const DOSSIER_DOCX_LAZY_TEMPLATE_IDS = Object.freeze(
  Object.keys(DOSSIER_DOCX_TEMPLATE_PLANS),
);

export function hasDossierDocxTemplateLoader(templateId: string) {
  return templateId in DOSSIER_DOCX_TEMPLATE_LOADERS;
}

export async function createLazyTemplateDossierDocxBlob(
  templateId: string,
  documents: DossierDocxDocuments,
) {
  const loader = DOSSIER_DOCX_TEMPLATE_LOADERS[
    templateId as keyof typeof DOSSIER_DOCX_TEMPLATE_LOADERS
  ];
  if (!loader) throw new Error(`Kein lazy DOCX-Modul für ${templateId} registriert.`);
  const module = await loader();
  return module.createDossierDocxBlob(documents);
}
