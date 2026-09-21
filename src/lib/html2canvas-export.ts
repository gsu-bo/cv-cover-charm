const JPEG_DATA_URL = /^data:image\/jpe?g(?:;|,)/i;
const JPEG_HEADER_SCAN_BYTES = 64 * 1024;
const ICC_MARKER = "ICC_PROFILE";
const normalizedJpegCache = new Map<string, string>();

/**
 * Canvas-generated JPEGs are already browser-normalized and do not carry the
 * embedded ICC chunk that triggered the black-photo rasterization seen in
 * legacy/imported dossiers. Scan only the small JPEG header area so an old
 * multi-megabyte JSON photo does not have to be fully decoded just to decide
 * whether the compatibility guard is needed.
 */
export function jpegDataUrlHasIccProfile(src: string) {
  if (!JPEG_DATA_URL.test(src)) return false;
  const comma = src.indexOf(",");
  if (comma < 0) return false;

  const meta = src.slice(0, comma);
  const body = src.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      const compact = body.replace(/\s/g, "");
      const maxChars = Math.ceil(JPEG_HEADER_SCAN_BYTES / 3) * 4;
      let chunk = compact.slice(0, maxChars);
      chunk = chunk.slice(0, chunk.length - (chunk.length % 4));
      if (!chunk) return false;
      return atob(chunk).includes(ICC_MARKER);
    }

    // URI-encoded JPEG data URLs are unusual here, but keep the detector safe
    // for imported hand-written JSON instead of assuming base64 unconditionally.
    return decodeURIComponent(body.slice(0, JPEG_HEADER_SCAN_BYTES * 3)).includes(ICC_MARKER);
  } catch {
    return false;
  }
}

function loadedLiveImageForClone(image: HTMLImageElement, src: string) {
  const frameElement = image.ownerDocument.defaultView?.frameElement;
  const liveDocument = frameElement?.ownerDocument;
  if (!liveDocument || liveDocument === image.ownerDocument) return null;

  for (const candidate of liveDocument.querySelectorAll<HTMLImageElement>("img")) {
    const candidateSrc = candidate.getAttribute("src") ?? candidate.src;
    if (candidateSrc !== src) continue;
    if (!candidate.complete || candidate.naturalWidth <= 0 || candidate.naturalHeight <= 0) continue;
    return candidate;
  }
  return null;
}

/**
 * html2canvas-pro arbeitet beim PDF-Export mit einem geklonten Dokument.
 * Einige ältere/importierte JPEG-Data-URLs enthalten ein eingebettetes
 * ICC-Farbprofil. Genau diese Bilder werden im Wegwerf-Clone einmal über den
 * Browser-Canvas in die bereits sichtbare RGB-Darstellung normalisiert.
 *
 * Neue Uploads laufen bereits durch readPhoto() und haben dieses Profil nicht
 * mehr. Sie werden hier bewusst NICHT nochmals als JPEG komprimiert. Für ein
 * mehrfach verwendetes Legacy-Foto wird das normalisierte Ergebnis gecacht.
 *
 * Wichtig: Der Clone kann beim onclone-Hook noch kein naturalWidth haben,
 * obwohl dasselbe Foto im Live-Dokument längst dekodiert und sichtbar ist.
 * Dann wird genau dieses bereits geladene Original als Rasterquelle benutzt.
 */
export function normalizeDataUrlJpegsForHtml2Canvas(root: HTMLElement) {
  const images: HTMLImageElement[] = [];
  if (root.tagName === "IMG") images.push(root as HTMLImageElement);
  images.push(...root.querySelectorAll<HTMLImageElement>("img"));

  for (const image of images) {
    const src = image.getAttribute("src") ?? image.src;
    if (!JPEG_DATA_URL.test(src)) continue;

    const cached = normalizedJpegCache.get(src);
    if (cached) {
      image.src = cached;
      continue;
    }

    // Avoid a second lossy JPEG pass for normal uploads. The compatibility
    // re-encode is only needed for legacy ICC-bearing JPEG data URLs.
    if (!jpegDataUrlHasIccProfile(src)) continue;

    const rasterSource =
      image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
        ? image
        : loadedLiveImageForClone(image, src);
    if (!rasterSource) continue;

    try {
      const canvas = image.ownerDocument.createElement("canvas");
      canvas.width = rasterSource.naturalWidth;
      canvas.height = rasterSource.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rasterSource, 0, 0, canvas.width, canvas.height);
      const normalized = canvas.toDataURL("image/jpeg", 0.94);
      if (!normalized || normalized === "data:,") continue;

      normalizedJpegCache.set(src, normalized);
      image.src = normalized;
    } catch {
      // PDF-Export nie wegen eines optionalen Kompatibilitäts-Guards stoppen.
      // html2canvas erhält im Fehlerfall einfach das ursprüngliche Bild.
    }
  }
}

/**
 * Combined dossier exports can contain different templates at the same time.
 * Legacy template CSS still reads html[data-dossier-template], so scope that
 * global selector only inside html2canvas' throw-away clone. The live document
 * keeps the editor route's own template and can no longer be hijacked by a
 * hidden cover/CV renderer immediately before capture.
 */
export function scopeDossierTemplateForHtml2Canvas(root: HTMLElement) {
  const scope = root.closest<HTMLElement>("[data-dossier-template]");
  const template = scope?.dataset.dossierTemplate?.trim();
  if (!template) return;
  root.ownerDocument.documentElement.dataset.dossierTemplate = template;
}

/**
 * html2canvas-pro measures text ranges after CSS `zoom` has already affected
 * their coordinates and then applies the same zoom again while painting the
 * stacking context. Words therefore drift into the following spaces.
 *
 * CSS transforms do not have that problem because html2canvas temporarily
 * neutralizes them while measuring the cloned DOM. Preserve the visual scale
 * by translating zoom into an equivalent transform inside the throw-away
 * capture clone only.
 */
export function cssZoomAsTransform(zoom: number, transform: string) {
  return `scale(${zoom})${transform === "none" ? "" : ` ${transform}`}`;
}

export function normalizeCssZoomForHtml2Canvas(root: HTMLElement) {
  // Every PDF path already runs this hook on html2canvas' cloned document.
  // Resolve the document-local template there before any computed-style reads,
  // then apply the existing image and CSS zoom compatibility normalization.
  scopeDossierTemplateForHtml2Canvas(root);
  normalizeDataUrlJpegsForHtml2Canvas(root);

  const view = root.ownerDocument.defaultView;
  if (!view) return;

  const elements = [root, ...root.querySelectorAll<HTMLElement>("*")];
  for (const element of elements) {
    const style = view.getComputedStyle(element);
    const zoom = Number.parseFloat(style.zoom);
    if (!Number.isFinite(zoom) || zoom <= 0 || Math.abs(zoom - 1) < 0.0001) continue;

    element.style.setProperty("zoom", "1", "important");
    element.style.setProperty("transform-origin", "0 0", "important");
    element.style.setProperty("transform", cssZoomAsTransform(zoom, style.transform), "important");
  }
}
