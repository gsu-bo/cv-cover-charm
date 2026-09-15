import { downloadBlob, safeFileName } from "@/lib/download";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  LETTER_STORAGE_KEY,
  createDossierProject,
  parseDossierProject,
  readStoredDossierPart,
  type DossierProject,
} from "@/lib/dossier-project";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function projectPersonName(project: DossierProject): string {
  const coverData = isRecord(project.cover?.data) ? project.cover.data : undefined;
  const cvData = isRecord(project.cv?.data) ? project.cv.data : undefined;
  const cvPerson = isRecord(cvData?.person) ? cvData.person : undefined;

  const coverName = coverData
    ? [stringField(coverData.vorname), stringField(coverData.nachname)].filter(Boolean).join("")
    : "";
  const cvName = cvPerson
    ? [stringField(cvPerson.vorname), stringField(cvPerson.nachname)].filter(Boolean).join("")
    : "";
  return coverName || cvName;
}

/** Liest den aktuellen Browserstand als portable Projektdatei – auch ein leerer Startstand ist speicherbar. */
export function dossierProjectFromBrowser(): DossierProject {
  const cover = readStoredDossierPart(COVER_STORAGE_KEY);
  const letter = readStoredDossierPart(LETTER_STORAGE_KEY);
  const cv = readStoredDossierPart(CV_STORAGE_KEY);
  return createDossierProject({ cover, letter, cv });
}

export function serializeDossierProject(project: DossierProject): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

/** Parst nur gültige CV Cover Charm Projektdateien. */
export function parseDossierProjectText(text: string): DossierProject | null {
  try {
    return parseDossierProject(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export function dossierProjectFileName(project: DossierProject): string {
  const person = projectPersonName(project);
  const base = person ? `Bewerbungsdossier-${person}` : "Bewerbungsdossier";
  return `${safeFileName(base)}.json`;
}

/** Lädt den aktuellen Projektstand lokal als JSON herunter. */
export function downloadDossierProjectFromBrowser(): DossierProject {
  const project = dossierProjectFromBrowser();
  downloadBlob(
    new Blob([serializeDossierProject(project)], { type: "application/json;charset=utf-8" }),
    dossierProjectFileName(project),
  );
  return project;
}

export function dossierProjectPartLabels(project: DossierProject): string[] {
  const parts: string[] = [];
  if (project.cover) parts.push("Titelblatt");
  if (project.letter) parts.push("Motivationsschreiben");
  if (project.cv) parts.push("Lebenslauf");
  return parts;
}
