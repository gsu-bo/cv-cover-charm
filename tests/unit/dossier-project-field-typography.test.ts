import { describe, expect, test } from "bun:test";
import {
  DOSSIER_PROJECT_KIND,
  DOSSIER_PROJECT_VERSION,
  parseDossierProject,
} from "@/lib/dossier-project";

describe("dossier project field typography", () => {
  test("keeps portable field typography as an additive v1 field", () => {
    const project = parseDossierProject({
      kind: DOSSIER_PROJECT_KIND,
      version: DOSSIER_PROJECT_VERSION,
      savedAt: "2026-09-20T21:00:00.000Z",
      letter: { data: {} },
      fieldTypography: {
        version: 1,
        cv: {},
        letter: {
          "field:letter:salutation": {
            section: "Briefinhalt",
            label: "Anrede",
            value: "Guten Tag",
            fieldId: "salutation",
            contextValues: ["Freundliche Grüsse"],
            docxOccurrence: 0,
            style: { bold: true },
          },
        },
      },
    });

    expect(project?.fieldTypography?.letter["field:letter:salutation"]).toEqual({
      section: "Briefinhalt",
      label: "Anrede",
      value: "Guten Tag",
      fieldId: "salutation",
      contextValues: ["Freundliche Grüsse"],
      docxOccurrence: 0,
      style: { bold: true },
    });
  });

  test("drops malformed typography buckets without rejecting the project", () => {
    const project = parseDossierProject({
      kind: DOSSIER_PROJECT_KIND,
      version: DOSSIER_PROJECT_VERSION,
      savedAt: "2026-09-20T21:00:00.000Z",
      cv: { data: {} },
      fieldTypography: {
        version: 1,
        cv: {
          bad: {
            section: "Schule",
            label: "Ort",
            value: "",
            style: { bold: "yes" },
          },
        },
        letter: {},
      },
    });

    expect(project).not.toBeNull();
    expect(project?.fieldTypography).toBeUndefined();
  });
});
