import { PHOTO } from "@/default-config";

/**
 * Skaliert ein hochgeladenes Foto herunter und gibt eine JPEG-Data-URL zurück.
 *
 * Jedes Foto wird bewusst einmal durch den Browser-Canvas neu codiert, auch
 * wenn es bereits klein genug ist. Der frühere Fast-Path gab kleine JPEGs
 * unverändert weiter. Dadurch blieben ICC-/Encoder-Metadaten im Data-URL und
 * einzelne gültige Fotos konnten von html2canvas-pro beim PDF-Export schwarz
 * gerastert werden. Das normalisierte JPEG ist für Vorschau, JSON und PDF
 * immer dieselbe, browser-dekodierte RGB-Darstellung.
 */
export function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error("Bildformat wird nicht unterstützt"));
      img.onload = () => {
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        if (sourceWidth <= 0 || sourceHeight <= 0) {
          reject(new Error("Bildformat wird nicht unterstützt"));
          return;
        }

        const scale = Math.min(1, PHOTO.MAX_EDGE / Math.max(sourceWidth, sourceHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Extrem defensiver Fallback: Upload nicht blockieren, falls ein
          // Browser unerwartet keinen 2D-Kontext bereitstellt.
          resolve(src);
          return;
        }

        // Bewerbungsfotos werden als JPEG gespeichert. Transparente Pixel aus
        // PNG/WebP deshalb explizit auf Weiss legen statt browserabhängig
        // schwarz werden zu lassen.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", PHOTO.QUALITY));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
