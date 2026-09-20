import type {
  DossierDocxV2CoverNode,
  DossierDocxV2CoverScene,
} from "@/lib/dossier-docx-v2-cover-scene";

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const GEOMETRY_EPSILON_MM = 0.05;
const CONTENT_OVERFLOW_WARNING_MM = 1;
const LATE_LAYOUT_POSITION_MM = 0.75;
const LATE_LAYOUT_SIZE_MM = 0.75;
const LATE_LAYOUT_FONT_PT = 0.75;

export type DossierDocxV2QaSeverity = "blocker" | "warning" | "info";

export type DossierDocxV2QaCode =
  | "non-finite-geometry"
  | "non-positive-size"
  | "unmeasured-browser-node"
  | "structural-background-missing"
  | "content-outside-page"
  | "content-overflow"
  | "text-lost"
  | "late-layout-adjustment";

export type DossierDocxV2QaIssue = {
  code: DossierDocxV2QaCode;
  severity: DossierDocxV2QaSeverity;
  nodeId?: string;
  message: string;
  metrics?: Record<string, number>;
};

export type DossierDocxV2CoverQaReport = {
  templateId: string;
  accepted: boolean;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  measuredInBrowser: boolean;
  structuralBackgroundRequired: boolean;
  lateLayoutNodeIds: string[];
  issues: DossierDocxV2QaIssue[];
};

export type DossierDocxV2CoverQaInput = {
  baseline: DossierDocxV2CoverScene;
  rendered: DossierDocxV2CoverScene;
  measuredInBrowser: boolean;
  unmeasuredNodeIds?: readonly string[];
  structuralBackgroundRequired?: boolean;
  structuralBackgroundDataUrl?: string | null;
};

function textValue(node: DossierDocxV2CoverNode) {
  return node.lines
    .flatMap((line) => line.runs.map((run) => run.text))
    .join("")
    .trim();
}

function finiteGeometry(node: DossierDocxV2CoverNode) {
  return [node.x, node.y, node.width, node.height].every(Number.isFinite);
}

function intersectsPage(node: DossierDocxV2CoverNode) {
  return (
    node.x + node.width > GEOMETRY_EPSILON_MM &&
    node.y + node.height > GEOMETRY_EPSILON_MM &&
    node.x < PAGE_WIDTH_MM - GEOMETRY_EPSILON_MM &&
    node.y < PAGE_HEIGHT_MM - GEOMETRY_EPSILON_MM
  );
}

function contentNode(node: DossierDocxV2CoverNode) {
  return node.layer === "content" || node.layer === "front";
}

function geometryDelta(a: DossierDocxV2CoverNode, b: DossierDocxV2CoverNode) {
  return {
    x: Math.abs(a.x - b.x),
    y: Math.abs(a.y - b.y),
    width: Math.abs(a.width - b.width),
    height: Math.abs(a.height - b.height),
    font: a.kind === "text" && b.kind === "text" ? Math.abs(a.fontSizePt - b.fontSizePt) : 0,
  };
}

function hasMeaningfulLateLayout(
  baseline: DossierDocxV2CoverNode,
  rendered: DossierDocxV2CoverNode,
) {
  const delta = geometryDelta(baseline, rendered);
  return (
    delta.x > LATE_LAYOUT_POSITION_MM ||
    delta.y > LATE_LAYOUT_POSITION_MM ||
    delta.width > LATE_LAYOUT_SIZE_MM ||
    delta.height > LATE_LAYOUT_SIZE_MM ||
    delta.font > LATE_LAYOUT_FONT_PT ||
    baseline.align !== rendered.align ||
    baseline.font !== rendered.font
  );
}

function issue(
  issues: DossierDocxV2QaIssue[],
  severity: DossierDocxV2QaSeverity,
  code: DossierDocxV2QaCode,
  message: string,
  nodeId?: string,
  metrics?: Record<string, number>,
) {
  issues.push({ severity, code, message, nodeId, metrics });
}

/**
 * Acceptance contract for the shadow DOCX V2 cover renderer.
 *
 * Blockers are things that may never silently reach production. Warnings are
 * visible parity risks worth reviewing in the 39-template gallery. "Late
 * layout" is informational: the browser measurement bridge intentionally owns
 * those CSS/template adjustments until they are migrated into canonical data.
 */
export function auditDossierDocxV2Cover(
  input: DossierDocxV2CoverQaInput,
): DossierDocxV2CoverQaReport {
  const {
    baseline,
    rendered,
    measuredInBrowser,
    unmeasuredNodeIds = [],
    structuralBackgroundRequired = false,
    structuralBackgroundDataUrl = null,
  } = input;
  const issues: DossierDocxV2QaIssue[] = [];
  const renderedById = new Map(rendered.nodes.map((node) => [node.id, node]));
  const baselineById = new Map(baseline.nodes.map((node) => [node.id, node]));

  for (const node of rendered.nodes) {
    if (!finiteGeometry(node)) {
      issue(
        issues,
        "blocker",
        "non-finite-geometry",
        `Node ${node.id} contains non-finite A4 geometry.`,
        node.id,
      );
      continue;
    }
    if (node.width <= 0 || node.height <= 0) {
      issue(
        issues,
        "blocker",
        "non-positive-size",
        `Node ${node.id} has no printable size.`,
        node.id,
        { width: node.width, height: node.height },
      );
      continue;
    }

    if (!contentNode(node)) continue;
    if (!intersectsPage(node)) {
      issue(
        issues,
        "blocker",
        "content-outside-page",
        `Visible content node ${node.id} is completely outside A4.`,
        node.id,
        { x: node.x, y: node.y, width: node.width, height: node.height },
      );
      continue;
    }

    const left = Math.max(0, -node.x);
    const top = Math.max(0, -node.y);
    const right = Math.max(0, node.x + node.width - PAGE_WIDTH_MM);
    const bottom = Math.max(0, node.y + node.height - PAGE_HEIGHT_MM);
    const overflow = Math.max(left, top, right, bottom);
    if (overflow > CONTENT_OVERFLOW_WARNING_MM) {
      issue(
        issues,
        "warning",
        "content-overflow",
        `Visible content node ${node.id} crosses the A4 edge by ${overflow.toFixed(1)} mm.`,
        node.id,
        { left, top, right, bottom },
      );
    }
  }

  if (measuredInBrowser) {
    for (const nodeId of unmeasuredNodeIds) {
      issue(
        issues,
        "blocker",
        "unmeasured-browser-node",
        `CoverCanvas did not expose DOM geometry for ${nodeId}; V2 must not silently fall back.`,
        nodeId,
      );
    }

    if (structuralBackgroundRequired && !structuralBackgroundDataUrl) {
      issue(
        issues,
        "blocker",
        "structural-background-missing",
        "This template needs structural browser artwork, but no background capture was produced.",
      );
    }

    for (const baselineNode of baseline.nodes) {
      const renderedNode = renderedById.get(baselineNode.id);
      if (!renderedNode) continue;
      if (
        baselineNode.kind === "text" &&
        textValue(baselineNode) &&
        !textValue(renderedNode)
      ) {
        issue(
          issues,
          "blocker",
          "text-lost",
          `Rendered browser scene lost visible text from ${baselineNode.id}.`,
          baselineNode.id,
        );
      }
    }
  }

  const lateLayoutNodeIds =
    measuredInBrowser
      ? baseline.nodes
          .filter((baselineNode) => {
            const renderedNode = renderedById.get(baselineNode.id);
            return renderedNode ? hasMeaningfulLateLayout(baselineNode, renderedNode) : false;
          })
          .map((node) => node.id)
      : [];

  for (const nodeId of lateLayoutNodeIds) {
    const baselineNode = baselineById.get(nodeId)!;
    const renderedNode = renderedById.get(nodeId)!;
    issue(
      issues,
      "info",
      "late-layout-adjustment",
      `Browser/PDF styling materially adjusts ${nodeId}; measured geometry remains authoritative.`,
      nodeId,
      geometryDelta(baselineNode, renderedNode),
    );
  }

  const blockerCount = issues.filter((candidate) => candidate.severity === "blocker").length;
  const warningCount = issues.filter((candidate) => candidate.severity === "warning").length;
  const infoCount = issues.filter((candidate) => candidate.severity === "info").length;

  return {
    templateId: rendered.templateId,
    accepted: blockerCount === 0,
    blockerCount,
    warningCount,
    infoCount,
    measuredInBrowser,
    structuralBackgroundRequired,
    lateLayoutNodeIds,
    issues,
  };
}

export function assertDossierDocxV2CoverAccepted(report: DossierDocxV2CoverQaReport) {
  if (report.accepted) return;
  const summary = report.issues
    .filter((issue) => issue.severity === "blocker")
    .slice(0, 4)
    .map((issue) => `${issue.code}${issue.nodeId ? `:${issue.nodeId}` : ""}`)
    .join(", ");
  throw new Error(
    `DOCX V2 cover QA rejected ${report.templateId}: ${summary || "unknown blocker"}.`,
  );
}
