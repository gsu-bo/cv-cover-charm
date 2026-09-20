import type {
  DossierDocxV2CvPageArtwork,
  DossierDocxV2CvPhoto,
  DossierDocxV2FlowBlock,
  DossierDocxV2FlowCell,
  DossierDocxV2FlowParagraph,
  DossierDocxV2FlowRun,
  DossierDocxV2FlowTable,
  DossierDocxV2FloatingTextBox,
} from "@/lib/dossier-docx-v2-flow-scene";

const MM_TO_TWIPS = 1440 / 25.4;
const MM_TO_EMU = 36000;

const twips = (mm: number) => Math.max(0, Math.round(mm * MM_TO_TWIPS));
const emu = (mm: number) => Math.round(mm * MM_TO_EMU);

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function wordColor(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : "111111";
}

function runXml(value: DossierDocxV2FlowRun) {
  const halfPoints = Math.max(1, Math.round(value.fontSizePt * 2));
  const properties = [
    `<w:rFonts w:ascii="${xmlEscape(value.font)}" w:hAnsi="${xmlEscape(value.font)}" w:eastAsia="${xmlEscape(value.font)}"/>`,
    `<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`,
    `<w:color w:val="${wordColor(value.color)}"/>`,
    value.bold ? "<w:b/><w:bCs/>" : "",
    value.italic ? "<w:i/><w:iCs/>" : "",
    value.underline ? '<w:u w:val="single"/>' : "",
  ].join("");

  const pieces = value.text.split("\n");
  const content = pieces
    .map((piece, index) => `${index ? "<w:br/>" : ""}<w:t xml:space="preserve">${xmlEscape(piece)}</w:t>`)
    .join("");
  return `<w:r><w:rPr>${properties}</w:rPr>${content}</w:r>`;
}

function paragraphProperties(value: DossierDocxV2FlowParagraph) {
  const properties = [
    `<w:spacing w:before="${twips(value.beforeMm)}" w:after="${twips(value.afterMm)}" w:line="${Math.round(240 * value.lineHeight)}" w:lineRule="auto"/>`,
    `<w:jc w:val="${value.align}"/>`,
    value.keepNext ? "<w:keepNext/>" : "",
    value.keepLines ? "<w:keepLines/>" : "",
    value.pageBreakBefore ? "<w:pageBreakBefore/>" : "",
    value.ruleBottom
      ? `<w:pBdr><w:bottom w:val="single" w:sz="${Math.max(2, Math.round(value.ruleBottom.widthPt * 8))}" w:space="1" w:color="${wordColor(value.ruleBottom.color)}"/></w:pBdr>`
      : "",
    value.background ? `<w:shd w:val="clear" w:color="auto" w:fill="${wordColor(value.background)}"/>` : "",
  ].join("");
  return `<w:pPr>${properties}</w:pPr>`;
}

export function renderDossierDocxV2FlowParagraph(value: DossierDocxV2FlowParagraph) {
  return `<w:p>${paragraphProperties(value)}${value.runs.map(runXml).join("") || "<w:r/>"}</w:p>`;
}

function spacerXml(mm: number) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.max(1, twips(mm))}" w:lineRule="exact"/></w:pPr><w:r/></w:p>`;
}

export function renderDossierDocxV2PageBreak() {
  return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
}

function cellXml(cell: DossierDocxV2FlowCell) {
  const pct = Math.max(1, Math.round(cell.widthPct * 50));
  const pad = twips(cell.paddingMm ?? 0);
  const margins = `<w:tcMar><w:top w:w="${pad}" w:type="dxa"/><w:left w:w="${pad}" w:type="dxa"/><w:bottom w:w="${pad}" w:type="dxa"/><w:right w:w="${pad}" w:type="dxa"/></w:tcMar>`;
  const shade = cell.background ? `<w:shd w:val="clear" w:fill="${wordColor(cell.background)}"/>` : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${pct}" w:type="pct"/><w:vAlign w:val="top"/>${margins}${shade}</w:tcPr>${renderDossierDocxV2FlowBlocks(cell.blocks) || renderDossierDocxV2FlowParagraph({ kind: "paragraph", runs: [], align: "left", beforeMm: 0, afterMm: 0, lineHeight: 1 })}</w:tc>`;
}

function tableXml(value: DossierDocxV2FlowTable) {
  const rows = value.rows
    .map((row) => {
      const height = row.minHeightMm
        ? `<w:trHeight w:val="${twips(row.minHeightMm)}" w:hRule="atLeast"/>`
        : "";
      return `<w:tr><w:trPr>${row.cantSplit ? "<w:cantSplit/>" : ""}${height}</w:trPr>${row.cells.map(cellXml).join("")}</w:tr>`;
    })
    .join("");
  const borders = value.border
    ? `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"]
        .map(
          (edge) =>
            `<w:${edge} w:val="single" w:sz="${Math.max(2, Math.round(value.border!.widthPt * 8))}" w:space="0" w:color="${wordColor(value.border!.color)}"/>`,
        )
        .join("")}</w:tblBorders>`
    : '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
  const table = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/>${borders}</w:tblPr>${rows}</w:tbl>`;
  return value.afterMm > 0 ? `${table}${spacerXml(value.afterMm)}` : table;
}

export function renderDossierDocxV2FlowBlock(block: DossierDocxV2FlowBlock): string {
  if (block.kind === "paragraph") return renderDossierDocxV2FlowParagraph(block);
  if (block.kind === "spacer") return spacerXml(block.mm);
  if (block.kind === "page-break") return renderDossierDocxV2PageBreak();
  return tableXml(block);
}

export function renderDossierDocxV2FlowBlocks(blocks: DossierDocxV2FlowBlock[]) {
  return blocks.map(renderDossierDocxV2FlowBlock).join("");
}

function vmlStyle(box: DossierDocxV2FloatingTextBox) {
  return `position:absolute;margin-left:${box.x}mm;margin-top:${box.y}mm;width:${box.width}mm;height:${box.height}mm;z-index:251658100;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

export function renderDossierDocxV2FloatingTextBox(box: DossierDocxV2FloatingTextBox) {
  const inset = box.insetMm ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const fill = box.background
    ? ` filled="t" fillcolor="#${wordColor(box.background)}"`
    : ' filled="f"';
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" id="docx-v2-flow-${xmlEscape(box.id)}" style="${vmlStyle(box)}"${fill} stroked="f"><v:textbox inset="${inset.left}mm,${inset.top}mm,${inset.right}mm,${inset.bottom}mm"><w:txbxContent>${renderDossierDocxV2FlowBlocks(box.blocks)}</w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>`;
}

function cropRect(photo: DossierDocxV2CvPhoto, imageAspect: number) {
  const frameAspect = photo.width / Math.max(photo.height, 0.1);
  const safeAspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : frameAspect;
  const baseVisibleWidth = safeAspect > frameAspect ? frameAspect / safeAspect : 1;
  const baseVisibleHeight = safeAspect < frameAspect ? safeAspect / frameAspect : 1;
  const zoom = Math.max(1, photo.zoom);
  const visibleWidth = baseVisibleWidth / zoom;
  const visibleHeight = baseVisibleHeight / zoom;
  const xShift = ((zoom - 1) * photo.imageX) / (100 * zoom);
  const yShift = ((zoom - 1) * photo.imageY) / (100 * zoom);
  const left = (1 - baseVisibleWidth) / 2 + xShift * baseVisibleWidth;
  const top = (1 - baseVisibleHeight) / 2 + yShift * baseVisibleHeight;
  const right = 1 - left - visibleWidth;
  const bottom = 1 - top - visibleHeight;
  const pct = (value: number) => Math.max(0, Math.min(100000, Math.round(value * 100000)));
  return { left: pct(left), top: pct(top), right: pct(right), bottom: pct(bottom) };
}

export function renderDossierDocxV2CvPageArtwork(
  artwork: DossierDocxV2CvPageArtwork,
  media: { relationshipId: string; fileName: string },
) {
  const cx = emu(artwork.width);
  const cy = emu(artwork.height);
  const docPrId = 15800 + Math.max(0, artwork.pageIndex);
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="1" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${emu(artwork.x)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(artwork.y)}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${docPrId}" name="DOCX V2 CV artwork page ${artwork.pageIndex + 1}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${xmlEscape(media.fileName)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${media.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
}

export function renderDossierDocxV2CvPhoto(
  photo: DossierDocxV2CvPhoto,
  media: { relationshipId: string; fileName: string; aspect: number },
) {
  const crop = cropRect(photo, media.aspect);
  const cx = emu(photo.width);
  const cy = emu(photo.height);
  const geometry = photo.shape === "circle" ? "ellipse" : photo.shape === "portrait" || photo.shape === "rect" || photo.shape === "square" ? "roundRect" : "rect";
  const line =
    photo.borderWidth > 0
      ? `<a:ln w="${Math.max(1, emu(photo.borderWidth))}"><a:solidFill><a:srgbClr val="${wordColor(photo.borderColor)}"/></a:solidFill></a:ln>`
      : "<a:ln><a:noFill/></a:ln>";
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659100" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${emu(photo.x)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(photo.y)}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="15901" name="DOCX V2 CV photo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><pic:nvPicPr><pic:cNvPr id="15901" name="${xmlEscape(media.fileName)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${media.relationshipId}"/><a:srcRect l="${crop.left}" t="${crop.top}" r="${crop.right}" b="${crop.bottom}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>${line}</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
}

export const dossierDocxV2FlowRendererInternals = {
  wordColor,
  cropRect,
  tableXml,
};
