import { TEMPLATES } from "@/components/cover/types";
import { DOCX_MIME_TYPE, readStoredDocxEntries, writeStoredDocxEntries } from "@/lib/dossier-docx-package";
import type { CoverPdfDocument } from "@/lib/dossier-pdf-document";

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function templateLabel(cover: CoverPdfDocument) {
  return TEMPLATES.find((template) => template.id === cover.template)?.name ?? String(cover.template);
}

export function patchDossierDocxV2CorePropertiesXml(source: string, cover: CoverPdfDocument) {
  const title = xmlEscape(`Bewerbungsdossier – ${templateLabel(cover)}`);
  const subject = xmlEscape("Lehrstellenbewerbung");
  let next = source;
  if (/<dc:title>[\s\S]*?<\/dc:title>/.test(next)) {
    next = next.replace(/<dc:title>[\s\S]*?<\/dc:title>/, `<dc:title>${title}</dc:title>`);
  } else {
    next = next.replace("</cp:coreProperties>", `<dc:title>${title}</dc:title></cp:coreProperties>`);
  }
  if (/<dc:subject>[\s\S]*?<\/dc:subject>/.test(next)) {
    next = next.replace(/<dc:subject>[\s\S]*?<\/dc:subject>/, `<dc:subject>${subject}</dc:subject>`);
  }
  return next;
}

/** Remove the last remaining Warm identity leak from the transitional package shell. */
export async function applyDossierDocxV2Metadata(blob: Blob, cover: CoverPdfDocument) {
  const entries = readStoredDocxEntries(new Uint8Array(await blob.arrayBuffer()), "DOCX V2 metadata");
  const core = entries.find((entry) => entry.name === "docProps/core.xml");
  if (!core) return blob;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  core.bytes = encoder.encode(patchDossierDocxV2CorePropertiesXml(decoder.decode(core.bytes), cover));
  return new Blob([writeStoredDocxEntries(entries)], { type: DOCX_MIME_TYPE });
}
