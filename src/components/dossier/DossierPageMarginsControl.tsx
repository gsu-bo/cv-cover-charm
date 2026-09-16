import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  DOSSIER_PAGE_MARGIN_MAX_MM,
  DOSSIER_PAGE_MARGIN_MIN_MM,
  applyDossierPageMarginsToDocument,
  getDossierPageMargins,
  getDossierPageMarginsSnapshot,
  normalizeDossierPageMargins,
  setDossierPageMargins,
  subscribeDossierPageMargins,
  type DossierPageMarginScope,
  type DossierPageMargins,
} from "@/lib/dossier-page-margins";
import "./page-margins.css";

const SIDES: Array<{ key: keyof DossierPageMargins; label: string }> = [
  { key: "top", label: "Oben" },
  { key: "right", label: "Rechts" },
  { key: "bottom", label: "Unten" },
  { key: "left", label: "Links" },
];

export function DossierPageMarginsControl({
  scope,
  defaultMargins,
  accentColor,
  onApplied,
}: {
  scope: DossierPageMarginScope;
  defaultMargins: DossierPageMargins;
  accentColor?: string;
  onApplied?: () => void;
}) {
  useSyncExternalStore(
    subscribeDossierPageMargins,
    getDossierPageMarginsSnapshot,
    () => "{}",
  );
  const custom = getDossierPageMargins(scope);
  const defaults = useMemo(
    () => normalizeDossierPageMargins(defaultMargins) ?? defaultMargins,
    [defaultMargins],
  );
  const values = custom ?? defaults;

  useEffect(() => {
    applyDossierPageMarginsToDocument();
  }, []);

  const change = (side: keyof DossierPageMargins, raw: string) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return;
    const next = normalizeDossierPageMargins({
      ...(custom ?? defaults),
      [side]: numeric,
    });
    if (!next) return;
    setDossierPageMargins(scope, next);
    onApplied?.();
  };

  const reset = () => {
    setDossierPageMargins(scope, null);
    onApplied?.();
  };

  return (
    <details
      data-dossier-page-margins-control={scope}
      className="group rounded-md border bg-muted/10"
      style={{ borderLeftColor: accentColor || undefined, borderLeftWidth: accentColor ? 3 : undefined }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs select-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Seitenränder</span>
          <span className="block text-[11px] leading-relaxed text-muted-foreground">
            Oben · unten · links · rechts
          </span>
        </span>
        <span className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {custom ? "Eigene Werte" : "Vorlage"}
        </span>
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="grid gap-3 border-t px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          {SIDES.map(({ key, label }) => (
            <label key={key} className="grid gap-1 text-[11px] font-medium">
              <span>{label}</span>
              <span className="relative">
                <input
                  type="number"
                  min={DOSSIER_PAGE_MARGIN_MIN_MM}
                  max={DOSSIER_PAGE_MARGIN_MAX_MM}
                  step={0.5}
                  value={values[key]}
                  onChange={(event) => change(key, event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`Seitenrand ${label} in Millimetern`}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  mm
                </span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ohne eigene Werte bleibt die bewährte Geometrie der gewählten Vorlage unverändert.
        </p>

        {custom ? (
          <button
            type="button"
            onClick={reset}
            className="justify-self-start rounded-md border bg-background px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted"
          >
            Vorlage wiederherstellen
          </button>
        ) : null}
      </div>
    </details>
  );
}
