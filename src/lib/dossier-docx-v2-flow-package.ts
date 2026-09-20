import {
  readStoredDocxEntries,
  transformStoredDocxEntries,
  type StoredDocxEntry,
} from "@/lib/dossier-docx-package";
import { dossierDocxV2DataUrlImageAsset } from "@/lib/dossier-docx-v2-image-asset";
import {
  renderDossierDocxV2CvPageArtwork,
  renderDossierDocxV2CvPhoto,
  renderDossierDocxV2FloatingTextBox,
  renderDossierDocxV2FlowBlocks,
  renderDossierDocxV2PageBreak,
} from "@/lib/dossier-docx-v2-flow-renderer";
import type {
  DossierDocxV2CvFlowScene,
  DossierDocxV2LetterFlowScene,
} from "@/lib/dossier-docx-v2-flow-scene";

const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const FLOW_MEDIA_PREFIX = "word/media/docx-v2-flow-";
const FLOW_REL_PREFIX = "rIdDocxV2Flow";

type SectionBounds = { start: number; end: number };

function bodyStart(source: string) {
  const body = /<w:body(?:\s[^>]*)?>/.exec(source);
  return body?.index === undefined ? null : body.index + body[0].length;
}

function enclosingParagraph(source: string, index: number) {
  const before = source.slice(0, index);
  const paragraphStarts = [...before.matchAll(/<w:p(?:\s[^>]*)?>/g)];
  const start = paragraphStarts.at(-1)?.index ?? -1;
  const endTag = source.indexOf("</w:p>", index);
  if (start < 0 || endTag < 0) return null;
  return { start, end: endTag + "</w:p>".length };
}

/** Cover, letter and CV are the three consecutive dossier Word sections. */
export function dossierDocxV2FlowSectionBounds(
  source: string,
): [SectionBounds, SectionBounds, SectionBounds] | null {
  const start = bodyStart(source);
  if (start === null) return null;
  const sectionProperties = [...source.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)];
  if (sectionProperties.length < 3) return null;
  const firstIndex = sectionProperties[0].index;
  const secondIndex = sectionProperties[1].index;
  const finalIndex = sectionProperties.at(-1)?.index;
  if (firstIndex === undefined || secondIndex === undefined || finalIndex === undefined) return null;
  const firstBreak = enclosingParagraph(source, firstIndex);
  const secondBreak = enclosingParagraph(source, secondIndex);
  if (!firstBreak || !secondBreak) return null;
  return [
    { start, end: firstBreak.start },
    { start: firstBreak.end, end: secondBreak.start },
    { start: secondBreak.end, end: finalIndex },
  ];
}

function visibleText(paragraph: string) {
  return Array.from(paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g), (match) => match[1])
    .join("")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Transitional migration bridge: preserve only negative-z, text-free VML artwork
 * from the reviewed production package. Semantic content is always rebuilt by
 * V2, so Warm/recipe paragraphs cannot remain a second layout engine.
 */
export function dossierDocxV2FlowSkin(section: string) {
  return Array.from(section.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g), (match) => match[0])
    .filter(
      (paragraph) =>
        /<w:pict\b/.test(paragraph) &&
        /z-index:-/.test(paragraph) &&
        !/<v:imagedata\b/.test(paragraph) &&
        !visibleText(paragraph),
    )
    .join("");
}

function textEntry(entries: StoredDocxEntry[], name: string) {
  return entries.find((entry) => entry.name === name);
}

function removePreviousRelationships(source: string) {
  return source.replace(
    new RegExp(`<Relationship\\b[^>]*\\bId="${FLOW_REL_PREFIX}[^"]*"[^>]*/>`, "g"),
    "",
  );
}

function appendRelationship(source: string, id: string, target: string) {
  return source.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${IMAGE_REL_TYPE}" Target="${target}"/></Relationships>`,
  );
}

function ensureContentType(source: string, extension: string, contentType: string) {
  const pattern = new RegExp(`<Default\\s+Extension="${extension}"\\b`, "i");
  if (pattern.test(source)) return source;
  return source.replace(
    "</Types>",
    `<Default Extension="${extension}" ContentType="${contentType}"/></Types>`,
  );
}

function renderLetter(scene: DossierDocxV2LetterFlowScene, skin: string) {
  const floating = scene.floating.map(renderDossierDocxV2FloatingTextBox).join("");
  return `${skin}${floating}${renderDossierDocxV2FlowBlocks(scene.blocks)}`;
}

function flowPages(blocks: DossierDocxV2CvFlowScene["blocks"]) {
  const pages: DossierDocxV2CvFlowScene["blocks"][] = [[]];
  for (const block of blocks) {
    if (block.kind === "page-break") {
      pages.push([]);
      continue;
    }
    pages.at(-1)!.push(block);
  }
  return pages;
}

function renderCv(
  scene: DossierDocxV2CvFlowScene,
  skin: string,
  photoXml: string,
  artworkXmlByPage: Map<number, string>,
) {
  const pages = flowPages(scene.blocks);
  const overlayMaxPage = scene.overlays.reduce((max, overlay) => Math.max(max, overlay.pageIndex), -1);
  const artworkMaxPage = scene.artwork.reduce((max, artwork) => Math.max(max, artwork.pageIndex), -1);
  while (pages.length <= Math.max(overlayMaxPage, artworkMaxPage)) pages.push([]);
  return pages
    .map((blocks, pageIndex) => {
      const overlays = scene.overlays
        .filter((overlay) => overlay.pageIndex === pageIndex)
        .map(renderDossierDocxV2FloatingTextBox)
        .join("");
      const artwork = artworkXmlByPage.get(pageIndex) ?? "";
      const legacySkin = pageIndex === 0 && !artwork ? skin : "";
      const photo = pageIndex === 0 ? photoXml : "";
      return `${artwork}${legacySkin}${photo}${overlays}${renderDossierDocxV2FlowBlocks(blocks)}`;
    })
    .map((page, index) => `${index ? renderDossierDocxV2PageBreak() : ""}${page}`)
    .join("");
}

export async function applyDossierDocxV2FlowToDocx(
  blob: Blob,
  scenes: { letter: DossierDocxV2LetterFlowScene; cv: DossierDocxV2CvFlowScene },
) {
  const photoAsset = scenes.cv.photo
    ? await dossierDocxV2DataUrlImageAsset(scenes.cv.photo.dataUrl)
    : null;
  if (scenes.cv.photo && !photoAsset) {
    throw new Error("DOCX V2 Flow: CV-Foto konnte nicht in ein Word-kompatibles Bild umgewandelt werden.");
  }

  const artworkAssets = await Promise.all(
    scenes.cv.artwork.map(async (artwork) => ({
      artwork,
      asset: await dossierDocxV2DataUrlImageAsset(artwork.dataUrl),
    })),
  );
  if (artworkAssets.some((item) => !item.asset)) {
    throw new Error("DOCX V2 Flow: CV-Hintergrund konnte nicht in ein Word-kompatibles PNG umgewandelt werden.");
  }

  return transformStoredDocxEntries(
    blob,
    (entries) => {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const documentEntry = textEntry(entries, "word/document.xml");
      const relsEntry = textEntry(entries, "word/_rels/document.xml.rels");
      const typesEntry = textEntry(entries, "[Content_Types].xml");
      if (!documentEntry || !relsEntry || !typesEntry) {
        throw new Error("DOCX V2 Flow: Paketstruktur unvollständig.");
      }

      let documentXml = decoder.decode(documentEntry.bytes);
      const bounds = dossierDocxV2FlowSectionBounds(documentXml);
      if (!bounds) throw new Error("DOCX V2 Flow: drei Dossierabschnitte konnten nicht erkannt werden.");
      const letterSection = documentXml.slice(bounds[1].start, bounds[1].end);
      const cvSection = documentXml.slice(bounds[2].start, bounds[2].end);
      const letterSkin = dossierDocxV2FlowSkin(letterSection);
      const cvSkin = dossierDocxV2FlowSkin(cvSection);
      const renderedLetter = renderLetter(scenes.letter, letterSkin);

      let relsXml = removePreviousRelationships(decoder.decode(relsEntry.bytes));
      let typesXml = decoder.decode(typesEntry.bytes);
      const kept = entries.filter((entry) => !entry.name.startsWith(FLOW_MEDIA_PREFIX));
      let photoXml = "";

      if (scenes.cv.photo && photoAsset) {
        const relationshipId = `${FLOW_REL_PREFIX}CvPhoto1`;
        const fileName = `docx-v2-flow-cv-photo.${photoAsset.extension}`;
        relsXml = appendRelationship(relsXml, relationshipId, `media/${fileName}`);
        typesXml = ensureContentType(typesXml, photoAsset.extension, photoAsset.contentType);
        kept.push({ name: `word/media/${fileName}`, bytes: photoAsset.bytes });
        photoXml = renderDossierDocxV2CvPhoto(scenes.cv.photo, {
          relationshipId,
          fileName,
          aspect: photoAsset.aspect,
        });
      }

      const artworkXmlByPage = new Map<number, string>();
      for (const [index, item] of artworkAssets.entries()) {
        if (!item.asset) continue;
        const relationshipId = `${FLOW_REL_PREFIX}CvArtwork${index + 1}`;
        const fileName = `docx-v2-flow-cv-artwork-p${item.artwork.pageIndex + 1}.${item.asset.extension}`;
        relsXml = appendRelationship(relsXml, relationshipId, `media/${fileName}`);
        typesXml = ensureContentType(typesXml, item.asset.extension, item.asset.contentType);
        kept.push({ name: `word/media/${fileName}`, bytes: item.asset.bytes });
        artworkXmlByPage.set(
          item.artwork.pageIndex,
          renderDossierDocxV2CvPageArtwork(item.artwork, { relationshipId, fileName }),
        );
      }

      const renderedCv = renderCv(scenes.cv, cvSkin, photoXml, artworkXmlByPage);

      documentXml =
        documentXml.slice(0, bounds[1].start) +
        renderedLetter +
        documentXml.slice(bounds[1].end, bounds[2].start) +
        renderedCv +
        documentXml.slice(bounds[2].end);
      documentEntry.bytes = encoder.encode(documentXml);
      relsEntry.bytes = encoder.encode(relsXml);
      typesEntry.bytes = encoder.encode(typesXml);
      return kept;
    },
    "DOCX V2 Flow",
  );
}

export async function dossierDocxV2FlowDocumentXml(blob: Blob) {
  const entries = readStoredDocxEntries(new Uint8Array(await blob.arrayBuffer()), "DOCX V2 Flow QA");
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
  return documentEntry ? new TextDecoder().decode(documentEntry.bytes) : "";
}
