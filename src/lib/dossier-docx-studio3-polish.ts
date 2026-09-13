import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import {
  createStudio3DossierDocxBlob,
  studio3DossierDocxSupported,
} from "@/lib/dossier-docx-studio3";
import { downloadBlob } from "@/lib/download";

export { studio3DossierDocxSupported };

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

type ZipEntry = { name: string; bytes: Uint8Array };

function storedZipEntries(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && u32(bytes, offset) === 0x04034b50) {
    const method = u16(bytes, offset + 8);
    if (method !== 0) throw new Error("Studio-3-DOCX-Polish erwartet unkomprimierte ZIP-Einträge.");
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
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(entries: ZipEntry[]) {
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

  const directory = concat(centralParts);
  const end = new Uint8Array(22);
  writeU32(end, 0, 0x06054b50);
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, directory.length);
  writeU32(end, 16, localOffset);
  return concat([...localParts, directory, end]);
}

function vmlStyle(x: number, y: number, width: number, height: number, z = -251658240) {
  return `position:absolute;margin-left:${x}mm;margin-top:${y}mm;width:${width}mm;height:${height}mm;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0`;
}

function rectRun(id: string, x: number, y: number, width: number, height: number, color: string) {
  return `<w:r><w:pict><v:rect id="${id}" style="${vmlStyle(x, y, width, height)}" fillcolor="#${color}" stroked="f"/></w:pict></w:r>`;
}

function replaceDrawing(source: string, id: string, replacement: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<w:r><w:pict><v:(?:shape|rect)[^>]*\\bid="${escaped}"[\\s\\S]*?</w:pict></w:r>`,
  );
  if (!pattern.test(source)) throw new Error(`Studio-3-DOCX-Polish Zeichnung fehlt: ${id}`);
  return source.replace(pattern, replacement);
}

function replaceParagraphAfter(source: string, text: string, afterMm: number) {
  const textIndex = source.indexOf(`>${text}</w:t>`);
  if (textIndex < 0) return source;
  const paragraphStart = source.lastIndexOf("<w:p>", textIndex);
  const paragraphEnd = source.indexOf("</w:p>", textIndex);
  if (paragraphStart < 0 || paragraphEnd < 0) return source;
  const paragraph = source.slice(paragraphStart, paragraphEnd + 6);
  const next = paragraph.replace(/(<w:spacing\b[^>]*\bw:after=")\d+("[^>]*\/>)/, `$1${twips(afterMm)}$2`);
  return source.slice(0, paragraphStart) + next + source.slice(paragraphEnd + 6);
}

function replaceSpacerAfter(source: string, anchor: string, fromMm: number, toMm: number) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) return source;
  const oldSpacing = `<w:spacing w:before="0" w:after="0" w:line="${twips(fromMm)}" w:lineRule="exact"/>`;
  const index = source.indexOf(oldSpacing, anchorIndex);
  if (index < 0) return source;
  const newSpacing = `<w:spacing w:before="0" w:after="0" w:line="${twips(toMm)}" w:lineRule="exact"/>`;
  return source.slice(0, index) + newSpacing + source.slice(index + oldSpacing.length);
}

function polishDocumentXml(
  source: string,
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const coverPrimary = wordColor(cover.colors.primary, "173D3A");
  const coverSecondary = wordColor(cover.colors.secondary, "5EC6B6");
  const letterPrimary = wordColor(letter.design.colors.primary, "173D3A");
  const letterSecondary = wordColor(letter.design.colors.secondary, "5EC6B6");
  const cvPrimary = wordColor(cv.design.colors.primary, "173D3A");

  let xml = source;

  // Custom VML paths are interpreted inconsistently by Word-compatible renderers.
  // Keep the same Studio-3 two-tone hierarchy with robust, editable VML rectangles.
  xml = replaceDrawing(xml, "studio3-cover-primary", rectRun("studio3-cover-primary", 0, 0, 210, 112, coverPrimary));
  xml = replaceDrawing(xml, "studio3-cover-mint", rectRun("studio3-cover-mint", 126, 0, 84, 90, coverSecondary));
  xml = replaceDrawing(xml, "studio3-letter-primary", rectRun("studio3-letter-primary", 0, 0, 210, 34, letterPrimary));
  xml = replaceDrawing(xml, "studio3-letter-mint", rectRun("studio3-letter-mint", 146, 0, 64, 34, letterSecondary));
  xml = replaceDrawing(xml, "studio3-cv-primary", rectRun("studio3-cv-primary", 0, 0, 210, 58, cvPrimary));

  if (!cover.data.foto) {
    const coverInitials = `${cover.data.vorname.trim().charAt(0)}${cover.data.nachname.trim().charAt(0)}`.toUpperCase();
    xml = replaceParagraphAfter(xml, coverInitials, 45);
  }
  if (cover.data.lehrbeginn?.trim()) {
    xml = replaceSpacerAfter(xml, "Lehrbeginn ·", 48, 63);
  }

  return xml;
}

export async function createPolishedStudio3DossierDocxBlob(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
) {
  const base = await createStudio3DossierDocxBlob(cover, letter, cv);
  const entries = storedZipEntries(new Uint8Array(await base.arrayBuffer()));
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("Studio-3-DOCX document.xml fehlt.");

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  document.bytes = encoder.encode(
    polishDocumentXml(decoder.decode(document.bytes), cover, letter, cv),
  );

  return new Blob([zipStore(entries)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function downloadPolishedStudio3DossierDocx(
  cover: CoverPdfDocument,
  letter: LetterPdfDocument,
  cv: CvPdfDocument,
  fileName: string,
) {
  downloadBlob(await createPolishedStudio3DossierDocxBlob(cover, letter, cv), fileName);
}
