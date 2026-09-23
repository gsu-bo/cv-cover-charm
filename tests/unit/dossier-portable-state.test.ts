import { afterEach, describe, expect, test } from "bun:test";
import {
  createDossierProject,
  storeDossierProject,
  CV_STORAGE_KEY,
} from "../../src/lib/dossier-project";

const originalWindow = globalThis.window;

function installStorage(entries: Record<string, string>) {
  const storage = new Map(Object.entries(entries));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  return storage;
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("portable CV dossier state", () => {
  test("embeds legacy sidecars in the dossier and restores them on import", () => {
    const storage = installStorage({
      "lebenslauf:layout:v1": "timeline",
      "lebenslauf:layout-mirror:v1": "true",
      "lebenslauf:section-gap:v1": "6.5",
      "lebenslauf:placement:v1": JSON.stringify({
        kontakt: "main",
        schule: "side",
        erfahrung: "main",
        sprachen: "main",
        hobbys: "side",
        staerken: "side",
        referenzen: "main",
        "custom:projects": "side",
      }),
      "lebenslauf:photo:v2": JSON.stringify({
        shape: "circle",
        zoom: 1.7,
        x: 22,
        y: 68,
        borderWidth: 0.8,
      }),
      "lebenslauf:photo-place:v1": JSON.stringify({
        mode: "frei",
        xMm: 133,
        yMm: 27,
        widthMm: 41,
        frameColor: "#123456",
      }),
    });

    const project = createDossierProject({
      cv: { version: 6, data: { titel: "Lebenslauf" }, design: { template: "edge" } },
    });

    expect(project.cv?.portableState).toEqual({
      layout: "timeline",
      mirrored: true,
      sectionGapMm: 6.5,
      placements: {
        kontakt: "main",
        schule: "side",
        erfahrung: "main",
        sprachen: "main",
        hobbys: "side",
        staerken: "side",
        referenzen: "main",
        "custom:projects": "side",
      },
      photoStyle: {
        shape: "circle",
        zoom: 1.7,
        x: 22,
        y: 68,
        borderWidth: 0.8,
      },
      photoPlacement: {
        mode: "frei",
        xMm: 133,
        yMm: 27,
        widthMm: 41,
        frameColor: "#123456",
      },
    });

    for (const key of [
      "lebenslauf:layout:v1",
      "lebenslauf:layout-mirror:v1",
      "lebenslauf:section-gap:v1",
      "lebenslauf:placement:v1",
      "lebenslauf:photo:v2",
      "lebenslauf:photo-place:v1",
    ]) {
      storage.delete(key);
    }

    expect(storeDossierProject(project)).toEqual({ cover: false, letter: false, cv: true });
    expect(storage.get("lebenslauf:layout:v1")).toBe("timeline");
    expect(storage.get("lebenslauf:layout-mirror:v1")).toBe("true");
    expect(storage.get("lebenslauf:section-gap:v1")).toBe("6.5");
    expect(JSON.parse(storage.get("lebenslauf:placement:v1") ?? "null")?.schule).toBe("side");
    expect(JSON.parse(storage.get("lebenslauf:photo:v2") ?? "null")?.zoom).toBe(1.7);
    expect(JSON.parse(storage.get("lebenslauf:photo-place:v1") ?? "null")?.frameColor).toBe(
      "#123456",
    );

    const storedCv = JSON.parse(storage.get(CV_STORAGE_KEY) ?? "null");
    expect(storedCv?.data?.titel).toBe("Lebenslauf");
    expect(storedCv?.portableState).toBeUndefined();
  });

  test("legacy CV projects without portableState leave current sidecars untouched", () => {
    const storage = installStorage({
      "lebenslauf:layout:v1": "minimal",
      "lebenslauf:layout-mirror:v1": "false",
      "lebenslauf:section-gap:v1": "5",
    });

    storeDossierProject({
      kind: "cv-cover-charm-dossier",
      version: 1,
      savedAt: "2026-08-31T12:00:00.000Z",
      cv: { version: 6, data: { titel: "Alt" } },
    });

    expect(storage.get("lebenslauf:layout:v1")).toBe("minimal");
    expect(storage.get("lebenslauf:layout-mirror:v1")).toBe("false");
    expect(storage.get("lebenslauf:section-gap:v1")).toBe("5");
  });
});
