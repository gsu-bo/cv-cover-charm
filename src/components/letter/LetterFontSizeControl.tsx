import { FONT_LABELS, type FontKey } from "@/components/cover/types";
import {
  LETTER_BODY_FONT_SIZE_MAX,
  LETTER_BODY_FONT_SIZE_MIN,
} from "@/components/letter/types";

export function LetterFontSizeControl({
  label,
  value,
  font,
  fallbackSize,
  min = LETTER_BODY_FONT_SIZE_MIN,
  max = LETTER_BODY_FONT_SIZE_MAX,
  hint,
  onChange,
  onFontChange,
}: {
  label: string;
  value?: number;
  font?: FontKey;
  fallbackSize: number;
  min?: number;
  max?: number;
  hint?: string;
  onChange: (value: number | undefined) => void;
  onFontChange: (value: FontKey | undefined) => void;
}) {
  const rawSize = value ?? fallbackSize;
  const effectiveMin = Math.min(min, rawSize);
  const effectiveMax = Math.max(max, rawSize);
  const size = Math.min(effectiveMax, Math.max(effectiveMin, rawSize));

  return (
    <div
      data-letter-context-font-size={label}
      className="grid gap-2 rounded-md border bg-background/75 px-2.5 py-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium">{label}</div>
          <div className="text-[10px] leading-snug text-muted-foreground">
            {hint ?? (font === undefined && value === undefined ? "Wie Vorlage" : "Eigene Typografie")}
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums">
          {size.toFixed(size % 1 ? 1 : 0)} pt
        </span>
      </div>

      <label className="grid gap-1 text-[10px] text-muted-foreground">
        <span>Schriftart</span>
        <select
          data-letter-context-font-family={label}
          value={font ?? "template"}
          onChange={(event) =>
            onFontChange(
              event.target.value === "template" ? undefined : (event.target.value as FontKey),
            )
          }
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          aria-label={`${label} Schriftart`}
        >
          <option value="template">Wie Vorlage</option>
          {(Object.entries(FONT_LABELS) as Array<[FontKey, string]>).map(([key, fontLabel]) => (
            <option key={key} value={key}>
              {fontLabel}
            </option>
          ))}
        </select>
      </label>

      <input
        type="range"
        min={effectiveMin}
        max={effectiveMax}
        step={0.5}
        value={size}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label={`${label} Schriftgrösse`}
      />
      {font !== undefined || value !== undefined ? (
        <button
          type="button"
          className="justify-self-start text-[10px] font-medium text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          onClick={() => {
            onFontChange(undefined);
            onChange(undefined);
          }}
        >
          Wie Vorlage
        </button>
      ) : null}
    </div>
  );
}
