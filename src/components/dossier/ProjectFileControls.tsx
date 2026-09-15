import { useRef, useState, type ChangeEvent } from "react";
import {
  dossierProjectPartLabels,
  parseDossierProjectText,
} from "@/lib/dossier-project-file";
import { replaceDossierProject } from "@/lib/dossier-project";

export function ProjectLoadButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const loadProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLoading(true);
    try {
      const project = parseDossierProjectText(await file.text());
      if (!project) {
        window.alert("Diese Datei ist kein gültiges CV Cover Charm Projekt.");
        return;
      }

      const parts = dossierProjectPartLabels(project);
      const confirmed = window.confirm(
        `Projekt laden?\n\nGefunden: ${parts.join(", ")}.\n\nDer aktuelle Browserstand wird durch diese Projektdatei ersetzt.`,
      );
      if (!confirmed) return;

      replaceDossierProject(project);
      window.location.reload();
    } catch {
      window.alert("Die Projektdatei konnte nicht gelesen werden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        <span className="sm:hidden">{loading ? "Lädt…" : "Laden"}</span>
        <span className="hidden sm:inline">{loading ? "Projekt wird geladen…" : "Projekt laden"}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={loadProject}
      />
    </>
  );
}
