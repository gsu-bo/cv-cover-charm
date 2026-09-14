import { transformStoredDocxDocumentXml } from "@/lib/dossier-docx-package";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";
import { createDossierDocxBlob as createStudio2DossierDocxBlob } from "@/lib/dossier-docx-templates/studio2";

function hex(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function wordColor(value: string) {
  return value.replace("#", "").toUpperCase();
}

function colorChannels(value: string, fallback: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  return [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
}

function weightedColor(parts: Array<[string, number]>) {
  const channels = parts.map(([color, weight]) => [colorChannels(color, "#000000"), weight] as const);
  const rgb = [0, 1, 2].map((channel) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(
          channels.reduce((sum, [values, weight]) => sum + values[channel] * weight, 0),
        ),
      ),
    ),
  );
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function vmlStyle(x: number, y: number, width: number, height: number, z: number) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${width}mm;height:${height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function replaceShapeBlock(source: string, id: string, replacement: string) {
  const pattern = new RegExp(
    `<v:(rect|oval|roundrect|shape)\\b([^>]*\\bid="${regexEscape(id)}"[^>]*)>[\\s\\S]*?<\\/v:\\1>`,
  );
  return source.replace(pattern, replacement);
}

function widenShapeStyle(source: string, id: string, widthMm: number) {
  const pattern = new RegExp(`(\\bid="${regexEscape(id)}"[^>]*\\bstyle=")([^"]+)("[^>]*>)`);
  return source.replace(pattern, (_match, before: string, style: string, after: string) => {
    const next = style.replace(/width:[0-9.]+mm;/, `width:${widthMm}mm;`);
    return `${before}${next}${after}`;
  });
}

function transformSection(source: string, index: number, transform: (segment: string) => string) {
  const ends = [...source.matchAll(/<\/w:sectPr>/g)].map(
    (match) => (match.index ?? 0) + match[0].length,
  );
  if (index > ends.length) return source;
  const start = index === 0 ? 0 : ends[index - 1];
  const end = index < ends.length ? ends[index] : source.length;
  return source.slice(0, start) + transform(source.slice(start, end)) + source.slice(end);
}

function roundCoverSignal(source: string, documents: DossierDocxDocuments) {
  if (documents.cover.data.foto) return source;

  const secondary = hex(documents.cover.colors?.secondary, "#f2c84b");
  const path = "m 0,0 l 1000,0 1000,1000 190,1000 c 85,1000 0,915 0,810 l 0,0 x e";
  const signal = `<v:shape id="studio2-cover-signal" coordorigin="0,0" coordsize="1000,1000" path="${path}" style="${vmlStyle(124, 0, 86, 96, -251658239)}" fillcolor="${secondary}" stroked="f"></v:shape>`;

  return transformSection(source, 0, (segment) => {
    const navyUnderlay = widenShapeStyle(segment, "studio2-cover-rail", 210);
    return replaceShapeBlock(navyUnderlay, "studio2-cover-signal", signal);
  });
}

function softenCvSecondaryText(source: string, documents: DossierDocxDocuments) {
  const primary = hex(
    documents.cv.design.colors?.primary ?? documents.cover.colors?.primary,
    "#202a3b",
  );
  const paper = hex(
    documents.cv.design.colors?.bg ?? documents.cover.colors?.bg,
    "#fbfbf8",
  );
  const primaryWord = wordColor(primary);
  const mutedWord = wordColor(weightedColor([[primary, 0.7], [paper, 0.3]]));
  const primaryPattern = new RegExp(`<w:color w:val="${regexEscape(primaryWord)}"\\/>`, "g");

  return transformSection(source, 2, (segment) =>
    segment.replace(/<w:r>([\s\S]*?)<\/w:r>/g, (run) => {
      if (/<w:b(?:\s*\/|>)/.test(run) || /<w:bCs(?:\s*\/|>)/.test(run)) return run;
      return run.replace(primaryPattern, `<w:color w:val="${mutedWord}"/>`);
    }),
  );
}

export async function createDossierDocxBlob(documents: DossierDocxDocuments) {
  const base = await createStudio2DossierDocxBlob(documents);
  return transformStoredDocxDocumentXml(
    base,
    (xml) => softenCvSecondaryText(roundCoverSignal(xml, documents), documents),
    "Studio 2 DOCX refined PDF parity",
  );
}
