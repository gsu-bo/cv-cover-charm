import { isBodyTextAlignment, type BodyTextAlignment } from "@/lib/text-alignment";

export const CV_TEXT_ALIGNMENT_STORAGE_KEY = "lebenslauf:text-align:v1";
const CV_TEXT_ALIGNMENT_EVENT = "lebenslauf:text-align-changed";
const DEFAULT_CV_TEXT_ALIGNMENT: BodyTextAlignment = "left";
let memoryAlignment: BodyTextAlignment | undefined;

export function readPersistedCvTextAlignment(): BodyTextAlignment | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(CV_TEXT_ALIGNMENT_STORAGE_KEY);
    return isBodyTextAlignment(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function getCvTextAlignment(): BodyTextAlignment {
  return memoryAlignment ?? readPersistedCvTextAlignment() ?? DEFAULT_CV_TEXT_ALIGNMENT;
}

export function setCvTextAlignment(value: BodyTextAlignment) {
  if (typeof window === "undefined" || !isBodyTextAlignment(value)) return;
  memoryAlignment = value;
  try {
    window.localStorage.setItem(CV_TEXT_ALIGNMENT_STORAGE_KEY, value);
  } catch {
    // Blockierter Speicher verhindert nur die Persistenz; die Sitzung bleibt reaktiv.
  }
  window.dispatchEvent(new CustomEvent(CV_TEXT_ALIGNMENT_EVENT));
}

export function clearCvTextAlignment() {
  memoryAlignment = undefined;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CV_TEXT_ALIGNMENT_STORAGE_KEY);
  } catch {
    // Der In-Memory-Stand ist trotzdem zurückgesetzt.
  }
  window.dispatchEvent(new CustomEvent(CV_TEXT_ALIGNMENT_EVENT));
}

export function subscribeCvTextAlignment(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CV_TEXT_ALIGNMENT_STORAGE_KEY) return;
    memoryAlignment = isBodyTextAlignment(event.newValue) ? event.newValue : undefined;
    listener();
  };
  window.addEventListener(CV_TEXT_ALIGNMENT_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CV_TEXT_ALIGNMENT_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
