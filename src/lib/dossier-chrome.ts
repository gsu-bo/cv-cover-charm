import { FONT_LABELS, type FontKey } from "@/components/cover/types";
import { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";

export type DossierChromeScope = "cv" | "letter";
export type DossierHeaderMode = "compact" | "contact" | "none";
export type DossierFooterMode = "compact" | "details" | "none";
export type DossierChromeTextLayout = "stacked" | "inline";
export type DossierChromeInlineSeparator = "dot" | "icons" | "slash" | "pipe" | "space";

export type DossierChromeOptions = {
  headerMode: DossierHeaderMode;
  headerShowName: boolean;
  headerShowAddress: boolean;
  headerShowPhone: boolean;
  headerShowEmail: boolean;
  /** Word-like first-page behavior for templates that explicitly use shared chrome. */
  headerDifferentFirstPage?: boolean;
  headerHeightMm: number | null;
  /** Additional whitespace between the shared header zone and document content. */
  headerGapMm?: number;
  /** Signed vertical nudge for header/contact content. Does not move the header surface. */
  headerContentOffsetYMm?: number;
  /** Motivation-letter-only recipient nudge. Ignored by CV rendering. */
  letterRecipientOffsetYMm?: number;
  headerTextLayout: DossierChromeTextLayout;
  /** Visual separator used by the horizontal contact header. */
  headerInlineSeparator?: DossierChromeInlineSeparator;
  headerBackgroundColor: string | null;
  headerGradientColor: string | null;
  footerMode: DossierFooterMode;
  footerHeightMm: number | null;
  /** Signed vertical nudge for footer details. Does not move the footer surface. */
  footerContentOffsetYMm?: number;
  footerTextLayout: DossierChromeTextLayout;
  footerBackgroundColor: string | null;
  footerGradientColor: string | null;
  borderEnabled: boolean;
  borderColor: string | null;
  borderWidthMm: number;
  textFont: FontKey | null;
};

export type DossierChromeState = {
  version: 1;
  sync: boolean;
  shared: DossierChromeOptions;
  cv: DossierChromeOptions;
  letter: DossierChromeOptions;
};

export type DossierChromeHistorySnapshot = {
  version: 1;
  scope: DossierChromeScope;
  options: DossierChromeOptions;
};

export type DossierChromeContact = {
  name: string;
  address: string;
  place: string;
  phone: string;
  email: string;
};

export const DOSSIER_CHROME_STORAGE_KEY = "bewerbungsdossier:chrome:v1";
const LETTER_STORAGE_KEY = "anschreiben:v1";
const EVENT = "bewerbungsdossier-chrome-change";

export const DEFAULT_DOSSIER_CHROME_OPTIONS: DossierChromeOptions = {
  headerMode: CANONICAL_DOSSIER_PRESENTATION.letter.headerMode,
  headerShowName: true,
  headerShowAddress: true,
  headerShowPhone: true,
  headerShowEmail: true,
  headerDifferentFirstPage: true,
  headerHeightMm: null,
  headerGapMm: 12,
  headerContentOffsetYMm: 0,
  letterRecipientOffsetYMm: 0,
  headerTextLayout: "stacked",
  headerInlineSeparator: "icons",
  headerBackgroundColor: null,
  headerGradientColor: null,
  footerMode: CANONICAL_DOSSIER_PRESENTATION.letter.footerMode,
  footerHeightMm: null,
  footerContentOffsetYMm: 0,
  footerTextLayout: "inline",
  footerBackgroundColor: null,
  footerGradientColor: null,
  borderEnabled: false,
  borderColor: null,
  borderWidthMm: 0.6,
  textFont: null,
};

export const DEFAULT_DOSSIER_CHROME_STATE: DossierChromeState = {
  version: 1,
  sync: true,
  shared: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
  cv: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
  letter: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
};

let cached: DossierChromeState | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function normalizedMm(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, Math.round(numeric * 10) / 10));
}

function normalizedOffsetMm(value: unknown, min: number, max: number, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric * 10) / 10));
}

function normalizedColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}

function normalizedFont(value: unknown): FontKey | null {
  return typeof value === "string" && value in FONT_LABELS ? (value as FontKey) : null;
}

function normalizedBorderWidth(value: unknown, fallback: number): number {
  const normalized = normalizedMm(value, 0.2, 3);
  return normalized ?? fallback;
}

function normalizedHeaderInlineSeparator(
  value: unknown,
  fallback: DossierChromeInlineSeparator = "icons",
): DossierChromeInlineSeparator {
  return value === "dot" ||
    value === "icons" ||
    value === "slash" ||
    value === "pipe" ||
    value === "space"
    ? value
    : fallback;
}

function normalizeOptions(
  value: unknown,
  fallback = DEFAULT_DOSSIER_CHROME_OPTIONS,
): DossierChromeOptions {
  if (!isRecord(value)) return { ...fallback };
  return {
    headerMode:
      value.headerMode === "compact" ||
      value.headerMode === "contact" ||
      value.headerMode === "none"
        ? value.headerMode
        : fallback.headerMode,
    headerShowName: value.headerShowName !== false,
    headerShowAddress: value.headerShowAddress !== false,
    headerShowPhone: value.headerShowPhone !== false,
    headerShowEmail: value.headerShowEmail !== false,
    headerDifferentFirstPage:
      typeof value.headerDifferentFirstPage === "boolean"
        ? value.headerDifferentFirstPage
        : (fallback.headerDifferentFirstPage ?? true),
    headerHeightMm: normalizedMm(value.headerHeightMm, 1, 40),
    headerGapMm: normalizedMm(value.headerGapMm, 0, 40) ?? fallback.headerGapMm ?? 12,
    headerContentOffsetYMm: normalizedOffsetMm(
      value.headerContentOffsetYMm,
      -12,
      12,
      fallback.headerContentOffsetYMm ?? 0,
    ),
    letterRecipientOffsetYMm: normalizedOffsetMm(
      value.letterRecipientOffsetYMm,
      -12,
      12,
      fallback.letterRecipientOffsetYMm ?? 0,
    ),
    headerTextLayout: value.headerTextLayout === "inline" ? "inline" : "stacked",
    // Before this field existed, horizontal contact rows always rendered with a
    // midpoint. Preserve that appearance for persisted legacy options that omit it.
    headerInlineSeparator:
      value.headerInlineSeparator === undefined
        ? "dot"
        : normalizedHeaderInlineSeparator(
            value.headerInlineSeparator,
            fallback.headerInlineSeparator ?? "icons",
          ),
    headerBackgroundColor: normalizedColor(value.headerBackgroundColor),
    headerGradientColor: normalizedColor(value.headerGradientColor),
    footerMode:
      value.footerMode === "details" || value.footerMode === "none" ? value.footerMode : "compact",
    footerHeightMm: normalizedMm(value.footerHeightMm, 1, 40),
    footerContentOffsetYMm: normalizedOffsetMm(
      value.footerContentOffsetYMm,
      -8,
      8,
      fallback.footerContentOffsetYMm ?? 0,
    ),
    footerTextLayout: value.footerTextLayout === "stacked" ? "stacked" : "inline",
    footerBackgroundColor: normalizedColor(value.footerBackgroundColor),
    footerGradientColor: normalizedColor(value.footerGradientColor),
    borderEnabled:
      typeof value.borderEnabled === "boolean" ? value.borderEnabled : fallback.borderEnabled,
    borderColor: normalizedColor(value.borderColor),
    borderWidthMm: normalizedBorderWidth(value.borderWidthMm, fallback.borderWidthMm),
    textFont: normalizedFont(value.textFont),
  };
}

function optionsFromSavedLetter(storage: Storage): DossierChromeOptions | null {
  try {
    const raw = storage.getItem(LETTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.design)) return null;
    const design = parsed.design;
    return normalizeOptions({
      headerMode: design.headerMode,
      headerShowName: design.headerShowName,
      headerShowAddress: design.headerShowAddress,
      headerShowPhone: design.headerShowPhone,
      headerShowEmail: design.headerShowEmail,
      headerDifferentFirstPage: design.headerDifferentFirstPage,
      headerHeightMm: design.headerHeightMm,
      headerGapMm: design.headerGapMm,
      headerTextLayout: design.headerTextLayout,
      headerInlineSeparator: design.headerInlineSeparator,
      headerBackgroundColor: design.headerBackgroundColor,
      headerGradientColor: design.headerGradientColor,
      footerMode: design.footerMode === "attachments" ? "details" : design.footerMode,
      footerHeightMm: design.footerHeightMm,
      footerTextLayout: design.footerTextLayout,
      footerBackgroundColor: design.footerBackgroundColor,
      footerGradientColor: design.footerGradientColor,
      borderEnabled: design.chromeBorderEnabled,
      borderColor: design.chromeBorderColor,
      borderWidthMm: design.chromeBorderWidthMm,
      textFont: design.chromeTextFont,
    });
  } catch {
    return null;
  }
}

export function normalizeDossierChromeState(value: unknown): DossierChromeState {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_DOSSIER_CHROME_STATE,
      shared: { ...DEFAULT_DOSSIER_CHROME_STATE.shared },
      cv: { ...DEFAULT_DOSSIER_CHROME_STATE.cv },
      letter: { ...DEFAULT_DOSSIER_CHROME_STATE.letter },
    };
  }
  const shared = normalizeOptions(value.shared);
  return {
    version: 1,
    sync: value.sync !== false,
    shared,
    cv: normalizeOptions(value.cv, shared),
    letter: normalizeOptions(value.letter, shared),
  };
}

/**
 * History is document-scoped. Persist only the effective chrome options of the
 * document that owns the history entry; never capture another document's
 * independent branch or the global sync flag.
 *
 * Existing history entries may still contain a full DossierChromeState. Passing
 * one here migrates it to the compact, scope-safe representation in memory.
 */
export function createDossierChromeHistorySnapshot(
  value: unknown,
  scope: DossierChromeScope,
): DossierChromeHistorySnapshot {
  if (isRecord(value) && value.scope === scope && isRecord(value.options)) {
    return {
      version: 1,
      scope,
      options: normalizeOptions(value.options),
    };
  }

  const state = normalizeDossierChromeState(value);
  const options = state.sync ? state.shared : state[scope];
  return {
    version: 1,
    scope,
    options: { ...options },
  };
}

/**
 * Restore one history snapshot into the current chrome topology. The current
 * sync mode stays authoritative: with sync off only the owning document branch
 * changes; with sync on only the shared branch changes. Latent CV/letter
 * branches are never rolled back by another document's history.
 */
export function restoreDossierChromeHistoryState(
  current: DossierChromeState,
  value: unknown,
): DossierChromeState {
  if (
    !isRecord(value) ||
    (value.scope !== "cv" && value.scope !== "letter") ||
    !isRecord(value.options)
  ) {
    return current;
  }

  const scope = value.scope as DossierChromeScope;
  const fallback = current.sync ? current.shared : current[scope];
  const options = normalizeOptions(value.options, fallback);

  if (current.sync) {
    return {
      ...current,
      shared: options,
    };
  }

  return {
    ...current,
    [scope]: options,
  };
}

function read(): DossierChromeState {
  if (typeof window === "undefined") return normalizeDossierChromeState(null);
  try {
    const raw = window.localStorage?.getItem(DOSSIER_CHROME_STORAGE_KEY);
    if (raw) return normalizeDossierChromeState(JSON.parse(raw));

    // Ein bestehendes Anschreiben behält seine bisherige Kopf-/Fusswahl. Beim
    // ersten Start des gemeinsamen Systems wird sie zur gemeinsamen Vorgabe.
    if (window.localStorage) {
      const migrated = optionsFromSavedLetter(window.localStorage);
      if (migrated) {
        return {
          version: 1,
          sync: true,
          shared: migrated,
          cv: { ...migrated },
          letter: { ...migrated },
        };
      }
    }
  } catch {
    // Blockierter oder beschädigter Storage fällt auf sichere Defaults zurück.
  }
  return normalizeDossierChromeState(null);
}

function mirrorLegacyLetterDesign(next: DossierChromeState) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.design)) return;

    const options = next.sync ? next.shared : next.letter;
    const footerMode = options.footerMode === "details" ? "attachments" : options.footerMode;
    const design = parsed.design;
    const designMatches =
      design.headerMode === options.headerMode &&
      design.headerShowName === options.headerShowName &&
      design.headerShowAddress === options.headerShowAddress &&
      design.headerShowPhone === options.headerShowPhone &&
      design.headerShowEmail === options.headerShowEmail &&
      design.headerDifferentFirstPage === (options.headerDifferentFirstPage ?? true) &&
      design.headerHeightMm === options.headerHeightMm &&
      design.headerGapMm === (options.headerGapMm ?? 12) &&
      design.headerTextLayout === options.headerTextLayout &&
      design.headerInlineSeparator === (options.headerInlineSeparator ?? "icons") &&
      design.headerBackgroundColor === options.headerBackgroundColor &&
      design.headerGradientColor === options.headerGradientColor &&
      design.footerMode === footerMode &&
      design.footerHeightMm === options.footerHeightMm &&
      design.footerTextLayout === options.footerTextLayout &&
      design.footerBackgroundColor === options.footerBackgroundColor &&
      design.footerGradientColor === options.footerGradientColor &&
      design.chromeBorderEnabled === options.borderEnabled &&
      design.chromeBorderColor === options.borderColor &&
      design.chromeBorderWidthMm === options.borderWidthMm &&
      design.chromeTextFont === options.textFont;
    if (designMatches && parsed.chrome == null) return;

    const nextLetter: Record<string, unknown> = {
      ...parsed,
      design: {
        ...design,
        headerMode: options.headerMode,
        headerShowName: options.headerShowName,
        headerShowAddress: options.headerShowAddress,
        headerShowPhone: options.headerShowPhone,
        headerShowEmail: options.headerShowEmail,
        headerDifferentFirstPage: options.headerDifferentFirstPage ?? true,
        headerHeightMm: options.headerHeightMm,
        headerGapMm: options.headerGapMm ?? 12,
        headerTextLayout: options.headerTextLayout,
        headerInlineSeparator: options.headerInlineSeparator ?? "icons",
        headerBackgroundColor: options.headerBackgroundColor,
        headerGradientColor: options.headerGradientColor,
        footerMode,
        footerHeightMm: options.footerHeightMm,
        footerTextLayout: options.footerTextLayout,
        footerBackgroundColor: options.footerBackgroundColor,
        footerGradientColor: options.footerGradientColor,
        chromeBorderEnabled: options.borderEnabled,
        chromeBorderColor: options.borderColor,
        chromeBorderWidthMm: options.borderWidthMm,
        chromeTextFont: options.textFont,
      },
    };
    // `bewerbungsdossier:chrome:v1` is the only live authority. Strip old
    // embedded copies whenever the compatibility design mirror is touched.
    delete nextLetter.chrome;
    window.localStorage.setItem(LETTER_STORAGE_KEY, JSON.stringify(nextLetter));
  } catch {
    // Der neue gemeinsame Speicher bleibt die kanonische Quelle. Die Spiegelung
    // existiert nur für ältere Einzelbrief-Stände und Browser-Automation.
  }
}

function store(next: DossierChromeState) {
  cached = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(DOSSIER_CHROME_STORAGE_KEY, JSON.stringify(next));
    mirrorLegacyLetterDesign(next);
  } catch {
    // Der laufende Tab reagiert weiterhin über das Event.
  }
  if (typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function getDossierChromeState(): DossierChromeState {
  if (!cached) cached = read();
  return cached;
}

export function getDossierChromeOptions(scope: DossierChromeScope): DossierChromeOptions {
  const state = getDossierChromeState();
  return state.sync ? state.shared : state[scope];
}

export function patchDossierChromeState(
  state: DossierChromeState,
  scope: DossierChromeScope,
  patch: Partial<DossierChromeOptions>,
): DossierChromeState {
  if (state.sync) {
    return {
      ...state,
      shared: normalizeOptions({ ...state.shared, ...patch }, state.shared),
    };
  }
  return {
    ...state,
    [scope]: normalizeOptions({ ...state[scope], ...patch }, state[scope]),
  };
}

export function patchDossierChrome(
  scope: DossierChromeScope,
  patch: Partial<DossierChromeOptions>,
) {
  store(patchDossierChromeState(getDossierChromeState(), scope, patch));
}

export function setDossierChromeSyncState(
  state: DossierChromeState,
  scope: DossierChromeScope,
  sync: boolean,
): DossierChromeState {
  if (state.sync === sync) return state;
  if (sync) {
    const source = state[scope];
    // Recipient placement belongs to the motivation letter, not to the shared
    // header/footer topology. Re-enabling sync from the CV must therefore keep
    // the letter branch's recipient offset instead of reviving the CV's dormant copy.
    const letterRecipientOffsetYMm =
      state.letter.letterRecipientOffsetYMm ?? state.shared.letterRecipientOffsetYMm ?? 0;
    return {
      ...state,
      sync: true,
      shared: { ...source, letterRecipientOffsetYMm },
    };
  }
  return {
    ...state,
    sync: false,
    cv: { ...state.shared },
    letter: { ...state.shared },
  };
}

export function setDossierChromeSync(scope: DossierChromeScope, sync: boolean) {
  store(setDossierChromeSyncState(getDossierChromeState(), scope, sync));
}

export function subscribeDossierChrome(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (event.key !== DOSSIER_CHROME_STORAGE_KEY) return;
    cached = read();
    onChange();
  };
  window.addEventListener(EVENT, local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener("storage", storage);
  };
}

export function readPortableDossierChromeState(): DossierChromeState {
  return getDossierChromeState();
}

export function applyPortableDossierChromeState(
  value: unknown,
  { replaceExisting = false }: { replaceExisting?: boolean } = {},
) {
  const current = getDossierChromeState();
  const historyRestored = restoreDossierChromeHistoryState(current, value);
  if (historyRestored !== current) {
    store(historyRestored);
    return;
  }

  if (!replaceExisting && typeof window !== "undefined") {
    try {
      const existing = window.localStorage?.getItem(DOSSIER_CHROME_STORAGE_KEY);
      if (existing) {
        // Ein eingebetteter Letter-Snapshot ist nur noch Kompatibilitätsdaten.
        // Sobald die dedizierte Dossier-Quelle existiert, darf er sie nicht
        // beim Öffnen oder bei einem Fokuswechsel zurückrollen.
        cached = normalizeDossierChromeState(JSON.parse(existing));
        return;
      }
    } catch {
      // Beschädigter kanonischer Speicher darf durch einen portablen Stand
      // repariert werden.
    }
  }
  store(normalizeDossierChromeState(value));
}

export function effectiveDossierHeaderModeForOptions(
  options: DossierChromeOptions,
  pageIndex = 0,
): DossierHeaderMode {
  const requested = options.headerMode;
  if (pageIndex === 0 || options.headerDifferentFirstPage === false) return requested;
  return requested === "none" ? "none" : "compact";
}

export function dossierHeaderVisualHeightMmForOptions(
  options: DossierChromeOptions,
  pageIndex = 0,
): number {
  if (options.headerMode === "none") return 0;

  const custom = options.headerHeightMm;
  if (
    pageIndex > 0 &&
    options.headerDifferentFirstPage !== false &&
    options.headerMode === "contact"
  ) {
    return custom === null ? 8 : Math.min(18, Math.max(5, custom));
  }

  const mode = effectiveDossierHeaderModeForOptions(options, pageIndex);
  if (mode === "contact") return custom === null ? 22 : Math.min(40, Math.max(10, custom));
  if (mode === "compact") return custom === null ? 3 : Math.min(18, Math.max(1, custom));
  return 0;
}

export function dossierHeaderContentTopMmForOptions(
  options: DossierChromeOptions,
  pageIndex = 0,
): number {
  const mode = effectiveDossierHeaderModeForOptions(options, pageIndex);
  if (mode === "none") return pageIndex > 0 ? 16 : 18;

  const height = dossierHeaderVisualHeightMmForOptions(options, pageIndex);
  const gap = Math.min(40, Math.max(0, options.headerGapMm ?? 12));
  if (pageIndex > 0 && options.headerDifferentFirstPage !== false) {
    const base =
      options.headerMode === "contact" ? Math.max(18, height + 10) : Math.max(18, height + 15);
    return base + gap;
  }
  const base = mode === "contact" ? Math.max(18, height + 9) : Math.max(18, height + 18);
  return base + gap;
}

export function dossierFooterVisualHeightMmForOptions(options: DossierChromeOptions): number {
  if (options.footerMode === "none") return 0;
  const custom = options.footerHeightMm;
  if (options.footerMode === "details") {
    return custom === null ? 10 : Math.min(40, Math.max(4, custom));
  }
  return custom === null ? 2.4 : Math.min(18, Math.max(1, custom));
}

export function dossierFooterContentBottomMmForOptions(options: DossierChromeOptions): number {
  if (options.footerMode === "none") return 10;
  const height = dossierFooterVisualHeightMmForOptions(options);
  return options.footerMode === "details" ? height + 10 : height + 14.6;
}

// Compatibility wrappers for callers that intentionally read the live store.
// Layout engines should use the pure option-based helpers above.
export function effectiveDossierHeaderMode(
  scope: DossierChromeScope,
  pageIndex = 0,
): DossierHeaderMode {
  return effectiveDossierHeaderModeForOptions(getDossierChromeOptions(scope), pageIndex);
}

export function dossierHeaderContentTopMm(scope: DossierChromeScope, pageIndex = 0): number {
  return dossierHeaderContentTopMmForOptions(getDossierChromeOptions(scope), pageIndex);
}

export function dossierHeaderVisualHeightMm(scope: DossierChromeScope, pageIndex = 0): number {
  return dossierHeaderVisualHeightMmForOptions(getDossierChromeOptions(scope), pageIndex);
}

export function dossierFooterContentBottomMm(scope: DossierChromeScope): number {
  return dossierFooterContentBottomMmForOptions(getDossierChromeOptions(scope));
}

export function dossierFooterVisualHeightMm(scope: DossierChromeScope): number {
  return dossierFooterVisualHeightMmForOptions(getDossierChromeOptions(scope));
}
