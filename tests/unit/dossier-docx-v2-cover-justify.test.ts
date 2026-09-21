import { describe, expect, test } from "bun:test";
import { coverPdfDocumentFromSaved } from "../../src/lib/dossier-pdf-document";
import { buildDossierDocxV2CoverScene } from "../../src/lib/dossier-docx-v2-cover-scene";
import { renderDossierDocxV2CoverScene } from "../../src/lib/dossier-docx-v2-cover-renderer";

describe("DOCX V2 cover text alignment", () => {
  test("maps editor justify alignment to Word both", () => {
    const document = coverPdfDocumentFromSaved({
      version: 3,
      template: "freundlich",
      data: {
        vorname: "Lea",
        nachname: "Müller",
        beruf: "Informatiker/in EFZ",
      },
      colors: {
        freundlich: {
          primary: "#0f766e",
          secondary: "#f59e0b",
          ink: "#0b1f24",
          bg: "#fff9ef",
        },
      },
      layout: {
        freundlich: {
          name: { align: "justify" },
        },
      },
    });

    expect(document).not.toBeNull();
    const scene = buildDossierDocxV2CoverScene(document!);
    expect(scene.nodes.find((node) => node.id === "name")?.align).toBe("justify");

    const xml = renderDossierDocxV2CoverScene(scene);
    expect(xml).toContain('<w:jc w:val="both"/>');
  });
});
