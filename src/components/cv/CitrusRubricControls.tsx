import { useSyncExternalStore } from "react";
import {
  CV_CONTENT_INDENT_MAX_MM,
  CV_CONTENT_INDENT_MIN_MM,
  CV_RUBRIC_DEFAULTS,
  CV_RUBRIC_OFFSET_MAX_MM,
  CV_RUBRIC_OFFSET_MIN_MM,
  resolveCvRubricOptions,
  type CvRubricPatch,
} from "./citrus-rubric";
import {
  CV_SECTION_GAP_CUSTOM_DEFAULT_MM,
  CV_SECTION_GAP_MAX_MM,
  CV_SECTION_GAP_MIN_MM,
  getCvSectionGapMm,
  setCvSectionGapMm,
  subscribeCvSectionGap,
} from "./layout";
import type { CvDesign } from "./types";

type Props = {
  design: CvDesign;
  onChange: (patch: CvRubricPatch) => void;
};

/**
 * Historic filename, shared behaviour: every CV template exposes the same
 * rubric-title controls. Keeping the filename avoids a noisy production-time
 * rename while removing the old Citrus-only product behaviour.
 */
export function CitrusRubricControls({ design, onChange }: Props) {
  const options = resolveCvRubricOptions(design);
  const horizontalLabel = `${options.horizontalMm > 0 ? "+" : ""}${options.horizontalMm} mm`;
  const sectionGapMm = useSyncExternalStore(subscribeCvSectionGap, getCvSectionGapMm, () => null);
  const customSectionGap = sectionGapMm !== null;

  return (
    <div
      data-cv-rubric-controls
      data-citrus-rubric-controls
      className="grid gap-3 rounded-md border bg-background/70 p-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold">Rubriktitel</span>
        <button
          type="button"
          onClick={() => {
            onChange({
              sectionTitlePill: undefined,
              sectionTitleOffsetMm: undefined,
              sectionContentIndentMm: undefined,
              citrusRubricPill: undefined,
              citrusRubricOffsetMm: undefined,
              citrusContentIndentMm: undefined,
            });
            setCvSectionGapMm(null);
          }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Standard
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Rubrik als Pille</span>
        <div className="flex gap-1">
          {(
            [
              [true, "Ja"],
              [false, "Nein"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={options.pill === value}
              onClick={() => onChange({ sectionTitlePill: value })}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                options.pill === value
                  ? "border-foreground bg-accent"
                  : "border-input hover:border-foreground/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>Rubrik horizontal</span>
          <span>{horizontalLabel}</span>
        </span>
        <input
          type="range"
          min={CV_RUBRIC_OFFSET_MIN_MM}
          max={CV_RUBRIC_OFFSET_MAX_MM}
          step={1}
          value={options.horizontalMm}
          onChange={(event) => onChange({ sectionTitleOffsetMm: Number(event.target.value) })}
          className="w-full accent-primary"
          aria-label="Rubrik horizontal"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>Inhaltseinzug unter Rubrik</span>
          <span>{options.contentIndentMm} mm</span>
        </span>
        <input
          type="range"
          min={CV_CONTENT_INDENT_MIN_MM}
          max={CV_CONTENT_INDENT_MAX_MM}
          step={1}
          value={options.contentIndentMm}
          onChange={(event) => onChange({ sectionContentIndentMm: Number(event.target.value) })}
          className="w-full accent-primary"
          aria-label="Inhaltseinzug unter Rubrik"
        />
      </label>

      <div data-cv-section-gap-control className="grid gap-2 rounded-md border border-input/70 p-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium">Abstand zwischen Rubriken</div>
            <div className="text-[11px] text-muted-foreground">
              Zusätzliche Luft vor der nächsten Rubrik; halbe Rubriken bleiben nebeneinander.
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={customSectionGap}
              onChange={(event) =>
                setCvSectionGapMm(
                  event.target.checked ? CV_SECTION_GAP_CUSTOM_DEFAULT_MM : null,
                )
              }
            />
            selber
          </label>
        </div>
        {customSectionGap ? (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">
              Abstand {sectionGapMm?.toFixed(1).replace(".0", "")} mm
            </span>
            <input
              type="range"
              min={CV_SECTION_GAP_MIN_MM}
              max={CV_SECTION_GAP_MAX_MM}
              step={0.5}
              value={sectionGapMm ?? CV_SECTION_GAP_CUSTOM_DEFAULT_MM}
              onChange={(event) => setCvSectionGapMm(Number(event.target.value))}
              className="w-full accent-primary"
              aria-label="Abstand zwischen Rubriken"
            />
          </label>
        ) : null}
      </div>

      <span className="text-[11px] leading-relaxed text-muted-foreground/80">
        Standard für alle CV-Vorlagen: keine Pille, {CV_RUBRIC_DEFAULTS.horizontalMm} mm
        Rubrikversatz und {CV_RUBRIC_DEFAULTS.contentIndentMm} mm Inhaltseinzug. Der bestehende
        Abstand unter dem Rubriktitel steuert Titel → Inhalt; dieser Regler steuert Rubrik → Rubrik.
      </span>
    </div>
  );
}
