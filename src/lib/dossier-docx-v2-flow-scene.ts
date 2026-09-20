import type { FontKey } from "@/components/cover/types";
import {
  CV_DOC_TITLE_DEFAULTS,
  CV_NAME_STYLE_DEFAULTS,
  CV_SECTION_LABELS,
  CV_SECTION_TITLE_DEFAULTS,
  customSectionForKey,
  cvSectionLayout,
  cvSectionOrder,
  entryFilled,
  isCustomSectionKey,
  type CvData,
  type CvLayoutSectionKey,
  type CvPlacementKey,
  type CvPlacements,
  type CvSectionKey,
} from "@/components/cv/types";
import type { CvInfoPosition, CvLayoutId } from "@/components/cv/layout";
import { resolveCvPalette } from "@/components/cv/cv-paper";
import { onColorRoles } from "@/components/cv/palette";
import type { CvPhotoPlacement } from "@/components/cv/photo-place";
import { resolveCvPhotoPosition } from "@/components/cv/photo-place";
import type { DossierPhotoStyle } from "@/lib/dossier-photo";
import { dossierPhotoRatio } from "@/lib/dossier-photo";
import {
  compatibleLetterTextAlign,
  letterRichHtml,
  type LetterTextAlign,
} from "@/components/letter/rich-text";
import { letterPageGeometry, visibleLetterAttachments } from "@/components/letter/layout-system";
import { resolveLetterPalette } from "@/components/letter/letter-paper";
import {
  DEFAULT_LETTER_CLOSING_GAP_MM,
  DEFAULT_LETTER_SIGNATURE_GAP_MM,
  normalizeLetterSpacingMm,
  type LetterRoleTypography,
} from "@/components/letter/types";
import { isWarmFirstPageCompactHeader } from "@/components/letter/warm-letter-layout";
import type { DossierChromeOptions } from "@/lib/dossier-chrome";
import type { CvPdfDocument, LetterPdfDocument } from "@/lib/dossier-pdf-document";
import { dossierDefaultFontKey, dossierThemeFor } from "@/lib/dossier-theme";

export type DossierDocxV2FlowIssue = {
  severity: "blocker" | "warning" | "info";
  code: string;
  scope: "letter" | "cv";
  message: string;
  id?: string;
};

export type DossierDocxV2TextStyle = {
  font: string;
  fontSizePt: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type DossierDocxV2FlowRun = DossierDocxV2TextStyle & { text: string };

export type DossierDocxV2FlowParagraph = {
  kind: "paragraph";
  id?: string;
  runs: DossierDocxV2FlowRun[];
  align: "left" | "center" | "right" | "both";
  beforeMm: number;
  afterMm: number;
  lineHeight: number;
  keepNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;
  ruleBottom?: { color: string; widthPt: number } | null;
  background?: string | null;
};

export type DossierDocxV2FlowSpacer = { kind: "spacer"; id?: string; mm: number };
export type DossierDocxV2FlowPageBreak = { kind: "page-break"; id?: string };

export type DossierDocxV2FlowCell = {
  blocks: DossierDocxV2FlowBlock[];
  widthPct: number;
  background?: string | null;
  paddingMm?: number;
};

export type DossierDocxV2FlowTable = {
  kind: "table";
  id?: string;
  rows: Array<{ cells: DossierDocxV2FlowCell[]; minHeightMm?: number; cantSplit?: boolean }>;
  afterMm: number;
  border?: { color: string; widthPt: number } | null;
};

export type DossierDocxV2FlowBlock =
  | DossierDocxV2FlowParagraph
  | DossierDocxV2FlowSpacer
  | DossierDocxV2FlowPageBreak
  | DossierDocxV2FlowTable;

export type DossierDocxV2FloatingTextBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  blocks: DossierDocxV2FlowBlock[];
  background?: string | null;
  insetMm?: { top: number; right: number; bottom: number; left: number };
};

export type DossierDocxV2CvOverlay = DossierDocxV2FloatingTextBox & {
  pageIndex: number;
  role: "main" | "sidebar" | "band-header" | "page-label";
};

export type DossierDocxV2LetterFlowScene = {
  templateId: string;
  paperColor: string;
  blocks: DossierDocxV2FlowBlock[];
  floating: DossierDocxV2FloatingTextBox[];
  issues: DossierDocxV2FlowIssue[];
};

export type DossierDocxV2CvPhoto = {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: DossierPhotoStyle["shape"];
  zoom: number;
  imageX: number;
  imageY: number;
  borderWidth: number;
  borderColor: string;
};

export type DossierDocxV2CvPageArtwork = {
  pageIndex: number;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DossierDocxV2CvFlowScene = {
  templateId: string;
  paperColor: string;
  blocks: DossierDocxV2FlowBlock[];
  overlays: DossierDocxV2CvOverlay[];
  artwork: DossierDocxV2CvPageArtwork[];
  photo: DossierDocxV2CvPhoto | null;
  issues: DossierDocxV2FlowIssue[];
};

export type DossierDocxV2CvFlowOptions = {
  layout: CvLayoutId;
  placements: CvPlacements;
  infoPosition: CvInfoPosition;
  sectionGapMm: number | null;
  photoStyle: DossierPhotoStyle;
  photoPlacement: CvPhotoPlacement;
};

const WORD_FONT_BY_KEY: Record<FontKey, string> = {
  sans: "Arial",
  serif: "Georgia",
  times: "Times New Roman",
  humanist: "Verdana",
  freundlich: "Cabin",
  schmal: "Arial Narrow",
  maschine: "Courier New",
  plakativ: "Impact",
};

function wordFont(key: FontKey | undefined, fallback: FontKey) {
  return WORD_FONT_BY_KEY[key ?? fallback] ?? WORD_FONT_BY_KEY[fallback];
}

function validHex(value: string | null | undefined, fallback: string) {
  const next = (value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(next) ? next.toLowerCase() : fallback.toLowerCase();
}

function tintHex(value: string, whiteMix = 0.88) {
  const hex = validHex(value, "#ffffff").slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * whiteMix));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function align(value: LetterTextAlign | "center" | "right" | "left") {
  return value === "justify" ? "both" : value;
}

function baseStyle(
  font: string,
  color: string,
  fontSizePt: number,
  patch: Partial<DossierDocxV2TextStyle> = {},
): DossierDocxV2TextStyle {
  return {
    font,
    fontSizePt,
    color,
    bold: false,
    italic: false,
    underline: false,
    ...patch,
  };
}

function run(text: string, style: DossierDocxV2TextStyle): DossierDocxV2FlowRun {
  return { text, ...style };
}

function paragraph(
  text: string,
  style: DossierDocxV2TextStyle,
  options: Partial<Omit<DossierDocxV2FlowParagraph, "kind" | "runs">> = {},
): DossierDocxV2FlowParagraph {
  return {
    kind: "paragraph",
    runs: text ? [run(text, style)] : [],
    align: "left",
    beforeMm: 0,
    afterMm: 0,
    lineHeight: 1.2,
    ...options,
  };
}

function roleStyle(
  base: DossierDocxV2TextStyle,
  role: LetterRoleTypography | undefined,
): DossierDocxV2TextStyle {
  return {
    ...base,
    font: role?.font ? wordFont(role.font, "sans") : base.font,
    fontSizePt:
      typeof role?.fontSizePt === "number" && Number.isFinite(role.fontSizePt)
        ? role.fontSizePt
        : base.fontSizePt,
    color: validHex(role?.color, base.color),
    bold: role?.bold ?? base.bold,
    italic: role?.italic ?? base.italic,
    underline: role?.underline ?? base.underline,
  };
}

function lines(
  values: Array<string | undefined>,
  style: DossierDocxV2TextStyle,
  id: string,
  textAlign: "left" | "right" = "left",
) {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value, index) =>
      paragraph(value, style, {
        id: index === 0 ? id : `${id}-${index + 1}`,
        align: textAlign,
        afterMm: 0.45,
        lineHeight: 1.4,
      }),
    );
}

function inlineRunsFromNode(
  node: Node,
  style: DossierDocxV2TextStyle,
  state: { bold: boolean; italic: boolean; underline: boolean } = {
    bold: false,
    italic: false,
    underline: false,
  },
): DossierDocxV2FlowRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text ? [run(text, { ...style, ...state })] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return [run("\n", { ...style, ...state })];
  const next = {
    bold: state.bold || tag === "strong" || tag === "b",
    italic: state.italic || tag === "em" || tag === "i",
    underline: state.underline || tag === "u",
  };
  return Array.from(element.childNodes).flatMap((child) => inlineRunsFromNode(child, style, next));
}

function listPrefix(value: string | undefined) {
  if (value === "bullet") return "• ";
  if (value === "dash") return "– ";
  if (value === "plus") return "+ ";
  if (value === "dot") return "· ";
  return "";
}

function withPrefix(runs: DossierDocxV2FlowRun[], prefix: string) {
  if (!prefix) return runs;
  if (!runs.length) return [];
  return [{ ...runs[0], text: `${prefix}${runs[0].text}` }, ...runs.slice(1)];
}

function richLetterBlocks(
  letter: LetterPdfDocument,
  bodyStyle: DossierDocxV2TextStyle,
  issues: DossierDocxV2FlowIssue[],
): DossierDocxV2FlowBlock[] {
  if (typeof document === "undefined" || !document.createElement) {
    return letter.data.text
      .split(/\n\s*\n/g)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value, index) =>
        paragraph(value, bodyStyle, {
          id: `body-${index + 1}`,
          align: "both",
          afterMm: 4.2,
          lineHeight: 1.48,
        }),
      );
  }

  const template = document.createElement("template");
  template.innerHTML = letterRichHtml(letter.data.richTextHtml, letter.data.text);
  const blocks: DossierDocxV2FlowBlock[] = [];
  let index = 0;

  for (const child of Array.from(template.content.children)) {
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.tagName.toLowerCase();
    index += 1;

    if (tag === "hr") {
      blocks.push(
        paragraph("", bodyStyle, {
          id: `body-rule-${index}`,
          afterMm: 5,
          ruleBottom: { color: bodyStyle.color, widthPt: 0.7 },
        }),
      );
      continue;
    }

    if (tag === "table") {
      const rows = Array.from(child.querySelectorAll(":scope > tbody > tr, :scope > tr")).map((rowEl) => {
        const cells = Array.from(rowEl.querySelectorAll(":scope > td"));
        const widthPct = cells.length ? 100 / cells.length : 100;
        return {
          cantSplit: true,
          cells: cells.map((cell, cellIndex) => ({
            widthPct,
            paddingMm: 1.4,
            blocks: [
              {
                ...paragraph("", bodyStyle, {
                  id: `body-table-${index}-${cellIndex + 1}`,
                  lineHeight: 1.4,
                }),
                runs: inlineRunsFromNode(cell, bodyStyle),
              },
            ],
          })),
        };
      });
      blocks.push({ kind: "table", id: `body-table-${index}`, rows, afterMm: 4.2 });
      continue;
    }

    if (tag !== "div" && tag !== "p") continue;
    const columns = child.dataset.columns;
    if (columns === "2" || columns === "3") {
      issues.push({
        severity: "blocker",
        code: "letter-rich-columns-unsupported",
        scope: "letter",
        id: `body-${index}`,
        message: `DOCX V2 bildet den ${columns}-spaltigen Rich-Text-Block noch nicht verlustfrei ab.`,
      });
    }
    const runs = withPrefix(inlineRunsFromNode(child, bodyStyle), listPrefix(child.dataset.list));
    const visible = runs.map((item) => item.text).join("").replace(/\n/g, "").trim();
    if (!visible) {
      blocks.push({ kind: "spacer", id: `body-${index}`, mm: 4.5 });
      continue;
    }
    blocks.push({
      ...paragraph("", bodyStyle, {
        id: `body-${index}`,
        align: align(compatibleLetterTextAlign(child.dataset.align, columns)),
        afterMm: 0.8,
        lineHeight: 1.55,
      }),
      runs,
    });
  }
  return blocks;
}

export function buildDossierDocxV2LetterFlowScene(
  letter: LetterPdfDocument,
  chromeOptions?: DossierChromeOptions,
): DossierDocxV2LetterFlowScene {
  const issues: DossierDocxV2FlowIssue[] = [];
  const data = letter.data;
  const design = letter.design;
  const palette = resolveLetterPalette(design);
  const theme = dossierThemeFor(design.template);
  const fallbackFont = dossierDefaultFontKey(design.template);
  const baseFontKey = design.template === "brief" ? design.font : (design.fontOverride ?? fallbackFont);
  const font = wordFont(baseFontKey, fallbackFont);
  const geometry = letterPageGeometry(data, design, { chromeOptions });
  if ((data.images ?? []).length > 0) {
    issues.push({
      severity: "blocker",
      code: "letter-images-v2-unsupported",
      scope: "letter",
      message:
        "Anschreiben-Bilder werden erst freigegeben, wenn ihre browsergemessene Seite und Wrap-Geometrie direkt vom V2-Renderer übernommen werden.",
    });
  }
  if ((chromeOptions?.letterRecipientOffsetYMm ?? 0) !== 0) {
    issues.push({
      severity: "warning",
      code: "letter-recipient-offset-approximation",
      scope: "letter",
      id: "recipient",
      message: "Der freie Empfänger-Y-Versatz wird in der Flow-Foundation noch nicht als Word-Overlay reproduziert.",
    });
  }
  if ((chromeOptions?.headerContentOffsetYMm ?? 0) !== 0 && geometry.effectiveHeaderMode !== "contact") {
    issues.push({
      severity: "warning",
      code: "letter-sender-offset-approximation",
      scope: "letter",
      id: "sender",
      message: "Der freie Absender-Y-Versatz wird in der Flow-Foundation noch nicht vollständig reproduziert.",
    });
  }
  const bodyStyle = baseStyle(font, palette.ink, 10.5, {
    bold: theme.typography.bodyWeight >= 600,
  });
  const senderStyle = roleStyle(baseStyle(font, palette.ink, 9.5), design.senderTypography);
  const recipientStyle = roleStyle(baseStyle(font, palette.ink, 10), design.recipientTypography);
  const subjectStyle = roleStyle(baseStyle(font, palette.ink, 12, { bold: true }), design.subjectTypography);
  const mutedStyle = baseStyle(font, palette.muted, 9.5);
  const blocks: DossierDocxV2FlowBlock[] = [];
  const floating: DossierDocxV2FloatingTextBox[] = [];
  const senderIntegrated = geometry.effectiveHeaderMode === "contact";
  const warmCompact = isWarmFirstPageCompactHeader(
    design.template,
    geometry.effectiveHeaderMode,
    geometry.pageIndex,
  );

  const warmPrimary =
    design.colors.primary ?? design.colors.accent ?? design.colors.secondary ?? palette.accent;
  const warmHeaderInk = onColorRoles(
    warmPrimary,
    design.colors.secondary ?? design.colors.accent ?? palette.accent,
  ).ink;
  const sender = lines(
    [data.absenderName, data.absenderAdresse, data.absenderPlzOrt, data.absenderTelefon, data.absenderEmail],
    senderStyle,
    "sender",
    design.senderAlign ?? "left",
  );
  if (warmCompact && sender.length) {
    floating.push({
      id: "warm-compact-sender",
      x: geometry.content.left,
      y: 8,
      width: 82,
      height: 38,
      blocks: sender.map((item, index) => ({
        ...item,
        runs: item.runs.map((itemRun) => ({
          ...itemRun,
          color: warmHeaderInk,
          bold: index === 0 ? true : itemRun.bold,
          fontSizePt: index === 0 ? Math.max(11, itemRun.fontSizePt) : itemRun.fontSizePt,
        })),
      })),
    });
  } else if (!senderIntegrated) {
    blocks.push(...sender);
    if (design.ruleAfterSender) {
      blocks.push(
        paragraph("", bodyStyle, {
          id: "sender-rule",
          afterMm: 4,
          ruleBottom: { color: palette.accent, widthPt: 0.7 },
        }),
      );
    } else {
      blocks.push({ kind: "spacer", mm: 5.5 });
    }
  }

  const recipient = lines(
    [data.empfaengerFirma, data.empfaengerName, data.empfaengerAdresse, data.empfaengerPlzOrt],
    recipientStyle,
    "recipient",
    design.recipientAlign ?? "left",
  );
  blocks.push({
    kind: "table",
    id: "recipient-block",
    rows: [
      {
        minHeightMm: 24,
        cantSplit: true,
        cells: [{ widthPct: 100, paddingMm: 0, blocks: recipient.length ? recipient : [paragraph("", recipientStyle)] }],
      },
    ],
    afterMm: design.ruleAfterRecipient ? 0 : 4,
  });
  if (design.ruleAfterRecipient) {
    blocks.push(
      paragraph("", bodyStyle, {
        id: "recipient-rule",
        afterMm: 4,
        ruleBottom: { color: palette.accent, widthPt: 0.7 },
      }),
    );
  }

  const placeDate = data.ort && data.datum ? `${data.ort}, ${data.datum}` : data.ort || data.datum;
  if (placeDate) {
    blocks.push(
      paragraph(placeDate, mutedStyle, {
        id: "date",
        align: design.dateAlign ?? "left",
        beforeMm: 1,
        afterMm: 7,
        lineHeight: 1.4,
      }),
    );
  }
  if (data.betreff) {
    blocks.push(
      paragraph(data.betreff, subjectStyle, {
        id: "subject",
        afterMm: design.ruleAfterSubject ? 0 : 8,
        keepNext: true,
        lineHeight: 1.12,
        ruleBottom: design.ruleAfterSubject ? { color: palette.accent, widthPt: 0.7 } : null,
      }),
    );
    if (design.ruleAfterSubject) blocks.push({ kind: "spacer", mm: 5 });
  }
  if (data.anrede) {
    blocks.push(
      paragraph(data.anrede, bodyStyle, {
        id: "salutation",
        afterMm: 5,
        keepNext: true,
        lineHeight: 1.48,
      }),
    );
  }

  blocks.push(...richLetterBlocks(letter, bodyStyle, issues));

  const closingGap = normalizeLetterSpacingMm(data.grussAbstandMm, DEFAULT_LETTER_CLOSING_GAP_MM);
  const signatureGap = normalizeLetterSpacingMm(
    data.unterschriftAbstandMm,
    DEFAULT_LETTER_SIGNATURE_GAP_MM,
  );
  if (data.gruss) {
    blocks.push(
      paragraph(data.gruss, bodyStyle, {
        id: "closing",
        beforeMm: closingGap,
        afterMm: signatureGap,
        lineHeight: 1.48,
      }),
    );
  }
  const signature = data.unterschrift || data.absenderName;
  if (signature) {
    blocks.push(paragraph(signature, { ...bodyStyle, bold: true }, { id: "signature", afterMm: 0 }));
  }

  const attachments = visibleLetterAttachments(data);
  const showAttachmentsInBody =
    data.showBeilagen !== false && attachments.length > 0 && geometry.requestedFooterMode !== "attachments";
  if (showAttachmentsInBody) {
    blocks.push(
      paragraph("Beilagen", { ...bodyStyle, bold: true }, { id: "attachments-heading", beforeMm: 9, afterMm: 1.5, keepNext: true }),
      ...attachments.map((item, index) =>
        paragraph(item, bodyStyle, { id: `attachment-${index + 1}`, afterMm: 0.4 }),
      ),
    );
  }

  return {
    templateId: String(design.template),
    paperColor: palette.paper,
    blocks,
    floating,
    issues,
  };
}

function cvTextStyle(
  font: string,
  color: string,
  sizePt: number,
  patch: Partial<DossierDocxV2TextStyle> = {},
) {
  return baseStyle(font, color, sizePt, patch);
}

function cvSectionTitleStyle(cv: CvPdfDocument, font: string, accent: string) {
  const design = cv.design;
  const theme = dossierThemeFor(design.template);
  return cvTextStyle(
    font,
    validHex(design.sectionTitleColor, accent),
    (typeof design.sectionTitleFontSizePx === "number"
      ? design.sectionTitleFontSizePx * 0.75
      : CV_SECTION_TITLE_DEFAULTS.fontSizePx * 0.75) * (design.headingScale ?? 1),
    {
      bold: design.sectionTitleBold ?? theme.headingStyle.weight >= 600,
      italic: design.sectionTitleItalic ?? false,
      underline: design.sectionTitleUnderline ?? false,
    },
  );
}

function cvHeading(
  id: string,
  title: string,
  cv: CvPdfDocument,
  font: string,
  accent: string,
  sectionGapMm: number | null,
): DossierDocxV2FlowParagraph {
  const design = cv.design;
  const style = cvSectionTitleStyle(cv, font, accent);
  const defaultGap = typeof design.sectionTitleMarginBottomPx === "number" ? design.sectionTitleMarginBottomPx * 0.264583 : 1.8;
  const rule = design.headingRule === "none" ? null : { color: style.color, widthPt: 0.7 };
  return paragraph(title, style, {
    id: `${id}-heading`,
    beforeMm: sectionGapMm ?? 3.2,
    afterMm: defaultGap,
    keepNext: true,
    lineHeight: 1.1,
    ruleBottom: rule,
    background:
      design.sectionTitlePill === true || design.citrusRubricPill === true
        ? tintHex(style.color)
        : null,
  });
}

function cvEntryTable(
  id: string,
  entries: CvData["schule"],
  font: string,
  ink: string,
  muted: string,
  bodyScale: number,
): DossierDocxV2FlowTable | null {
  const filled = entries.filter(entryFilled);
  if (!filled.length) return null;
  const body = cvTextStyle(font, ink, 9.5 * bodyScale);
  const meta = cvTextStyle(font, muted, 9.2 * bodyScale);
  const title = cvTextStyle(font, ink, 10.2 * bodyScale, { bold: true });
  return {
    kind: "table",
    id,
    rows: filled.map((entry, index) => ({
      cantSplit: true,
      cells: [
        {
          widthPct: 23,
          paddingMm: 0.7,
          blocks: [paragraph(entry.zeit, meta, { id: `${id}-${index + 1}-time`, lineHeight: 1.2 })],
        },
        {
          widthPct: 77,
          paddingMm: 0.7,
          blocks: [
            ...(entry.titel ? [paragraph(entry.title, title, { keepNext: true, afterMm: 0.5 })] : []),
            ...(entry.ort ? [paragraph(entry.ort, meta, { afterMm: 0.5 })] : []),
            ...(entry.beschreibung ? [paragraph(entry.beschreibung, body, { afterMm: 2.2, lineHeight: 1.3 })] : []),
          ],
        },
      ],
    })),
    afterMm: 1.2,
  };
}

function sectionTitle(data: CvData, key: CvSectionKey) {
  return data.labels?.[key]?.trim() || CV_SECTION_LABELS[key];
}

function cvSectionBlocks(
  cv: CvPdfDocument,
  key: CvLayoutSectionKey,
  font: string,
  ink: string,
  muted: string,
  accent: string,
  sectionGapMm: number | null,
): DossierDocxV2FlowBlock[] {
  const data = cv.data;
  const bodyScale = cv.design.bodyScale ?? 1;
  const body = cvTextStyle(font, ink, 9.5 * bodyScale);
  const meta = cvTextStyle(font, muted, 9.3 * bodyScale);
  const blocks: DossierDocxV2FlowBlock[] = [];

  if (key === "person") return blocks;
  if (isCustomSectionKey(key)) {
    const section = customSectionForKey(data, key);
    if (!section || (!section.title.trim() && !section.entries.some(entryFilled))) return blocks;
    blocks.push(cvHeading(key, section.title || "Weitere Angaben", cv, font, accent, sectionGapMm));
    const table = cvEntryTable(key, section.entries, font, ink, muted, bodyScale);
    if (table) blocks.push(table);
    return blocks;
  }

  if (data.hidden?.[key]) return blocks;
  const title = sectionTitle(data, key);
  if (key === "schule" || key === "erfahrung") {
    const entries = data[key];
    if (!entries.some(entryFilled)) return blocks;
    blocks.push(cvHeading(key, title, cv, font, accent, sectionGapMm));
    const table = cvEntryTable(key, entries, font, ink, muted, bodyScale);
    if (table) blocks.push(table);
    return blocks;
  }
  if (key === "sprachen") {
    const values = data.sprachen.filter((item) => item.name.trim() || item.niveau.trim());
    if (!values.length) return blocks;
    blocks.push(cvHeading(key, title, cv, font, accent, sectionGapMm));
    blocks.push({
      kind: "table",
      id: key,
      rows: values.map((item) => ({
        cantSplit: true,
        cells: [
          { widthPct: 42, paddingMm: 0.6, blocks: [paragraph(item.name, { ...body, bold: true })] },
          { widthPct: 58, paddingMm: 0.6, blocks: [paragraph(item.niveau, meta)] },
        ],
      })),
      afterMm: 1.2,
    });
    return blocks;
  }
  if (key === "hobbys" || key === "staerken") {
    const values = data[key].filter((item) => item.trim());
    if (!values.length) return blocks;
    blocks.push(cvHeading(key, title, cv, font, accent, sectionGapMm));
    blocks.push(...values.map((item, index) => paragraph(`• ${item}`, body, { id: `${key}-${index + 1}`, afterMm: 0.7, lineHeight: 1.3 })));
    return blocks;
  }
  if (key === "referenzen") {
    const values = data.referenzen.filter((item) => item.name.trim() || item.kontakt.trim() || item.email?.trim());
    if (!values.length) return blocks;
    blocks.push(cvHeading(key, title, cv, font, accent, sectionGapMm));
    for (const [index, item] of values.entries()) {
      const first = [item.name, item.funktion].filter(Boolean).join(" · ");
      if (first) blocks.push(paragraph(first, { ...body, bold: true }, { id: `reference-${index + 1}`, afterMm: 0.4, keepNext: true }));
      for (const value of [item.kontakt, item.email, item.zusatz].filter((part): part is string => Boolean(part?.trim()))) {
        for (const valueLine of value.split(/\r?\n/g).filter(Boolean)) {
          blocks.push(paragraph(valueLine, body, { afterMm: 0.4, lineHeight: 1.25 }));
        }
      }
      blocks.push({ kind: "spacer", mm: 1.2 });
    }
    return blocks;
  }
  return blocks;
}

function visibleSection(cv: CvPdfDocument, key: CvLayoutSectionKey) {
  return cvSectionBlocks(cv, key, "Arial", "#111111", "#666666", "#111111", null).length > 0;
}

function sectionGroups(
  cv: CvPdfDocument,
  keys: CvLayoutSectionKey[],
  font: string,
  ink: string,
  muted: string,
  accent: string,
  sectionGapMm: number | null,
): DossierDocxV2FlowBlock[] {
  const output: DossierDocxV2FlowBlock[] = [];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const layout = cvSectionLayout(cv.data, key);
    const blocks = cvSectionBlocks(cv, key, font, ink, muted, accent, sectionGapMm);
    if (!blocks.length) continue;
    if (layout.width !== "half") {
      output.push(...blocks);
      continue;
    }
    const nextKey = keys[index + 1];
    const nextLayout = nextKey ? cvSectionLayout(cv.data, nextKey) : null;
    const nextBlocks = nextKey ? cvSectionBlocks(cv, nextKey, font, ink, muted, accent, sectionGapMm) : [];
    if (nextKey && nextLayout?.width === "half" && nextBlocks.length) {
      output.push({
        kind: "table",
        id: `half-pair-${key}-${nextKey}`,
        rows: [
          {
            cantSplit: true,
            cells: [
              { widthPct: 50, paddingMm: 1.2, blocks },
              { widthPct: 50, paddingMm: 1.2, blocks: nextBlocks },
            ],
          },
        ],
        afterMm: 1.4,
      });
      index += 1;
    } else {
      output.push({
        kind: "table",
        id: `half-single-${key}`,
        rows: [{ cantSplit: true, cells: [{ widthPct: 50, paddingMm: 1.2, blocks }] }],
        afterMm: 1.4,
      });
    }
  }
  return output;
}

function cvContactBlocks(cv: CvPdfDocument, font: string, ink: string, muted: string) {
  const person = cv.data.person;
  const body = cvTextStyle(font, ink, 9.4 * (cv.design.bodyScale ?? 1));
  const meta = cvTextStyle(font, muted, 9.2 * (cv.design.bodyScale ?? 1));
  const values: Array<[string, DossierDocxV2TextStyle]> = [
    [person.adresse, body],
    [person.plzOrt, body],
    [person.telefon, body],
    [person.email, body],
    [person.geburtsdatum ? `Geburtsdatum ${person.geburtsdatum}` : "", meta],
    [person.nationalitaet ? `Nationalität ${person.nationalitaet}` : "", meta],
  ];
  return values
    .filter(([value]) => value.trim())
    .map(([value, style], index) => paragraph(value, style, { id: `contact-${index + 1}`, afterMm: 0.45, lineHeight: 1.28 }));
}

function identityBlocks(cv: CvPdfDocument, font: string, ink: string, accent: string) {
  const design = cv.design;
  const person = cv.data.person;
  const titleScale = design.titleScale ?? 1;
  const headingScale = design.headingScale ?? 1;
  const docTitle = cv.data.titel?.trim() || "Lebenslauf";
  const fullName = [person.vorname, person.nachname].filter(Boolean).join(" ");
  const nameStyle = person.nameStyle;
  const titleStyle = cvTextStyle(
    font,
    validHex(design.docTitleColor, accent),
    (typeof design.docTitleFontSizePx === "number" ? design.docTitleFontSizePx * 0.75 : CV_DOC_TITLE_DEFAULTS.fontSizePx * 0.75) * titleScale,
    {
      bold: design.docTitleBold ?? CV_DOC_TITLE_DEFAULTS.bold,
      italic: design.docTitleItalic ?? CV_DOC_TITLE_DEFAULTS.italic,
      underline: design.docTitleUnderline ?? CV_DOC_TITLE_DEFAULTS.underline,
    },
  );
  const nameFont = nameStyle?.font ? wordFont(nameStyle.font, dossierDefaultFontKey(design.template)) : font;
  const name = cvTextStyle(
    nameFont,
    validHex(nameStyle?.color, ink),
    (nameStyle?.fontSizePt ?? CV_NAME_STYLE_DEFAULTS.fontSizePt) * titleScale,
    {
      bold: nameStyle?.bold ?? CV_NAME_STYLE_DEFAULTS.bold,
      italic: nameStyle?.italic ?? CV_NAME_STYLE_DEFAULTS.italic,
      underline: nameStyle?.underline ?? CV_NAME_STYLE_DEFAULTS.underline,
    },
  );
  const subtitle = cvTextStyle(font, accent, 10.5 * headingScale, { bold: true });
  const result: DossierDocxV2FlowBlock[] = [];
  if (docTitle) {
    result.push(
      paragraph(docTitle, titleStyle, {
        id: "cv-document-title",
        afterMm: (design.docTitleMarginBottomPx ?? CV_DOC_TITLE_DEFAULTS.marginBottomPx) * 0.264583,
        keepNext: true,
      }),
    );
  }
  if (fullName) result.push(paragraph(fullName, name, { id: "cv-name", afterMm: 1.2, keepNext: true, lineHeight: 1.05 }));
  if (person.untertitel) result.push(paragraph(person.untertitel, subtitle, { id: "cv-subtitle", afterMm: 2.5, keepNext: true }));
  return result;
}

function standardPlacement(key: CvLayoutSectionKey, placements: CvPlacements): "side" | "main" {
  if (key === "person" || isCustomSectionKey(key)) return "main";
  return placements[key as CvPlacementKey] ?? "main";
}

export function buildDossierDocxV2CvFlowScene(
  cv: CvPdfDocument,
  options: DossierDocxV2CvFlowOptions,
): DossierDocxV2CvFlowScene {
  const issues: DossierDocxV2FlowIssue[] = [];
  if (options.layout !== "classic" && options.layout !== "modern" && options.layout !== "executive") {
    issues.push({
      severity: "blocker",
      code: "cv-layout-variant-unsupported",
      scope: "cv",
      id: options.layout,
      message: `DOCX V2 Flow unterstützt ${options.layout} noch nicht als eigenständige Word-Geometrie.`,
    });
  }
  const personLayout = cvSectionLayout(cv.data, "person");
  if (personLayout.page !== 1 || personLayout.width !== "full" || personLayout.positioning !== "flow") {
    issues.push({
      severity: "blocker",
      code: "cv-person-layout-unsupported",
      scope: "cv",
      id: "person",
      message: "Eine explizit verschobene/umgebaute Personenrubrik darf im V2-Export nicht still auf Standard zurückfallen.",
    });
  }
  if (cv.design.useElements && cv.elements.length > 0) {
    issues.push({
      severity: "blocker",
      code: "cv-imported-cover-elements-unsupported",
      scope: "cv",
      message: "Mitgenommene Titelblatt-Elemente brauchen vor V2-Freigabe einen eigenen CV-Dekorationslayer.",
    });
  }
  const explicitIndent =
    cv.design.sectionTitleOffsetMm ??
    cv.design.sectionContentIndentMm ??
    cv.design.citrusRubricOffsetMm ??
    cv.design.citrusContentIndentMm;
  if (typeof explicitIndent === "number" && Math.abs(explicitIndent) > 0.001) {
    issues.push({
      severity: "blocker",
      code: "cv-rubric-indent-unsupported",
      scope: "cv",
      message: "Explizite Rubrik-Offsets/Einzüge werden noch nicht verlustfrei in Word umgesetzt.",
    });
  }
  if (cv.design.headingRule === "short") {
    issues.push({
      severity: "blocker",
      code: "cv-short-heading-rule-unsupported",
      scope: "cv",
      message: "Eine explizite kurze Rubriklinie benötigt noch den nativen V2-Heading-Renderer.",
    });
  }
  const palette = resolveCvPalette(cv.design);
  const fallbackFont = dossierDefaultFontKey(cv.design.template);
  const font = wordFont(cv.design.font, fallbackFont);
  const accent = validHex(cv.design.sectionTitleColor, palette.accent);
  const identity = identityBlocks(cv, font, palette.ink, accent);
  const contact = cvContactBlocks(cv, font, palette.ink, palette.muted);
  const ordered = cvSectionOrder(cv.data).filter((key) => key !== "person" && visibleSection(cv, key));

  for (const key of ordered) {
    const layout = cvSectionLayout(cv.data, key);
    if (layout.positioning === "free") {
      issues.push({
        severity: "blocker",
        code: "cv-free-section-unsupported",
        scope: "cv",
        id: key,
        message: `DOCX V2 kann die frei positionierte CV-Rubrik ${key} noch nicht verlustfrei als Word-Fliesstext setzen.`,
      });
    }
  }

  if (cv.design.sectionTitlePill === true || cv.design.citrusRubricPill === true) {
    issues.push({
      severity: "warning",
      code: "cv-title-pill-approximation",
      scope: "cv",
      message: "Rubrik-Pills werden in der Flow-Foundation als Word-Schattierung angenähert.",
    });
  }

  const pageKeys = (page: 1 | 2) => ordered.filter((key) => cvSectionLayout(cv.data, key).page === page);
  const blocks: DossierDocxV2FlowBlock[] = [...identity];

  const renderClassicPage = (keys: CvLayoutSectionKey[], includeContact: boolean) => {
    const result: DossierDocxV2FlowBlock[] = [];
    if (includeContact && contact.length) {
      result.push(...contact, { kind: "spacer", mm: 2.2 });
    }
    result.push(...sectionGroups(cv, keys, font, palette.ink, palette.muted, accent, options.sectionGapMm));
    return result;
  };

  const renderModernPage = (keys: CvLayoutSectionKey[], includeContact: boolean) => {
    const sideKeys = keys.filter((key) => standardPlacement(key, options.placements) === "side");
    const mainKeys = keys.filter((key) => standardPlacement(key, options.placements) !== "side");
    const sideBlocks: DossierDocxV2FlowBlock[] = [];
    const mainBlocks: DossierDocxV2FlowBlock[] = [];
    if (includeContact && contact.length) {
      (options.placements.kontakt === "main" ? mainBlocks : sideBlocks).push(...contact, { kind: "spacer", mm: 2.2 });
    }
    sideBlocks.push(...sectionGroups(cv, sideKeys, font, palette.ink, palette.muted, accent, options.sectionGapMm));
    mainBlocks.push(...sectionGroups(cv, mainKeys, font, palette.ink, palette.muted, accent, options.sectionGapMm));
    const sidebarPct = Math.max(0.2, Math.min(0.45, cv.design.sidebarPct ?? 0.3)) * 100;
    const sideCell: DossierDocxV2FlowCell = { widthPct: sidebarPct, paddingMm: 1.8, blocks: sideBlocks };
    const mainCell: DossierDocxV2FlowCell = { widthPct: 100 - sidebarPct, paddingMm: 2.2, blocks: mainBlocks };
    const cells = options.infoPosition === "mirrored" ? [mainCell, sideCell] : [sideCell, mainCell];
    return [
      {
        kind: "table" as const,
        id: "cv-sidebar-flow",
        rows: [{ cells }],
        afterMm: 0,
      },
    ];
  };

  const modern = options.layout === "modern" || options.layout === "executive";
  blocks.push(...(modern ? renderModernPage(pageKeys(1), true) : renderClassicPage(pageKeys(1), true)));
  const secondPage = pageKeys(2);
  if (secondPage.length) {
    blocks.push({ kind: "page-break", id: "cv-page-2" });
    blocks.push(...(modern ? renderModernPage(secondPage, false) : renderClassicPage(secondPage, false)));
  }

  let photo: DossierDocxV2CvPhoto | null = null;
  if (cv.data.person.foto) {
    const position = resolveCvPhotoPosition(options.photoPlacement, {
      template: String(cv.design.template),
      layout: modern ? "modern" : "classic",
      legacyMirrored: options.infoPosition === "mirrored",
    });
    const width = options.photoPlacement.widthMm;
    const height = width * dossierPhotoRatio(options.photoStyle.shape);
    const x =
      position === "free"
        ? options.photoPlacement.xMm
        : position === "left"
          ? 18
          : 210 - 18 - width;
    const y = position === "free" ? options.photoPlacement.yMm : 20;
    photo = {
      dataUrl: cv.data.person.foto,
      x,
      y,
      width,
      height,
      shape: options.photoStyle.shape,
      zoom: options.photoStyle.zoom,
      imageX: options.photoStyle.x,
      imageY: options.photoStyle.y,
      borderWidth: options.photoStyle.borderWidth,
      borderColor: validHex(options.photoPlacement.frameColor, accent),
    };
    if (position !== "free") {
      issues.push({
        severity: "warning",
        code: "cv-photo-auto-placement-approximate",
        scope: "cv",
        id: "cv-photo",
        message: "CV-Foto nutzt in der Flow-Foundation noch eine sichere Seitenposition; Browser-Messung folgt im Visual-Pass.",
      });
    }
  }

  return {
    templateId: String(cv.design.template),
    paperColor: palette.paper,
    blocks,
    overlays: [],
    artwork: [],
    photo,
    issues,
  };
}

export const dossierDocxV2FlowSceneInternals = {
  wordFont,
  richLetterBlocks,
  sectionGroups,
  standardPlacement,
};
