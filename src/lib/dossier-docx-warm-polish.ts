import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { downloadBlob } from "@/lib/download";
import {
  createWarmDossierDocxBlob,
  warmDossierDocxSupported,
} from "@/lib/dossier-docx-warm";

export { warmDossierDocxSupported };

const MM_TO_TWIPS = 1440 / 25.4;
const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function wordColor(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
}

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function storedZipEntries(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  const entries: Array<{ name: string; bytes: Uint8Array }> = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && u32(bytes, offset) === 0x04034b50) {
    const method = u16(bytes, offset + 8);
    if (method !== 0) throw new Error("Warm DOCX polish expects stored ZIP entries.");
    const size = u32(bytes, offset + 18);
    const nameLength = u16(bytes, offset + 26);
    const extraLength = u16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries.push({ name, bytes: bytes.slice(dataStart, dataStart + size) });
    offset = dataStart + size;
  }

  return entries;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(entries: Array<{ name: string; bytes: Uint8Array }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, 0x0800);
    writeU16(local, 8, 0);
    writeU32(local, 14, checksum);
    writeU32(local, 18, entry.bytes.length);
    writeU32(local, 22, entry.bytes.length);
    writeU16(local, 26, name.length);
    local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, 0x0800);
    writeU32(central, 16, checksum);
    writeU32(central, 20, entry.bytes.length);
    writeU32(central, 24, entry.bytes.length);
    writeU16(central, 28, name.length);
    writeU32(central, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.bytes.length;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  writeU32(end, 0, 0x06054b50);
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, centralDirectory.length);
  writeU32(end, 16, localOffset);
  return concat([...localParts, centralDirectory, end]);
}

function replaceFirstAfter(source: string, anchor: string, search: string, replacement: string) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`Warm DOCX polish anchor missing: ${anchor}`);
  const index = source.indexOf(search, anchorIndex);
  if (index < 0) throw new Error(`Warm DOCX polish target missing after ${anchor}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function polishDocumentXml(source: string, cover: CoverPdfDocument) {
  const primary = wordColor(cover.colors.primary, "0F766E");
  const secondary = wordColor(cover.colors.secondary, "F59E0B");

  let xml = source.replace(
    /(<v:oval id="warm-cover-photo-mat"[^>]*?fillcolor="#[0-9A-Fa-f]{6}") stroked="f"/,
    `$1 strokecolor="#${primary}" strokeweight="1pt"`,
  );

  const oldHeroSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(62)}" w:lineRule="exact"/>`;
  const newHeroSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(cover.data.foto ? 109 : 88)}" w:lineRule="exact"/>`;
  xml = replaceFirstAfter(xml, 'id="warm-cover-photo-mat"', oldHeroSpacer, newHeroSpacer);

  if (!cover.data.foto) {
    const oldInitialSpacing = `<w:spacing w:before="0" w:after="${twips(10)}" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin" w:eastAsia="Cabin"/><w:sz w:val="52"`;
    const newInitialSpacing = `<w:spacing w:before="0" w:after="${twips(31)}" w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cabin" w:hAnsi="Cabin" w:eastAsia="Cabin"/><w:sz w:val="52"`;
    xml = replaceFirstAfter(xml, 'id="warm-cover-photo-mat"', oldInitialSpacing, newInitialSpacing);
  }

  if (cover.data.lehrbeginn?.trim()) {
    const centerWidth = twips(78);
    const sideWidth = twips(50);
    const insetY = twips(1.8);
    const insetX = twips(4);
    const oldOpen = `<w:tc><w:tcPr><w:tcW w:w="${centerWidth}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr><w:tc><w:tcPr><w:shd w:fill="${secondary}"/><w:tcMar><w:top w:w="${insetY}" w:type="dxa"/><w:left w:w="${insetX}" w:type="dxa"/><w:bottom w:w="${insetY}" w:type="dxa"/><w:right w:w="${insetX}" w:type="dxa"/></w:tcMar></w:tcPr>`;
    const newOpen = `<w:tc><w:tcPr><w:tcW w:w="${centerWidth}" w:type="dxa"/><w:vAlign w:val="top"/><w:shd w:fill="${secondary}"/><w:tcMar><w:top w:w="${insetY}" w:type="dxa"/><w:left w:w="${insetX}" w:type="dxa"/><w:bottom w:w="${insetY}" w:type="dxa"/><w:right w:w="${insetX}" w:type="dxa"/></w:tcMar></w:tcPr>`;
    xml = replaceFirstAfter(xml, "Lehrbeginn", oldOpen, newOpen);

    const oldClose = `</w:t></w:r></w:p></w:tc></w:tc><w:tc><w:tcPr><w:tcW w:w="${sideWidth}"`;
    const newClose = `</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="${sideWidth}"`;
    xml = replaceFirstAfter(xml, "Lehrbeginn", oldClose, newClose);

    const oldBottomSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(48)}" w:lineRule="exact"/>`;
    const newBottomSpacer = `<w:spacing w:before="0" w:after="0" w:line="${twips(56)}" w:lineRule="exact"/>`;
    xml = replaceFirstAfter(xml, "Lehrbeginn", oldBottomSpacer, newBottomSpacer);
  }

  return xml;
}

export async function createPolishedWarmDossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const base = createWarmDossierDocxBlob(cover, letter, cv);
  const entries = storedZipEntries(new Uint8Array(await base.arrayBuffer()));
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("Warm DOCX document.xml fehlt.");

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  document.bytes = encoder.encode(polishDocumentXml(decoder.decode(document.bytes), cover));

  return new Blob([zipStore(entries)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function downloadPolishedWarmDossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(await createPolishedWarmDossierDocxBlob(cover, letter, cv), fileName);
}
