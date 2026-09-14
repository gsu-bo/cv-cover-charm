import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import { recipeTemplate } from "@/lib/dossier-docx-templates/shared";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";

const createBaseDossierDocxBlob = recipeTemplate("studio");

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function setParagraphColor(source: string, text: string, color: string) {
  if (!text) return source;
  const needle = `>${xmlEscape(text)}</w:t>`;
  const textIndex = source.indexOf(needle);
  if (textIndex < 0) return source;
  const start = source.lastIndexOf("<w:p>", textIndex);
  const end = source.indexOf("</w:p>", textIndex);
  if (start < 0 || end < 0) return source;

  const wordColor = color.replace("#", "").toUpperCase();
  let paragraph = source.slice(start, end + 6);
  if (/<w:color w:val="[^"]+"\/>/.test(paragraph)) {
    paragraph = paragraph.replace(
      /<w:color w:val="[^"]+"\/>/g,
      `<w:color w:val="${wordColor}"/>`,
    );
  } else {
    paragraph = paragraph.replace(/<w:rPr>/g, `<w:rPr><w:color w:val="${wordColor}"/>`);
  }
  return source.slice(0, start) + paragraph + source.slice(end + 6);
}

function polishStudioCover(source: string, documents: DossierDocxDocuments) {
  const sectionStart = source.indexOf("<w:sectPr>");
  if (sectionStart < 0) return source;

  let cover = source.slice(0, sectionStart);
  const texts = [
    "BEILAGEN",
    ...(documents.cover.data.showBeilagenOnCover ? documents.cover.data.beilagen ?? [] : []),
  ].filter(Boolean) as string[];
  for (const text of texts) cover = setParagraphColor(cover, text, "#232b3a");
  return cover + source.slice(sectionStart);
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createBaseDossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => polishStudioCover(xml, documents),
    "DOCX Studio cover attachment contrast",
  );
}
