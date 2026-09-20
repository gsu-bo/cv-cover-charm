import type { DossierDocxV2CoverNode } from "@/lib/dossier-docx-v2-cover-scene";
import type { CoverPdfDocument } from "@/lib/dossier-pdf-document";
import {
  transformStoredDocxEntries,
  type StoredDocxEntry,
} from "@/lib/dossier-docx-package";
import { buildDossierDocxV2CoverScene } from "@/lib/dossier-docx-v2-cover-scene";
import {
  assertDossierDocxV2CoverAccepted,
  auditDossierDocxV2Cover,
} from "@/lib/dossier-docx-v2-cover-qa";
import {
  renderDossierDocxV2CoverScene,
  type DossierDocxV2MediaRef,
} from "@/lib/dossier-docx-v2-cover-renderer";
import {
  dossierDocxV2DataUrlImageAsset,
  dossierDocxV2SvgImageAsset,
  type DossierDocxV2ImageAsset,
} from "@/lib/dossier-docx-v2-image-asset";

const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const MEDIA_PREFIX = "word/media/docx-v2-cover-";
const REL_PREFIX = "rIdDocxV2Cover";

function initials(cover: CoverPdfDocument) {
  return [cover.data.vorname, cover.data.nachname]
    .map((value) => value.trim().charAt(0))
    .filter(Boolean)
    .join("")
    .toUpperCase();
}

type CoverBounds = {
  bodyContentStart: number;
  firstSectionParagraphStart: number;
};

/** Find the first Word section without assuming the renderer that created it. */
function coverBounds(source: string): CoverBounds | null {
  const body = /<w:body(?:\s[^>]*)?>/.exec(source);
  if (!body || body.index === undefined) return null;
  const bodyContentStart = body.index + body[0].length;
  const section = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/.exec(source.slice(bodyContentStart));
  if (!section || section.index === undefined) return null;
  const sectionIndex = bodyContentStart + section.index;
  const beforeSection = source.slice(bodyContentStart, sectionIndex);
  const paragraphStarts = [...beforeSection.matchAll(/<w:p(?:\s[^>]*)?>/g)];
  const paragraph = paragraphStarts.at(-1);
  if (!paragraph || paragraph.index === undefined) return null;
  return {
    bodyContentStart,
    firstSectionParagraphStart: bodyContentStart + paragraph.index,
  };
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function svgPathAsset(node: DossierDocxV2CoverNode) {
  const from = node.gradient?.from ?? node.fill ?? node.color;
  const to = node.gradient?.to ?? from;
  const angle = ((node.gradient?.angle ?? 135) * Math.PI) / 180;
  const x1 = 50 - Math.sin(angle) * 50;
  const y1 = 50 + Math.cos(angle) * 50;
  const x2 = 50 + Math.sin(angle) * 50;
  const y2 = 50 - Math.cos(angle) * 50;
  const gradient = node.gradient
    ? `<defs><linearGradient id="g" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="${node.gradient.start}%" stop-color="${from}"/><stop offset="${node.gradient.end}%" stop-color="${to}"/></linearGradient></defs>`
    : "";
  const fill = node.fill || node.gradient ? (node.gradient ? "url(#g)" : from) : "none";
  const strokeWidth = Math.max(0.1, (node.strokeWidth / Math.max(node.width, 0.1)) * 100);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${node.width}mm" height="${node.height}mm" viewBox="0 0 100 100" preserveAspectRatio="none">${gradient}<path d="${escapeAttribute(node.path ?? "")}" fill="${fill}" stroke="${node.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  return dossierDocxV2SvgImageAsset(svg, node.width / Math.max(node.height, 0.1));
}

type PreparedMedia = {
  nodeId: string;
  relationshipId: string;
  fileName: string;
  asset: DossierDocxV2ImageAsset;
};

async function prepareMedia(cover: CoverPdfDocument) {
  const rendered =
    typeof document === "undefined"
      ? (() => {
          const scene = buildDossierDocxV2CoverScene(cover);
          return {
            scene,
            structuralBackgroundDataUrl: null,
            qa: auditDossierDocxV2Cover({
              baseline: scene,
              rendered: scene,
              measuredInBrowser: false,
            }),
          };
        })()
      : await import("@/lib/dossier-docx-v2-cover-browser").then(
          ({ resolveDossierDocxV2RenderedCover }) => resolveDossierDocxV2RenderedCover(cover),
        );
  assertDossierDocxV2CoverAccepted(rendered.qa);
  const scene = rendered.scene;
  const prepared: PreparedMedia[] = [];
  if (rendered.structuralBackgroundDataUrl) {
    const asset = await dossierDocxV2DataUrlImageAsset(rendered.structuralBackgroundDataUrl);
    if (!asset) throw new Error("DOCX V2 cover could not package its structural background.");
    prepared.push({
      nodeId: "__structural-background__",
      relationshipId: `${REL_PREFIX}1`,
      fileName: `docx-v2-cover-1.${asset.extension}`,
      asset,
    });
  }
  for (const node of scene.nodes) {
    let asset: DossierDocxV2ImageAsset | null = null;
    if (node.kind === "shape" && node.shape === "path") {
      asset = await svgPathAsset(node);
    } else if (node.mediaDataUrl) {
      asset = await dossierDocxV2DataUrlImageAsset(node.mediaDataUrl);
      if (!asset) {
        throw new Error(`DOCX V2 cover cannot normalize image media for ${node.id}.`);
      }
    }
    if (!asset) continue;
    const index = prepared.length + 1;
    prepared.push({
      nodeId: node.id,
      relationshipId: `${REL_PREFIX}${index}`,
      fileName: `docx-v2-cover-${index}.${asset.extension}`,
      asset,
    });
  }
  return { scene, prepared };
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
  return source.replace(
    new RegExp(`<Relationship\\b[^>]*\\bId="${REL_PREFIX}\\d+"[^>]*/>`, "g"),
    "",
  );
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
 * Replace only section 1 (cover) and preserve the existing section-break
 * paragraph plus letter/CV body. The current production exporter therefore
 * remains the flow engine while V2 is validated as a canonical cover renderer.
 */
export async function applyDossierDocxV2CoverToDocx(blob: Blob, cover: CoverPdfDocument) {
  const { scene, prepared } = await prepareMedia(cover);
  const mediaRef = (item: PreparedMedia): DossierDocxV2MediaRef => ({
    relationshipId: item.relationshipId,
    aspect: item.asset.aspect,
    fileName: item.fileName,
  });
  const backgroundItem = prepared.find((item) => item.nodeId === "__structural-background__");
  const mediaByNodeId = Object.fromEntries(
    prepared
      .filter((item) => item.nodeId !== "__structural-background__")
      .map((item) => [item.nodeId, mediaRef(item)]),
  );

  return transformStoredDocxEntries(
    blob,
    (entries) => {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const documentEntry = textEntry(entries, "word/document.xml");
      const relsEntry = textEntry(entries, "word/_rels/document.xml.rels");
      const typesEntry = textEntry(entries, "[Content_Types].xml");
      if (!documentEntry || !relsEntry || !typesEntry) {
        throw new Error("DOCX V2 cover package structure is incomplete.");
      }

      const source = decoder.decode(documentEntry.bytes);
      const bounds = coverBounds(source);
      if (!bounds) throw new Error("DOCX V2 cover could not resolve the first Word section.");
      const coverXml = renderDossierDocxV2CoverScene(scene, {
        initialsValue: initials(cover),
        mediaByNodeId,
        structuralBackground: backgroundItem ? mediaRef(backgroundItem) : null,
      });
      let documentXml =
        source.slice(0, bounds.bodyContentStart) +
        coverXml +
        source.slice(bounds.firstSectionParagraphStart);
      if (!/\bxmlns:v=/.test(documentXml)) {
        documentXml = documentXml.replace(
          /<w:document\b/,
          '<w:document xmlns:v="urn:schemas-microsoft-com:vml"',
        );
      }

      let relsXml = removePreviousRelationships(decoder.decode(relsEntry.bytes));
      let typesXml = decoder.decode(typesEntry.bytes);
      const keptEntries = entries.filter((entry) => !entry.name.startsWith(MEDIA_PREFIX));
      for (const item of prepared) {
        relsXml = appendRelationship(relsXml, item.relationshipId, `media/${item.fileName}`);
        typesXml = ensureContentType(typesXml, item.asset.extension, item.asset.contentType);
        keptEntries.push({ name: `word/media/${item.fileName}`, bytes: item.asset.bytes });
      }

      documentEntry.bytes = encoder.encode(documentXml);
      relsEntry.bytes = encoder.encode(relsXml);
      typesEntry.bytes = encoder.encode(typesXml);
      return keptEntries;
    },
    "DOCX V2 canonical cover",
  );
}
