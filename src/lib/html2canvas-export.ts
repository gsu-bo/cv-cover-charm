const JPEG_DATA_URL = /^data:image\/jpe?g(?:;|,)/i;

/**
 * html2canvas-pro arbeitet beim PDF-Export mit einem geklonten Dokument.
 * Kleine ältere Bewerbungsfotos konnten dort als unveränderte JPEG-Data-URLs
 * inklusive Farbprofil/Encoder-Metadaten landen und in seltenen Fällen schwarz
 * gerastert werden. Wenn das JPEG im Clone bereits dekodiert ist, codieren wir
 * genau diese sichtbare RGB-Darstellung noch einmal über Canvas. Neue Uploads
 * werden zusätzlich schon in readPhoto() normalisiert; dieser Guard schützt
 * damit auch ältere/importierte JSON-Stände.
 */
export function normalizeDataUrlJpegsForHtml2Canvas(root: HTMLElement) {
  const images: HTMLImageElement[] = [];
  if (root.tagName === "IMG") images.push(root as HTMLImageElement);
  images.push(...root.querySelectorAll<HTMLImageElement>("img"));

  for (const image of images) {
    const src = image.getAttribute("src") ?? image.src;
    if (!JPEG_DATA_URL.test(src)) continue;
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) continue;

    try {
      const canvas = image.ownerDocument.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const normalized = canvas.toDataURL("image/jpeg", 0.94);
      if (normalized && normalized !== "data:,") image.src = normalized;
    } catch {
      // PDF-Export nie wegen eines optionalen Kompatibilitäts-Guards stoppen.
      // html2canvas erhält im Fehlerfall einfach das ursprüngliche Bild.
    }
  }
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
  // Alle bestehenden PDF-Pfade rufen diese Funktion bereits im onclone-Hook
  // auf. Der JPEG-Guard gilt dadurch für CV, Anschreiben und Gesamtdossier,
  // ohne drei getrennte Exportimplementierungen auseinanderlaufen zu lassen.
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
