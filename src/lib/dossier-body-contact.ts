import type { CvData } from "@/components/cv/types";
import type { DossierChromeOptions } from "@/lib/dossier-chrome";

export function cvBodyData(data: CvData, options: DossierChromeOptions): CvData {
  if (options.headerMode !== "contact") return data;
  const person = data.person;
  return {
    ...data,
    person: {
      ...person,
      ...(options.headerShowAddress ? { adresse: "", plzOrt: "" } : {}),
      ...(options.headerShowPhone ? { telefon: "" } : {}),
      ...(options.headerShowEmail ? { email: "" } : {}),
    },
  };
}
