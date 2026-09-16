import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { TEXT_ALIGNMENTS, type TextAlignment } from "@/lib/text-alignment";

const LABELS: Record<TextAlignment, string> = {
  left: "Linksbündig",
  center: "Zentriert",
  right: "Rechtsbündig",
  justify: "Blocksatz",
};

const ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
} satisfies Record<TextAlignment, typeof AlignLeft>;

type TextAlignmentControlProps<T extends TextAlignment> = {
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel?: string;
  alignments?: readonly T[];
};

export function TextAlignmentControl<T extends TextAlignment = TextAlignment>({
  value,
  onChange,
  ariaLabel = "Textausrichtung",
  alignments,
}: TextAlignmentControlProps<T>) {
  const options = alignments ?? (TEXT_ALIGNMENTS as readonly T[]);

  return (
    <div
      data-text-alignment-control
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-input bg-background"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((alignment, index) => {
        const Icon = ICONS[alignment];
        const active = value === alignment;
        return (
          <button
            key={alignment}
            type="button"
            data-alignment={alignment}
            aria-label={LABELS[alignment]}
            aria-pressed={active}
            title={LABELS[alignment]}
            className={`inline-flex h-8 min-w-8 items-center justify-center px-2 transition-colors focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring ${
              index < options.length - 1 ? "border-r border-input" : ""
            } ${
              active
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(alignment)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
