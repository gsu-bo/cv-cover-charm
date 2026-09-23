import {
  cvSectionOrder,
  customSectionForKey,
  entryFilled,
  isCustomSectionKey,
  type CvData,
  type CvLayoutSectionKey,
  type CvSectionPage,
} from "./types";

export type CvPageFitMode = "one" | "two";

export const CV_PAGE_FIT_STORAGE_KEY = "lebenslauf:page-fit:v1";
const CV_PAGE_FIT_EVENT = "lebenslauf-page-fit-change";

let runtimePageCount = 0;
let revision = 0;

function validMode(value: unknown): value is CvPageFitMode {
  return value === "one" || value === "two";
}

function readMode(): CvPageFitMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CV_PAGE_FIT_STORAGE_KEY);
    return validMode(value) ? value : null;
  } catch {
    return null;
  }
}

function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CV_PAGE_FIT_EVENT));
}

export function getCvPageFitMode(): CvPageFitMode | null {
  return readMode();
}

/**
 * Selecting the active mode again deliberately counts as a new request. This
 * lets a pupil press "1 Seite" or "2 Seiten" once more after manually moving a
 * rubric and get a clean automatic redistribution without a third reset button.
 */
export function setCvPageFitMode(mode: CvPageFitMode | null) {
  if (typeof window !== "undefined") {
    try {
      if (mode === null) window.localStorage.removeItem(CV_PAGE_FIT_STORAGE_KEY);
      else window.localStorage.setItem(CV_PAGE_FIT_STORAGE_KEY, mode);
    } catch {
      // The current editor still reacts through the in-memory revision/event.
    }
  }
  revision += 1;
  dispatchChange();
}

export function getCvPageFitRevision(): number {
  return revision;
}

export function publishCvPageFitPageCount(count: number) {
  const next = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  if (next === runtimePageCount) return;
  runtimePageCount = next;
  dispatchChange();
}

export function getCvPageFitPageCount(): number {
  return runtimePageCount;
}

export function subscribeCvPageFit(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const local = () => onChange();
  const storage = (event: StorageEvent) => {
    if (event.key !== CV_PAGE_FIT_STORAGE_KEY) return;
    revision += 1;
    onChange();
  };
  window.addEventListener(CV_PAGE_FIT_EVENT, local);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CV_PAGE_FIT_EVENT, local);
    window.removeEventListener("storage", storage);
  };
}

const textWeight = (...values: unknown[]) =>
  values.reduce<number>(
    (sum, value) => sum + (typeof value === "string" ? value.trim().length / 52 : 0),
    0,
  );

function entryWeight(entry: CvData["schule"][number]) {
  if (!entryFilled(entry)) return 0;
  return 2.1 + textWeight(entry.zeit, entry.titel, entry.ort) + entry.beschreibung.trim().length / 38;
}

/**
 * Content weight is intentionally a stable estimate, not a second DOM layout
 * engine. The browser paginator remains the final authority; this score only
 * chooses a sensible section split and a conservative typography density.
 */
export function cvPageFitSectionWeight(data: CvData, key: CvLayoutSectionKey): number {
  if (key === "person") {
    const person = data.person;
    const values = [
      person.vorname,
      person.nachname,
      person.untertitel,
      person.adresse,
      person.plzOrt,
      person.telefon,
      person.email,
      person.geburtsdatum,
      person.geburtsort,
      person.heimatort,
      person.nationalitaet,
    ];
    const filled = values.filter((value) => typeof value === "string" && value.trim()).length;
    return 3.8 + filled * 0.48 + textWeight(...values) + (person.foto ? 1.1 : 0);
  }

  if (isCustomSectionKey(key)) {
    const section = customSectionForKey(data, key);
    if (!section) return 0;
    const entries = section.entries.reduce((sum, entry) => sum + entryWeight(entry), 0);
    return entries > 0 ? 1.2 + entries + section.title.trim().length / 80 : 0;
  }

  if (data.hidden[key]) return 0;

  if (key === "schule" || key === "erfahrung") {
    const entries = data[key].reduce((sum, entry) => sum + entryWeight(entry), 0);
    return entries > 0 ? 1.3 + entries : 0;
  }

  if (key === "sprachen") {
    const rows = data.sprachen.filter((row) => row.name.trim() || row.niveau.trim());
    return rows.length
      ? 1.2 + rows.reduce((sum, row) => sum + 0.9 + textWeight(row.name, row.niveau), 0)
      : 0;
  }

  if (key === "hobbys" || key === "staerken") {
    const rows = data[key].filter((row) => row.trim());
    return rows.length
      ? 1.1 + rows.reduce((sum, row) => sum + 0.72 + row.trim().length / 55, 0)
      : 0;
  }

  const rows = data.referenzen.filter((row) =>
    [row.name, row.funktion, row.kontakt, row.email, row.zusatz].some((value) => value?.trim()),
  );
  return rows.length
    ? 1.2 +
        rows.reduce(
          (sum, row) =>
            sum +
            1.65 +
            textWeight(row.name, row.funktion, row.kontakt, row.email, row.zusatz),
          0,
        )
    : 0;
}

export type CvPageFitPlan = {
  mode: CvPageFitMode;
  totalWeight: number;
  pageBySection: Partial<Record<CvLayoutSectionKey, CvSectionPage>>;
  assignmentSignature: string;
  titleScaleFactor: number;
  headingScaleFactor: number;
  bodyScaleFactor: number;
};

function onePageScale(weight: number) {
  if (weight <= 18) return 1;
  if (weight <= 24) return 0.97;
  if (weight <= 32) return 0.93;
  if (weight <= 40) return 0.89;
  if (weight <= 50) return 0.85;
  return 0.82;
}

function twoPageScale(weight: number) {
  if (weight <= 20) return 1.07;
  if (weight <= 30) return 1.04;
  if (weight <= 42) return 1.02;
  return 1;
}

/**
 * Build a predictable pupil-facing plan:
 * - one page: everything returns to page 1 / normal flow;
 * - two pages: keep section order, put personal data on page 1, and choose the
 *   split whose estimated content weights are closest to balanced.
 */
export function buildCvPageFitPlan(data: CvData, mode: CvPageFitMode): CvPageFitPlan {
  const order = cvSectionOrder(data);
  const weights = new Map(order.map((key) => [key, cvPageFitSectionWeight(data, key)]));
  const totalWeight = order.reduce((sum, key) => sum + (weights.get(key) ?? 0), 0);
  const pageBySection: Partial<Record<CvLayoutSectionKey, CvSectionPage>> = {};

  if (mode === "one") {
    for (const key of order) pageBySection[key] = 1;
  } else {
    const active = order.filter((key) => key !== "person" && (weights.get(key) ?? 0) > 0);
    if (!active.length) {
      for (const key of order) pageBySection[key] = 1;
    } else {
      const personWeight = weights.get("person") ?? 0;
      const activeWeights = active.map((key) => weights.get(key) ?? 0);
      const activeTotal = activeWeights.reduce((sum, value) => sum + value, 0);
      let bestSplit = 0;
      let bestCost = Number.POSITIVE_INFINITY;
      let before = 0;

      // split is the number of active sections kept on page 1. At least one
      // active section remains on page 2 so the explicit two-page choice really
      // produces a second content page whenever there is content to move.
      for (let split = 0; split < active.length; split += 1) {
        const pageOneWeight = personWeight + before;
        const pageTwoWeight = activeTotal - before;
        const emptinessPenalty = split === 0 && active.length >= 3 ? 1.5 : 0;
        const cost = Math.abs(pageOneWeight - pageTwoWeight) + emptinessPenalty;
        if (cost < bestCost) {
          bestCost = cost;
          bestSplit = split;
        }
        before += activeWeights[split];
      }

      const firstPageTwoKey = active[bestSplit];
      const splitIndex = order.indexOf(firstPageTwoKey);
      for (const [index, key] of order.entries()) {
        pageBySection[key] = key === "person" || index < splitIndex ? 1 : 2;
      }
    }
  }

  const baseScale = mode === "one" ? onePageScale(totalWeight) : twoPageScale(totalWeight);
  const titleScaleFactor = mode === "one" ? Math.max(0.9, baseScale) : Math.min(1.04, baseScale);
  const headingScaleFactor = mode === "one" ? Math.max(0.86, baseScale) : baseScale;
  const bodyScaleFactor = baseScale;
  const assignmentSignature = `${mode}|${order
    .map((key) => `${key}:${pageBySection[key] ?? 1}`)
    .join("|")}`;

  return {
    mode,
    totalWeight,
    pageBySection,
    assignmentSignature,
    titleScaleFactor,
    headingScaleFactor,
    bodyScaleFactor,
  };
}
