import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DOSSIER_PAGE_MARGIN_HARD_MAX_MM,
  DOSSIER_PAGE_MARGIN_MAX_MM,
  DOSSIER_PAGE_MARGIN_MIN_MM,
  applyDossierPageMarginsToDocument,
  clampDossierPageMarginsToMinimums,
  getDossierPageMargins,
  getDossierPageMarginsSnapshot,
  setDossierPageMargins,
  subscribeDossierPageMargins,
  type DossierPageMarginScope,
  type DossierPageMargins,
} from "@/lib/dossier-page-margins";

const SIDES: Array<{ key: keyof DossierPageMargins; label: string }> = [
  { key: "top", label: "Oben" },
  { key: "right", label: "Rechts" },
  { key: "bottom", label: "Unten" },
  { key: "left", label: "Links" },
];

const GLOBAL_MINIMUMS: DossierPageMargins = {
  top: DOSSIER_PAGE_MARGIN_MIN_MM,
  right: DOSSIER_PAGE_MARGIN_MIN_MM,
  bottom: DOSSIER_PAGE_MARGIN_MIN_MM,
  left: DOSSIER_PAGE_MARGIN_MIN_MM,
};

const asDraft = (margins: DossierPageMargins) => ({
  top: String(margins.top),
  right: String(margins.right),
  bottom: String(margins.bottom),
  left: String(margins.left),
});

const sameMargins = (a: DossierPageMargins, b: DossierPageMargins) =>
  SIDES.every(({ key }) => a[key] === b[key]);

export function DossierPageMarginsControl({
  scope,
  defaultMargins,
  minimumMargins,
  accentColor,
  onApplied,
}: {
  scope: DossierPageMarginScope;
  defaultMargins: DossierPageMargins;
  minimumMargins?: DossierPageMargins;
  accentColor?: string;
  onApplied?: () => void;
}) {
  useSyncExternalStore(
    subscribeDossierPageMargins,
    getDossierPageMarginsSnapshot,
    () => "{}",
  );
  const custom = getDossierPageMargins(scope);
  const minimums = useMemo(
    () =>
      clampDossierPageMarginsToMinimums(
        GLOBAL_MINIMUMS,
        minimumMargins ?? GLOBAL_MINIMUMS,
      ) ?? GLOBAL_MINIMUMS,
    [minimumMargins],
  );
  const defaults = useMemo(
    () => clampDossierPageMarginsToMinimums(defaultMargins, minimums) ?? defaultMargins,
    [defaultMargins, minimums],
  );
  const safeCustom = custom ? clampDossierPageMarginsToMinimums(custom, minimums) : null;
  const values = safeCustom ?? defaults;
  const [draft, setDraft] = useState(() => asDraft(values));

  useEffect(() => {
    applyDossierPageMarginsToDocument();
  }, []);

  useEffect(() => {
    setDraft(asDraft(values));
  }, [values.bottom, values.left, values.right, values.top]);

  useEffect(() => {
    if (!custom || !safeCustom || sameMargins(custom, safeCustom)) return;
    setDossierPageMargins(scope, safeCustom);
    onApplied?.();
  }, [custom, onApplied, safeCustom, scope]);

  const commit = (side: keyof DossierPageMargins) => {
    const raw = draft[side].trim();
    if (!raw) {
      setDraft(asDraft(values));
      return;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      setDraft(asDraft(values));
      return;
    }
    const next = clampDossierPageMarginsToMinimums(
      {
        ...(safeCustom ?? defaults),
        [side]: numeric,
      },
      minimums,
    );
    if (!next) {
      setDraft(asDraft(values));
      return;
    }
    setDraft(asDraft(next));
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
                  min={minimums[key]}
                  max={
                    minimums[key] > DOSSIER_PAGE_MARGIN_MAX_MM
                      ? DOSSIER_PAGE_MARGIN_HARD_MAX_MM
                      : DOSSIER_PAGE_MARGIN_MAX_MM
                  }
                  step={0.5}
                  value={draft[key]}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [key]: event.target.value }))
                  }
                  onBlur={() => commit(key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      setDraft(asDraft(values));
                      event.currentTarget.blur();
                    }
                  }}
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
          Mindestwerte schützen Header, Footer und tragende Vorlagenelemente.
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
