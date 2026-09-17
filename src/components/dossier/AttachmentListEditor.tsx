import { Plus, Trash2 } from "lucide-react";

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
