import {
  getDossierPageMarginsState,
  type DossierPageMargins,
  type DossierPageMarginsState,
} from "@/lib/dossier-page-margins";
import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function patchSectionMargins(source: string, sectionIndex: number, margins: DossierPageMargins) {
  const pattern = /<w:sectPr>[\s\S]*?<\/w:sectPr>/g;
  const matches = [...source.matchAll(pattern)];
  const match = matches[sectionIndex];
  if (!match || match.index === undefined) return source;

  const block = match[0];
  const next = block.replace(/<w:pgMar\b[^>]*\/>/, (pgMar) => {
    let value = pgMar;
    const attrs = {
      top: twips(margins.top),
      right: twips(margins.right),
      bottom: twips(margins.bottom),
      left: twips(margins.left),
    };
    for (const [name, amount] of Object.entries(attrs)) {
      const attribute = new RegExp(`w:${name}="-?\\d+"`);
      value = attribute.test(value)
        ? value.replace(attribute, `w:${name}="${amount}"`)
        : value.replace("/>", ` w:${name}="${amount}"/>`);
    }
    return value;
  });

  return source.slice(0, match.index) + next + source.slice(match.index + block.length);
}

/**
 * Every dossier DOCX renderer emits the same three Word sections in this order:
 * title page, motivation letter, CV. The title page deliberately stays untouched.
 */
export function patchDossierDocxPageMarginsXml(
  source: string,
  state: DossierPageMarginsState,
) {
  let xml = source;
  if (state.letter) xml = patchSectionMargins(xml, 1, state.letter);
  if (state.cv) xml = patchSectionMargins(xml, 2, state.cv);
  return xml;
}

export async function applyDossierPageMarginsToDocx(blob: Blob) {
  const state = getDossierPageMarginsState();
  if (!state.letter && !state.cv) return blob;
  return transformStoredDocxDocumentXml(
    blob,
    (documentXml) => patchDossierDocxPageMarginsXml(documentXml, state),
    "Dossier-DOCX Seitenränder",
  );
}
