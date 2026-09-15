import { describe, expect, test } from "bun:test";
import {
  embedCabinFontsInDossierDocxBlob,
  obfuscateOoxmlFont,
} from "../../src/lib/dossier-docx-font-embed";
import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  writeStoredDocxEntries,
} from "../../src/lib/dossier-docx-package";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function minimalDocx() {
  return new Blob(
    [
      writeStoredDocxEntries([
        {
          name: "[Content_Types].xml",
          bytes: encoder.encode(
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
          ),
        },
        {
          name: "word/fontTable.xml",
          bytes: encoder.encode(
            '<?xml version="1.0"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:font w:name="Cabin"><w:altName w:val="Trebuchet MS"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>',
          ),
        },
        {
          name: "word/settings.xml",
          bytes: encoder.encode(
            '<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat/></w:settings>',
          ),
        },
        {
          name: "word/document.xml",
          bytes: encoder.encode("<w:document/>")
        },
      ]),
    ],
    { type: DOCX_MIME_TYPE },
  );
}

function fakeFont(seed: number) {
  const bytes = new Uint8Array(96);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (seed + i) & 0xff;
  return bytes;
}

describe("DOCX Cabin portability", () => {
  test("OOXML font obfuscation changes only the first 32 bytes and round-trips", () => {
    const original = fakeFont(17);
    const key = "{0A4C0C1E-4B3A-4A7C-8B36-8DF50F034991}";
    const encoded = obfuscateOoxmlFont(original, key);
    expect([...encoded.slice(0, 32)]).not.toEqual([...original.slice(0, 32)]);
    expect([...encoded.slice(32)]).toEqual([...original.slice(32)]);
    expect([...obfuscateOoxmlFont(encoded, key)]).toEqual([...original]);
  });

  test("embeds all four Cabin faces with Word font relationships", async () => {
    const sourceFonts = new Map([
      ["Cabin-Regular.ttf", fakeFont(1)],
      ["Cabin-Bold.ttf", fakeFont(2)],
      ["Cabin-Italic.ttf", fakeFont(3)],
      ["Cabin-BoldItalic.ttf", fakeFont(4)],
    ]);
    const blob = await embedCabinFontsInDossierDocxBlob(
      minimalDocx(),
      async (fileName) => sourceFonts.get(fileName)?.slice() ?? null,
    );
    const entries = readStoredDocxEntries(new Uint8Array(await blob.arrayBuffer()));
    const names = entries.map((entry) => entry.name);

    for (const part of [
      "word/fonts/Cabin-Regular.odttf",
      "word/fonts/Cabin-Bold.odttf",
      "word/fonts/Cabin-Italic.odttf",
      "word/fonts/Cabin-BoldItalic.odttf",
      "word/_rels/fontTable.xml.rels",
    ]) {
      expect(names).toContain(part);
    }

    const contentTypes = decoder.decode(
      entries.find((entry) => entry.name === "[Content_Types].xml")?.bytes,
    );
    expect(contentTypes).toContain("application/vnd.openxmlformats-officedocument.obfuscatedFont");

    const settings = decoder.decode(entries.find((entry) => entry.name === "word/settings.xml")?.bytes);
    expect(settings).toContain("<w:embedTrueTypeFonts/>");

    const fontTable = decoder.decode(
      entries.find((entry) => entry.name === "word/fontTable.xml")?.bytes,
    );
    expect(fontTable).toContain("xmlns:r=");
    expect(fontTable).toContain("<w:embedRegular");
    expect(fontTable).toContain("<w:embedBold");
    expect(fontTable).toContain("<w:embedItalic");
    expect(fontTable).toContain("<w:embedBoldItalic");

    const relationships = decoder.decode(
      entries.find((entry) => entry.name === "word/_rels/fontTable.xml.rels")?.bytes,
    );
    expect((relationships.match(/relationships\/font/g) ?? []).length).toBe(4);
  });
});
