import type {
  DossierDocxV2CvFlowScene,
  DossierDocxV2FlowIssue,
  DossierDocxV2LetterFlowScene,
} from "@/lib/dossier-docx-v2-flow-scene";

export type DossierDocxV2FlowQaReport = {
  accepted: boolean;
  blockers: DossierDocxV2FlowIssue[];
  warnings: DossierDocxV2FlowIssue[];
  info: DossierDocxV2FlowIssue[];
};

export function auditDossierDocxV2Flow(
  letter: DossierDocxV2LetterFlowScene,
  cv: DossierDocxV2CvFlowScene,
): DossierDocxV2FlowQaReport {
  const issues = [...letter.issues, ...cv.issues];
  const blockers = issues.filter((issue) => issue.severity === "blocker");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const info = issues.filter((issue) => issue.severity === "info");
  return { accepted: blockers.length === 0, blockers, warnings, info };
}

export function assertDossierDocxV2FlowAccepted(
  letter: DossierDocxV2LetterFlowScene,
  cv: DossierDocxV2CvFlowScene,
) {
  const report = auditDossierDocxV2Flow(letter, cv);
  if (report.accepted) return report;
  throw new Error(
    `DOCX V2 Flow QA blockiert den Shadow-Export: ${report.blockers.map((issue) => `${issue.scope}/${issue.code}${issue.id ? `:${issue.id}` : ""}`).join(", ")}`,
  );
}
