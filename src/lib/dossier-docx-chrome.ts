import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";
import {
  dossierHeaderVisualHeightMmForOptions,
  dossierFooterVisualHeightMmForOptions,
  hasReducedContinuationHeader,
} from "@/lib/dossier-chrome";
import type { DossierDocxDocuments } from "@/lib/dossier-docx-template-types";
import type { ResolvedDossierChrome } from "@/lib/dossier-resolved-chrome";
import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  writeStoredDocxEntries,
} from "@/lib/dossier-docx-package";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const twips = (mm: number) => Math.round((mm * 1440) / 25.4);
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const color = (value: string | null | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value ?? "") ? value!.slice(1).toUpperCase() : fallback;
function ink(background: string) {
  const rgb = [0, 2, 4].map((offset) => parseInt(background.slice(offset, offset + 2), 16));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 148 ? "111111" : "FFFFFF";
}
function paragraph(text: string, foreground: string, bold = false) {
  return `<w:p><w:pPr><w:spacing w:after="0" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin"/><w:sz w:val="16"/><w:color w:val="${foreground}"/>${bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
}
function band(id: string, background: string, y: number, height: number) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:rect id="${id}" style="position:absolute;margin-left:0mm;margin-top:${y}mm;width:210mm;height:${height}mm;z-index:251658240;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" fillcolor="#${background}" stroked="f"/></w:pict></w:r></w:p>`;
}
function part(kind: "header" | "footer", body: string) {
  const tag = kind === "header" ? "hdr" : "ftr";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="${W}" xmlns:r="${R}" xmlns:v="urn:schemas-microsoft-com:vml">${body || "<w:p/>"}</w:${tag}>`;
}
function header(
  options: DossierChromeOptions,
  contact: DossierChromeContact,
  colors: Record<string, string>,
  page: number,
) {
  if (options.headerMode === "none") return part("header", "");
  const background = color(
    options.headerBackgroundColor ?? colors.primary ?? colors.accent,
    "111111",
  );
  let body = band(
    `semantic-header-${page}`,
    background,
    0,
    dossierHeaderVisualHeightMmForOptions(options, page),
  );
  if (options.headerMode === "contact") {
    const reduced = hasReducedContinuationHeader(options, page);
    const lines = [
      options.headerShowName && contact.name,
      !reduced && options.headerShowAddress && contact.address,
      !reduced && options.headerShowAddress && contact.place,
      options.headerShowPhone && contact.phone,
      options.headerShowEmail && contact.email,
    ].filter((value): value is string => !!value);
    const inline = reduced || options.headerTextLayout === "inline";
    body += (inline ? [lines.join(" · ")] : lines)
      .map((line) =>
        paragraph(
          line,
          ink(background),
          !inline && options.headerShowName && line === contact.name,
        ),
      )
      .join("");
  }
  return part("header", body);
}
function footer(options: DossierChromeOptions, colors: Record<string, string>, text: string) {
  if (options.footerMode === "none") return part("footer", "");
  const background = color(
    options.footerBackgroundColor ?? colors.accent ?? colors.secondary,
    "4B5563",
  );
  const height = dossierFooterVisualHeightMmForOptions(options);
  return part(
    "footer",
    band("semantic-footer", background, 297 - height, height) +
      (options.footerMode === "details" ? paragraph(text, ink(background)) : ""),
  );
}
function finalPageDetailsFooter(
  options: DossierChromeOptions,
  colors: Record<string, string>,
  text: string,
) {
  if (!text) return "";
  const background = color(
    options.footerBackgroundColor ?? colors.accent ?? colors.secondary,
    "4B5563",
  );
  const height = dossierFooterVisualHeightMmForOptions(options);
  const foreground = ink(background);
  return (
    band("semantic-footer-final", background, 297 - height, height).replace(
      "<v:rect ",
      '<v:rect xmlns:v="urn:schemas-microsoft-com:vml" ',
    ) +
    `<w:p><w:pPr><w:framePr w:w="${twips(170)}" w:h="${twips(Math.max(4, height - 4))}" w:hAnchor="page" w:vAnchor="page" w:x="${twips(20)}" w:y="${twips(297 - height + 2)}" w:wrap="none" w:hRule="atLeast"/><w:spacing w:after="0" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin"/><w:sz w:val="16"/><w:color w:val="${foreground}"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`
  );
}
const paragraphText = (xml: string) =>
  [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("");
function removeText(source: string, text: string) {
  if (!text) return source;
  let removed = false;
  return source.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (
      removed ||
      /<w:(?:pict|drawing)\b/.test(paragraph) ||
      paragraphText(paragraph) !== escape(text)
    )
      return paragraph;
    removed = true;
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr></w:p>';
  });
}

/**
 * The reviewed Warm recipe predates native Word header/footer parts, so its
 * first-page masthead and edge footer still live in document.xml. Treat those
 * named drawings as semantic surfaces here. The recipe's full-page paper sits
 * above Word header/footer layers, so its masthead supplies the visible surface
 * for compact/contact and its edge supplies compact. Native parts still own all
 * text and continuation behavior. None removes the surface; details replaces
 * the compact edge with its final-page semantic band.
 */
const WARM_RECIPE_SURFACES = {
  letter: {
    header: ["warm-letter-masthead", "warm-letter-ring", "warm-letter-orb"],
    footer: ["warm-letter-footer"],
  },
  cv: {
    header: ["warm-cv-top-band", "warm-cv-orb"],
    footer: ["warm-cv-bottom-band"],
  },
} as const;

function removeDrawingRuns(source: string, ids: readonly string[]) {
  let result = source;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(
        `<w:r><w:pict><v:(?:shape|rect|oval|roundrect)[^>]*\\bid="${escaped}"[\\s\\S]*?</w:pict></w:r>`,
      ),
      "",
    );
  }
  return result;
}

/** Attach native Word section chrome after the established recipe pipeline. */
export async function applyDossierChromeToDocx(
  blob: Blob,
  documents: DossierDocxDocuments,
  resolved: ResolvedDossierChrome,
) {
  const entries = readStoredDocxEntries(new Uint8Array(await blob.arrayBuffer()), "Dossier chrome");
  const decoder = new TextDecoder(),
    encoder = new TextEncoder();
  const get = (name: string) => {
    const entry = entries.find((item) => item.name === name);
    if (!entry) throw new Error(`DOCX part missing: ${name}`);
    return decoder.decode(entry.bytes);
  };
  const set = (name: string, value: string) => {
    const entry = entries.find((item) => item.name === name);
    if (entry) entry.bytes = encoder.encode(value);
    else entries.push({ name, bytes: encoder.encode(value) });
  };
  let xml = get("word/document.xml"),
    rels = get("word/_rels/document.xml.rels"),
    types = get("[Content_Types].xml");
  const sections = [...xml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)];
  if (sections.length !== 3)
    throw new Error("Dossier chrome requires cover, letter and CV sections");
  for (const [index, scope] of [
    [2, "cv"],
    [1, "letter"],
  ] as const) {
    const { options, contact } = resolved[scope];
    const document = documents[scope],
      section = sections[index];
    const start = sections[index - 1].index! + sections[index - 1][0].length;
    let content = xml.slice(start, section.index);
    let properties = section[0]
      .replace(/<w:pgBorders\b[^>]*>[\s\S]*?<\/w:pgBorders>/g, "")
      .replace(/<w:(?:headerReference|footerReference|titlePg)\b[^>]*\/>/g, "");
    const references: string[] = [];
    const warmRecipe = String(document.design.template) === "freundlich";
    if (warmRecipe) {
      const surfaces = WARM_RECIPE_SURFACES[scope];
      if (options.footerMode !== "compact") {
        content = removeDrawingRuns(content, surfaces.footer);
      }
      if (options.headerMode === "none") {
        content = removeDrawingRuns(content, surfaces.header);
      }
    }
    for (const [kind, variant, page] of [
      ["header", "default", 1],
      ["header", "first", 0],
      ["footer", "default", 0],
      ["footer", "first", 0],
    ] as const) {
      const id = `rIdSemantic${scope}${kind}${variant}`,
        name = `${kind}-${scope}-${variant}.xml`;
      const attachments =
        documents.letter.data.showBeilagen !== false
          ? (documents.letter.data.beilagen ?? []).filter((value) => value.trim())
          : [];
      const text =
        scope === "letter"
          ? attachments.length
            ? `Beilagen   ${attachments.join(" · ")}`
            : ""
          : contact.name;
      set(
        `word/${name}`,
        kind === "header"
          ? warmRecipe && options.headerMode === "compact" && variant === "first"
            ? part("header", "")
            : header(
                options,
                contact,
                document.design.colors,
                options.headerDifferentFirstPage === false ? 0 : page,
              )
          : footer(
              scope === "letter" && options.footerMode === "details"
                ? { ...options, footerMode: "compact", footerHeightMm: null }
                : options,
              document.design.colors,
              scope === "letter" ? "" : text,
            ),
      );
      rels = rels.replace(
        "</Relationships>",
        `<Relationship Id="${id}" Type="${R}/${kind}" Target="${name}"/></Relationships>`,
      );
      types = types.replace(
        "</Types>",
        `<Override PartName="/word/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}+xml"/></Types>`,
      );
      references.push(`<w:${kind}Reference w:type="${variant}" r:id="${id}"/>`);
    }
    properties = properties.replace(/(<w:sectPr\b[^>]*>)/, `$1${references.join("")}`);
    if (options.headerDifferentFirstPage !== false)
      properties = properties.replace("</w:sectPr>", "<w:titlePg/></w:sectPr>");
    if (scope === "letter" && options.headerMode === "contact") {
      for (const value of [
        documents.letter.data.absenderName,
        documents.letter.data.absenderAdresse,
        documents.letter.data.absenderPlzOrt,
        documents.letter.data.absenderTelefon,
        documents.letter.data.absenderEmail,
      ])
        content = removeText(content, value);
      let reached = false;
      const recipient =
        documents.letter.data.empfaengerFirma || documents.letter.data.empfaengerName;
      content = content.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
        if (recipient && paragraphText(paragraph) === escape(recipient)) reached = true;
        return !reached && !/<w:(?:t|pict|drawing|sectPr)\b/.test(paragraph) ? "" : paragraph;
      });
    }
    if (
      scope === "letter" &&
      options.footerMode === "details" &&
      documents.letter.data.showBeilagen !== false
    ) {
      content = removeText(content, "Beilagen");
      for (const value of documents.letter.data.beilagen ?? [])
        content = removeText(content, value);
      const attachments = (documents.letter.data.beilagen ?? []).filter((value) => value.trim());
      const finalFooter = finalPageDetailsFooter(
        options,
        document.design.colors,
        attachments.length ? `Beilagen   ${attachments.join(" · ")}` : "",
      );
      // The section properties live inside the paragraph that follows the
      // letter content. A page-anchored frame inserted immediately before that
      // paragraph belongs to the final flowed letter page only; Word headers
      // and footers still repeat their compact structural band on earlier pages.
      const sectionParagraph = content.lastIndexOf("<w:p><w:pPr>");
      if (finalFooter && sectionParagraph >= 0) {
        content =
          content.slice(0, sectionParagraph) + finalFooter + content.slice(sectionParagraph);
      }
    }
    if (options.headerMode === "contact") {
      const minTop = twips(
        dossierHeaderVisualHeightMmForOptions(options, 0) + 9 + (options.headerGapMm ?? 12),
      );
      properties = properties.replace(
        /w:top="(\d+)"/,
        (_m, value) => `w:top="${Math.max(Number(value), minTop)}"`,
      );
    }
    properties = properties
      .replace(/w:header="\d+"/, `w:header="${twips(1)}"`)
      .replace(/w:footer="\d+"/, `w:footer="${twips(3)}"`);
    xml =
      xml.slice(0, start) + content + properties + xml.slice(section.index! + section[0].length);
  }
  set("word/document.xml", xml);
  set("word/_rels/document.xml.rels", rels);
  set("[Content_Types].xml", types);
  return new Blob([writeStoredDocxEntries(entries)], { type: DOCX_MIME_TYPE });
}
