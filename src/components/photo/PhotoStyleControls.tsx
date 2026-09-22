import { DOSSIER_PHOTO_SHAPES, type DossierPhotoStyle } from "@/lib/dossier-photo";

const btn = "rounded-md border px-2 py-1 text-xs transition-colors border-input hover:bg-accent";
const btnOn =
  "rounded-md border px-2 py-1 text-xs border-primary bg-primary text-primary-foreground";
const nudgeBtn =
  "shrink-0 rounded-md border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent";

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </label>
  );
}

type Props = {
  value: DossierPhotoStyle;
  onChange: (patch: Partial<DossierPhotoStyle>) => void;
  hasPhoto: boolean;
  compact?: boolean;
  cropOnly?: boolean;
};

/** One control surface used by title page and CV. */
export function PhotoStyleControls({ value, onChange, hasPhoto, compact, cropOnly }: Props) {
  return (
    <div className={`flex flex-col gap-3 ${compact ? "" : "min-w-56"}`}>
      {!cropOnly && (
        <Row label="Form">
          <div className="flex flex-wrap gap-1">
            {DOSSIER_PHOTO_SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                className={value.shape === shape.id ? btnOn : btn}
                onClick={() => onChange({ shape: shape.id })}
                aria-pressed={value.shape === shape.id}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </Row>
      )}

      {!cropOnly && (
        // Stärke 0 heisst "kein Rahmen". Das stand vorher nur im Regler und war
        // schwer zu treffen, darum zwei klare Knöpfe davor.
        <Row
          label={
            value.borderWidth > 0
              ? `Rahmen ${Math.round(value.borderWidth * 10) / 10} mm`
              : "Rahmen"
          }
        >
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className={value.borderWidth > 0 ? btn : btnOn}
              aria-pressed={value.borderWidth === 0}
              onClick={() => onChange({ borderWidth: 0 })}
            >
              Ohne
            </button>
            <button
              type="button"
              className={value.borderWidth > 0 ? btnOn : btn}
              aria-pressed={value.borderWidth > 0}
              onClick={() => value.borderWidth === 0 && onChange({ borderWidth: 0.3 })}
            >
              Mit
            </button>
          </div>
          {value.borderWidth > 0 && (
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.1}
              value={value.borderWidth}
              onChange={(e) => onChange({ borderWidth: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          )}
        </Row>
      )}

      {hasPhoto ? (
        <>
          <Row label={`Foto zuschneiden ${Math.round(value.zoom * 100)} %`}>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={value.zoom}
              onChange={(e) => onChange({ zoom: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            {(value.zoom > 1 || value.x !== 50 || value.y !== 50) && (
              <button
                type="button"
                className={btn}
                onClick={() => onChange({ zoom: 1, x: 50, y: 50 })}
              >
                Reset
              </button>
            )}
          </Row>

          {value.zoom > 1 && (
            <div className="grid gap-3">
              <Row label={`Ausschnitt links / rechts · ${Math.round(value.x)} %`}>
                <button
                  type="button"
                  className={nudgeBtn}
                  aria-label="Ausschnitt nach links"
                  title="Ausschnitt nach links"
                  onClick={() => onChange({ x: clampPercent(value.x - 5) })}
                >
                  ← Links
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={value.x}
                  onChange={(e) => onChange({ x: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-primary"
                  aria-label="Ausschnitt horizontal verschieben"
                />
                <button
                  type="button"
                  className={nudgeBtn}
                  aria-label="Ausschnitt nach rechts"
                  title="Ausschnitt nach rechts"
                  onClick={() => onChange({ x: clampPercent(value.x + 5) })}
                >
                  Rechts →
                </button>
              </Row>
              <Row label={`Ausschnitt oben / unten · ${Math.round(value.y)} %`}>
                <button
                  type="button"
                  className={nudgeBtn}
                  aria-label="Ausschnitt nach oben"
                  title="Ausschnitt nach oben"
                  onClick={() => onChange({ y: clampPercent(value.y - 5) })}
                >
                  ↑ Oben
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={value.y}
                  onChange={(e) => onChange({ y: Number(e.target.value) })}
                  className="min-w-0 flex-1 accent-primary"
                  aria-label="Ausschnitt vertikal verschieben"
                />
                <button
                  type="button"
                  className={nudgeBtn}
                  aria-label="Ausschnitt nach unten"
                  title="Ausschnitt nach unten"
                  onClick={() => onChange({ y: clampPercent(value.y + 5) })}
                >
                  Unten ↓
                </button>
              </Row>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Zuschneiden ist möglich, sobald ein Bild gewählt ist.
        </p>
      )}
    </div>
  );
}
