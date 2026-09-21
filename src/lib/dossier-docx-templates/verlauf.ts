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
      const attributes = rawAttributes
        .replace(/\sfillcolor="[^"]*"/g, "")
        .replace(/\sstroked="[^"]*"/g, "")
        .replace(/z-index:-251658240/g, "z-index:251658050");
      return `<v:oval${attributes} filled="f" stroked="t" strokecolor="#FFFFFF" strokeweight="1.2pt"><v:fill opacity="0"/></v:oval>`;
    },
  );

  return cover + source.slice(sectionStart);
}

function compactVerlaufCv(source: string) {
  const sections = [...source.matchAll(/<w:sectPr>[\s\S]*?<\/w:sectPr>/g)];
  const second = sections[1];
  if (!second || second.index === undefined) return source;

  const cvStart = second.index + second[0].length;
  const cv = source.slice(cvStart);

  // The shared body-contact parity pass added two useful contact rows to the CV.
  // Verlauf sits right on LibreOffice's page boundary, so that extra body copy
  // can push the final reference phone line onto a fourth dossier page. Keep all
  // content and spacing roles intact and tighten only the standard CV auto line
  // pitch by 2 twips (0.1 pt), which is visually negligible but restores the
  // intended single-page CV in LibreOffice/Word-style pagination.
  const compactCv = cv.replace(/w:line="276"/g, 'w:line="274"');
  return source.slice(0, cvStart) + compactCv;
}

function polishVerlaufDocument(source: string) {
  return compactVerlaufCv(polishVerlaufCover(source));
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createBaseDossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    polishVerlaufDocument,
    "DOCX Verlauf transparent cover portrait ring and compact CV flow",
  );
}
