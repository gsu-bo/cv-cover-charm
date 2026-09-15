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
        window.alert(
          "Diese Datei kann hier nicht als Projekt geöffnet werden. Wähle eine Projektdatei, die zuvor mit «Projekt speichern» erstellt wurde.",
        );
        return;
      }

      const parts = dossierProjectPartLabels(project);
      const confirmed = window.confirm(
        `Gespeichertes Projekt öffnen?\n\nIn der Datei gefunden: ${parts.join(", ")}.\n\nBeim Laden werden die gespeicherten Dossierdaten aus dieser Datei in diesem Browser geöffnet. Dein aktueller Stand in diesem Browser wird dadurch ersetzt.\n\nDie Datei wird nur auf diesem Gerät gelesen und nicht ins Internet hochgeladen.`,
      );
      if (!confirmed) return;

      replaceDossierProject(project);
      window.location.reload();
    } catch {
      window.alert(
        "Die Projektdatei konnte nicht gelesen werden. Wähle eine Datei, die zuvor mit «Projekt speichern» erstellt wurde.",
      );
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
        title="Einen früher gespeicherten Projektstand öffnen und weiterbearbeiten. Die Datei wird nicht hochgeladen."
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
