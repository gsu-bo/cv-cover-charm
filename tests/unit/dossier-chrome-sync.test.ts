import { describe, expect, test } from "bun:test";
import {
  DEFAULT_DOSSIER_CHROME_STATE,
  createDossierChromeHistorySnapshot,
  normalizeDossierChromeState,
  patchDossierChromeState,
  restoreDossierChromeHistoryState,
  setDossierChromeSyncState,
} from "../../src/lib/dossier-chrome";

describe("shared CV and motivation-letter header/footer settings", () => {
  test("synchronization is enabled by default", () => {
    const state = normalizeDossierChromeState(null);
    expect(state.sync).toBe(true);
    expect(state.shared.headerMode).toBe("compact");
    expect(state.shared.footerMode).toBe("compact");
  });

  test("with sync enabled either editor changes the one shared configuration", () => {
    const next = patchDossierChromeState(DEFAULT_DOSSIER_CHROME_STATE, "letter", {
      headerMode: "contact",
      footerMode: "details",
      headerShowPhone: false,
    });

    expect(next.sync).toBe(true);
    expect(next.shared.headerMode).toBe("contact");
    expect(next.shared.footerMode).toBe("details");
    expect(next.shared.headerShowPhone).toBe(false);
  });

  test("turning sync off clones the current shared settings into both documents", () => {
    const shared = patchDossierChromeState(DEFAULT_DOSSIER_CHROME_STATE, "cv", {
      headerMode: "contact",
      footerMode: "details",
    });
    const split = setDossierChromeSyncState(shared, "cv", false);

    expect(split.sync).toBe(false);
    expect(split.cv).toEqual(shared.shared);
    expect(split.letter).toEqual(shared.shared);
  });

  test("with sync off CV and motivation letter can diverge", () => {
    const split = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const cv = patchDossierChromeState(split, "cv", { headerMode: "contact" });

    expect(cv.cv.headerMode).toBe("contact");
    expect(cv.letter.headerMode).toBe("compact");
  });

  test("turning sync back on uses the document where the checkbox was enabled", () => {
    const split = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const changed = patchDossierChromeState(split, "letter", {
      headerMode: "contact",
      footerMode: "details",
      headerShowEmail: false,
    });
    const joined = setDossierChromeSyncState(changed, "letter", true);

    expect(joined.sync).toBe(true);
    expect(joined.shared).toEqual(changed.letter);
    expect(joined.shared.headerShowEmail).toBe(false);
  });

  test("letter history stores only the effective letter chrome, never CV or sync state", () => {
    const split = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const changedCv = patchDossierChromeState(split, "cv", {
      headerMode: "none",
      footerMode: "none",
    });
    const historical = patchDossierChromeState(changedCv, "letter", {
      headerMode: "contact",
      footerMode: "details",
      headerShowPhone: false,
    });

    const snapshot = createDossierChromeHistorySnapshot(historical, "letter");

    expect(snapshot).toEqual({
      version: 1,
      scope: "letter",
      options: historical.letter,
    });
    expect("cv" in snapshot).toBe(false);
    expect("shared" in snapshot).toBe(false);
    expect("sync" in snapshot).toBe(false);
  });

  test("restoring letter history with sync off cannot roll back independent CV settings", () => {
    const currentSplit = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const currentCv = patchDossierChromeState(currentSplit, "cv", {
      headerMode: "contact",
      footerMode: "details",
      headerShowEmail: false,
    });
    const current = patchDossierChromeState(currentCv, "letter", { headerMode: "none" });

    const oldSplit = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const oldLetter = patchDossierChromeState(oldSplit, "letter", {
      headerMode: "contact",
      footerMode: "none",
      headerShowPhone: false,
    });
    const snapshot = createDossierChromeHistorySnapshot(oldLetter, "letter");
    const restored = restoreDossierChromeHistoryState(current, snapshot);

    expect(restored.sync).toBe(false);
    expect(restored.letter).toEqual(oldLetter.letter);
    expect(restored.cv).toEqual(current.cv);
    expect(restored.shared).toEqual(current.shared);
  });

  test("restoring letter history with sync on changes only the shared effective chrome", () => {
    const current = patchDossierChromeState(DEFAULT_DOSSIER_CHROME_STATE, "cv", {
      headerMode: "none",
      headerShowEmail: false,
    });
    const latentCv = current.cv;
    const latentLetter = current.letter;

    const oldSplit = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const oldLetter = patchDossierChromeState(oldSplit, "letter", {
      headerMode: "contact",
      footerMode: "details",
      headerShowAddress: false,
    });
    const snapshot = createDossierChromeHistorySnapshot(oldLetter, "letter");
    const restored = restoreDossierChromeHistoryState(current, snapshot);

    expect(restored.sync).toBe(true);
    expect(restored.shared).toEqual(oldLetter.letter);
    expect(restored.cv).toEqual(latentCv);
    expect(restored.letter).toEqual(latentLetter);
  });
});
