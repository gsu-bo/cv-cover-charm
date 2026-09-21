export type DossierDocxV2ImageAsset = {
  bytes: Uint8Array;
  extension: "png" | "jpg" | "gif" | "svg";
  contentType: "image/png" | "image/jpeg" | "image/gif" | "image/svg+xml";
  aspect: number;
};

function pngAspect(bytes: Uint8Array) {
  if (bytes.length < 24) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 ? width / height : 1;
}

function gifAspect(bytes: Uint8Array) {
  if (bytes.length < 10) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  return width > 0 && height > 0 ? width / height : 1;
}

function jpegAspect(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (sofMarkers.has(marker) && length >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? width / height : 1;
    }
    offset += length;
  }
  return 1;
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function directDataUrlAsset(value: string): DossierDocxV2ImageAsset | null {
  const match = value.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
  if (!match) return null;
  try {
    const bytes = bytesFromBase64(match[2]);
    const format = match[1].toLowerCase();
    if (format === "png") {
      return { bytes, extension: "png", contentType: "image/png", aspect: pngAspect(bytes) };
    }
    if (format === "gif") {
      return { bytes, extension: "gif", contentType: "image/gif", aspect: gifAspect(bytes) };
    }
    return { bytes, extension: "jpg", contentType: "image/jpeg", aspect: jpegAspect(bytes) };
  } catch {
    return null;
  }
}

/**
 * Browser-only compatibility fallback for small uploads that readPhoto kept in
 * their original format (for example WebP). Word/LibreOffice get a boring,
 * portable PNG instead of depending on the original codec.
 */
async function rasterizeUnknownDataUrl(value: string): Promise<DossierDocxV2ImageAsset | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(null);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, image.naturalWidth || image.width);
      canvas.height = Math.max(1, image.naturalHeight || image.height);
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(directDataUrlAsset(canvas.toDataURL("image/png")));
    };
    image.src = value;
  });
}

export async function dossierDocxV2DataUrlImageAsset(value: string | null | undefined) {
  if (!value) return null;
  return directDataUrlAsset(value) ?? rasterizeUnknownDataUrl(value);
}

export function dossierDocxV2SvgAsset(svg: string, aspect: number): DossierDocxV2ImageAsset {
  return {
    bytes: new TextEncoder().encode(svg),
    extension: "svg",
    contentType: "image/svg+xml",
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : 1,
  };
}

export async function dossierDocxV2SvgImageAsset(
  svg: string,
  aspect: number,
): Promise<DossierDocxV2ImageAsset> {
  const fallback = dossierDocxV2SvgAsset(svg, aspect);
  if (typeof document === "undefined" || typeof Image === "undefined") return fallback;

  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const maxEdge = 1400;
  const width = safeAspect >= 1 ? maxEdge : Math.max(1, Math.round(maxEdge * safeAspect));
  const height = safeAspect >= 1 ? Math.max(1, Math.round(maxEdge / safeAspect)) : maxEdge;

  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(fallback);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(fallback);
        return;
      }
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(directDataUrlAsset(canvas.toDataURL("image/png")) ?? fallback);
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
