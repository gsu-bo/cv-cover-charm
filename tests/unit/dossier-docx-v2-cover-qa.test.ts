import { describe, expect, test } from "bun:test";
import { TEMPLATES } from "../../src/components/cover/types";
import { coverPdfDocumentFromSaved } from "../../src/lib/dossier-pdf-document";
import { buildDossierDocxV2CoverScene } from "../../src/lib/dossier-docx-v2-cover-scene";
import {
  assertDossierDocxV2CoverAccepted,
  auditDossierDocxV2Cover,
} from "../../src/lib/dossier-docx-v2-cover-qa";

function defaultCover(template: (typeof TEMPLATES)[number]["id"]) {
  const document = coverPdfDocumentFromSaved({
    version: 3,
    template,
    data: {
      eyebrow: "Bewerbung",
      kicker: "Bewerbung um eine Lehrstelle als",
      vorname: "Lea",
      nachname: "Müller",
      beruf: "Informatiker/in EFZ",
      lehrbeginn: "August 2027",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "079 123 45 67",
      email: "lea@example.ch",
      geburtsdatum: "14.03.2010",
      ort: "Hubersdorf",
      datum: "20.09.2026",
      showBeilagenOnCover: true,
      beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
    },
  });
  if (!document) throw new Error(`fixture missing for ${template}`);
  return document;
}

describe("DOCX V2 cover acceptance gate", () => {
  test("all active templates have a structurally acceptable canonical scene", () => {
    expect(TEMPLATES.length).toBe(39);
    for (const definition of TEMPLATES) {
      const scene = buildDossierDocxV2CoverScene(defaultCover(definition.id));
      const report = auditDossierDocxV2Cover({
        baseline: scene,
        rendered: scene,
        measuredInBrowser: false,
      });
      expect(report.blockerCount).toBe(0);
      expect(report.accepted).toBe(true);
    }
  });

  test("browser mode fails closed when a visible node was not measured", () => {
    const scene = buildDossierDocxV2CoverScene(defaultCover("freundlich"));
    const report = auditDossierDocxV2Cover({
      baseline: scene,
      rendered: scene,
      measuredInBrowser: true,
      unmeasuredNodeIds: ["name"],
    });
    expect(report.accepted).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        severity: "blocker",
        code: "unmeasured-browser-node",
        nodeId: "name",
      }),
    );
    expect(() => assertDossierDocxV2CoverAccepted(report)).toThrow();
  });

  test("structural templates cannot silently lose their background capture", () => {
    const scene = buildDossierDocxV2CoverScene(defaultCover("citrus"));
    const report = auditDossierDocxV2Cover({
      baseline: scene,
      rendered: scene,
      measuredInBrowser: true,
      structuralBackgroundRequired: true,
      structuralBackgroundDataUrl: null,
    });
    expect(report.accepted).toBe(false);
    expect(report.issues.some((issue) => issue.code === "structural-background-missing")).toBe(
      true,
    );
  });

  test("late browser/PDF layout changes are reported instead of mistaken for canonical data", () => {
    const baseline = buildDossierDocxV2CoverScene(defaultCover("neon"));
    const rendered = {
      ...baseline,
      nodes: baseline.nodes.map((node) =>
        node.id === "name" ? { ...node, x: node.x + 8, y: node.y - 3 } : node,
      ),
    };
    const report = auditDossierDocxV2Cover({
      baseline,
      rendered,
      measuredInBrowser: true,
    });
    expect(report.accepted).toBe(true);
    expect(report.lateLayoutNodeIds).toContain("name");
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        severity: "info",
        code: "late-layout-adjustment",
        nodeId: "name",
      }),
    );
  });

  test("real content completely outside A4 is a blocker while decoration may bleed", () => {
    const baseline = buildDossierDocxV2CoverScene(defaultCover("freundlich"));
    const name = baseline.nodes.find((node) => node.id === "name");
    const decor = baseline.nodes.find((node) => node.id.startsWith("decor-"));
    if (!name || !decor) throw new Error("fixture missing name/decor");

    const rendered = {
      ...baseline,
      nodes: baseline.nodes.map((node) => {
        if (node.id === name.id) return { ...node, x: 230 };
        if (node.id === decor.id) return { ...node, x: -300 };
        return node;
      }),
    };
    const report = auditDossierDocxV2Cover({
      baseline,
      rendered,
      measuredInBrowser: true,
    });
    expect(report.accepted).toBe(false);
    expect(
      report.issues.some(
        (issue) => issue.code === "content-outside-page" && issue.nodeId === name.id,
      ),
    ).toBe(true);
    expect(
      report.issues.some(
        (issue) => issue.code === "content-outside-page" && issue.nodeId === decor.id,
      ),
    ).toBe(false);
  });
});
