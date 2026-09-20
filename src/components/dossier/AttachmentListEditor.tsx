import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

type AttachmentListEditorProps = {
  values: string[];
  onChange: (values: string[]) => void;
};

type AttachmentListStyle = "none" | "bullet" | "dash" | "number";

const ATTACHMENT_LIST_STYLES: Array<{ value: AttachmentListStyle; label: string }> = [
  { value: "none", label: "Ohne" },
  { value: "bullet", label: "•" },
  { value: "dash", label: "–" },
  { value: "number", label: "1." },
];

function attachmentMarker(value: string): { style: AttachmentListStyle; text: string } {
  const bullet = value.match(/^•\s+(.*)$/s);
  if (bullet) return { style: "bullet", text: bullet[1] };

  const dash = value.match(/^–\s+(.*)$/s);
  if (dash) return { style: "dash", text: dash[1] };

  const number = value.match(/^\d+\.\s+(.*)$/s);
  if (number) return { style: "number", text: number[1] };

  return { style: "none", text: value };
}

function attachmentListStyle(values: string[]): AttachmentListStyle {
  const visible = values.filter((value) => value.trim());
  if (!visible.length) return "none";

  const styles = visible.map((value) => attachmentMarker(value).style);
  const first = styles[0];
  return first !== "none" && styles.every((style) => style === first) ? first : "none";
}

function formatAttachment(value: string, style: AttachmentListStyle, index: number): string {
  const text = attachmentMarker(value).text;
  if (!text.trim() || style === "none") return text;
  if (style === "bullet") return `• ${text}`;
  if (style === "dash") return `– ${text}`;
  return `${index + 1}. ${text}`;
}

function formatAttachments(values: string[], style: AttachmentListStyle): string[] {
  return values.map((value, index) => formatAttachment(value, style, index));
}

export function AttachmentListEditor({ values, onChange }: AttachmentListEditorProps) {
  const letterEditor =
    typeof window !== "undefined" && window.location.pathname.startsWith("/anschreiben");
  const listStyle = letterEditor ? attachmentListStyle(values) : "none";

  const changeEntry = (index: number, value: string) => {
    const next = [...values];
    next[index] = letterEditor ? formatAttachment(value, listStyle, index) : value;
    onChange(next);
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= values.length) return;

    const next = [...values];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(letterEditor ? formatAttachments(next, listStyle) : next);
  };

  const removeEntry = (index: number) => {
    const next = values.filter((_, entryIndex) => entryIndex !== index);
    onChange(letterEditor ? formatAttachments(next, listStyle) : next);
  };

  const setListStyle = (style: AttachmentListStyle) => {
    onChange(formatAttachments(values, style));
  };

  return (
    <div className="flex flex-col gap-3">
      {letterEditor ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-foreground">Aufzählung</legend>
          <div className="flex flex-wrap gap-1.5">
            {ATTACHMENT_LIST_STYLES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setListStyle(option.value)}
                aria-pressed={listStyle === option.value}
                className={`min-w-10 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                  listStyle === option.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-input bg-background text-foreground hover:bg-accent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {values.length ? (
        values.map((value, index) => (
          <div key={index} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-medium text-foreground">
              Beilage {index + 1}
              <input
                type="text"
                value={letterEditor && listStyle !== "none" ? attachmentMarker(value).text : value}
                onChange={(event) => changeEntry(index, event.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="flex shrink-0 gap-1" aria-label={`Beilage ${index + 1} sortieren`}>
              <button
                type="button"
                onClick={() => moveEntry(index, -1)}
                disabled={index === 0}
                className="inline-flex size-9 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={`Beilage ${index + 1} nach oben verschieben`}
                title="Nach oben"
              >
                <ChevronUp className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => moveEntry(index, 1)}
                disabled={index === values.length - 1}
                className="inline-flex size-9 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={`Beilage ${index + 1} nach unten verschieben`}
                title="Nach unten"
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeEntry(index)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={`Beilage ${index + 1} entfernen`}
              title={`Beilage ${index + 1} entfernen`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))
      ) : (
        <p className="text-xs text-muted-foreground">Keine Beilagen eingetragen.</p>
      )}

      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="inline-flex w-fit items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Plus className="size-4" aria-hidden="true" />
        Beilage hinzufügen
      </button>
    </div>
  );
}
