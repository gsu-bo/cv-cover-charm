import { useEffect, useState } from "react";
import { readable } from "@/components/cv/palette";

type Props = {
  value: string;
  customValue?: string | null;
  paperColor: string;
  ariaLabel: string;
  description: string;
  onChange: (value: string) => void;
  onAuto: () => void;
};

function normalizeHex(value: string): string | null {
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : null;
}

export function DocumentTextColorControl({
  value,
  customValue,
  paperColor,
  ariaLabel,
  description,
  onChange,
  onAuto,
}: Props) {
  const [draft, setDraft] = useState(value.toUpperCase());
  const custom = customValue ? normalizeHex(customValue) : null;
  const lowContrast = !!custom && !readable(custom, paperColor);

  useEffect(() => setDraft(value.toUpperCase()), [value]);

  const commit = (next: string) => {
    setDraft(next);
    const normalized = normalizeHex(next);
    if (normalized) onChange(normalized);
  };

  return (
    <div data-document-text-color-control className="grid gap-2 rounded-md border border-input p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 items-center gap-2 text-xs font-medium">
          <input
            type="color"
            aria-label={ariaLabel}
            value={value}
            onChange={(event) => commit(event.target.value)}
            className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <span>Textfarbe</span>
        </label>
        <input
          type="text"
          inputMode="text"
          spellCheck={false}
          aria-label={`${ariaLabel} als Hex-Code`}
          value={draft}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setDraft(value.toUpperCase())}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs uppercase"
          placeholder="#1A1A1A"
        />
        <button
          type="button"
          disabled={!custom}
          onClick={onAuto}
          className="text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-default disabled:no-underline disabled:opacity-45"
        >
          Automatisch
        </button>
      </div>
      <span className="text-[11px] leading-snug text-muted-foreground">{description}</span>
      {lowContrast ? (
        <span role="status" className="text-[11px] font-medium leading-snug text-amber-700">
          Wenig Kontrast zum Seitenhintergrund – der Text könnte schwer lesbar sein.
        </span>
      ) : null}
    </div>
  );
}
