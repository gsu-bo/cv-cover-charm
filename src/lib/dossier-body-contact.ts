import type { CvData } from "@/components/cv/types";
import type { DossierChromeOptions } from "@/lib/dossier-chrome";

export function cvBodyData(data: CvData, options: DossierChromeOptions): CvData {
  if (options.headerMode !== "contact") return data;
  const person = data.person;
  const hasName = !!(person.vorname?.trim() || person.nachname?.trim());
  return {
    ...data,
    person: {
      ...person,
      ...(options.headerShowName && hasName ? { vorname: "\u200b", nachname: "" } : {}),
      ...(options.headerShowAddress ? { adresse: "", plzOrt: "" } : {}),
      ...(options.headerShowPhone ? { telefon: "" } : {}),
      ...(options.headerShowEmail ? { email: "" } : {}),
    },
  };
}
