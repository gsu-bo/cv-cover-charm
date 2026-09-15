import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { recipeTemplate } from "@/lib/dossier-docx-templates/shared";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

const createBaseDossierDocxBlob = recipeTemplate("warm2");
const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function protectNoPhotoCoverName(source: string, documents: DossierDocxDocuments) {
  if (documents.cover.data.foto) return source;
  const fullName = [documents.cover.data.vorname, documents.cover.data.nachname]
    .filter(Boolean)
    .join(" ");
  if (!fullName) return source;

  const needle = `>${xmlEscape(fullName)}</w:t>`;
  const textIndex = source.indexOf(needle);
  if (textIndex < 0) return source;
  const start = source.lastIndexOf("<w:p>", textIndex);
  const end = source.indexOf("</w:p>", textIndex);
  if (start < 0 || end < 0) return source;

  const paragraph = source.slice(start, end + 6);
  const next = paragraph.replace(
    /<w:spacing\b([^>]*)w:before="\d+"([^>]*)\/>/,
    (_match, before: string, after: string) => {
      return `<w:spacing${before}w:before="${twips(12)}"${after}/>`;
    },
  );
  return source.slice(0, start) + next + source.slice(end + 6);
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createBaseDossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => protectNoPhotoCoverName(xml, documents),
    "Warm 2 DOCX cover identity clearance",
  );
}
