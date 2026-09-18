import { describe, expect, test } from "bun:test";
import {
  EMPTY_LETTER,
  emptyLetterDesign,
  type LetterFlowImage,
} from "../../src/components/letter/types";
import { applyLetterImagesToDocx } from "../../src/lib/dossier-docx-letter-images";
import {
  readStoredDocxEntries,
  writeStoredDocxEntries,
  type StoredDocxEntry,
} from "../../src/lib/dossier-docx-package";
import type { LetterPdfDocument } from "../../src/lib/dossier-pdf-document";

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WlY4AAAAASUVORK5CYII=";
const sectionBreak =
  '<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:pPr></w:p>';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type LetterFlowImageWithPlacement = LetterFlowImage & {
  placement?: "left" | "right" | "free";
};

function textEntry(name: string, content: string): StoredDocxEntry {
  return { name, bytes: encoder.encode(content) };
}

function baseBlob() {
  const documentXml = [
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    "<w:p><w:r><w:t>Cover</w:t></w:r></w:p>",
    sectionBreak,
    "<w:p><w:r><w:t>Guten Tag</w:t></w:r></w:p>",
    '<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:docPr id="10" name="Bewerbungsfoto 10"/></wp:inline></w:drawing></w:r></w:p>',
    "<w:p><w:r><w:t>Brieftext</w:t></w:r></w:p>",
    sectionBreak,
    "<w:p><w:r><w:t>CV</w:t></w:r></w:p>",
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>',
    "</w:body></w:document>",
  ].join("");
  const rels =
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const types =
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>';
  return new Blob([
    writeStoredDocxEntries([
      textEntry("word/document.xml", documentXml),
      textEntry("word/_rels/document.xml.rels", rels),
      textEntry("[Content_Types].xml", types),
    ]),
  ]);
}

function letter(): LetterPdfDocument {
  const freeImage: LetterFlowImageWithPlacement = {
    id: "free-middle",
    src: PNG_1X1,
    side: "right",
    placement: "free",
    xMm: 54,
    topMm: 32,
    widthMm: 36,
    gapMm: 4,
  };
  return {
    data: {
      ...EMPTY_LETTER,
      anrede: "Guten Tag",
      images: [
        {
          id: "flow-left",
          src: PNG_1X1,
          side: "left",
          topMm: 6,
          widthMm: 28,
          gapMm: 4,
        },
        freeImage,
      ],
    },
    design: emptyLetterDesign(),
  };
}

describe("DOCX letter image parity", () => {
  test("keeps legacy flow images wrapping and maps explicit free placement to page anchors", async () => {
    const result = await applyLetterImagesToDocx(baseBlob(), letter());
    const entries = readStoredDocxEntries(new Uint8Array(await result.arrayBuffer()));
    const document = decoder.decode(
      entries.find((entry) => entry.name === "word/document.xml")?.bytes ?? new Uint8Array(),
    );
    const rels = decoder.decode(
      entries.find((entry) => entry.name === "word/_rels/document.xml.rels")?.bytes ??
        new Uint8Array(),
    );
    const types = decoder.decode(
      entries.find((entry) => entry.name === "[Content_Types].xml")?.bytes ?? new Uint8Array(),
    );

    expect(document).not.toContain('name="Bewerbungsfoto 10"');
    expect(document).toContain('name="Anschreiben Bild 1"');
    expect(document).toContain('name="Anschreiben Bild 2"');
    expect(document).toContain('<wp:positionH relativeFrom="column">');
    expect(document).toContain('<wp:wrapSquare wrapText="right"/>');
    expect(document).toContain('<wp:positionH relativeFrom="page">');
    expect(document).toContain('<wp:positionV relativeFrom="page">');
    expect(document).toContain("<wp:wrapNone/>");

    expect(rels).toContain('Id="rIdLetterFlowImage1"');
    expect(rels).toContain('Target="media/letter-flow-image-1.png"');
    expect(rels).toContain('Id="rIdLetterFlowImage2"');
    expect(types).toContain('Extension="png" ContentType="image/png"');
    expect(entries.some((entry) => entry.name === "word/media/letter-flow-image-1.png")).toBe(true);
    expect(entries.some((entry) => entry.name === "word/media/letter-flow-image-2.png")).toBe(true);
  });

  test("legacy side plus xMm remains a text-flow anchor instead of becoming free", async () => {
    const legacy = letter();
    legacy.data.images = [
      {
        id: "legacy-right",
        src: PNG_1X1,
        side: "right",
        xMm: 42,
        topMm: 5,
        widthMm: 30,
        gapMm: 3,
      },
    ];
    const result = await applyLetterImagesToDocx(baseBlob(), legacy);
    const entries = readStoredDocxEntries(new Uint8Array(await result.arrayBuffer()));
    const document = decoder.decode(
      entries.find((entry) => entry.name === "word/document.xml")?.bytes ?? new Uint8Array(),
    );
    expect(document).toContain('<wp:positionH relativeFrom="column">');
    expect(document).toContain('<wp:wrapSquare wrapText="left"/>');
    expect(document).not.toContain('<wp:wrapNone/>');
  });
});
