import { describe, expect, test } from "bun:test";
import {
  letterHasStarted,
  letterReadiness,
  letterTextLayerOverflows,
} from "../../src/components/letter/preflight";
import { EMPTY_LETTER } from "../../src/components/letter/types";
import { downloadCombinedDossierPdf, downloadLetterPdf } from "../../src/lib/dossier-pdf";

describe("letter preflight", () => {
  test("distinguishes an untouched letter from a started draft", () => {
    expect(letterHasStarted(EMPTY_LETTER)).toBe(false);
    expect(letterReadiness(EMPTY_LETTER)).toEqual({
      started: false,
      readyToSend: false,
      missing: ["Absendername", "Lehrbetrieb oder Ansprechperson", "Datum", "Betreff", "Brieftext"],
    });

    const started = { ...EMPTY_LETTER, absenderName: "Lea Müller" };
    expect(letterHasStarted(started)).toBe(true);
    expect(letterReadiness(started).readyToSend).toBe(false);
  });

  test("requires only the minimum professional sending fields", () => {
    const ready = {
      ...EMPTY_LETTER,
      absenderName: "Lea Müller",
      empfaengerFirma: "Beispiel AG",
      datum: "02.09.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatikerin EFZ",
      text: "Ich bewerbe mich mit grossem Interesse um die Lehrstelle.",
    };

    expect(letterReadiness(ready)).toEqual({
      started: true,
      readyToSend: true,
      missing: [],
    });
  });

  test("recipient person may replace company but whitespace never counts", () => {
    const data = {
      ...EMPTY_LETTER,
      absenderName: " Lea Müller ",
      empfaengerName: " Frau Anna Muster ",
      datum: " 02.09.2026 ",
      betreff: " Bewerbung ",
      text: " Motivation ",
    };
    expect(letterReadiness(data).readyToSend).toBe(true);

    expect(letterReadiness({ ...data, empfaengerName: "   " }).missing).toContain(
      "Lehrbetrieb oder Ansprechperson",
    );
  });

  test("uses one deterministic one-page overflow tolerance", () => {
    expect(letterTextLayerOverflows({ scrollHeight: 100, clientHeight: 100 })).toBe(false);
    expect(letterTextLayerOverflows({ scrollHeight: 101, clientHeight: 100 })).toBe(false);
    expect(letterTextLayerOverflows({ scrollHeight: 102, clientHeight: 100 })).toBe(true);
    expect(letterTextLayerOverflows(null)).toBe(false);
  });

  test("PDF exporters reject an overflowing letter before rasterization", async () => {
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

    const textLayer = { scrollHeight: 220, clientHeight: 100 };
    const letterPage = {
      matches: (selector: string) => selector === "[data-letter-page]",
      querySelector: (selector: string) =>
        selector === "[data-letter-text-layer]" ? textLayer : null,
    } as unknown as HTMLElement;
    const letterRoot = {
      querySelector: (selector: string) => (selector === "[data-letter-page]" ? letterPage : null),
    } as unknown as HTMLElement;
    const combinedRoot = {
      querySelector: (selector: string) => {
        if (selector === "[data-dossier-document='cover']") return {} as HTMLElement;
        if (selector === "[data-dossier-document='letter']") return letterRoot;
        return null;
      },
      querySelectorAll: (selector: string) =>
        selector === "[data-cv-page]"
          ? ([{} as HTMLElement] as unknown as NodeListOf<HTMLElement>)
          : [],
    } as unknown as HTMLElement;

    try {
      await expect(
        downloadLetterPdf(letterPage, "blocked.pdf", { title: "Test", author: "Test" }),
      ).rejects.toThrow("Motivationsschreiben Seite 1 enthält Inhalt");
      await expect(
        downloadCombinedDossierPdf(combinedRoot, "blocked-dossier.pdf", {
          title: "Test",
          author: "Test",
        }),
      ).rejects.toThrow("Motivationsschreiben Seite 1 enthält Inhalt");
    } finally {
      if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
      else Reflect.deleteProperty(globalThis, "document");
      if (rafDescriptor) Object.defineProperty(globalThis, "requestAnimationFrame", rafDescriptor);
      else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    }
  });
});
