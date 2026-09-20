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
};

export type DossierFieldTypographyEntry = DossierFieldTypographyMeta & {
  key: string;
  style: DossierFieldTypographyStyle;
};

type StoredEntry = Omit<DossierFieldTypographyEntry, "key" | "scope">;
type StoredState = {
  version: 1;
  cv: Record<string, StoredEntry>;
  letter: Record<string, StoredEntry>;
};

export const DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY =
  "bewerbungsdossier:field-typography:v1";
export const DOSSIER_FIELD_TYPOGRAPHY_EVENT = "dossier-field-typography-change";

const EMPTY_STATE: StoredState = { version: 1, cv: {}, letter: {} };

export function normalizeDossierFieldText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanMeta(meta: DossierFieldTypographyMeta): DossierFieldTypographyMeta {
  return {
    scope: meta.scope,
    section: normalizeDossierFieldText(meta.section),
    label: normalizeDossierFieldText(meta.label),
    value: normalizeDossierFieldText(meta.value),
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

export function dossierFieldTypographyKey(meta: DossierFieldTypographyMeta): string {
  const clean = cleanMeta(meta);
  return hashText(
    [clean.scope, clean.section, clean.label, clean.value]
      .map((part) => part.toLocaleLowerCase("de-CH"))
      .join("\u0000"),
  );
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

function normalizeBucket(value: unknown): Record<string, StoredEntry> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, StoredEntry> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const style = normalizeStyle(entry.style);
    const valueText = normalizeDossierFieldText(String(entry.value ?? ""));
    if (!valueText || !hasStyle(style)) continue;
    result[key] = {
      section: normalizeDossierFieldText(String(entry.section ?? "")),
      label: normalizeDossierFieldText(String(entry.label ?? "")),
      value: valueText,
      style,
    };
  }
  return result;
}

function readState(): StoredState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      version: 1,
      cv: normalizeBucket(parsed.cv),
      letter: normalizeBucket(parsed.letter),
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Formatting still works for the current render when storage is blocked.
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

export function setDossierFieldTypography(
  meta: DossierFieldTypographyMeta,
  style: DossierFieldTypographyStyle,
  previousKey?: string | null,
): string {
  const clean = cleanMeta(meta);
  const key = dossierFieldTypographyKey(clean);
  const state = readState();
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
