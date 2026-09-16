import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_DOSSIER_HYPHENATION_STATE,
  getDossierHyphenationState,
  setDossierHyphenationEnabled,
  subscribeDossierHyphenation,
} from "@/lib/dossier-hyphenation";

function useDossierHyphenation() {
  return useSyncExternalStore(
    subscribeDossierHyphenation,
    getDossierHyphenationState,
    () => DEFAULT_DOSSIER_HYPHENATION_STATE,
  );
}

/** Keeps preview and PDF DOM on the same persisted typography preference. */
export function DossierHyphenationBridge() {
  const state = useDossierHyphenation();

  useEffect(() => {
    document.documentElement.dataset.dossierHyphenation = state.enabled ? "true" : "false";
  }, [state.enabled]);

  return null;
}

export function DossierHyphenationControl() {
  const state = useDossierHyphenation();

  return (
    <label
      data-dossier-hyphenation-control
      className="grid gap-1 rounded-md border bg-muted/20 p-2.5 text-xs"
    >
      <span className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(event) => setDossierHyphenationEnabled(event.target.checked)}
        />
        Automatische Silbentrennung
      </span>
      <span className="pl-6 text-[11px] font-normal leading-relaxed text-muted-foreground">
        Für Motivationsschreiben und längere CV-Texte. Das Titelblatt bleibt unverändert.
      </span>
    </label>
  );
}
