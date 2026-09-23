import {
  LETTER_BODY_FONT_SIZE_MAX,
  LETTER_BODY_FONT_SIZE_MIN,
} from "@/components/letter/types";

export function LetterFontSizeControl({
  label,
  value,
  fallbackSize,
  min = LETTER_BODY_FONT_SIZE_MIN,
  max = LETTER_BODY_FONT_SIZE_MAX,
  hint,
  onChange,
}: {
  label: string;
  value?: number;
  fallbackSize: number;
  min?: number;
  max?: number;
  hint?: string;
  onChange: (value: number | undefined) => void;
}) {
  const rawSize = value ?? fallbackSize;
  const effectiveMin = Math.min(min, rawSize);
  const effectiveMax = Math.max(max, rawSize);
  const size = Math.min(effectiveMax, Math.max(effectiveMin, rawSize));

  return (
    <div
      data-letter-context-font-size={label}
      className="grid gap-1.5 rounded-md border bg-background/75 px-2.5 py-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium">{label}</div>
          <div className="text-[10px] leading-snug text-muted-foreground">
            {hint ?? (value === undefined ? "Vorlagengrösse" : "Eigene Grösse")}
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums">
          {size.toFixed(size % 1 ? 1 : 0)} pt
        </span>
      </div>
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
      {value !== undefined ? (
        <button
          type="button"
          className="justify-self-start text-[10px] font-medium text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          onClick={() => onChange(undefined)}
        >
          Vorlagengrösse
        </button>
      ) : null}
    </div>
  );
}
