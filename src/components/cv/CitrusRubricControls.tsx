import {
  CITRUS_CONTENT_INDENT_MAX_MM,
  CITRUS_CONTENT_INDENT_MIN_MM,
  CITRUS_RUBRIC_DEFAULTS,
  CITRUS_RUBRIC_OFFSET_MAX_MM,
  CITRUS_RUBRIC_OFFSET_MIN_MM,
  resolveCitrusRubricOptions,
  type CitrusRubricPatch,
} from "./citrus-rubric";
import type { CvDesign } from "./types";

type Props = {
  design: CvDesign;
  onChange: (patch: CitrusRubricPatch) => void;
};

export function CitrusRubricControls({ design, onChange }: Props) {
  if (design.template !== "citrus") return null;

  const options = resolveCitrusRubricOptions(design);
  const horizontalLabel = `${options.horizontalMm > 0 ? "+" : ""}${options.horizontalMm} mm`;

  return (
    <div data-citrus-rubric-controls className="grid gap-3 rounded-md border bg-background/70 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold">Citrus-Rubriken</span>
        <button
          type="button"
          onClick={() =>
            onChange({
              citrusRubricPill: undefined,
              citrusRubricOffsetMm: undefined,
              citrusContentIndentMm: undefined,
            })
          }
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
              onClick={() => onChange({ citrusRubricPill: value })}
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
          min={CITRUS_RUBRIC_OFFSET_MIN_MM}
          max={CITRUS_RUBRIC_OFFSET_MAX_MM}
          step={1}
          value={options.horizontalMm}
          onChange={(event) => onChange({ citrusRubricOffsetMm: Number(event.target.value) })}
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
          min={CITRUS_CONTENT_INDENT_MIN_MM}
          max={CITRUS_CONTENT_INDENT_MAX_MM}
          step={1}
          value={options.contentIndentMm}
          onChange={(event) => onChange({ citrusContentIndentMm: Number(event.target.value) })}
          className="w-full accent-primary"
          aria-label="Inhaltseinzug unter Rubrik"
        />
      </label>

      <span className="text-[11px] leading-relaxed text-muted-foreground/80">
        Citrus-Standard: Pille, {CITRUS_RUBRIC_DEFAULTS.horizontalMm} mm Rubrikversatz und {" "}
        {CITRUS_RUBRIC_DEFAULTS.contentIndentMm} mm Inhaltseinzug.
      </span>
    </div>
  );
}
