import { useRef, useState, type ChangeEvent } from "react";
import {
  dossierProjectPartLabels,
  downloadDossierProjectFromBrowser,
  parseDossierProjectText,
} from "@/lib/dossier-project-file";
import { replaceDossierProject } from "@/lib/dossier-project";

export function ProjectFileControls() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const saveProject = () => {
    const project = downloadDossierProjectFromBrowser();
    if (!project) {
      setStatus("Noch keine Dossierdaten zum Sichern vorhanden.");
      return;
    }
    setStatus("Projekt wurde als JSON-Datei gespeichert.");
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
