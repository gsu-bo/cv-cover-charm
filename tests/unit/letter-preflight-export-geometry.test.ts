import { expect, test } from "bun:test";
import { downloadLetterPdf } from "../../src/lib/dossier-pdf";

const rect = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
  x: left,
  y: top,
  toJSON: () => ({}),
});

test("M8 PDF export rejects clipped attachment chrome before rasterization", async () => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const rafDescriptor = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { fonts: { ready: Promise.resolve() } },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: (timestamp: number) => void) => {
      callback(0);
      return 1;
    },
  });

  const textLayer = {
    clientWidth: 630,
    scrollWidth: 630,
    clientHeight: 850,
    scrollHeight: 850,
    getBoundingClientRect: () => rect(80, 100, 710, 950),
  } as unknown as HTMLElement;
  const footer = {
    clientWidth: 794,
    scrollWidth: 794,
    clientHeight: 100,
    scrollHeight: 132,
    getBoundingClientRect: () => rect(0, 1023, 794, 1123),
  } as unknown as HTMLElement;
  const page = {
    matches: (selector: string) => selector === "[data-letter-page]",
    getBoundingClientRect: () => rect(0, 0, 794, 1123),
    querySelector: (selector: string) => {
      if (selector === "[data-letter-text-layer]") return textLayer;
      if (selector === "[data-letter-footer]") return footer;
      return null;
    },
    querySelectorAll: () => [],
  } as unknown as HTMLElement;

  try {
    await expect(
      downloadLetterPdf(page, "blocked-footer.pdf", { title: "Test", author: "Test" }),
    ).rejects.toThrow("Motivationsschreiben Seite 1 enthält Inhalt");
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else Reflect.deleteProperty(globalThis, "document");
    if (rafDescriptor) Object.defineProperty(globalThis, "requestAnimationFrame", rafDescriptor);
    else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  }
});
