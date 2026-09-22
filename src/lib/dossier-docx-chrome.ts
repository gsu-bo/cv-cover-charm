import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";
import type { DossierChromeDocumentContent } from "@/lib/dossier-chrome-content";
import {
  dossierHeaderContentTopMmForOptions,
  dossierHeaderVisualHeightMmForOptions,
  dossierFooterVisualHeightMmForOptions,
  effectiveDossierHeaderModeForOptions,
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
const WORD_FONT = {
  sans: "Arial",
  serif: "Georgia",
  times: "Times New Roman",
  humanist: "Verdana",
  freundlich: "Cabin",
  schmal: "Arial Narrow",
  maschine: "Courier New",
  plakativ: "Impact",
} as const;
function paragraph(text: string, foreground: string, bold = false, fontSizePt = 8, font = "Cabin") {
  const halfPoints = Math.max(12, Math.min(28, Math.round(fontSizePt * 2)));
  return `<w:p><w:pPr><w:spacing w:after="0" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${halfPoints}"/><w:color w:val="${foreground}"/>${bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
}
function band(id: string, background: string, y: number, height: number) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:rect id="${id}" style="position:absolute;margin-left:0mm;margin-top:${y}mm;width:210mm;height:${height}mm;z-index:251658240;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" fillcolor="#${background}" stroked="f"/></w:pict></w:r></w:p>`;
}
function part(kind: "header" | "footer", body: string) {
  const tag = kind === "header" ? "hdr" : "ftr";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="${W}" xmlns:r="${R}" xmlns:v="urn:schemas-microsoft-com:vml">${body || "<w:p/>"}</w:${tag}>`;
}
type HeaderContactRow = {
  key: "name" | "address" | "place" | "phone" | "email";
  value: string;
};

export function dossierDocxInlineHeaderText(
  rows: HeaderContactRow[],
  separator: DossierChromeOptions["headerInlineSeparator"] = "icons",
) {
  return rows
    .map((row, index) => {
      if (separator === "icons" && row.key === "phone") {
        return `${index ? "  " : ""}☎ ${row.value}`;
      }
      if (separator === "icons" && row.key === "email") {
        return `${index ? "  " : ""}✉ ${row.value}`;
      }
      if (index === 0) return row.value;
      const joiner =
        separator === "slash"
          ? " / "
          : separator === "pipe"
            ? " | "
            : separator === "space"
              ? "     "
              : " · ";
      return `${joiner}${row.value}`;
    })
    .join("");
}

function header(
  options: DossierChromeOptions,
  contact: DossierChromeContact,
  colors: Record<string, string>,
  page: number,
  content?: DossierChromeDocumentContent,
) {
  const mode = effectiveDossierHeaderModeForOptions(options, page);
  if (mode === "none") return part("header", "");
  const background = color(
    options.headerBackgroundColor ?? colors.primary ?? colors.accent,
    "111111",
  );
  const foreground = color(options.headerTextColor, ink(background));
  const fontSizePt = options.headerFontSizePt ?? (options.headerTextLayout === "stacked" ? 8 : 8.5);
  const font = options.textFont ? WORD_FONT[options.textFont] : "Cabin";
  let body = band(
    `semantic-header-${page}`,
    background,
    0,
    dossierHeaderVisualHeightMmForOptions(options, page),
  );
  const reduced = hasReducedContinuationHeader(options, page);
  if (!reduced) {
    if (content?.headerTitle?.trim()) {
      body += paragraph(content.headerTitle.trim(), foreground, true, fontSizePt, font);
    }
    if (content?.headerText?.trim()) {
      body += paragraph(content.headerText.trim(), foreground, false, fontSizePt, font);
    }
  }
  if (mode === "contact") {
    const rows = (
      reduced
        ? [
            options.headerShowName && contact.name ? { key: "name", value: contact.name } : null,
            options.headerShowEmail && contact.email
              ? { key: "email", value: contact.email }
              : null,
            options.headerShowPhone && contact.phone
              ? { key: "phone", value: contact.phone }
              : null,
          ]
        : [
            options.headerShowName && contact.name ? { key: "name", value: contact.name } : null,
            options.headerShowAddress && contact.address
              ? { key: "address", value: contact.address }
              : null,
            options.headerShowAddress && contact.place
              ? { key: "place", value: contact.place }
              : null,
            options.headerShowPhone && contact.phone
              ? { key: "phone", value: contact.phone }
              : null,
            options.headerShowEmail && contact.email
              ? { key: "email", value: contact.email }
              : null,
          ]
    ).filter((row): row is HeaderContactRow => row !== null);
    const inline = reduced || options.headerTextLayout === "inline";
    const lines = inline
      ? [dossierDocxInlineHeaderText(rows, options.headerInlineSeparator)]
      : rows.map((row) => row.value);
    body += lines
      .map((line) =>
        paragraph(
          line,
          foreground,
          !inline && options.headerShowName && line === contact.name,
          fontSizePt,
          font,
        ),
      )
      .join("");
  }
  return part("header", body);
}

function footer(
  options: DossierChromeOptions,
  colors: Record<string, string>,
  text: string,
  content?: DossierChromeDocumentContent,
) {
  if (options.footerMode === "none") return part("footer", "");
  const background = color(
    options.footerBackgroundColor ?? colors.accent ?? colors.secondary,
    "4B5563",
  );
  const foreground = color(options.footerTextColor, ink(background));
  const fontSizePt = options.footerFontSizePt ?? 8.5;
  const font = options.textFont ? WORD_FONT[options.textFont] : "Cabin";
  const height = dossierFooterVisualHeightMmForOptions(options);
  const customText = [content?.footerTitle?.trim(), content?.footerText?.trim()]
    .filter((value): value is string => !!value)
    .join(" · ");
  const resolvedText = customText || (options.footerMode === "details" ? text : "");
  return part(
    "footer",
    band("semantic-footer", background, 297 - height, height) +
      (resolvedText ? paragraph(resolvedText, foreground, false, fontSizePt, font) : ""),
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
  const foreground = color(options.footerTextColor, ink(background));
  const fontSizePt = options.footerFontSizePt ?? 8.5;
  const halfPoints = Math.max(12, Math.min(28, Math.round(fontSizePt * 2)));
  const font = options.textFont ? WORD_FONT[options.textFont] : "Cabin";
  return (
    band("semantic-footer-final", background, 297 - height, height).replace(
      "<v:rect ",
      '<v:rect xmlns:v="urn:schemas-microsoft-com:vml" ',
    ) +
    `<w:p><w:pPr><w:framePr w:w="${twips(170)}" w:h="${twips(Math.max(4, height - 4))}" w:hAnchor="page" w:vAnchor="page" w:x="${twips(20)}" w:y="${twips(297 - height + 2)}" w:wrap="none" w:hRule="atLeast"/><w:spacing w:after="0" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${halfPoints}"/><w:color w:val="${foreground}"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`
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
    const { options, contact, content: chromeContent } = resolved[scope];
    const document = documents[scope],
      section = sections[index];
    const start = sections[index - 1].index! + sections[index - 1][0].length;
    let content = xml.slice(start, section.index);
    let properties = section[0]
      .replace(/<w:pgBorders\b[^>]*>[\s\S]*?<\/w:pgBorders>/g, "")
      .replace(/<w:(?:headerReference|footerReference|titlePg)\b[^>]*\/>/g, "");
    const references: string[] = [];
    const warmRecipe = String(document.design.template) === "freundlich";
    const citrusRecipe = String(document.design.template) === "citrus";
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
                chromeContent,
              )
          : footer(
              scope === "letter" && options.footerMode === "details"
                ? { ...options, footerMode: "compact", footerHeightMm: null }
                : options,
              document.design.colors,
              scope === "letter" ? "" : text,
              chromeContent,
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
      const customFooterText = [chromeContent.footerTitle, chromeContent.footerText]
        .filter((value): value is string => !!value?.trim())
        .join(" · ");
      const finalFooter = finalPageDetailsFooter(
        options,
        document.design.colors,
        customFooterText || (attachments.length ? `Beilagen   ${attachments.join(" · ")}` : ""),
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
    const firstHeaderMode = effectiveDossierHeaderModeForOptions(options, 0);
    const continuationHeaderMode = effectiveDossierHeaderModeForOptions(options, 1);
    if (firstHeaderMode === "contact" || continuationHeaderMode === "contact") {
      // Word page margins are section-wide. Reserve enough top space for the
      // larger of page 1 and the continuation pages so an explicit full
      // contact header on page 2 can never overlap editable document content.
      const chromeTopMm = Math.max(
        dossierHeaderContentTopMmForOptions(options, 0),
        dossierHeaderContentTopMmForOptions(options, 1),
      );
      // Template-specific DOCX recipes can already provide part of the visual
      // separation below the 32 mm header. Keep the visible header unchanged
      // and only reclaim redundant body safety space in the CV section.
      const cvTopAllowanceMm = scope === "cv" ? (warmRecipe ? 0.35 : citrusRecipe ? 8 : 0) : 0;
      const minTop = twips(chromeTopMm - cvTopAllowanceMm);
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
