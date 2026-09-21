import { FRAME } from "@/default-config";
import type { DossierDocxV2CoverNode, DossierDocxV2CoverScene } from "@/lib/dossier-docx-v2-cover-scene";

const MM_TO_EMU = 36000;
const PX_TO_MM = 25.4 / 96;
const ptToTwips = (pt: number) => Math.max(1, Math.round(pt * 20));
const halfPoints = (pt: number) => Math.max(2, Math.round(pt * 2));
const emu = (mm: number) => Math.round(mm * MM_TO_EMU);
const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const wordHex = (value: string) => value.replace(/^#/, "").toUpperCase();

export type DossierDocxV2MediaRef = {
  relationshipId: string;
  aspect: number;
  fileName: string;
};

function vmlStyle(node: Pick<DossierDocxV2CoverNode, "x" | "y" | "width" | "height">, z: number) {
  return `position:absolute;margin-left:${node.x}mm;margin-top:${node.y}mm;width:${node.width}mm;height:${node.height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function fillXml(node: DossierDocxV2CoverNode) {
  if (node.gradient) {
    const angle = ((360 - node.gradient.angle) % 360 + 360) % 360;
    return `<v:fill type="gradient" angle="${angle}" colors="${node.gradient.start}% ${node.gradient.from};${node.gradient.end}% ${node.gradient.to}" opacity="${Math.round(node.opacity * 100)}%"/>`;
  }
  return node.opacity < 0.999 ? `<v:fill opacity="${Math.round(node.opacity * 100)}%"/>` : "";
}

function paragraphAlignment(value: DossierDocxV2CoverNode["align"]) {
  return value === "right" ? "right" : value === "center" ? "center" : value === "justify" ? "both" : "left";
}

function runXml(node: DossierDocxV2CoverNode, text: string, color: string, weight: number) {
  const spacing = Math.round(node.trackingEm * node.fontSizePt * 20);
  return `<w:r><w:rPr><w:rFonts w:ascii="${xmlEscape(node.font)}" w:hAnsi="${xmlEscape(node.font)}"/><w:sz w:val="${halfPoints(node.fontSizePt)}"/><w:szCs w:val="${halfPoints(node.fontSizePt)}"/><w:color w:val="${wordHex(color)}"/>${weight >= 600 ? "<w:b/><w:bCs/>" : ""}${node.italic ? "<w:i/><w:iCs/>" : ""}${node.underline ? '<w:u w:val="single"/>' : ""}${spacing ? `<w:spacing w:val="${spacing}"/>` : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function textParagraphs(node: DossierDocxV2CoverNode) {
  const lineTwips = ptToTwips(node.fontSizePt * node.lineHeight);
  return node.lines
    .map((line) => {
      const runs = line.runs.map((run) => runXml(node, run.text, run.color, run.weight)).join("");
      return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${lineTwips}" w:lineRule="atLeast"/><w:jc w:val="${paragraphAlignment(node.align)}"/></w:pPr>${runs}</w:p>`;
    })
    .join("");
}

function badgeShapes(node: DossierDocxV2CoverNode, z: number) {
  return node.badgeRects
    .map((badge, index) => {
      const tag = badge.radius > 0 ? "roundrect" : "rect";
      const arcsize =
        tag === "roundrect"
          ? ` arcsize="${badge.radius >= 999 ? "50%" : Math.min(50, (badge.radius / Math.max(badge.width, 0.1)) * 100) + "%"}"`
          : "";
      return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:${tag} id="docx-v2-${xmlEscape(node.id)}-badge-${index + 1}" style="${vmlStyle(badge, z - 2 - index)}" fillcolor="${badge.color}" stroked="f"${arcsize}/></w:pict></w:r></w:p>`;
    })
    .join("");
}

function textboxShape(node: DossierDocxV2CoverNode, z: number) {
  const background = node.background;
  const hasBackground = !!background && node.badgeRects.length === 0;
  const cornerRadius = hasBackground ? node.backgroundRadius : node.boxRadius;
  const tag = cornerRadius > 0 ? "roundrect" : "rect";
  const fill = hasBackground ? ` fillcolor="${background}"` : ' filled="f"';
  const arcsize = tag === "roundrect" ? ` arcsize="${cornerRadius >= 999 ? "50%" : "8%"}"` : "";
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:${tag} id="docx-v2-${xmlEscape(node.id)}" style="${vmlStyle(node, z)};v-text-anchor:top"${fill} stroked="${node.borderWidth > 0 ? "t" : "f"}"${node.borderWidth > 0 ? ` strokecolor="${node.borderColor}" strokeweight="${node.borderWidth}mm"` : ""}${arcsize}><v:textbox inset="${node.padX}mm,${node.padY}mm,${node.padX}mm,${node.padY}mm"><w:txbxContent>${textParagraphs(node)}</w:txbxContent></v:textbox></v:${tag}></w:pict></w:r></w:p>`;
}

function shapeXml(node: DossierDocxV2CoverNode, z: number) {
  if (node.shape === "path") return "";
  const isLine = node.shape === "line";
  const tag = node.shape === "circle" ? "oval" : "rect";
  const height = isLine ? Math.max(node.strokeWidth, 0.2) : node.height;
  const styleNode = { ...node, height };
  const fill = isLine ? (node.gradient?.from ?? node.color) : (node.fill ?? node.color);
  const border = !isLine && node.strokeWidth > 0;
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:${tag} id="docx-v2-${xmlEscape(node.id)}" style="${vmlStyle(styleNode, z)}" fillcolor="${fill}" stroked="${border ? "t" : "f"}"${border ? ` strokecolor="${node.color}" strokeweight="${node.strokeWidth}mm"` : ""}>${fillXml(node)}</v:${tag}></w:pict></w:r></w:p>`;
}

function initials(node: DossierDocxV2CoverNode, value: string, z: number) {
  const tag = node.radius >= 999 ? "oval" : node.radius > 0 ? "roundrect" : "rect";
  const fill = node.fill ?? "#ffffff";
  const textNode: DossierDocxV2CoverNode = {
    ...node,
    lines: [{ runs: [{ text: value, color: node.color, weight: Math.max(600, node.fontWeight) }] }],
    align: "center",
    padX: 0,
    padY: Math.max(0, (node.height - node.fontSizePt * 0.3528) / 2),
  };
  const arcsize = tag === "roundrect" ? ` arcsize="${Math.min(50, (node.radius / Math.max(node.width, 0.1)) * 100)}%"` : "";
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:${tag} id="docx-v2-${xmlEscape(node.id)}" style="${vmlStyle(node, z)};v-text-anchor:middle" fillcolor="${fill}" stroked="${node.borderWidth > 0 ? "t" : "f"}"${node.borderWidth > 0 ? ` strokecolor="${node.borderColor}" strokeweight="${node.borderWidth}mm"` : ""}${arcsize}><v:textbox inset="0,0,0,0"><w:txbxContent>${textParagraphs(textNode)}</w:txbxContent></v:textbox></v:${tag}></w:pict></w:r></w:p>`;
}

function cropRect(node: DossierDocxV2CoverNode, imageAspect: number) {
  const frameAspect = node.width / Math.max(node.height, 0.1);
  const safeAspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : frameAspect;
  const baseVisibleWidth = safeAspect > frameAspect ? frameAspect / safeAspect : 1;
  const baseVisibleHeight = safeAspect < frameAspect ? safeAspect / frameAspect : 1;
  const zoom = Math.max(1, node.imageZoom);
  const visibleWidth = baseVisibleWidth / zoom;
  const visibleHeight = baseVisibleHeight / zoom;
  const xShift = ((zoom - 1) * node.imageX) / (100 * zoom);
  const yShift = ((zoom - 1) * node.imageY) / (100 * zoom);
  const left = (1 - baseVisibleWidth) / 2 + xShift * baseVisibleWidth;
  const top = (1 - baseVisibleHeight) / 2 + yShift * baseVisibleHeight;
  const right = 1 - left - visibleWidth;
  const bottom = 1 - top - visibleHeight;
  const pct = (value: number) => Math.max(0, Math.min(100000, Math.round(value * 100000)));
  return { left: pct(left), top: pct(top), right: pct(right), bottom: pct(bottom) };
}

function imageMat(node: DossierDocxV2CoverNode, paperColor: string, z: number) {
  if (node.borderWidth <= 0) return "";
  const gap = FRAME.GAP_PX * PX_TO_MM;
  const radius = node.kind === "text" ? node.boxRadius : node.radius;
  const shape = radius >= 999 ? "oval" : radius > 0 ? "roundrect" : "rect";
  const mat = {
    x: node.x - gap,
    y: node.y - gap,
    width: node.width + gap * 2,
    height: node.height + gap * 2,
  };
  const arcsize = shape === "roundrect" ? ` arcsize="${Math.min(50, (radius / Math.max(node.width, 0.1)) * 100)}%"` : "";
  return `<w:r><w:pict><v:${shape} id="docx-v2-${xmlEscape(node.id)}-mat" style="${vmlStyle(mat, z)}" fillcolor="${paperColor}" stroked="t" strokecolor="${node.borderColor}" strokeweight="${node.borderWidth}mm"${arcsize}/></w:pict></w:r>`;
}

function imageAnchor(node: DossierDocxV2CoverNode, media: DossierDocxV2MediaRef, z: number) {
  const crop = cropRect(node, media.aspect);
  const cx = emu(node.width);
  const cy = emu(node.height);
  const docPrId = Math.max(1, 12000 + Math.abs(z % 10000));
  const radius = node.kind === "text" ? node.boxRadius : node.radius;
  const geometry = radius >= 999 ? "ellipse" : radius > 0 ? "roundRect" : "rect";
  const alpha = Math.max(0, Math.min(100000, Math.round(node.opacity * 100000)));
  const relativeHeight = z < 0 ? Math.max(1, z + 251659000) : Math.min(251659999, z);
  const behindDoc = z < 0 ? 1 : 0;
  return `<w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${relativeHeight}" behindDoc="${behindDoc}" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${emu(node.x)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${emu(node.y)}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${docPrId}" name="DOCX V2 ${xmlEscape(node.id)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${xmlEscape(media.fileName)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${media.relationshipId}">${alpha < 100000 ? `<a:alphaModFix amt="${alpha}"/>` : ""}</a:blip><a:srcRect l="${crop.left}" t="${crop.top}" r="${crop.right}" b="${crop.bottom}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

function imageParagraph(
  node: DossierDocxV2CoverNode,
  media: DossierDocxV2MediaRef,
  paperColor: string,
  z: number,
) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr>${imageMat(node, paperColor, z - 1)}${imageAnchor(node, media, z)}</w:p>`;
}

function structuralBackground(media: DossierDocxV2MediaRef) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:rect id="docx-v2-cover-structural-background" style="position:absolute;margin-left:0mm;margin-top:0mm;width:210mm;height:297mm;z-index:-251658240;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" stroked="f"><v:imagedata xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${media.relationshipId}"/></v:rect></w:pict></w:r></w:p>`;
}

function paper(scene: DossierDocxV2CoverScene) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:rect id="docx-v2-cover-paper" style="position:absolute;margin-left:0mm;margin-top:0mm;width:210mm;height:297mm;z-index:-251658241;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" fillcolor="${scene.paperColor}" stroked="f"/></w:pict></w:r></w:p>`;
}

/** Pure OOXML renderer. Package/media relationships are injected by the adapter. */
export function renderDossierDocxV2CoverScene(
  scene: DossierDocxV2CoverScene,
  options: {
    initialsValue?: string;
    mediaByNodeId?: Readonly<Record<string, DossierDocxV2MediaRef>>;
    structuralBackground?: DossierDocxV2MediaRef | null;
  } = {},
) {
  const mediaByNodeId = options.mediaByNodeId ?? {};
  const body = scene.nodes
    .map((node, index) => {
      const z =
        node.layer === "decor"
          ? -251658000 + index
          : node.layer === "back"
            ? -100000 + index
            : node.layer === "front"
              ? 251658000 + index
              : 251657000 + index;
      const media = mediaByNodeId[node.id];
      if (node.kind === "shape") {
        return node.shape === "path" && media
          ? imageParagraph(node, media, scene.paperColor, z)
          : shapeXml(node, z);
      }
      if (node.kind === "text") {
        const image = media ? imageParagraph(node, media, scene.paperColor, z - 4) : "";
        return `${image}${badgeShapes(node, z)}${textboxShape(node, z)}`;
      }
      if (media) return imageParagraph(node, media, scene.paperColor, z);
      if (node.kind === "photo" && options.initialsValue) return initials(node, options.initialsValue, z);
      return "";
    })
    .join("");
  return `${paper(scene)}${options.structuralBackground ? structuralBackground(options.structuralBackground) : ""}${body}`;
}
