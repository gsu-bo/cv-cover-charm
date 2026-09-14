import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { recipeTemplate } from "@/lib/dossier-docx-templates/shared";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

const createBaseDossierDocxBlob = recipeTemplate("verlauf2");

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function moveCoverNameBelowHero(source: string, documents: DossierDocxDocuments) {
  const sectionStart = source.indexOf("<w:sectPr>");
  if (sectionStart < 0) return source;
  let cover = source.slice(0, sectionStart);
  const fullName = [documents.cover.data.vorname, documents.cover.data.nachname]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!fullName) return source;

  const textIndex = cover.indexOf(`>${xmlEscape(fullName)}</w:t>`);
  if (textIndex < 0) return source;
  const start = cover.lastIndexOf("<w:p>", textIndex);
  const end = cover.indexOf("</w:p>", textIndex);
  if (start < 0 || end < 0) return source;

  let paragraph = cover.slice(start, end + 6);
  paragraph = paragraph.replace(/w:before="\d+"/, 'w:before="900"');
  cover = cover.slice(0, start) + paragraph + cover.slice(end + 6);
  return cover + source.slice(sectionStart);
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createBaseDossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => moveCoverNameBelowHero(xml, documents),
    "DOCX Verlauf 2 cover name spacing",
  );
}
