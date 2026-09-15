import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  writeStoredDocxEntries,
  type StoredDocxEntry,
} from "@/lib/dossier-docx-package";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const FONT_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font";
const OFFICE_RELATIONSHIPS_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const OBFUSCATED_FONT_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.obfuscatedFont";

type CabinFace = {
  fileName: string;
  partName: string;
  relId: string;
  embedTag: "embedRegular" | "embedBold" | "embedItalic" | "embedBoldItalic";
  fontKey: string;
};

const CABIN_FACES: readonly CabinFace[] = [
  {
    fileName: "Cabin-Regular.ttf",
    partName: "word/fonts/Cabin-Regular.odttf",
    relId: "rIdCabinRegular",
    embedTag: "embedRegular",
    fontKey: "{0A4C0C1E-4B3A-4A7C-8B36-8DF50F034991}",
  },
  {
    fileName: "Cabin-Bold.ttf",
    partName: "word/fonts/Cabin-Bold.odttf",
    relId: "rIdCabinBold",
    embedTag: "embedBold",
    fontKey: "{B73AC3CB-7D42-4FEF-925B-85F5C20D9E62}",
  },
  {
    fileName: "Cabin-Italic.ttf",
    partName: "word/fonts/Cabin-Italic.odttf",
    relId: "rIdCabinItalic",
    embedTag: "embedItalic",
    fontKey: "{61D3908B-6B96-4C6A-BA37-2A5FC86E4C91}",
  },
  {
    fileName: "Cabin-BoldItalic.ttf",
    partName: "word/fonts/Cabin-BoldItalic.odttf",
    relId: "rIdCabinBoldItalic",
    embedTag: "embedBoldItalic",
    fontKey: "{CCF65E33-AE8F-4190-8144-473FA63BC205}",
  },
] as const;

export type DossierDocxFontLoader = (fileName: string) => Promise<Uint8Array | null>;

function fontKeyBytes(fontKey: string) {
  const hex = fontKey.replace(/[{}-]/g, "");
  if (!/^[0-9A-F]{32}$/i.test(hex)) throw new Error(`Ungültiger DOCX fontKey: ${fontKey}`);
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** ECMA-376 font obfuscation is symmetric: applying this twice restores the TTF. */
export function obfuscateOoxmlFont(bytes: Uint8Array, fontKey: string) {
  const key = fontKeyBytes(fontKey);
  const output = bytes.slice();
  for (let i = 0; i < Math.min(32, output.length); i += 1) {
    output[i] ^= key[15 - (i % 16)];
  }
  return output;
}

async function browserCabinFontLoader(fileName: string) {
  if (typeof window === "undefined" || typeof fetch !== "function") return null;
  const url = new URL(`/fonts/${fileName}`, window.location.origin);
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Cabin-Font für DOCX konnte nicht geladen werden: ${fileName}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function textEntry(entries: StoredDocxEntry[], name: string) {
  const entry = entries.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`DOCX-Font-Embedding: ${name} fehlt.`);
  return entry;
}

function replaceTextEntry(
  entries: StoredDocxEntry[],
  name: string,
  transform: (source: string) => string,
) {
  const entry = textEntry(entries, name);
  entry.bytes = encoder.encode(transform(decoder.decode(entry.bytes)));
}

function patchContentTypes(source: string) {
  if (source.includes('Extension="odttf"')) return source;
  return source.replace(
    "</Types>",
    `<Default Extension="odttf" ContentType="${OBFUSCATED_FONT_CONTENT_TYPE}"/></Types>`,
  );
}

function patchFontTable(source: string) {
  let xml = source.includes("xmlns:r=")
    ? source
    : source.replace("<w:fonts ", `<w:fonts xmlns:r="${OFFICE_RELATIONSHIPS_NS}" `);

  const embeds = CABIN_FACES.map(
    (face) =>
      `<w:${face.embedTag} r:id="${face.relId}" w:fontKey="${face.fontKey}"/>`,
  ).join("");
  const cabinPattern = /(<w:font w:name="Cabin">)([\s\S]*?)(<\/w:font>)/;
  if (!cabinPattern.test(xml)) throw new Error("DOCX-Font-Embedding: Cabin fehlt in fontTable.xml.");
  xml = xml.replace(cabinPattern, (_match, open: string, body: string, close: string) => {
    const cleanBody = body.replace(/<w:embed(?:Regular|Bold|Italic|BoldItalic)\b[^>]*\/>/g, "");
    return `${open}${cleanBody}${embeds}${close}`;
  });
  return xml;
}

function patchSettings(source: string) {
  if (source.includes("<w:embedTrueTypeFonts")) return source;
  return source.replace("</w:settings>", "<w:embedTrueTypeFonts/></w:settings>");
}

function fontRelationshipsXml() {
  const relationships = CABIN_FACES.map(
    (face) =>
      `<Relationship Id="${face.relId}" Type="${FONT_RELATIONSHIP}" Target="fonts/${face.partName.split("/").pop()}"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}">${relationships}</Relationships>`;
}

export async function embedCabinFontsInDossierDocxBlob(
  blob: Blob,
  loadFont: DossierDocxFontLoader = browserCabinFontLoader,
) {
  const loaded = await Promise.all(
    CABIN_FACES.map(async (face) => ({ face, bytes: await loadFont(face.fileName) })),
  );
  if (loaded.every(({ bytes }) => bytes === null)) return blob;
  if (loaded.some(({ bytes }) => bytes === null)) {
    throw new Error("DOCX-Font-Embedding: Cabin konnte nicht vollständig geladen werden.");
  }

  const entries = readStoredDocxEntries(
    new Uint8Array(await blob.arrayBuffer()),
    "DOCX-Font-Embedding",
  ).filter(
    (entry) =>
      entry.name !== "word/_rels/fontTable.xml.rels" &&
      !CABIN_FACES.some((face) => face.partName === entry.name),
  );

  replaceTextEntry(entries, "[Content_Types].xml", patchContentTypes);
  replaceTextEntry(entries, "word/fontTable.xml", patchFontTable);
  replaceTextEntry(entries, "word/settings.xml", patchSettings);

  entries.push({
    name: "word/_rels/fontTable.xml.rels",
    bytes: encoder.encode(fontRelationshipsXml()),
  });
  for (const { face, bytes } of loaded) {
    entries.push({
      name: face.partName,
      bytes: obfuscateOoxmlFont(bytes as Uint8Array, face.fontKey),
    });
  }

  return new Blob([writeStoredDocxEntries(entries)], { type: DOCX_MIME_TYPE });
}
