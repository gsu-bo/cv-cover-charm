import type { CvDesign, CvPerson } from "@/components/cv/types";

export type CvPersonalInfoRow = {
  key: "geburtsdatum" | "geburtsort" | "heimatort" | "nationalitaet";
  label: string;
  value: string;
};

/** Eine gemeinsame Quelle für Reihenfolge und Beschriftung in Vorschau und Export. */
export function cvPersonalInfoRows(person: CvPerson): CvPersonalInfoRow[] {
  const rows: CvPersonalInfoRow[] = [
    { key: "geburtsdatum", label: "Geburtsdatum", value: person.geburtsdatum },
    { key: "geburtsort", label: "Geburtsort", value: person.geburtsort ?? "" },
    { key: "heimatort", label: "Heimatort", value: person.heimatort ?? "" },
    { key: "nationalitaet", label: "Nationalität", value: person.nationalitaet },
  ];
  return rows.filter((row) => row.value.trim());
}

export function cvPersonalInfoLines(person: CvPerson, design: CvDesign): string[] {
  const separator = design.personalInfoColons === false ? " " : ": ";
  return cvPersonalInfoRows(person).map((row) => `${row.label}${separator}${row.value}`);
}
