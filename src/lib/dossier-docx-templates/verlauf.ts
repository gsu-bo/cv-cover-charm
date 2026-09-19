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
  // Verlauf was already close to LibreOffice's page boundary, so its last
  // reference phone number alone spilled onto a fourth dossier page. Preserve
  // all content and typography; reclaim only the tiny legacy after-paragraph
  // padding inside the Verlauf CV section.
  const compactCv = cv.replace(/w:after="28"/g, 'w:after="12"');
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
