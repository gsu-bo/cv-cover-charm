import "./cv-pdf-text";

const UMLAUTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "Ae",
  Ö: "Oe",
  Ü: "Ue",
  ß: "ss",
};

const COVER_STORAGE_KEY = "titelblatt:v3";
const LETTER_STORAGE_KEY = "anschreiben:v1";
const CV_STORAGE_KEY = "lebenslauf:v1";

type StudentModule = "Titelblatt" | "Motivationsschreiben" | "Lebenslauf";

export type StudentDownloadIdentity = {
  personName?: string;
  job?: string;
};

function compactDossierPersonName(name: string): string {
  const match = name.match(/^(Bewerbungsdossier-)(.+?)(\.(?:json|pdf|docx))$/i);
  if (!match) return name;
  return `${match[1]}${match[2].replace(/\s+/g, "")}${match[3]}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const text = (record: Record<string, unknown> | undefined, key: string): string => {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
};

function storedRecord(storageKey: string): Record<string, unknown> | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function studentModuleFromPath(pathname: string): StudentModule | null {
  if (/(^|\/)titelblatt(?:\/|$)/i.test(pathname)) return "Titelblatt";
  if (/(^|\/)anschreiben(?:\/|$)/i.test(pathname)) return "Motivationsschreiben";
  if (/(^|\/)lebenslauf(?:\/|$)/i.test(pathname)) return "Lebenslauf";
  return null;
}

/**
 * Holt den Lehrberuf aus einem Betreff, ohne sich auf einen einzigen Wortlaut
 * festzulegen. EFZ/EBA dient als stabiler Anker; typische Bewerbungs-Prefixe
 * werden entfernt. Fehlt jeder brauchbare Hinweis, bleibt der Beruf leer.
 */
export function extractLehrberuf(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const stripped = normalized
    .replace(/^Bewerbung(?:\s+um\s+(?:eine\s+)?Lehrstelle)?\s+(?:als\s+)?/i, "")
    .replace(/^Lehrstelle\s+als\s+/i, "")
    .trim();
  const credential = stripped.match(/^(.*?\b(?:EFZ|EBA)\b)/i)?.[1]?.trim();
  if (credential) return credential.replace(/[,:;\-\s]+$/g, "").trim();

  return stripped !== normalized ? stripped : "";
}

function storedStudentIdentity(): StudentDownloadIdentity {
  const cover = storedRecord(COVER_STORAGE_KEY);
  const cv = storedRecord(CV_STORAGE_KEY);
  const letter = storedRecord(LETTER_STORAGE_KEY);

  const coverData = cover && isRecord(cover.data) ? cover.data : undefined;
  const cvData = cv && isRecord(cv.data) ? cv.data : undefined;
  const cvPerson = cvData && isRecord(cvData.person) ? cvData.person : undefined;
  const letterData = letter && isRecord(letter.data) ? letter.data : undefined;

  const vorname = text(coverData, "vorname") || text(cvPerson, "vorname");
  const nachname = text(coverData, "nachname") || text(cvPerson, "nachname");
  const separatedName = [vorname, nachname].filter(Boolean).join("-");
  const letterName = text(letterData, "absenderName");
  const personName = separatedName || letterName;
  const job = text(coverData, "beruf") || extractLehrberuf(text(letterData, "betreff"));

  return { personName, job };
}

function liveJob(pathname: string): string {
  try {
    if (typeof document === "undefined") return "";
    const module = studentModuleFromPath(pathname);
    if (module === "Titelblatt") {
      return document.querySelector<HTMLInputElement>('input[list="lehrberufe"]')?.value.trim() ?? "";
    }
    if (module === "Motivationsschreiben") {
      const subject = Array.from(document.querySelectorAll<HTMLInputElement>("input")).find((input) =>
        input.placeholder?.toLowerCase().startsWith("bewerbung um eine lehrstelle als"),
      )?.value;
      return extractLehrberuf(subject ?? "");
    }
  } catch {
    // Die Dateibenennung darf niemals einen Download verhindern.
  }
  return "";
}

function requestedPersonPart(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const prefixes = [
    "Bewerbungsdossier",
    "Dossier",
    "Titelblatt",
    "Motivationsschreiben",
    "Lebenslauf",
  ];
  const prefix = prefixes.find((candidate) =>
    new RegExp(`^${candidate}(?:-|$)`, "i").test(base),
  );
  if (!prefix) return "";
  const suffix = base.slice(prefix.length).replace(/^-+/, "").trim();
  if (!suffix || /^(?:Bewerbung|Dossier|Bewerbungsdossier)$/i.test(suffix)) return "";
  return suffix;
}

/**
 * Gemeinsames Namensschema für SuS-Downloads.
 *
 * - Modul-JSON: Modul-Vorname-Nachname-Beruf.json
 * - Einzel-PDF: Modul-Vorname-Nachname-Beruf.pdf
 * - Gesamt-PDF: Dossier-Vorname-Nachname-Beruf.pdf
 *
 * Beruf und Name sind optional; fehlende Angaben werden einfach ausgelassen.
 */
export function resolveStudentDownloadFileName(
  requestedName: string,
  pathname: string,
  identity: StudentDownloadIdentity,
): string {
  const extension = requestedName.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
  if (extension !== "json" && extension !== "pdf") return requestedName;

  const base = requestedName.replace(/\.[^.]+$/, "");
  const module = studentModuleFromPath(pathname);
  let prefix: "Dossier" | StudentModule | null = null;

  if (/^(?:Bewerbungsdossier|Dossier)(?:-|$)/i.test(base)) {
    prefix = extension === "json" && module ? module : "Dossier";
  } else if (/^Titelblatt(?:-|$)/i.test(base)) {
    prefix = "Titelblatt";
  } else if (/^Motivationsschreiben(?:-|$)/i.test(base)) {
    prefix = "Motivationsschreiben";
  } else if (/^Lebenslauf(?:-|$)/i.test(base)) {
    prefix = "Lebenslauf";
  }

  if (!prefix) return requestedName;
  return [prefix, identity.personName?.trim(), identity.job?.trim()].filter(Boolean).join("-") + `.${extension}`;
}

function runtimeDownloadFileName(fileName: string): string {
  try {
    if (typeof window === "undefined") return fileName;
    const pathname = window.location.pathname;
    const stored = storedStudentIdentity();
    const personName = requestedPersonPart(fileName) || stored.personName;
    const job = liveJob(pathname) || stored.job;
    return resolveStudentDownloadFileName(fileName, pathname, { personName, job });
  } catch {
    return fileName;
  }
}

/**
 * Chrome ignoriert das `download`-Attribut, sobald der Dateiname Zeichen
 * ausserhalb von Latin-1 … in der Praxis reicht schon ein "ü": aus
 * "Titelblatt-Lea-Müller.pdf" wird dann kommentarlos "download". Deshalb
 * werden Umlaute transliteriert und alles Übrige entfernt.
 *
 * Die alte Bewerbungsdossier-Kompaktform bleibt als Fallback kompatibel.
 * Die aktuellen SuS-Downloads laufen vorher durch das gemeinsame, lesbare
 * Modul-/Dossier-Schema mit Bindestrichen.
 */
export function safeFileName(name: string): string {
  const ascii = compactDossierPersonName(name)
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTS[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || "Titelblatt";
}

/** Lädt einen Blob herunter, ohne die Object-URL zu früh freizugeben. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(runtimeDownloadFileName(fileName));
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
