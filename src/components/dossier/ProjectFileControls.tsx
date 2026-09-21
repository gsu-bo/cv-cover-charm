import { useRef, useState, type ChangeEvent } from "react";
import {
  dossierProjectPartLabels,
  parseDossierProjectText,
} from "@/lib/dossier-project-file";
import { replaceDossierProject } from "@/lib/dossier-project";

function JsonFileIcon() {
  return (
    <svg
      viewBox="0 0 40 48"
      className="h-7 w-6 shrink-0 text-primary"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 3.5h18l8 8V43a1.5 1.5 0 0 1-1.5 1.5h-24A1.5 1.5 0 0 1 6 43V5A1.5 1.5 0 0 1 7.5 3.5Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M25 3.8V12h8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="24" width="32" height="14" rx="4" fill="currentColor" />
      <text
        x="20"
        y="33.3"
        textAnchor="middle"
        fill="var(--color-primary-foreground)"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="0.3"
      >
        JSON
      </text>
    </svg>
  );
}

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
          "Diese Datei kann hier nicht als Dossier geöffnet werden. Wähle eine JSON-Datei, die zuvor mit «Dossier speichern» erstellt wurde.",
        );
        return;
      }

      const parts = dossierProjectPartLabels(project);
      const confirmed = window.confirm(
        `Gespeichertes Dossier öffnen?\n\nIn der Datei gefunden: ${parts.join(", ")}.\n\nBeim Laden werden die gespeicherten Dossierdaten aus dieser Datei in diesem Browser geöffnet. Dein aktueller Stand in diesem Browser wird dadurch ersetzt.\n\nDie Datei wird nur auf diesem Gerät gelesen und nicht ins Internet hochgeladen.`,
      );
      if (!confirmed) return;

      replaceDossierProject(project);
      window.location.reload();
    } catch {
      window.alert(
        "Die Dossierdatei konnte nicht gelesen werden. Wähle eine JSON-Datei, die zuvor mit «Dossier speichern» erstellt wurde.",
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
        title="Ein früher gespeichertes Dossier aus einer JSON-Datei öffnen und weiterbearbeiten. Die Datei wird nicht hochgeladen."
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        <JsonFileIcon />
        <span>{loading ? "Dossier wird geladen…" : "Dossier laden"}</span>
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
