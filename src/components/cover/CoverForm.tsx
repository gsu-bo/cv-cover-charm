import { useEffect, useState } from "react";
import type { BlockStyle, CoverData, PdfMeta } from "./types";
import { PhotoControls } from "./PhotoControls";
import { coverAttachmentValues, LEHRBERUFE } from "./types";
import { readPhoto } from "@/lib/image";
import { DEFAULTS } from "@/default-config";
import { AttachmentListEditor } from "@/components/dossier/AttachmentListEditor";
import {
  readCoverDossierSource,
  type CoverDossierSource,
} from "@/components/letter/dossier-transfer";

type Props = {
  data: CoverData;
  onChange: (patch: Partial<CoverData>) => void;
  onError?: (message: string) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function FormBewerbung({ data, onChange }: Props) {
  const [dossierSource, setDossierSource] = useState<CoverDossierSource | null>(null);
  const [transferNote, setTransferNote] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    const refresh = () => setDossierSource(readCoverDossierSource());
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!transferNote) return;
    const timer = window.setTimeout(() => setTransferNote(null), 6000);
    return () => window.clearTimeout(timer);
  }, [transferNote]);

  const takeFromDossier = () => {
    const source = readCoverDossierSource();
    setDossierSource(source);
    if (!source.hasPersonal && !source.hasApplication) {
      setTransferNote({
        kind: "error",
        text: "Im Lebenslauf oder Motivationsschreiben stehen noch keine übernehmbaren Angaben.",
      });
      return;
    }

    const personal = source.personalData;
    const application = source.applicationData;
    onChange({
      ...(personal.vorname?.trim() ? { vorname: personal.vorname } : {}),
      ...(personal.nachname?.trim() ? { nachname: personal.nachname } : {}),
      ...(personal.adresse?.trim() ? { adresse: personal.adresse } : {}),
      ...(personal.plzOrt?.trim() ? { plzOrt: personal.plzOrt } : {}),
      ...(personal.telefon?.trim() ? { telefon: personal.telefon } : {}),
      ...(personal.email?.trim() ? { email: personal.email } : {}),
      ...(personal.geburtsdatum?.trim() ? { geburtsdatum: personal.geburtsdatum } : {}),
      ...(personal.foto ? { foto: personal.foto } : {}),
      ...(application.beruf?.trim() ? { beruf: application.beruf } : {}),
      ...(application.lehrbetrieb?.trim() ? { lehrbetrieb: application.lehrbetrieb } : {}),
      ...(application.ansprechperson?.trim()
        ? { ansprechperson: application.ansprechperson }
        : {}),
      ...(application.betriebAdresse?.trim()
        ? { betriebAdresse: application.betriebAdresse }
        : {}),
      ...(application.ort?.trim() ? { ort: application.ort } : {}),
      ...(application.datum?.trim() ? { datum: application.datum } : {}),
      ...(application.showBetriebOnCover === true ? { showBetriebOnCover: true } : {}),
    });

    const done: string[] = [];
    if (source.hasPersonal) {
      done.push(`persönliche Angaben aus ${source.personalSource}`);
    }
    if (source.hasApplication) {
      done.push("Betrieb/Bewerbung aus Motivationsschreiben");
    }
    setTransferNote({
      kind: "ok",
      text: `Aus dem Dossier übernommen: ${done.join("; ")}.`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-dashed p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold">Vom Dossier übernehmen</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Lebenslauf zuerst für persönliche Angaben; das Motivationsschreiben ergänzt fehlende
              Kontaktdaten sowie Betrieb und Bewerbung.
            </div>
          </div>
          <button
            type="button"
            onClick={takeFromDossier}
            disabled={!dossierSource?.hasPersonal && !dossierSource?.hasApplication}
            className="shrink-0 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Alles übernehmen
          </button>
        </div>
        <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
          <div>
            Persönliche Angaben: {dossierSource?.personalSource ?? "noch nicht verfügbar"}
          </div>
          <div>
            Betrieb und Bewerbung: {dossierSource?.applicationSource ?? "noch nicht verfügbar"}
          </div>
        </div>
        {transferNote ? (
          <div
            role="status"
            className={`mt-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
              transferNote.kind === "error"
                ? "border-destructive/40 text-destructive"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            {transferNote.text}
          </div>
        ) : null}
      </div>

      <Field label="Titelzeile">
        <input
          className={inputCls}
          value={data.kicker}
          onChange={(e) => onChange({ kicker: e.target.value })}
          placeholder={DEFAULTS.KICKER}
        />
      </Field>
      <Field label="Lehrberuf">
        <input
          className={inputCls}
          list="lehrberufe"
          value={data.beruf}
          onChange={(e) => onChange({ beruf: e.target.value })}
          placeholder="z. B. Kaufmann/-frau EFZ"
        />
        <datalist id="lehrberufe">
          {LEHRBERUFE.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </Field>
      <Field label="Kopfzeile">
        <input
          className={inputCls}
          value={data.eyebrow}
          onChange={(e) => onChange({ eyebrow: e.target.value })}
          placeholder="Vorgabe der Vorlage"
        />
      </Field>
      <Field label="Lehrbeginn">
        <input
          className={inputCls}
          value={data.lehrbeginn}
          onChange={(e) => onChange({ lehrbeginn: e.target.value })}
          placeholder="August 2027"
        />
      </Field>
    </div>
  );
}

export function FormPerson({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vorname">
          <input
            className={inputCls}
            value={data.vorname}
            onChange={(e) => onChange({ vorname: e.target.value })}
          />
        </Field>
        <Field label="Nachname">
          <input
            className={inputCls}
            value={data.nachname}
            onChange={(e) => onChange({ nachname: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Adresse">
        <input
          className={inputCls}
          value={data.adresse}
          onChange={(e) => onChange({ adresse: e.target.value })}
          placeholder="Musterstrasse 12"
        />
      </Field>
      <Field label="PLZ / Ort">
        <input
          className={inputCls}
          value={data.plzOrt}
          onChange={(e) => onChange({ plzOrt: e.target.value })}
          placeholder="4535 Hubersdorf"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefon">
          <input
            className={inputCls}
            value={data.telefon}
            onChange={(e) => onChange({ telefon: e.target.value })}
            placeholder="+41 79 000 00 00"
          />
        </Field>
        <Field label="Geburtsdatum">
          <input
            className={inputCls}
            value={data.geburtsdatum}
            onChange={(e) => onChange({ geburtsdatum: e.target.value })}
            placeholder="01.01.2010"
          />
        </Field>
      </div>
      <Field label="E-Mail">
        <input
          className={inputCls}
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function FormFoto({
  data,
  onChange,
  onError,
  photoStyle,
  onPhotoStyle,
  onAddImage,
}: Props & {
  photoStyle?: BlockStyle;
  onPhotoStyle?: (patch: Partial<BlockStyle>) => void;
  /** Legt ein weiteres, frei platzierbares Bild aufs Blatt. */
  onAddImage?: () => void;
}) {
  const onFile = (file: File | undefined) => {
    if (!file) return;
    readPhoto(file)
      .then((foto) => onChange({ foto }))
      .catch((e: Error) => onError?.(e.message));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
          {data.foto ? "Foto ersetzen" : "Foto hochladen"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {data.foto ? (
          <>
            <img src={data.foto} alt="Vorschau" className="h-10 w-10 rounded-full object-cover" />
            <button
              type="button"
              onClick={() => onChange({ foto: null })}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Entfernen
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Ohne Foto werden die Initialen angezeigt.
          </span>
        )}
      </div>
      {photoStyle && onPhotoStyle && (
        <PhotoControls style={photoStyle} onChange={onPhotoStyle} hasPhoto={!!data.foto} compact />
      )}
      {data.foto && onAddImage && (
        <button
          type="button"
          onClick={onAddImage}
          className="self-start rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
        >
          + Weiteres Bild aufs Blatt
        </button>
      )}
    </div>
  );
}

export function FormBetrieb({ data, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.showBetriebOnCover === true}
          onChange={(event) => onChange({ showBetriebOnCover: event.target.checked })}
        />
        <span>Auf Titelblatt anzeigen</span>
      </label>
      <Field label="Firma">
        <input
          className={inputCls}
          value={data.lehrbetrieb}
          onChange={(e) => onChange({ lehrbetrieb: e.target.value })}
        />
      </Field>
      <Field label="Ansprechperson">
        <input
          className={inputCls}
          value={data.ansprechperson}
          onChange={(e) => onChange({ ansprechperson: e.target.value })}
        />
      </Field>
      <Field label="Adresse">
        <input
          className={inputCls}
          value={data.betriebAdresse}
          onChange={(e) => onChange({ betriebAdresse: e.target.value })}
          placeholder="Strasse, PLZ Ort"
        />
      </Field>
    </div>
  );
}

export function FormBeilagen({ data, onChange }: Props) {
  const values = coverAttachmentValues(data);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.showBeilagenOnCover !== false}
          onChange={(event) => onChange({ showBeilagenOnCover: event.target.checked })}
        />
        <span>Auf Titelblatt anzeigen</span>
      </label>
      <AttachmentListEditor values={values} onChange={(beilagen) => onChange({ beilagen })} />
    </div>
  );
}

export function FormOrtDatum({ data, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Ort">
        <input
          className={inputCls}
          value={data.ort}
          onChange={(e) => onChange({ ort: e.target.value })}
        />
      </Field>
      <Field label="Datum">
        <input
          className={inputCls}
          value={data.datum}
          onChange={(e) => onChange({ datum: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function FormMeta({
  meta,
  auto,
  onChange,
}: {
  meta: PdfMeta;
  /** Automatisch berechnete Werte – als Platzhalter sichtbar. */
  auto: PdfMeta;
  onChange: (patch: Partial<PdfMeta>) => void;
}) {
  const rows: { key: keyof PdfMeta; label: string }[] = [
    { key: "title", label: "Titel" },
    { key: "author", label: "Autor/in" },
    { key: "subject", label: "Betreff" },
    { key: "keywords", label: "Stichwörter" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Landet als Dokumentinfo im PDF – so heisst die Datei im Mailprogramm nicht nur
        &bdquo;Titelblatt&ldquo;. Leere Felder werden automatisch gefüllt.
      </p>
      {rows.map((r) => (
        <Field key={r.key} label={r.label}>
          <input
            className={inputCls}
            value={meta[r.key]}
            onChange={(e) => onChange({ [r.key]: e.target.value })}
            placeholder={auto[r.key]}
          />
        </Field>
      ))}
    </div>
  );
}
