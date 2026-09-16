import { normalizeTextAlignment, type TextAlignment } from "@/lib/text-alignment";

export const CV_TEXT_ALIGNMENT_STORAGE_KEY = "lebenslauf:text-align:v1";
const CV_TEXT_ALIGNMENT_EVENT = "lebenslauf:text-align-changed";
const DEFAULT_CV_TEXT_ALIGNMENT: TextAlignment = "left";
let memoryAlignment: TextAlignment | undefined;

export function readPersistedCvTextAlignment(): TextAlignment | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(CV_TEXT_ALIGNMENT_STORAGE_KEY);
    return value === null ? undefined : normalizeTextAlignment(value, DEFAULT_CV_TEXT_ALIGNMENT);
  } catch {
    return undefined;
  }
}

export function getCvTextAlignment(): TextAlignment {
  return memoryAlignment ?? readPersistedCvTextAlignment() ?? DEFAULT_CV_TEXT_ALIGNMENT;
}

export function setCvTextAlignment(value: TextAlignment) {
  if (typeof window === "undefined") return;
  const next = normalizeTextAlignment(value, DEFAULT_CV_TEXT_ALIGNMENT);
  memoryAlignment = next;
  try {
    window.localStorage.setItem(CV_TEXT_ALIGNMENT_STORAGE_KEY, next);
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
    memoryAlignment =
      event.newValue === null
        ? undefined
        : normalizeTextAlignment(event.newValue, DEFAULT_CV_TEXT_ALIGNMENT);
    listener();
  };
  window.addEventListener(CV_TEXT_ALIGNMENT_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CV_TEXT_ALIGNMENT_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
