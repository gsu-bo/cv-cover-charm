import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import type { DossierChromeState } from "@/lib/dossier-chrome";
import {
  dossierContactFromCv,
  dossierContactFromLetter,
  resolveDossierContact,
} from "@/lib/dossier-contact";
import { resolveTemplateChromeOptions } from "@/lib/template-chrome";
import {
  resolveDossierChromeDocumentContent,
  withDossierChromeDocumentContent,
} from "@/lib/dossier-chrome-content";

/** Capture semantic chrome before asynchronous export work starts. */
export function resolveDossierChromeSnapshot(
  documents: {
    cover: CoverPdfDocument | null;
    letter: LetterPdfDocument | null;
    cv: CvPdfDocument | null;
  },
  state: DossierChromeState,
) {
  const shared = state.sync
    ? resolveDossierContact({
        cover: documents.cover?.data,
        letter: documents.letter?.data,
        cv: documents.cv?.data,
      })
    : null;
  const resolve = (scope: "letter" | "cv") => {
    const document = documents[scope];
    const defaultTitle =
      scope === "cv"
        ? documents.cv?.data.titel?.trim() || "Lebenslauf"
        : "Motivationsschreiben";
    const content = resolveDossierChromeDocumentContent(
      document?.design.chromeContent,
      defaultTitle,
    );
    const options = withDossierChromeDocumentContent(
      resolveTemplateChromeOptions(
        document?.design.template ?? "brief",
        document?.design.colors ?? {},
        { ...(state.sync ? state.shared : state[scope]) },
      ),
      content,
    );
    return {
      options,
      content,
      contact:
        shared ??
        (scope === "letter"
          ? dossierContactFromLetter(documents.letter?.data)
          : dossierContactFromCv(documents.cv?.data)),
    };
  };
  return { letter: resolve("letter"), cv: resolve("cv") };
}
export type ResolvedDossierChrome = ReturnType<typeof resolveDossierChromeSnapshot>;
