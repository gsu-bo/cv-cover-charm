import { describe, expect, test } from "bun:test";
import { TEMPLATES } from "../../src/components/cover/types";
import { coverPdfDocumentFromSaved } from "../../src/lib/dossier-pdf-document";
import { buildDossierDocxV2CoverScene } from "../../src/lib/dossier-docx-v2-cover-scene";
import { renderDossierDocxV2CoverScene } from "../../src/lib/dossier-docx-v2-cover-renderer";
import { applyDossierDocxV2CoverToDocx } from "../../src/lib/dossier-docx-v2-cover-package";
import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  writeStoredDocxEntries,
} from "../../src/lib/dossier-docx-package";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKp8AAAAASUVORK5CYII=";

function cover(
  template: "freundlich" | "neon",
  layout: Record<string, unknown> = {},
  foto: string | null = null,
) {
  const colors =
    template === "freundlich"
      ? { primary: "#0f766e", secondary: "#f59e0b", ink: "#0b1f24", bg: "#fff9ef" }
      : { bg: "#0d0b2b", primary: "#e11d8f", secondary: "#7c3aed", ink: "#f8fafc" };
  const document = coverPdfDocumentFromSaved({
    version: 3,
    template,
    data: {
      eyebrow: "Bewerbung",
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
      foto,
      showBeilagenOnCover: true,
      beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
    },
    colors: { [template]: colors },
    layout: { [template]: layout },
  });
  if (!document) throw new Error("cover fixture missing");
  return document;
}

function storedDocx() {
  const documentXml =
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
    '<w:p><w:r><w:t>OLD COVER</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr></w:p>' +
    '<w:p><w:r><w:t>LETTER KEEP</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr></w:p>' +
    '<w:p><w:r><w:t>CV KEEP</w:t></w:r></w:p>' +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>' +
    "</w:body></w:document>";
  const rels =
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const types =
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>';
  const encoder = new TextEncoder();
  return new Blob(
    [
      writeStoredDocxEntries([
        { name: "[Content_Types].xml", bytes: encoder.encode(types) },
        { name: "word/document.xml", bytes: encoder.encode(documentXml) },
        { name: "word/_rels/document.xml.rels", bytes: encoder.encode(rels) },
      ]),
    ],
    { type: DOCX_MIME_TYPE },
  );
}

function textEntry(blobBytes: Uint8Array, name: string) {
  const entry = readStoredDocxEntries(blobBytes).find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`${name} missing`);
  return new TextDecoder().decode(entry.bytes);
}

describe("DOCX V2 canonical cover scene", () => {
  test("Warm consumes the user's edited decoration geometry instead of recipe defaults", () => {
    const scene = buildDossierDocxV2CoverScene(
      cover("freundlich", {
        "decor-large-circle": { x: -66.3, y: -69.6, w: 160 },
        "decor-small-circle": { x: 163.6, y: 17.8, w: 80 },
      }),
    );
    expect(scene.nodes.find((node) => node.id === "decor-large-circle")).toMatchObject({
      x: -66.3,
      y: -69.6,
      width: 160,
    });
    expect(scene.nodes.find((node) => node.id === "decor-small-circle")).toMatchObject({
      x: 163.6,
      y: 17.8,
      width: 80,
    });
  });

  test("Neon keeps canonical hero geometry and real gradient stops", () => {
    const scene = buildDossierDocxV2CoverScene(cover("neon"));
    expect(scene.nodes.find((node) => node.id === "name")).toMatchObject({
      x: 22,
      y: 116,
      width: 166,
    });
    expect(scene.nodes.find((node) => node.id === "decor-blob-one")?.gradient).toEqual({
      from: "#7c3aed",
      to: "#e11d8f",
      start: 0,
      end: 100,
      angle: 135,
    });
  });

  test("VML renderer emits the scene geometry instead of Warm geometry", () => {
    const scene = buildDossierDocxV2CoverScene(
      cover("freundlich", { "decor-large-circle": { x: -66.3, y: -69.6 } }),
    );
    const xml = renderDossierDocxV2CoverScene(scene, { initialsValue: "LM" });
    expect(xml).toContain('id="docx-v2-decor-large-circle"');
    expect(xml).toContain("margin-left:-66.3mm;margin-top:-69.6mm");
    expect(xml).not.toContain('id="warm-cover-large-orb"');
  });

  test("real photo nodes retain canonical crop controls", () => {
    const scene = buildDossierDocxV2CoverScene(
      cover("neon", { foto: { imgZoom: 2, imgX: 25, imgY: 75 } }, PNG_DATA_URL),
    );
    expect(scene.nodes.find((node) => node.id === "foto")).toMatchObject({
      mediaDataUrl: PNG_DATA_URL,
      imageZoom: 2,
      imageX: 25,
      imageY: 75,
    });
  });
  test("hidden editor elements stay hidden in the Word scene", () => {
    const scene = buildDossierDocxV2CoverScene(
      cover("freundlich", { name: { hidden: true } }),
    );
    expect(scene.nodes.some((node) => node.id === "name")).toBe(false);
  });

  test("builds a finite baseline scene for every active cover template", () => {
    for (const definition of TEMPLATES) {
      const document = coverPdfDocumentFromSaved({
        version: 3,
        template: definition.id,
        data: {
          vorname: "Lea",
          nachname: "Müller",
          beruf: "Informatiker/in EFZ",
          lehrbeginn: "August 2027",
          adresse: "Dorfstrasse 12",
          plzOrt: "4535 Hubersdorf",
          telefon: "079 123 45 67",
          email: "lea@example.ch",
          ort: "Hubersdorf",
          datum: "20.09.2026",
        },
      });
      expect(document).not.toBeNull();
      const scene = buildDossierDocxV2CoverScene(document!);
      expect(scene.templateId).toBe(String(definition.id));
      expect(scene.nodes.length).toBeGreaterThan(0);
      for (const node of scene.nodes) {
        expect([node.x, node.y, node.width, node.height].every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe("DOCX V2 cover package adapter", () => {
  test("replaces only cover body and preserves the letter/CV sections", async () => {
    const blob = await applyDossierDocxV2CoverToDocx(
      storedDocx(),
      cover("freundlich", { "decor-large-circle": { x: -66.3, y: -69.6 } }),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const xml = textEntry(bytes, "word/document.xml");
    expect(xml).not.toContain("OLD COVER");
    expect(xml).toContain("LETTER KEEP");
    expect(xml).toContain("CV KEEP");
    expect(xml).toContain("margin-left:-66.3mm;margin-top:-69.6mm");
    expect(xml).toContain('xmlns:v="urn:schemas-microsoft-com:vml"');
  });

  test("embeds photo media and maps zoom/pan into DrawingML crop", async () => {
    const blob = await applyDossierDocxV2CoverToDocx(
      storedDocx(),
      cover("neon", { foto: { imgZoom: 2, imgX: 25, imgY: 75 } }, PNG_DATA_URL),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const entries = readStoredDocxEntries(bytes);
    const xml = textEntry(bytes, "word/document.xml");
    const rels = textEntry(bytes, "word/_rels/document.xml.rels");
    expect(entries.some((entry) => entry.name === "word/media/docx-v2-cover-1.png")).toBe(true);
    expect(rels).toContain('Id="rIdDocxV2Cover1"');
    expect(xml).toContain('r:embed="rIdDocxV2Cover1"');
    expect(xml).toContain('<a:srcRect l="12500" t="37500" r="37500" b="12500"/>');
    expect(xml).toContain('prst="ellipse"');
  });

  test("packages freehand paths as SVG media instead of silently dropping them", async () => {
    const document = cover("neon");
    document.blocks.push({
      id: "custom-path",
      label: "Freihand",
      kind: "shape",
      shape: "path",
      path: "M 0 0 L 100 100",
      lines: [],
      style: {
        ...document.blocks[0].style,
        x: 10,
        y: 10,
        w: 20,
        ratio: 1,
        hidden: false,
        fill: null,
        strokeWidth: 1,
      },
    });
    const blob = await applyDossierDocxV2CoverToDocx(storedDocx(), document);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const entries = readStoredDocxEntries(bytes);
    const types = textEntry(bytes, "[Content_Types].xml");
    const media = entries.find((entry) => entry.name === "word/media/docx-v2-cover-1.svg");
    expect(media).toBeDefined();
    expect(types).toContain('Extension="svg" ContentType="image/svg+xml"');
    expect(new TextDecoder().decode(media!.bytes)).toContain('d="M 0 0 L 100 100"');
  });
});
