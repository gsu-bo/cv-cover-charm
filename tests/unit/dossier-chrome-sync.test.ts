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
    expect(state.shared.headerTextColor).toBeNull();
    expect(state.shared.footerTextColor).toBeNull();
  });

  test("with sync enabled either editor changes the one shared configuration", () => {
    const next = patchDossierChromeState(DEFAULT_DOSSIER_CHROME_STATE, "cv", {
      headerMode: "contact",
      footerMode: "details",
      headerShowPhone: false,
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });

    expect(next.sync).toBe(true);
    expect(next.shared.headerMode).toBe("contact");
    expect(next.shared.footerMode).toBe("details");
    expect(next.shared.headerShowPhone).toBe(false);
    expect(next.shared.headerTextColor).toBe("#123456");
    expect(next.shared.footerTextColor).toBe("#654321");
    expect(next.cv.headerTextColor).toBeNull();
    expect(next.letter.footerTextColor).toBeNull();
  });

  test("resetting explicit text colors stores null and returns to automatic mode", () => {
    const custom = patchDossierChromeState(DEFAULT_DOSSIER_CHROME_STATE, "cv", {
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });
    const automatic = patchDossierChromeState(custom, "cv", {
      headerTextColor: null,
      footerTextColor: null,
    });

    expect(automatic.shared.headerTextColor).toBeNull();
    expect(automatic.shared.footerTextColor).toBeNull();
  });

  test("turning sync off clones the current shared settings into both documents", () => {
    const shared = patchDossierChromeState(DEFAULT_DOSSIER_CHROME_STATE, "cv", {
      headerMode: "contact",
      footerMode: "details",
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });
    const split = setDossierChromeSyncState(shared, "cv", false);

    expect(split.sync).toBe(false);
    expect(split.cv).toEqual(shared.shared);
    expect(split.letter).toEqual(shared.shared);
  });

  test("with sync off CV and motivation letter can diverge", () => {
    const split = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const cv = patchDossierChromeState(split, "cv", {
      headerMode: "contact",
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });
    const letter = patchDossierChromeState(cv, "letter", {
      headerTextColor: "#abcdef",
      footerTextColor: "#fedcba",
    });

    expect(letter.cv.headerMode).toBe("contact");
    expect(letter.letter.headerMode).toBe("compact");
    expect(letter.cv.headerTextColor).toBe("#123456");
    expect(letter.cv.footerTextColor).toBe("#654321");
    expect(letter.letter.headerTextColor).toBe("#abcdef");
    expect(letter.letter.footerTextColor).toBe("#fedcba");
  });

  test("turning sync back on uses the document where the checkbox was enabled", () => {
    const split = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const changed = patchDossierChromeState(split, "letter", {
      headerMode: "contact",
      footerMode: "details",
      headerShowEmail: false,
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });
    const joined = setDossierChromeSyncState(changed, "letter", true);

    expect(joined.sync).toBe(true);
    expect(joined.shared).toEqual(changed.letter);
    expect(joined.shared.headerShowEmail).toBe(false);
    expect(joined.shared.headerTextColor).toBe("#123456");
    expect(joined.shared.footerTextColor).toBe("#654321");
  });

  test("letter history stores only the effective letter chrome, never CV or sync state", () => {
    const split = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const changedCv = patchDossierChromeState(split, "cv", {
      headerMode: "none",
      footerMode: "none",
      headerTextColor: "#111111",
      footerTextColor: "#222222",
    });
    const historical = patchDossierChromeState(changedCv, "letter", {
      headerMode: "contact",
      footerMode: "details",
      headerShowPhone: false,
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });

    const snapshot = createDossierChromeHistorySnapshot(historical, "letter");

    expect(snapshot).toEqual({
      version: 1,
      scope: "letter",
      options: historical.letter,
    });
    expect(snapshot.options.headerTextColor).toBe("#123456");
    expect(snapshot.options.footerTextColor).toBe("#654321");
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
      headerTextColor: "#111111",
      footerTextColor: "#222222",
    });
    const current = patchDossierChromeState(currentCv, "letter", { headerMode: "none" });

    const oldSplit = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const oldLetter = patchDossierChromeState(oldSplit, "letter", {
      headerMode: "contact",
      footerMode: "none",
      headerShowPhone: false,
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });
    const snapshot = createDossierChromeHistorySnapshot(oldLetter, "letter");
    const restored = restoreDossierChromeHistoryState(current, snapshot);

    expect(restored.sync).toBe(false);
    expect(restored.letter).toEqual(oldLetter.letter);
    expect(restored.letter.headerTextColor).toBe("#123456");
    expect(restored.letter.footerTextColor).toBe("#654321");
    expect(restored.cv).toEqual(current.cv);
    expect(restored.cv.headerTextColor).toBe("#111111");
    expect(restored.cv.footerTextColor).toBe("#222222");
    expect(restored.shared).toEqual(current.shared);
  });

  test("restoring letter history with sync on changes only the shared effective chrome", () => {
    const current = patchDossierChromeState(DEFAULT_DOSSIER_CHROME_STATE, "cv", {
      headerMode: "none",
      headerShowEmail: false,
      headerTextColor: "#111111",
      footerTextColor: "#222222",
    });
    const latentCv = current.cv;
    const latentLetter = current.letter;

    const oldSplit = setDossierChromeSyncState(DEFAULT_DOSSIER_CHROME_STATE, "letter", false);
    const oldLetter = patchDossierChromeState(oldSplit, "letter", {
      headerMode: "contact",
      footerMode: "details",
      headerShowAddress: false,
      headerTextColor: "#123456",
      footerTextColor: "#654321",
    });
    const snapshot = createDossierChromeHistorySnapshot(oldLetter, "letter");
    const restored = restoreDossierChromeHistoryState(current, snapshot);

    expect(restored.sync).toBe(true);
    expect(restored.shared).toEqual(oldLetter.letter);
    expect(restored.shared.headerTextColor).toBe("#123456");
    expect(restored.shared.footerTextColor).toBe("#654321");
    expect(restored.cv).toEqual(latentCv);
    expect(restored.letter).toEqual(latentLetter);
  });
});
