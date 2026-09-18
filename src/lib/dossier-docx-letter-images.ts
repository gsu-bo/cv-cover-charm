import { normalizeLetterImageGeometry } from "@/components/letter/letter-image-geometry";
import { letterPageGeometry } from "@/components/letter/layout-system";
import type { LetterFlowImage } from "@/components/letter/types";
import type { LetterPdfDocument } from "@/lib/dossier-pdf-document";
import {
  transformStoredDocxEntries,
  type StoredDocxEntry,
} from "@/lib/dossier-docx-package";

const MM_TO_EMU = 36000;
const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const LETTER_MEDIA_PREFIX = "word/media/letter-flow-image-";
const LETTER_REL_PREFIX = "rIdLetterFlowImage";

const emu = (mm: number) => Math.round(mm * MM_TO_EMU);

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizedText(value: string) {
  return xmlDecode(value).replace(/\s+/g, " ").trim().toLocaleLowerCase("de-CH");
}

function visibleText(xml: string) {
  return normalizedText(
    Array.from(xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g), (match) => match[1]).join(""),
  );
}

type ImageAsset = {
  bytes: Uint8Array;
  extension: "png" | "jpg" | "gif";
  contentType: "image/png" | "image/jpeg" | "image/gif";
  aspect: number;
};

function pngAspect(bytes: Uint8Array) {
  if (bytes.length < 24) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 ? width / height : 1;
}

function gifAspect(bytes: Uint8Array) {
  if (bytes.length < 10) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  return width > 0 && height > 0 ? width / height : 1;
}

function jpegAspect(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (sofMarkers.has(marker) && length >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? width / height : 1;
    }
    offset += length;
  }
  return 1;
}

function dataUrlAsset(value: string): ImageAsset | null {
  const match = value.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

  const format = match[1].toLowerCase();
  if (format === "png") {
    return { bytes, extension: "png", contentType: "image/png", aspect: pngAspect(bytes) };
  }
  if (format === "gif") {
    return { bytes, extension: "gif", contentType: "image/gif", aspect: gifAspect(bytes) };
  }
  return { bytes, extension: "jpg", contentType: "image/jpeg", aspect: jpegAspect(bytes) };
}

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

/** Cover, letter and CV are emitted as the three consecutive Word sections. */
function dossierSections(source: string): [SectionBounds, SectionBounds, SectionBounds] | null {
  const start = bodyStart(source);
  if (start === null) return null;
  const sectionProperties = [...source.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)];
  if (sectionProperties.length < 2) return null;
  const firstIndex = sectionProperties[0].index;
  const secondIndex = sectionProperties[1].index;
  if (firstIndex === undefined || secondIndex === undefined) return null;
  const firstBreak = enclosingParagraph(source, firstIndex);
  const secondBreak = enclosingParagraph(source, secondIndex);
  if (!firstBreak || !secondBreak) return null;
  const finalSectionIndex = sectionProperties.at(-1)?.index ?? source.length;
  return [
    { start, end: firstBreak.start },
    { start: firstBreak.end, end: secondBreak.start },
    { start: secondBreak.end, end: finalSectionIndex },
  ];
}

function stripPreviousLetterImageParagraphs(section: string) {
  return section.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) =>
    /<wp:docPr\b[^>]*\bname="(?:Bewerbungsfoto (?:1\d|[2-9]\d+)|Anschreiben Bild \d+)"/.test(paragraph)
      ? ""
      : paragraph,
  );
}

function insertAfterSalutation(section: string, salutation: string, content: string) {
  if (!content) return section;
  const target = normalizedText(salutation || "Guten Tag");
  const paragraphs = [...section.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
  const match = paragraphs.find((candidate) => {
    const text = visibleText(candidate[0]);
    return text === target || (target.length >= 3 && text.includes(target));
  });
  if (!match || match.index === undefined) return `${content}${section}`;
  const end = match.index + match[0].length;
  return `${section.slice(0, end)}${content}${section.slice(end)}`;
}

function imageAnchorParagraph({
  image,
  asset,
  relationshipId,
  mediaIndex,
  contentLeftMm,
  contentTopMm,
  contentWidthMm,
}: {
  image: LetterFlowImage;
  asset: ImageAsset;
  relationshipId: string;
  mediaIndex: number;
  contentLeftMm: number;
  contentTopMm: number;
  contentWidthMm: number;
}) {
  const geometry = normalizeLetterImageGeometry(image, contentWidthMm);
  const heightMm = Math.max(1, geometry.widthMm / Math.max(0.05, asset.aspect));
  const free = geometry.placement === "free";
  const xMm = free ? contentLeftMm + geometry.xMm : geometry.xMm;
  const yMm = free ? contentTopMm + geometry.topMm : geometry.topMm;
  const horizontalFrom = free ? "page" : "column";
  const verticalFrom = free ? "page" : "paragraph";
  const distance = free ? 0 : emu(geometry.gapMm);
  const wrap = free
    ? "<wp:wrapNone/>"
    : `<wp:wrapSquare wrapText="${geometry.placement === "left" ? "right" : "left"}"/>`;
  const cx = emu(geometry.widthMm);
  const cy = emu(heightMm);
  const docPrId = 9100 + mediaIndex;

  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="${distance}" distB="${distance}" distL="${distance}" distR="${distance}" simplePos="0" relativeHeight="251659000" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="${horizontalFrom}"><wp:posOffset>${emu(xMm)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="${verticalFrom}"><wp:posOffset>${emu(yMm)}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${wrap}<wp:docPr id="${docPrId}" name="Anschreiben Bild ${mediaIndex + 1}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="letter-flow-image-${mediaIndex + 1}.${asset.extension}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
}

function ensureContentType(source: string, extension: string, contentType: string) {
  const pattern = new RegExp(`<Default\\s+Extension="${extension}"\\b`, "i");
  if (pattern.test(source)) return source;
  return source.replace(
    "</Types>",
    `<Default Extension="${extension}" ContentType="${contentType}"/></Types>`,
  );
}

function removePreviousRelationships(source: string) {
  const pattern = new RegExp(
    `<Relationship\\b[^>]*\\bId="${LETTER_REL_PREFIX}\\d+"[^>]*/>`,
    "g",
  );
  return source.replace(pattern, "");
}

function appendRelationship(source: string, id: string, target: string) {
  return source.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${IMAGE_REL_TYPE}" Target="${target}"/></Relationships>`,
  );
}

function textEntry(entries: StoredDocxEntry[], name: string) {
  return entries.find((entry) => entry.name === name);
}

/**
 * Final document-level image pass. Every template family feeds through here,
 * so Web/PDF/DOCX share one letter-image geometry instead of 39 recipe hacks.
 */
export async function applyLetterImagesToDocx(blob: Blob, letter: LetterPdfDocument) {
  const images = (letter.data.images ?? [])
    .map((image) => ({ image, asset: dataUrlAsset(image.src) }))
    .filter((item): item is { image: LetterFlowImage; asset: ImageAsset } => !!item.asset);

  return transformStoredDocxEntries(
    blob,
    (entries) => {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const documentEntry = textEntry(entries, "word/document.xml");
      const relsEntry = textEntry(entries, "word/_rels/document.xml.rels");
      const typesEntry = textEntry(entries, "[Content_Types].xml");
      if (!documentEntry || !relsEntry || !typesEntry) {
        throw new Error("DOCX Bildplatzierung: Paketstruktur unvollständig.");
      }

      let documentXml = decoder.decode(documentEntry.bytes);
      const bounds = dossierSections(documentXml);
      if (!bounds) throw new Error("DOCX Bildplatzierung: Dossierabschnitte fehlen.");

      const letterBounds = bounds[1];
      let letterSection = stripPreviousLetterImageParagraphs(
        documentXml.slice(letterBounds.start, letterBounds.end),
      );

      let relsXml = removePreviousRelationships(decoder.decode(relsEntry.bytes));
      let typesXml = decoder.decode(typesEntry.bytes);
      const keptEntries = entries.filter((entry) => !entry.name.startsWith(LETTER_MEDIA_PREFIX));

      if (images.length) {
        const geometry = letterPageGeometry(letter.data, letter.design, {
          pageIndex: 0,
          finalPage: true,
        });
        const anchors = images
          .map(({ image, asset }, index) => {
            const relationshipId = `${LETTER_REL_PREFIX}${index + 1}`;
            const fileName = `letter-flow-image-${index + 1}.${asset.extension}`;
            relsXml = appendRelationship(relsXml, relationshipId, `media/${fileName}`);
            typesXml = ensureContentType(typesXml, asset.extension, asset.contentType);
            keptEntries.push({ name: `word/media/${fileName}`, bytes: asset.bytes });
            return imageAnchorParagraph({
              image,
              asset,
              relationshipId,
              mediaIndex: index,
              contentLeftMm: geometry.content.left,
              contentTopMm: geometry.content.top,
              contentWidthMm: geometry.content.width,
            });
          })
          .join("");
        letterSection = insertAfterSalutation(letterSection, letter.data.anrede, anchors);
      }

      documentXml =
        documentXml.slice(0, letterBounds.start) +
        letterSection +
        documentXml.slice(letterBounds.end);
      documentEntry.bytes = encoder.encode(documentXml);
      relsEntry.bytes = encoder.encode(relsXml);
      typesEntry.bytes = encoder.encode(typesXml);
      return keptEntries;
    },
    "DOCX Anschreiben-Bilder",
  );
}
