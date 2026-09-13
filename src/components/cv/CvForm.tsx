import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { readPhoto } from "@/lib/image";
import { readCoverPhoto } from "@/lib/dossier";
import {
  DEFAULT_DOSSIER_PHOTO_STYLE,
  dossierPhotoCropStyle,
  dossierPhotoRadius,
  dossierPhotoRatio,
  type DossierPhotoStyle,
} from "@/lib/dossier-photo";
import { PhotoStyleControls } from "@/components/photo/PhotoStyleControls";
import {
  CV_SECTION_GAP_CUSTOM_DEFAULT_MM,
  CV_SECTION_GAP_MAX_MM,
  CV_SECTION_GAP_MIN_MM,
  getCvLayout,
  getCvSectionGapMm,
  setCvSectionGapMm,
  subscribeCvLayout,
  subscribeCvSectionGap,
} from "./layout";
import { getCvPlacements, setCvPlacement, subscribeCvPlacements } from "./placement";
import { getCvPhotoStyle, setCvPhotoStyle, subscribeCvPhotoStyle } from "./photo";
import {
  CV_PHOTO_MAX_MM,
  CV_PHOTO_MIN_MM,
  DEFAULT_CV_PHOTO_PLACEMENT,
  getCvPhotoPlacement,
  resetCvPhotoPlacement,
  setCvPhotoPlacement,
  subscribeCvPhotoPlacement,
} from "./photo-place";
import {
  CV_BLOCK_LABELS,
  DEFAULT_CV_PLACEMENTS,
  emptyEntry,
  emptyReferenz,
  emptySprache,
  type CvEntry,
  type CvLayoutSectionKey,
  type CvPerson,
  type CvPlacement,
  type CvPlacementKey,
  type CvReferenz,
  type CvSectionLayout,
  type CvSprache,
} from "./types";

const inputCls =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const addBtn =
  "self-start rounded-md border border-dashed border-input px-3 py-1.5 text-xs hover:bg-accent";
const delBtn = "shrink-0 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10";

const AUTO_SORT_EXPERIENCE_KEY = "lebenslauf:auto-sort:erfahrung";
const DRAG_PREFIX = "cv-sort:";

function readAutoSortExperience(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUTO_SORT_EXPERIENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeAutoSortExperience(value: boolean) {
  try {
    window.localStorage.setItem(AUTO_SORT_EXPERIENCE_KEY, String(value));
  } catch {
    // Private mode / blocked storage: the checkbox still works for this visit.
  }
}

/**
 * Freie Datumsangaben wie „Sept. 2026", „2023 – heute" oder „2017 – 2023"
 * bleiben erlaubt. Für die Sortierung reicht ein robuster Best-Effort-Key;
 * nicht erkennbare Angaben bleiben stabil hinter den datierbaren Einträgen.
 */
function experienceDateKey(text: string): number | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/\b(heute|aktuell|gegenwart)\b/.test(value)) return Number.MAX_SAFE_INTEGER;

  const years = Array.from(value.matchAll(/\b(?:19|20)\d{2}\b/g), (m) => Number(m[0]));
  if (!years.length) return null;
  const year = Math.max(...years);

  const months: Array<[RegExp, number]> = [
    [/jan/, 1],
    [/feb/, 2],
    [/mär|mae|mar/, 3],
    [/apr/, 4],
    [/mai|may/, 5],
    [/jun/, 6],
    [/jul/, 7],
    [/aug/, 8],
    [/sep/, 9],
    [/okt|oct/, 10],
    [/nov/, 11],
    [/dez|dec/, 12],
  ];
  let month = 0;
  for (const [pattern, number] of months) {
    if (pattern.test(value)) month = Math.max(month, number);
  }
  return year * 12 + month;
}

function sortExperienceNewestFirst(entries: CvEntry[]): CvEntry[] {
  return entries
    .map((entry, index) => ({ entry, index, key: experienceDateKey(entry.zeit) }))
    .sort((a, b) => {
      if (a.key == null && b.key == null) return a.index - b.index;
      if (a.key == null) return 1;
      if (b.key == null) return -1;
      return b.key - a.key || a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/**
 * `kontakt` bleibt die bereits vom Renderer verwendete sichtbare Kontaktzeile.
 * E-Mail und Zusatz werden als eigene Datenfelder gepflegt, für den bestehenden
 * Renderer aber als zusätzliche Zeilen hineinkomponiert. So bleiben alte
 * gespeicherte Referenzen kompatibel und neue Felder erscheinen sofort in allen
 * CV-Layouts, ohne eine zweite Darstellung der Referenzdaten einzuführen.
 */
function referencePrimaryContact(reference: CvReferenz): string {
  const lines = reference.kontakt.split("\n");
  let end = lines.length;
  const extra = reference.zusatz?.trim();
  const email = reference.email?.trim();

  if (extra && lines[end - 1]?.trim() === extra) end -= 1;
  if (email && lines[end - 1]?.trim() === email) end -= 1;

  return lines.slice(0, end).join("\n").trim();
}

function referenceVisibleContact(primary: string, email?: string, extra?: string): string {
  return [primary, email ?? "", extra ?? ""]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

function DragHandle({ scope, index }: { scope: string; index: number }) {
  return (
    <span
      draggable
      role="button"
      tabIndex={0}
      title="Ziehen zum Sortieren"
      aria-label="Eintrag ziehen zum Sortieren"
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", `${DRAG_PREFIX}${scope}:${index}`);
      }}
      className="mt-0.5 shrink-0 cursor-grab select-none rounded px-1.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
    >
      ⋮⋮
    </span>
  );
}

function dropReorder<T>(
  e: React.DragEvent,
  scope: string,
  targetIndex: number,
  list: T[],
  onChange: (next: T[]) => void,
) {
  e.preventDefault();
  const prefix = `${DRAG_PREFIX}${scope}:`;
  const raw = e.dataTransfer.getData("text/plain");
  if (!raw.startsWith(prefix)) return;
  const from = Number(raw.slice(prefix.length));
  if (!Number.isInteger(from) || from < 0 || from >= list.length || from === targetIndex) return;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(targetIndex, 0, moved);
  onChange(next);
}

/** Kompakter Zwei-Zustands-Schalter für das Modern-Layout. */
export function PlacementToggle({
  value,
  onChange,
}: {
  value: CvPlacement;
  onChange: (value: CvPlacement) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-input bg-background"
      aria-label="Position im Modern-Layout"
    >
      {(["side", "main"] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={`px-2.5 py-1.5 text-[11px] font-semibold transition ${
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {option === "side" ? "Side" : "Main"}
          </button>
        );
      })}
    </div>
  );
}

function BlockPlacementControl({
  block,
  label = "Position",
}: {
  block: CvPlacementKey;
  label?: string;
}) {
  const layout = useSyncExternalStore(subscribeCvLayout, getCvLayout, () => "classic");
  const placements = useSyncExternalStore(
    subscribeCvPlacements,
    getCvPlacements,
    () => DEFAULT_CV_PLACEMENTS,
  );

  if (layout !== "modern") return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <PlacementToggle
        value={placements[block]}
        onChange={(value) => setCvPlacement(block, value)}
      />
    </div>
  );
}

/** Rahmen um einen wiederholbaren Eintrag, mit Entfernen-Knopf. */
function Item({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background/60 p-2">
      <div className="flex flex-col gap-2">{children}</div>
      <button type="button" onClick={onRemove} className={`${delBtn} self-end`}>
        Entfernen
      </button>
    </div>
  );
}

function photoPreviewFrame(style: DossierPhotoStyle): CSSProperties {
  const ratio = dossierPhotoRatio(style.shape);
  const width = style.shape === "rect" ? 80 : 64;
  return {
    position: "relative",
    width,
    height: width * ratio,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: dossierPhotoRadius(style.shape),
    boxShadow:
      style.borderWidth > 0
        ? `0 0 0 ${Math.max(1, style.borderWidth * 2)}px currentColor`
        : undefined,
  };
}

const placeBtn =
  "flex-1 rounded-md border px-2 py-1 text-xs transition-colors border-input hover:bg-accent";
const placeBtnOn =
  "flex-1 rounded-md border px-2 py-1 text-xs border-primary bg-primary text-primary-foreground";

/**
 * Wo das Foto auf dem Blatt sitzt und welche Farbe sein Rahmen hat.
 *
 * Stärke und Form des Rahmens stehen bewusst weiter oben in den geteilten
 * Foto-Reglern – dieselbe Einstellung wie auf dem Titelblatt. Hier steht nur,
 * was den Lebenslauf allein betrifft.
 */
function CvPhotoPlaceControls({ borderWidth }: { borderWidth: number }) {
  const place = useSyncExternalStore(
    subscribeCvPhotoPlacement,
    getCvPhotoPlacement,
    () => DEFAULT_CV_PHOTO_PLACEMENT,
  );
  const free = place.mode === "frei";

  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Positionierung
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          className={free ? placeBtn : placeBtnOn}
          aria-pressed={!free}
          onClick={() => setCvPhotoPlacement({ mode: "auto" })}
        >
          Automatisch
        </button>
        <button
          type="button"
          className={free ? placeBtnOn : placeBtn}
          aria-pressed={free}
          onClick={() => setCvPhotoPlacement({ mode: "frei" })}
        >
          Frei platzieren
        </button>
      </div>

      {free ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">
              Breite {Math.round(place.widthMm)} mm
            </span>
            <input
              type="range"
              min={CV_PHOTO_MIN_MM}
              max={CV_PHOTO_MAX_MM}
              step={1}
              value={place.widthMm}
              onChange={(e) => setCvPhotoPlacement({ widthMm: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </label>
          <p className="text-[11px] leading-snug text-muted-foreground">
            In der Vorschau lässt sich das Foto mit der Maus ziehen; am Punkt unten rechts wird es
            grösser oder kleiner. Mit den Pfeiltasten geht es millimeterweise.
          </p>
          <button
            type="button"
            className="self-start text-[11px] text-muted-foreground underline hover:text-foreground"
            onClick={resetCvPhotoPlacement}
          >
            Platz zurücksetzen
          </button>
        </>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Das Foto sitzt im Kopf bzw. in der Seitenspalte – je nach Aufbau.
        </p>
      )}

      {borderWidth > 0 && (
        <label className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Rahmenfarbe</span>
          <input
            type="color"
            value={place.frameColor ?? "#000000"}
            onChange={(e) => setCvPhotoPlacement({ frameColor: e.target.value })}
            className="h-6 w-10 cursor-pointer rounded border border-input bg-background"
            aria-label="Rahmenfarbe"
          />
          {place.frameColor && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline hover:text-foreground"
              onClick={() => setCvPhotoPlacement({ frameColor: null })}
            >
              wie Vorlage
            </button>
          )}
        </label>
      )}
    </div>
  );
}

export function FormCvPerson({
  person,
  onChange,
  contactLabel,
  onContactLabel,
}: {
  person: CvPerson;
  onChange: (p: Partial<CvPerson>) => void;
  /** Eigene Überschrift über den Kontaktangaben; leer heisst „Kontakt". */
  contactLabel: string;
  onContactLabel: (value: string) => void;
}) {
  const photoStyle = useSyncExternalStore(
    subscribeCvPhotoStyle,
    getCvPhotoStyle,
    () => DEFAULT_DOSSIER_PHOTO_STYLE,
  );
  const [photoMessage, setPhotoMessage] = useState<{ error: boolean; text: string } | null>(null);

  const onPhotoFile = (file?: File) => {
    if (!file) return;
    readPhoto(file)
      .then((foto) => {
        onChange({ foto });
        setPhotoMessage({ error: false, text: "Foto übernommen" });
      })
      .catch((e: Error) => setPhotoMessage({ error: true, text: e.message }));
  };

  const takePhotoFromCover = () => {
    const draft = readCoverPhoto();
    if (!draft) {
      setPhotoMessage({ error: true, text: "Im Titelblatt ist noch kein Foto gespeichert." });
      return;
    }
    setCvPhotoStyle(draft.photoStyle);
    onChange({ foto: draft.foto });
    setPhotoMessage({ error: false, text: "Foto und Ausschnitt vom Titelblatt übernommen" });
  };

  return (
    <div className="flex flex-col gap-3">
      <BlockPlacementControl block="kontakt" label="Kontaktangaben" />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Überschrift über den Kontaktangaben</span>
        <input
          className={inputCls}
          placeholder={CV_BLOCK_LABELS.kontakt}
          value={contactLabel}
          onChange={(e) => onContactLabel(e.target.value)}
        />
      </label>
      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
            {person.foto ? "Foto ersetzen" : "Foto hochladen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPhotoFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={takePhotoFromCover}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            Vom Titelblatt
          </button>
          {person.foto && (
            <button
              type="button"
              onClick={() => {
                onChange({ foto: null });
                setPhotoMessage(null);
              }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Entfernen
            </button>
          )}
        </div>
        <div className="flex items-start gap-3">
          <div style={photoPreviewFrame(photoStyle)} className="border bg-background text-primary">
            {person.foto ? (
              <img
                src={person.foto}
                alt="Foto-Vorschau"
                style={dossierPhotoCropStyle(photoStyle)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                Foto
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <PhotoStyleControls
              value={photoStyle}
              onChange={setCvPhotoStyle}
              hasPhoto={!!person.foto}
              compact
            />
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              Form, Rahmen und Ausschnitt bleiben beim Wechsel des CV-Layouts erhalten.
            </p>
            <CvPhotoPlaceControls borderWidth={photoStyle.borderWidth} />
            {photoMessage && (
              <p
                className={`mt-1.5 text-[11px] ${
                  photoMessage.error ? "text-destructive" : "text-primary"
                }`}
              >
                {photoMessage.text}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Vorname">
          <input
            className={inputCls}
            value={person.vorname}
            onChange={(e) => onChange({ vorname: e.target.value })}
          />
        </Field>
        <Field label="Nachname">
          <input
            className={inputCls}
            value={person.nachname}
            onChange={(e) => onChange({ nachname: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Zeile unter dem Namen">
        <input
          className={inputCls}
          placeholder="z. B. Schülerin, 3. Sekundarklasse"
          value={person.untertitel}
          onChange={(e) => onChange({ untertitel: e.target.value })}
        />
      </Field>
      <Field label="Adresse">
        <input
          className={inputCls}
          value={person.adresse}
          onChange={(e) => onChange({ adresse: e.target.value })}
        />
      </Field>
      <Field label="PLZ und Ort">
        <input
          className={inputCls}
          value={person.plzOrt}
          onChange={(e) => onChange({ plzOrt: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Telefon">
          <input
            className={inputCls}
            value={person.telefon}
            onChange={(e) => onChange({ telefon: e.target.value })}
          />
        </Field>
        <Field label="E-Mail">
          <input
            className={inputCls}
            value={person.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Geburtsdatum">
          <input
            className={inputCls}
            value={person.geburtsdatum}
            onChange={(e) => onChange({ geburtsdatum: e.target.value })}
          />
        </Field>
        <Field label="Nationalität">
          <input
            className={inputCls}
            value={person.nationalitaet}
            onChange={(e) => onChange({ nationalitaet: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

/** Schule und Praktika teilen sich denselben Aufbau. */
export function FormCvEntries({
  entries,
  onChange,
  titelLabel,
  ortLabel,
  placement,
}: {
  entries: CvEntry[];
  onChange: (list: CvEntry[]) => void;
  titelLabel: string;
  ortLabel: string;
  /** `null` bei eigenen Rubriken; dort gibt es bewusst kein Side/Main. */
  placement?: CvPlacementKey | null;
}) {
  const patch = (id: string, p: Partial<CvEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const block =
    placement === undefined
      ? titelLabel === "Schule / Stufe"
        ? "schule"
        : "erfahrung"
      : placement;
  const isExperience = block === "erfahrung";
  const [autoSort, setAutoSort] = useState(readAutoSortExperience);
  const sortedOnce = useRef(false);

  const sortNow = () => {
    const sorted = sortExperienceNewestFirst(entries);
    if (sorted.some((entry, index) => entry.id !== entries[index]?.id)) onChange(sorted);
  };

  useEffect(() => {
    if (!isExperience || !autoSort || sortedOnce.current) return;
    sortedOnce.current = true;
    sortNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExperience, autoSort]);

  return (
    <div className="flex flex-col gap-2">
      {block && <BlockPlacementControl block={block} />}
      {isExperience && (
        <label className="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
          <input
            type="checkbox"
            checked={autoSort}
            onChange={(e) => {
              const checked = e.target.checked;
              setAutoSort(checked);
              writeAutoSortExperience(checked);
              if (checked) {
                const sorted = sortExperienceNewestFirst(entries);
                if (sorted.some((entry, index) => entry.id !== entries[index]?.id))
                  onChange(sorted);
              }
            }}
          />
          <span>
            Automatisch nach Datum sortieren
            <span className="ml-1 text-muted-foreground">
              {autoSort ? "(neueste zuerst)" : "(manuell per Drag & Drop)"}
            </span>
          </span>
        </label>
      )}
      {entries.map((e, i) => (
        <div
          key={e.id}
          className={isExperience && !autoSort ? "flex items-start gap-1" : undefined}
          onDragOver={isExperience && !autoSort ? (event) => event.preventDefault() : undefined}
          onDrop={
            isExperience && !autoSort
              ? (event) => dropReorder(event, "erfahrung", i, entries, onChange)
              : undefined
          }
        >
          {isExperience && !autoSort && <DragHandle scope="erfahrung" index={i} />}
          <div className={isExperience && !autoSort ? "min-w-0 flex-1" : undefined}>
            <Item onRemove={() => onChange(entries.filter((x) => x.id !== e.id))}>
              <Field label="Zeitraum">
                <input
                  className={inputCls}
                  placeholder="2023 – heute"
                  value={e.zeit}
                  onChange={(ev) => patch(e.id, { zeit: ev.target.value })}
                  onBlur={() => {
                    if (isExperience && autoSort) sortNow();
                  }}
                />
              </Field>
              <Field label={titelLabel}>
                <input
                  className={inputCls}
                  value={e.titel}
                  onChange={(ev) => patch(e.id, { titel: ev.target.value })}
                />
              </Field>
              <Field label={ortLabel}>
                <input
                  className={inputCls}
                  value={e.ort}
                  onChange={(ev) => patch(e.id, { ort: ev.target.value })}
                />
              </Field>
              <Field label="Ergänzung (optional)">
                <input
                  className={inputCls}
                  value={e.beschreibung}
                  onChange={(ev) => patch(e.id, { beschreibung: ev.target.value })}
                />
              </Field>
            </Item>
          </div>
        </div>
      ))}
      <button type="button" className={addBtn} onClick={() => onChange([...entries, emptyEntry()])}>
        + Eintrag
      </button>
    </div>
  );
}

export function FormCvSprachen({
  list,
  onChange,
}: {
  list: CvSprache[];
  onChange: (l: CvSprache[]) => void;
}) {
  const patch = (id: string, p: Partial<CvSprache>) =>
    onChange(list.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="flex flex-col gap-2">
      <BlockPlacementControl block="sprachen" />
      {list.map((s, i) => (
        <div
          key={s.id}
          className="flex items-end gap-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => dropReorder(e, "sprachen", i, list, onChange)}
        >
          <DragHandle scope="sprachen" index={i} />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <Field label="Sprache">
              <input
                className={inputCls}
                value={s.name}
                onChange={(e) => patch(s.id, { name: e.target.value })}
              />
            </Field>
            <Field label="Niveau">
              <input
                className={inputCls}
                placeholder="Muttersprache, B1 …"
                value={s.niveau}
                onChange={(e) => patch(s.id, { niveau: e.target.value })}
              />
            </Field>
          </div>
          <button
            type="button"
            className={`${delBtn} mb-1.5`}
            onClick={() => onChange(list.filter((x) => x.id !== s.id))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={addBtn} onClick={() => onChange([...list, emptySprache()])}>
        + Sprache
      </button>
    </div>
  );
}

/** Hobbys und Stärken sind schlichte Zeilenlisten. */
export function FormCvLines({
  list,
  onChange,
  placeholder,
  addLabel,
}: {
  list: string[];
  onChange: (l: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const block: CvPlacementKey = addLabel.includes("Hobby") ? "hobbys" : "staerken";

  return (
    <div className="flex flex-col gap-2">
      <BlockPlacementControl block={block} />
      {list.map((v, i) => (
        <div
          key={i}
          className="flex items-center gap-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => dropReorder(e, block, i, list, onChange)}
        >
          <DragHandle scope={block} index={i} />
          <input
            className={inputCls}
            placeholder={placeholder}
            value={v}
            onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            className={delBtn}
            onClick={() => onChange(list.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={addBtn} onClick={() => onChange([...list, ""])}>
        {addLabel}
      </button>
    </div>
  );
}

export function FormCvReferenzen({
  list,
  onChange,
}: {
  list: CvReferenz[];
  onChange: (l: CvReferenz[]) => void;
}) {
  const patch = (id: string, p: Partial<CvReferenz>) =>
    onChange(
      list.map((reference) => {
        if (reference.id !== id) return reference;
        const primary = p.kontakt !== undefined ? p.kontakt : referencePrimaryContact(reference);
        const email = p.email !== undefined ? p.email : (reference.email ?? "");
        const extra = p.zusatz !== undefined ? p.zusatz : (reference.zusatz ?? "");
        return {
          ...reference,
          ...p,
          email,
          zusatz: extra,
          kontakt: referenceVisibleContact(primary, email, extra),
        };
      }),
    );

  return (
    <div className="flex flex-col gap-2">
      <BlockPlacementControl block="referenzen" />
      {list.map((r, i) => (
        <div
          key={r.id}
          className="flex items-start gap-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => dropReorder(e, "referenzen", i, list, onChange)}
        >
          <DragHandle scope="referenzen" index={i} />
          <div className="min-w-0 flex-1">
            <Item onRemove={() => onChange(list.filter((x) => x.id !== r.id))}>
              <Field label="Name">
                <input
                  className={inputCls}
                  value={r.name}
                  onChange={(e) => patch(r.id, { name: e.target.value })}
                />
              </Field>
              <Field label="Funktion">
                <input
                  className={inputCls}
                  placeholder="Klassenlehrer, Schulhaus Feld"
                  value={r.funktion}
                  onChange={(e) => patch(r.id, { funktion: e.target.value })}
                />
              </Field>
              <Field label="Telefon / Kontakt (optional)">
                <input
                  className={inputCls}
                  value={referencePrimaryContact(r)}
                  onChange={(e) => patch(r.id, { kontakt: e.target.value })}
                />
              </Field>
              <Field label="E-Mail (optional)">
                <input
                  type="email"
                  className={inputCls}
                  value={r.email ?? ""}
                  onChange={(e) => patch(r.id, { email: e.target.value })}
                />
              </Field>
              <Field label="Zusatz (optional)">
                <input
                  className={inputCls}
                  placeholder="z. B. Betreuung im Berufswahlprozess"
                  value={r.zusatz ?? ""}
                  onChange={(e) => patch(r.id, { zusatz: e.target.value })}
                />
              </Field>
            </Item>
          </div>
        </div>
      ))}
      <button type="button" className={addBtn} onClick={() => onChange([...list, emptyReferenz()])}>
        + Referenz
      </button>
    </div>
  );
}

const layoutSelectCls =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring";

/** Kompakte, verständliche Layoutwahl für eine komplette Rubrik. */
export function SectionLayoutControls({
  section,
  layout,
  onLayout,
}: {
  section: CvLayoutSectionKey;
  layout: CvSectionLayout;
  onLayout: (patch: Partial<CvSectionLayout>) => void;
}) {
  const sectionGapMm = useSyncExternalStore(
    subscribeCvSectionGap,
    getCvSectionGapMm,
    () => null,
  );
  const customSectionGap = sectionGapMm !== null;

  return (
    <details className="group rounded-md border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-semibold hover:bg-accent/60">
        <span>⚙ Layout</span>
        <span className="font-normal text-muted-foreground group-open:hidden">
          Seite {layout.page} · {layout.width === "half" ? "Halbe Breite" : "Volle Breite"}
          {layout.positioning === "free" && (layout.widthMm || layout.heightMm)
            ? " · Eigene Grösse"
            : ""}
        </span>
        <span className="hidden font-normal text-muted-foreground group-open:inline">
          schliessen
        </span>
      </summary>
      <div className="grid gap-2 border-t p-2.5 sm:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium">Seite</span>
          <select
            className={layoutSelectCls}
            value={layout.page}
            onChange={(event) => onLayout({ page: Number(event.target.value) === 2 ? 2 : 1 })}
            aria-label={`${section}: Seite`}
          >
            <option value={1}>Seite 1</option>
            <option value={2}>Seite 2</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium">Breite</span>
          <select
            className={layoutSelectCls}
            value={layout.width}
            onChange={(event) =>
              onLayout({ width: event.target.value === "half" ? "half" : "full" })
            }
            aria-label={`${section}: Breite`}
          >
            <option value="full">Volle Breite</option>
            <option value="half">Halbe Breite</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium">Positionierung</span>
          <select
            className={layoutSelectCls}
            value={layout.positioning}
            onChange={(event) =>
              onLayout({ positioning: event.target.value === "free" ? "free" : "flow" })
            }
            aria-label={`${section}: Positionierung`}
          >
            <option value="flow">Automatisch</option>
            <option value="free">Frei platzieren</option>
          </select>
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground sm:col-span-3">
          {layout.positioning === "free"
            ? "Diese Rubrik kannst du direkt auf der Seite verschieben und am Rahmen vergrössern."
            : layout.width === "half"
              ? "Zwei Rubriken mit halber Breite können nebeneinander stehen."
              : "Die Rubrik bleibt sicher im automatischen Dokumentfluss."}
        </p>
        {layout.positioning === "free" && (layout.widthMm || layout.heightMm) ? (
          <button
            type="button"
            className="justify-self-start rounded-md border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent sm:col-span-3"
            onClick={() => onLayout({ widthMm: null, heightMm: null })}
          >
            Grösse zurücksetzen
          </button>
        ) : null}
      </div>
      {section === "person" && (
        <div className="flex flex-col gap-2 border-t p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold">Vertikaler Rubrik-Abstand</div>
              <div className="text-[11px] text-muted-foreground">Global für den ganzen CV</div>
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
          {customSectionGap && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">
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
                aria-label="Vertikaler Rubrik-Abstand"
              />
            </label>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Nur vertikal: zwei Rubriken mit halber Breite bleiben weiterhin nebeneinander.
          </p>
        </div>
      )}
    </details>
  );
}

/** Überschrift eines Abschnitts umbenennen, ausblenden und Layout wählen. */
export function SectionOptions({
  section,
  value,
  placeholder,
  hidden,
  layout,
  onLabel,
  onHidden,
  onLayout,
}: {
  section: CvLayoutSectionKey;
  value: string;
  placeholder: string;
  hidden: boolean;
  layout: CvSectionLayout;
  onLabel: (v: string) => void;
  onHidden: (v: boolean) => void;
  onLayout: (patch: Partial<CvSectionLayout>) => void;
}) {
  return (
    <div className="mb-2 flex flex-col gap-2 border-b pb-2">
      <div className="flex items-center gap-2">
        <input
          className={`${inputCls} flex-1`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onLabel(e.target.value)}
          aria-label="Überschrift"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={!hidden} onChange={(e) => onHidden(!e.target.checked)} />
          zeigen
        </label>
      </div>
      <SectionLayoutControls section={section} layout={layout} onLayout={onLayout} />
    </div>
  );
}
