import type {
  DossierDocxV2MeasuredCv,
  DossierDocxV2MeasuredFlow,
  DossierDocxV2MeasuredLetter,
  DossierDocxV2MeasuredText,
} from "@/lib/dossier-docx-v2-flow-browser";
import type {
  DossierDocxV2CvFlowScene,
  DossierDocxV2FlowBlock,
  DossierDocxV2FlowIssue,
  DossierDocxV2FlowParagraph,
  DossierDocxV2LetterFlowScene,
} from "@/lib/dossier-docx-v2-flow-scene";

function normalized(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function paragraphText(paragraph: DossierDocxV2FlowParagraph) {
  return normalized(paragraph.runs.map((run) => run.text).join(""));
}

function semanticForParagraph(id: string | undefined) {
  if (!id) return null;
  if (id.startsWith("attachment-") && !id.startsWith("attachments-")) return "attachments-body";
  for (const semantic of [
    "sender",
    "recipient",
    "date",
    "subject",
    "salutation",
    "closing",
    "signature",
    "attachments-heading",
    "attachments-body",
  ]) {
    if (id === semantic || id.startsWith(`${semantic}-`)) return semantic;
  }
  return null;
}

function matchingMetric(
  paragraph: DossierDocxV2FlowParagraph,
  metrics: DossierDocxV2MeasuredText[],
) {
  const semantic = semanticForParagraph(paragraph.id);
  if (!semantic) return null;
  const candidates = metrics.filter((metric) => metric.semantic === semantic);
  if (!candidates.length) return null;
  const text = paragraphText(paragraph);
  return candidates.find((metric) => normalized(metric.text) === text) ?? candidates[0];
}

function calibrateParagraph(
  paragraph: DossierDocxV2FlowParagraph,
  metrics: DossierDocxV2MeasuredText[],
) {
  const metric = matchingMetric(paragraph, metrics);
  if (!metric) return paragraph;
  return {
    ...paragraph,
    align: metric.align,
    lineHeight: metric.lineHeight,
    runs: paragraph.runs.map((run) => ({ ...run, ...metric.style, text: run.text })),
  };
}

function calibrateBlock(
  block: DossierDocxV2FlowBlock,
  metrics: DossierDocxV2MeasuredText[],
): DossierDocxV2FlowBlock {
  if (block.kind === "paragraph") return calibrateParagraph(block, metrics);
  if (block.kind !== "table") return block;
  return {
    ...block,
    rows: block.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({
        ...cell,
        blocks: cell.blocks.map((child) => calibrateBlock(child, metrics)),
      })),
    })),
  };
}

function isBodyBlock(block: DossierDocxV2FlowBlock) {
  return !!block.id?.startsWith("body-");
}

function bodyInsertionIndex(blocks: DossierDocxV2FlowBlock[]) {
  const body = blocks.findIndex(isBodyBlock);
  if (body >= 0) return body;
  const salutation = blocks.findIndex((block) => block.id === "salutation");
  if (salutation >= 0) return salutation + 1;
  const subject = blocks.findIndex((block) => block.id === "subject");
  if (subject >= 0) return subject + 1;
  const date = blocks.findIndex((block) => block.id === "date");
  if (date >= 0) return date + 1;
  const recipient = blocks.findIndex((block) => block.id === "recipient-block");
  return recipient >= 0 ? recipient + 1 : 0;
}

function browserBodyBlocks(measured: DossierDocxV2MeasuredLetter) {
  const output: DossierDocxV2FlowBlock[] = [];
  for (const page of measured.pages) {
    if (page.pageIndex > 0) {
      output.push({ kind: "page-break", id: `letter-browser-page-${page.pageIndex + 1}` });
    }
    output.push(...page.bodyBlocks);
  }
  return output;
}

function dedupeIssues(issues: DossierDocxV2FlowIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.scope}|${issue.code}|${issue.id ?? ""}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function calibrateDossierDocxV2LetterFlowScene(
  scene: DossierDocxV2LetterFlowScene,
  measured: DossierDocxV2MeasuredLetter,
): DossierDocxV2LetterFlowScene {
  const allMetrics = measured.pages.flatMap((page) => page.text);
  const calibrated = scene.blocks.map((block) => calibrateBlock(block, allMetrics));
  const kept = calibrated.filter((block) => !isBodyBlock(block));
  const insertion = bodyInsertionIndex(calibrated);
  const keptBeforeInsertion = calibrated.slice(0, insertion).filter((block) => !isBodyBlock(block)).length;
  kept.splice(keptBeforeInsertion, 0, ...browserBodyBlocks(measured));

  const floating = scene.floating.map((box) => ({
    ...box,
    blocks: box.blocks.map((block) => calibrateBlock(block, allMetrics)),
  }));
  return {
    ...scene,
    blocks: kept,
    floating,
    issues: dedupeIssues([...scene.issues, ...measured.issues]),
  };
}

function scenePageCount(blocks: DossierDocxV2FlowBlock[]) {
  return 1 + blocks.filter((block) => block.kind === "page-break").length;
}

function blockText(block: DossierDocxV2FlowBlock): string {
  if (block.kind === "paragraph") return block.runs.map((run) => run.text).join(" ");
  if (block.kind === "table") {
    return block.rows
      .flatMap((row) => row.cells.flatMap((cell) => cell.blocks.map(blockText)))
      .join(" ");
  }
  return "";
}

function rowText(row: Extract<DossierDocxV2FlowBlock, { kind: "table" }>["rows"][number]) {
  return row.cells.flatMap((cell) => cell.blocks.map(blockText)).join(" ");
}

function compact(value: string) {
  return normalized(value).toLocaleLowerCase("de-CH").replace(/\s+/g, "");
}

function matchesBoundary(candidate: string, boundary: string) {
  const a = compact(candidate);
  const b = compact(boundary);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function splitClassicBlocksAtBoundary(
  blocks: DossierDocxV2FlowBlock[],
  boundary: string,
): { before: DossierDocxV2FlowBlock[]; after: DossierDocxV2FlowBlock[] } | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.kind === "page-break" || block.kind === "spacer") continue;
    if (matchesBoundary(blockText(block), boundary)) {
      return { before: blocks.slice(0, index), after: blocks.slice(index) };
    }
    if (block.kind !== "table") continue;
    const rowIndex = block.rows.findIndex((row) => matchesBoundary(rowText(row), boundary));
    if (rowIndex < 0) continue;
    if (rowIndex === 0) return { before: blocks.slice(0, index), after: blocks.slice(index) };
    const beforeTable = {
      ...block,
      id: block.id ? `${block.id}-before-browser-break` : undefined,
      rows: block.rows.slice(0, rowIndex),
      afterMm: 0,
    };
    const afterTable = {
      ...block,
      id: block.id ? `${block.id}-after-browser-break` : undefined,
      rows: block.rows.slice(rowIndex),
    };
    return {
      before: [...blocks.slice(0, index), beforeTable],
      after: [afterTable, ...blocks.slice(index + 1)],
    };
  }
  return null;
}

function calibrateClassicCvPagination(
  blocks: DossierDocxV2FlowBlock[],
  measured: DossierDocxV2MeasuredCv,
) {
  if (measured.layout !== "classic" || measured.pageCount <= 1) return null;
  const boundaries = measured.pages
    .slice(1)
    .map((page) => page.mainRows[0] ?? "")
    .filter(Boolean);
  if (boundaries.length !== measured.pageCount - 1) return null;

  let remaining: DossierDocxV2FlowBlock[] = blocks.filter((block) => block.kind !== "page-break");
  const output: DossierDocxV2FlowBlock[] = [];
  for (const [index, boundary] of boundaries.entries()) {
    const split = splitClassicBlocksAtBoundary(remaining, boundary);
    if (!split) return null;
    output.push(...split.before, { kind: "page-break", id: `cv-browser-page-${index + 2}` });
    remaining = split.after;
  }
  output.push(...remaining);
  return output;
}

export function calibrateDossierDocxV2CvFlowScene(
  scene: DossierDocxV2CvFlowScene,
  measured: DossierDocxV2MeasuredCv,
): DossierDocxV2CvFlowScene {
  const issues = [...scene.issues, ...measured.issues].filter(
    (issue) => issue.code !== "cv-photo-auto-placement-approximate",
  );
  let blocks = scene.blocks;
  let overlays = scene.overlays;
  let artwork = scene.artwork;
  if (measured.measuredInBrowser && measured.layout === "classic") {
    const browserPagination = calibrateClassicCvPagination(scene.blocks, measured);
    if (browserPagination) blocks = browserPagination;
  }
  if (measured.measuredInBrowser && measured.layout === "modern") {
    overlays = measured.pages.flatMap((page) => page.overlays);
    const missingMain = measured.pages.filter(
      (page) => !page.overlays.some((overlay) => overlay.role === "main"),
    );
    if (missingMain.length) {
      issues.push({
        severity: "blocker",
        code: "cv-browser-modern-main-missing",
        scope: "cv",
        message: `Die Browser-Messung enthält auf ${missingMain.length} Modern-CV-Seite(n) keinen Hauptbereich. V2 stoppt statt auf geschätzte Geometrie zurückzufallen.`,
      });
    } else {
      blocks = measured.pages.flatMap((page, index) =>
        index === 0 ? [] : [{ kind: "page-break" as const, id: `cv-browser-page-${page.pageIndex + 1}` }],
      );
    }
  }
  if (measured.measuredInBrowser && measured.artwork.length) {
    artwork = measured.artwork;
  }
  const expectedPages = scenePageCount(blocks);
  if (
    measured.measuredInBrowser &&
    measured.pageCount > 0 &&
    measured.layout !== "modern" &&
    measured.pageCount !== expectedPages
  ) {
    issues.push({
      severity: "blocker",
      code: "cv-browser-pagination-mismatch",
      scope: "cv",
      message: `Browser/PDF verwendet ${measured.pageCount} CV-Seite(n), der aktuelle Word-Flow ${expectedPages}. V2 stoppt statt still anders umzubrechen.`,
    });
  }

  let photo = scene.photo;
  if (photo && measured.measuredInBrowser) {
    if (!measured.photo) {
      issues.push({
        severity: "blocker",
        code: "cv-browser-photo-missing",
        scope: "cv",
        id: "cv-photo",
        message: "Das CV-Foto existiert im V2-Modell, konnte aber in der echten Browser-Seite nicht vermessen werden.",
      });
    } else if (measured.photo.pageIndex !== 0) {
      issues.push({
        severity: "blocker",
        code: "cv-browser-photo-page-unsupported",
        scope: "cv",
        id: "cv-photo",
        message: "Das Browser-CV platziert das Foto nicht auf Seite 1; dieser Zustand braucht einen seitengebundenen Word-Anker.",
      });
    } else {
      photo = {
        ...photo,
        x: measured.photo.x,
        y: measured.photo.y,
        width: measured.photo.width,
        height: measured.photo.height,
        borderWidth: measured.photo.borderWidth,
        borderColor: measured.photo.borderColor,
      };
    }
  }

  return { ...scene, blocks, overlays, artwork, photo, issues: dedupeIssues(issues) };
}

export function calibrateDossierDocxV2FlowScenes(
  scenes: { letter: DossierDocxV2LetterFlowScene; cv: DossierDocxV2CvFlowScene },
  measured: DossierDocxV2MeasuredFlow,
) {
  return {
    letter: calibrateDossierDocxV2LetterFlowScene(scenes.letter, measured.letter),
    cv: calibrateDossierDocxV2CvFlowScene(scenes.cv, measured.cv),
  };
}

export const dossierDocxV2FlowCalibrationInternals = {
  semanticForParagraph,
  isBodyBlock,
  bodyInsertionIndex,
  scenePageCount,
  blockText,
  splitClassicBlocksAtBoundary,
  calibrateClassicCvPagination,
};
