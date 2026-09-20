import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

type AttachmentListEditorProps = {
  values: string[];
  onChange: (values: string[]) => void;
};

export function AttachmentListEditor({ values, onChange }: AttachmentListEditorProps) {
  const changeEntry = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= values.length) return;

    const next = [...values];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  const removeEntry = (index: number) => {
    onChange(values.filter((_, entryIndex) => entryIndex !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {values.length ? (
        values.map((value, index) => (
          <div key={index} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-medium text-foreground">
              Beilage {index + 1}
              <input
                type="text"
                value={value}
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
