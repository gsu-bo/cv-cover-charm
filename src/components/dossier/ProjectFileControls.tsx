import { useRef, useState, type ChangeEvent } from "react";
import {
  dossierProjectPartLabels,
  downloadDossierProjectFromBrowser,
  parseDossierProjectText,
} from "@/lib/dossier-project-file";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  LETTER_STORAGE_KEY,
  readStoredDossierPart,
  replaceDossierProject,
} from "@/lib/dossier-project";
import {
  coverPdfDocumentFromSaved,
  coverPdfHasContent,
  cvPdfDocumentFromSaved,
  cvPdfHasContent,
  letterPdfDocumentFromSaved,
  letterPdfHasContent,
} from "@/lib/dossier-pdf-document";
import { briefDossierDocxSupported, downloadBriefDossierDocx } from "@/lib/dossier-docx";
import {
  downloadPolishedWarmDossierDocx,
  warmDossierDocxSupported,
} from "@/lib/dossier-docx-warm-polish";

function readDocxDocuments() {
  return {
    cover: coverPdfDocumentFromSaved(readStoredDossierPart(COVER_STORAGE_KEY)),
    letter: letterPdfDocumentFromSaved(readStoredDossierPart(LETTER_STORAGE_KEY)),
    cv: cvPdfDocumentFromSaved(readStoredDossierPart(CV_STORAGE_KEY)),
  };
}

export function ProjectFileControls() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const docxDocuments = readDocxDocuments();
  const briefDocxSupported = briefDossierDocxSupported(
    docxDocuments.cover,
    docxDocuments.letter,
    docxDocuments.cv,
  );
  const warmDocxSupported = warmDossierDocxSupported(
    docxDocuments.cover,
    docxDocuments.letter,
    docxDocuments.cv,
  );
  const docxTemplateLabel = warmDocxSupported ? "Warm" : briefDocxSupported ? "Brief" : null;
  const docxSupported = docxTemplateLabel !== null;
  const docxReady = !!(
    docxDocuments.cover &&
    coverPdfHasContent(docxDocuments.cover.data) &&
    docxDocuments.letter &&
    letterPdfHasContent(docxDocuments.letter.data) &&
    docxDocuments.cv &&
    cvPdfHasContent(docxDocuments.cv.data)
  );

  const saveProject = () => {
    const project = downloadDossierProjectFromBrowser();
    if (!project) {
      setStatus("Noch keine Dossierdaten zum Sichern vorhanden.");
      return;
    }
    setStatus("Projekt wurde als JSON-Datei gespeichert.");
  };

  const downloadDocx = async () => {
    const { cover, letter, cv } = readDocxDocuments();
    if (
      !cover ||
      !letter ||
      !cv ||
      !coverPdfHasContent(cover.data) ||
      !letterPdfHasContent(letter.data) ||
      !cvPdfHasContent(cv.data)
    ) {
      setStatus(
        "Für DOCX müssen Titelblatt, Motivationsschreiben und Lebenslauf ausgefüllt sein.",
      );
      return;
    }

    const brief = briefDossierDocxSupported(cover, letter, cv);
    const warm = warmDossierDocxSupported(cover, letter, cv);
    if (!brief && !warm) {
      setStatus("Der DOCX-Referenzexport ist momentan für die Vorlagen Brief und Warm verfügbar.");
      return;
    }

    const author =
      [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ") ||
      [cv.data.person.vorname, cv.data.person.nachname].filter(Boolean).join(" ") ||
      "Bewerbungsdossier";
    const fileName =
      author === "Bewerbungsdossier"
        ? "Bewerbungsdossier.docx"
        : `Bewerbungsdossier-${author}.docx`;

    if (warm) await downloadPolishedWarmDossierDocx(cover, letter, cv, fileName);
    else downloadBriefDossierDocx(cover, letter, cv, fileName);
    setStatus("DOCX-Referenz wurde erstellt. Prüfe die Datei am besten in Microsoft Word.");
  };

  const loadProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLoading(true);
    try {
      const project = parseDossierProjectText(await file.text());
      if (!project) {
        setStatus("Diese Datei ist kein gültiges CV Cover Charm Projekt.");
        return;
      }

      const parts = dossierProjectPartLabels(project);
      const confirmed = window.confirm(
        `Projekt laden?\n\nGefunden: ${parts.join(", ")}.\n\nDer aktuelle Browserstand wird durch diese Projektdatei ersetzt.`,
      );
      if (!confirmed) {
        setStatus("Projekt laden abgebrochen.");
        return;
      }

      replaceDossierProject(project);
      window.location.reload();
    } catch {
      setStatus("Die Projektdatei konnte nicht gelesen werden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-40 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:right-6 sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Projekt sichern</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Lokal als Datei speichern oder später wieder laden. Es wird nichts hochgeladen.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={saveProject}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Projekt sichern
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {loading ? "Wird geladen…" : "Projekt laden"}
        </button>
      </div>

      <button
        type="button"
        onClick={downloadDocx}
        disabled={!docxSupported || !docxReady}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
        title={
          docxSupported
            ? `Bearbeitbare Word-Referenz der Vorlage ${docxTemplateLabel} herunterladen`
            : "DOCX ist im Referenzschritt für die Vorlagen Brief und Warm verfügbar"
        }
      >
        Dossier als DOCX{docxTemplateLabel ? ` · ${docxTemplateLabel}` : ""}
      </button>
      {!docxSupported ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          DOCX-Referenz: derzeit für Brief oder Warm, jeweils im ganzen Dossier.
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={loadProject}
      />

      {status ? (
        <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
          {status}
        </p>
      ) : null}
    </aside>
  );
}
