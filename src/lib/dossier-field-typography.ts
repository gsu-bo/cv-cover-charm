export type DossierFieldTypographyScope = "cv" | "letter";

export type DossierFieldTypographyStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type DossierFieldTypographyMeta = {
  scope: DossierFieldTypographyScope;
  section: string;
  label: string;
  value: string;
  /**
   * Stable identity for a formatted editor field. It is generated lazily when
   * the user first formats a plain field and survives value changes.
   */
  fieldId?: string;
  /**
   * Nearby field values captured from the same editor row/group. These are not
   * part of the key; they only disambiguate equal visible text after reload and
   * in DOCX/preview replicas.
   */
  contextValues?: string[];
  /**
   * Zero-based occurrence of the same visible value in editor document order.
   * This is a last-resort tie-breaker when contextual values are identical.
   */
  docxOccurrence?: number;
};

export type DossierFieldTypographyEntry = DossierFieldTypographyMeta & {
  key: string;
  style: DossierFieldTypographyStyle;
};

export type DossierFieldTypographyStoredEntry = Omit<
  DossierFieldTypographyEntry,
  "key" | "scope"
>;

export type PortableDossierFieldTypographyState = {
  version: 1;
  cv: Record<string, DossierFieldTypographyStoredEntry>;
  letter: Record<string, DossierFieldTypographyStoredEntry>;
};

export const DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY =
  "bewerbungsdossier:field-typography:v1";
export const DOSSIER_FIELD_TYPOGRAPHY_EVENT = "dossier-field-typography-change";

const EMPTY_STATE: PortableDossierFieldTypographyState = {
  version: 1,
  cv: {},
  letter: {},
};

let generatedFieldIdCounter = 0;

export function normalizeDossierFieldText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedComparable(value: string): string {
  return normalizeDossierFieldText(value).toLocaleLowerCase("de-CH");
}

function cleanContextValues(value: unknown, ownValue: string): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const own = normalizedComparable(ownValue);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const clean = normalizeDossierFieldText(raw);
    const comparable = normalizedComparable(clean);
    if (!clean || comparable === own || seen.has(comparable)) continue;
    seen.add(comparable);
    result.push(clean);
    if (result.length >= 8) break;
  }

  return result.length ? result : undefined;
}

function cleanFieldId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function cleanOccurrence(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
  return value;
}

function cleanMeta(meta: DossierFieldTypographyMeta): DossierFieldTypographyMeta {
  const value = normalizeDossierFieldText(meta.value);
  const fieldId = cleanFieldId(meta.fieldId);
  const contextValues = cleanContextValues(meta.contextValues, value);
  const docxOccurrence = cleanOccurrence(meta.docxOccurrence);
  return {
    scope: meta.scope,
    section: normalizeDossierFieldText(meta.section),
    label: normalizeDossierFieldText(meta.label),
    value,
    ...(fieldId ? { fieldId } : {}),
    ...(contextValues ? { contextValues } : {}),
    ...(docxOccurrence !== undefined ? { docxOccurrence } : {}),
  };
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function legacyDossierFieldTypographyKey(meta: DossierFieldTypographyMeta): string {
  const clean = cleanMeta(meta);
  return hashText(
    [clean.scope, clean.section, clean.label, clean.value]
      .map((part) => part.toLocaleLowerCase("de-CH"))
      .join("\u0000"),
  );
}

export function dossierFieldTypographyKey(meta: DossierFieldTypographyMeta): string {
  const clean = cleanMeta(meta);
  return clean.fieldId
    ? `field:${clean.scope}:${clean.fieldId}`
    : legacyDossierFieldTypographyKey(clean);
}

export function newDossierFieldTypographyFieldId(
  scope: DossierFieldTypographyScope,
): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${scope}-${crypto.randomUUID()}`;
  }
  generatedFieldIdCounter += 1;
  return `${scope}-${Date.now().toString(36)}-${generatedFieldIdCounter.toString(36)}`;
}

function normalizeStyle(value: unknown): DossierFieldTypographyStyle {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return {
    ...(typeof source.bold === "boolean" ? { bold: source.bold } : {}),
    ...(typeof source.italic === "boolean" ? { italic: source.italic } : {}),
    ...(typeof source.underline === "boolean" ? { underline: source.underline } : {}),
  };
}

function hasStyle(style: DossierFieldTypographyStyle): boolean {
  return (
    typeof style.bold === "boolean" ||
    typeof style.italic === "boolean" ||
    typeof style.underline === "boolean"
  );
}

function normalizeBucket(
  value: unknown,
): Record<string, DossierFieldTypographyStoredEntry> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, DossierFieldTypographyStoredEntry> = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const style = normalizeStyle(entry.style);
    const valueText = normalizeDossierFieldText(String(entry.value ?? ""));
    if (!valueText || !hasStyle(style)) continue;

    const fieldId = cleanFieldId(entry.fieldId);
    const contextValues = cleanContextValues(entry.contextValues, valueText);
    const docxOccurrence = cleanOccurrence(entry.docxOccurrence);

    result[key] = {
      section: normalizeDossierFieldText(String(entry.section ?? "")),
      label: normalizeDossierFieldText(String(entry.label ?? "")),
      value: valueText,
      ...(fieldId ? { fieldId } : {}),
      ...(contextValues ? { contextValues } : {}),
      ...(docxOccurrence !== undefined ? { docxOccurrence } : {}),
      style,
    };
  }

  return result;
}

export function normalizeDossierFieldTypographyState(
  value: unknown,
): PortableDossierFieldTypographyState {
  if (!value || typeof value !== "object") return EMPTY_STATE;
  const source = value as Record<string, unknown>;
  return {
    version: 1,
    cv: normalizeBucket(source.cv),
    letter: normalizeBucket(source.letter),
  };
}

function readState(): PortableDossierFieldTypographyState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY);
    return raw ? normalizeDossierFieldTypographyState(JSON.parse(raw)) : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(state: PortableDossierFieldTypographyState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Formatting still works for the current render when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent(DOSSIER_FIELD_TYPOGRAPHY_EVENT));
}

export function readPortableDossierFieldTypographyState():
  | PortableDossierFieldTypographyState
  | null {
  const state = readState();
  return Object.keys(state.cv).length || Object.keys(state.letter).length ? state : null;
}

export function applyPortableDossierFieldTypographyState(value: unknown) {
  writeState(normalizeDossierFieldTypographyState(value));
}

export function clearDossierFieldTypographyState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY);
  } catch {
    // Storage is optional; still refresh live previews below.
  }
  window.dispatchEvent(new CustomEvent(DOSSIER_FIELD_TYPOGRAPHY_EVENT));
}

export function getDossierFieldTypographyEntries(
  scope: DossierFieldTypographyScope,
): DossierFieldTypographyEntry[] {
  const bucket = readState()[scope];
  return Object.entries(bucket).map(([key, entry]) => ({ key, scope, ...entry }));
}

export function getDossierFieldTypography(
  scope: DossierFieldTypographyScope,
  key: string,
): DossierFieldTypographyStyle {
  return readState()[scope][key]?.style ?? {};
}

function entryMatchScore(
  entry: DossierFieldTypographyEntry,
  meta: DossierFieldTypographyMeta,
): number {
  if (normalizedComparable(entry.section) !== normalizedComparable(meta.section)) return -1;
  if (normalizedComparable(entry.label) !== normalizedComparable(meta.label)) return -1;
  if (normalizedComparable(entry.value) !== normalizedComparable(meta.value)) return -1;

  if (meta.fieldId && entry.fieldId === meta.fieldId) return 10_000;

  let score = entry.fieldId ? 20 : 10;
  const wantedContext = new Set(
    (meta.contextValues ?? []).map((value) => normalizedComparable(value)),
  );
  for (const value of entry.contextValues ?? []) {
    if (wantedContext.has(normalizedComparable(value))) score += 4;
  }
  if (
    meta.docxOccurrence !== undefined &&
    entry.docxOccurrence !== undefined &&
    meta.docxOccurrence === entry.docxOccurrence
  ) {
    score += 2;
  }
  return score;
}

/**
 * Resolves a formatted field after reload/re-render without depending on its
 * current DOM position. Visible value + nearby sibling values identify the
 * field; occurrence is only a final tie-breaker.
 */
export function findDossierFieldTypographyEntry(
  meta: DossierFieldTypographyMeta,
): DossierFieldTypographyEntry | null {
  const clean = cleanMeta(meta);
  const entries = getDossierFieldTypographyEntries(clean.scope);

  if (clean.fieldId) {
    const direct = entries.find((entry) => entry.fieldId === clean.fieldId);
    if (direct) return direct;
  }

  const ranked = entries
    .map((entry) => ({ entry, score: entryMatchScore(entry, clean) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.entry ?? null;
}

export function setDossierFieldTypography(
  meta: DossierFieldTypographyMeta,
  style: DossierFieldTypographyStyle,
  previousKey?: string | null,
): string {
  let clean = cleanMeta(meta);
  const state = readState();
  const existing = previousKey ? state[clean.scope][previousKey] : undefined;

  // Preserve a stable id while the user edits the field value.
  if (!clean.fieldId && existing?.fieldId) {
    clean = { ...clean, fieldId: existing.fieldId };
  }

  const key = dossierFieldTypographyKey(clean);
  const bucket = { ...state[clean.scope] };
  if (previousKey && previousKey !== key) delete bucket[previousKey];

  const normalizedStyle = normalizeStyle(style);
  if (!clean.value || !hasStyle(normalizedStyle)) {
    delete bucket[key];
  } else {
    bucket[key] = {
      section: clean.section,
      label: clean.label,
      value: clean.value,
      ...(clean.fieldId ? { fieldId: clean.fieldId } : {}),
      ...(clean.contextValues ? { contextValues: clean.contextValues } : {}),
      ...(clean.docxOccurrence !== undefined
        ? { docxOccurrence: clean.docxOccurrence }
        : {}),
      style: normalizedStyle,
    };
  }

  writeState({ ...state, [clean.scope]: bucket });
  return key;
}

export function clearDossierFieldTypography(
  scope: DossierFieldTypographyScope,
  key: string,
) {
  const state = readState();
  if (!state[scope][key]) return;
  const bucket = { ...state[scope] };
  delete bucket[key];
  writeState({ ...state, [scope]: bucket });
}
