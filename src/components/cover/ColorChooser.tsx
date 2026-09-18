import { useEffect, useMemo, useState } from "react";
import type { ColorSlot } from "./types";
import { isActive, palettesFor } from "./palettes";
import { cvPalette } from "@/components/cv/palette";
import { DocumentTextColorControl } from "@/components/dossier/DocumentTextColorControl";

type Props = {
  slots: ColorSlot[];
  colors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApplyPalette: (colors: Record<string, string>) => void;
  onReset: () => void;
};

export function ColorChooser({ slots, colors, onChange, onApplyPalette, onReset }: Props) {
  const palettes = useMemo(() => palettesFor(slots), [slots]);
  const previewSlots = useMemo(() => {
    const background = slots.find((slot) => slot.key === "bg");
    const rest = slots.filter((slot) => slot.key !== "bg");
    return background ? [background, ...rest] : slots;
  }, [slots]);
  const cvText = useMemo(() => cvPalette(colors), [colors]);
  const [showCvText, setShowCvText] = useState(false);
  const [showCoverDocumentColors, setShowCoverDocumentColors] = useState(false);

  // ColorChooser is shared by title page, CV and motivation letter. Route-aware
  // semantic controls keep the generic template palette compact while exposing
  // document-level overrides where they belong.
  useEffect(() => {
    const path = window.location.pathname;
    setShowCvText(path.startsWith("/lebenslauf"));
    setShowCoverDocumentColors(path.startsWith("/titelblatt"));
  }, []);

  const cvSlots = [
    { key: "cvMuted", label: "Sekundärtext", value: colors.cvMuted || cvText.muted },
    { key: "cvHeading", label: "Überschriften", value: colors.cvHeading || cvText.accent },
  ] as const;

  const semanticOverrides = useMemo(() => {
    const keys = ["coverPaper", "coverInk", "cvInk", "cvMuted", "cvHeading"] as const;
    return Object.fromEntries(
      keys.filter((key) => colors[key]).map((key) => [key, colors[key]]),
    ) as Record<string, string>;
  }, [colors]);

  const coverPaper = colors.coverPaper || colors.bg || "#ffffff";
  const coverText = colors.coverInk || colors.ink || colors.primary || colors.accent || "#111111";

  return (
    <div className="flex flex-col gap-4">
      {showCoverDocumentColors ? (
        <div className="grid gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Dokumentfarben
          </span>

          <div
            data-cover-paper-color-control
            className="grid gap-2 rounded-md border border-input p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <label className="flex min-w-0 items-center gap-2 text-xs font-medium">
                <input
                  type="color"
                  aria-label="Seitenhintergrund des Titelblatts"
                  value={coverPaper}
                  onChange={(event) => onChange("coverPaper", event.target.value)}
                  className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span>Seitenhintergrund</span>
              </label>
              <button
                type="button"
                disabled={!colors.coverPaper}
                onClick={() => onChange("coverPaper", "")}
                className="text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-default disabled:no-underline disabled:opacity-45"
              >
                Automatisch
              </button>
            </div>
            <span className="text-[11px] leading-snug text-muted-foreground">
              Gilt bei jeder Vorlage für den Hintergrund des Titelblatts.
            </span>
          </div>

          <DocumentTextColorControl
            ariaLabel="Textfarbe des Titelblatts"
            value={coverText}
            customValue={colors.coverInk}
            paperColor={coverPaper}
            description="Gilt bei jeder Vorlage für die Standardtexte des Titelblatts. Formen, Akzente und bewusst einzeln gefärbte eigene Elemente bleiben unabhängig."
            onChange={(value) => onChange("coverInk", value)}
            onAuto={() => onChange("coverInk", "")}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Farbsets
        </span>
        <div className="grid grid-cols-4 gap-2">
          {palettes.map((p) => {
            const active = isActive(colors, p);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onApplyPalette({ ...p.colors, ...semanticOverrides })}
                aria-label={`Farbset ${p.name}`}
                title={p.name}
                aria-pressed={active}
                className={`group relative h-12 overflow-hidden rounded-lg border p-1.5 transition-all ${
                  active
                    ? "border-foreground ring-2 ring-foreground/80 ring-offset-2 ring-offset-background"
                    : "border-input hover:border-foreground/50 hover:scale-[1.02]"
                }`}
              >
                <span className="flex h-full w-full overflow-hidden rounded-md" aria-hidden>
                  {previewSlots.map((s) => (
                    <span
                      key={s.key}
                      className="h-full min-w-0"
                      style={{
                        backgroundColor: p.colors[s.key],
                        // The page/background is the most important distinction
                        // between the bottom four presets, so show it larger.
                        flex: s.key === "bg" ? 1.75 : 1,
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-[10px] leading-snug text-muted-foreground">
          Oben 4× gleicher Vorlagen-Hintergrund. Unten 4× deutlich andere, abgestimmte Hintergründe.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Einzelne Farben
          </span>
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Zurücksetzen
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <label
              key={s.key}
              className="flex items-center gap-2 rounded-md border border-input p-2"
            >
              <input
                type="color"
                value={colors[s.key] ?? s.default}
                onChange={(e) => onChange(s.key, e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <span className="truncate text-xs">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {showCvText && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Weitere CV-Textfarben
            </span>
            <button
              type="button"
              onClick={() => {
                onChange("cvMuted", "");
                onChange("cvHeading", "");
              }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Automatisch
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cvSlots.map((slot) => (
              <label
                key={slot.key}
                className="flex items-center gap-2 rounded-md border border-input p-2"
              >
                <input
                  type="color"
                  value={slot.value}
                  onChange={(e) => onChange(slot.key, e.target.value)}
                  className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="truncate text-xs">{slot.label}</span>
              </label>
            ))}
          </div>
          <span className="text-[11px] leading-snug text-muted-foreground">
            Gilt für helle CV-Flächen. Auf dunklen Farbbändern und Sidebars bleibt die Schriftfarbe
            automatisch kontrastreich.
          </span>
        </div>
      )}
    </div>
  );
}
