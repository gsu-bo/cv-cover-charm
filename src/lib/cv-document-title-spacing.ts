export const CV_DOC_TITLE_MARGIN_TOP_STORAGE_KEY = "bewerbungsdossier:cv-doc-title-margin-top:v1";
export const CV_DOC_TITLE_MARGIN_TOP_DEFAULT_PX = 0;
export const CV_DOC_TITLE_MARGIN_TOP_MAX_PX = 100;

const EVENT = "bewerbungsdossier-cv-doc-title-margin-top-change";
let cached: number | null = null;

function clamp(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return CV_DOC_TITLE_MARGIN_TOP_DEFAULT_PX;
  return Math.max(0, Math.min(CV_DOC_TITLE_MARGIN_TOP_MAX_PX, Math.round(numeric)));
}

function read(): number {
  if (typeof window === "undefined") return CV_DOC_TITLE_MARGIN_TOP_DEFAULT_PX;
  try {
    return clamp(window.localStorage?.getItem(CV_DOC_TITLE_MARGIN_TOP_STORAGE_KEY));
  } catch {
    return CV_DOC_TITLE_MARGIN_TOP_DEFAULT_PX;
  }
}

export function getCvDocumentTitleMarginTopPx(): number {
  if (cached === null) cached = read();
  return cached;
}

export function setCvDocumentTitleMarginTopPx(value: number): void {
  const next = clamp(value);
  cached = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(CV_DOC_TITLE_MARGIN_TOP_STORAGE_KEY, String(next));
  } catch {
    // The live editor still updates even when browser storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeCvDocumentTitleMarginTop(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const notify = () => onChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CV_DOC_TITLE_MARGIN_TOP_STORAGE_KEY) return;
    cached = read();
    onChange();
  };
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}
