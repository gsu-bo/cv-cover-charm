import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { recipeTemplate } from "@/lib/dossier-docx-templates/shared";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

const createBaseDossierDocxBlob = recipeTemplate("verlauf");

function polishVerlaufCover(source: string) {
  const sectionStart = source.indexOf("<w:sectPr>");
  if (sectionStart < 0) return source;
  let cover = source.slice(0, sectionStart);

  cover = cover.replace(
    /<v:oval\b([^>]*\bid="warm-cover-photo-mat"[^>]*)>[\s\S]*?<\/v:oval>/,
    (_shape, rawAttributes: string) => {
      let attributes = rawAttributes
        .replace(/\sfillcolor="[^"]*"/g, "")
        .replace(/\sstroked="[^"]*"/g, "")
        .replace(/z-index:-251658240/g, "z-index:251658050");
      return `<v:oval${attributes} filled="f" stroked="t" strokecolor="#FFFFFF" strokeweight="1.2pt"><v:fill opacity="0"/></v:oval>`;
    },
  );

  return cover + source.slice(sectionStart);
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createBaseDossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    polishVerlaufCover,
    "DOCX Verlauf transparent cover portrait ring",
  );
}
