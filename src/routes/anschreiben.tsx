import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ColorChooser } from "@/components/cover/ColorChooser";
import { Section } from "@/components/cover/Section";
import { ThemeToggle } from "@/components/cover/ThemeToggle";
import {
  FileDown,
  Files,
  FolderOpen,
  History,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { EditorMenuLabel } from "@/components/dossier/EditorMenuLabel";
import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";
import { DossierChromeDocumentContentControls } from "@/components/dossier/DossierChromeDocumentContentControls";
import { DossierPdfCanvas } from "@/components/dossier/DossierPdfCanvas";
import { useForeignWrite, usePageVisible } from "@/lib/autosave";
import {
  HISTORY_KEYS,
  formatWhen,
  hasContent,
  pushSnapshot,
  readHistory,
  type Snapshot,
} from "@/lib/history";
import { TEMPLATES } from "@/components/cover/types";
import { DEFAULTS } from "@/default-config";
import { ResizableEditorPanel } from "@/components/dossier/ResizableEditorPanel";
import { AttachmentListEditor } from "@/components/dossier/AttachmentListEditor";
import { SaveStatus, type SaveState } from "@/components/dossier/SaveStatus";
import { LetterDocument, type LetterPaginationState } from "@/components/letter/LetterDocument";
import {
  LetterLayoutControls,
  legacyLetterChromePatch,
} from "@/components/letter/LetterLayoutControls";
import { LetterRichTextEditor } from "@/components/letter/LetterRichTextEditor";
import { LetterFontSizeControl } from "@/components/letter/LetterFontSizeControl";
import { LetterTemplatePicker } from "@/components/letter/LetterTemplatePicker";
import { useTemplateQaTemplateSwitch } from "@/lib/template-qa-switch";
import { resolveLetterPalette, resolveLetterPaperColor } from "@/components/letter/letter-paper";
import { DocumentTextColorControl } from "@/components/dossier/DocumentTextColorControl";
import { downloadCombinedDossierPdf, downloadLetterPdf } from "@/lib/dossier-pdf";
import {
  coverPdfDocumentFromSaved,
  coverPdfHasContent,
  cvPdfDocumentFromSaved,
  cvPdfHasContent,
} from "@/lib/dossier-pdf-document";
import { downloadBlob } from "@/lib/download";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  createDossierProject,
  parseDossierProject,
  readStoredDossierPart,
  storeDossierProject,
} from "@/lib/dossier-project";
import { readPhoto } from "@/lib/image";
import { readDossierContact } from "@/lib/dossier-contact";
import {
  DEFAULT_DOSSIER_CHROME_STATE,
  applyPortableDossierChromeState,
  getDossierChromeState,
  patchDossierChrome,
  subscribeDossierChrome,
} from "@/lib/dossier-chrome";
import {
  mergeNonEmptyLetterData,
  readLetterDossierSource,
  type LetterDossierSource,
} from "@/components/letter/dossier-transfer";
import {
  DEFAULT_LETTER_BEILAGEN,
  DEFAULT_LETTER_CLOSING_GAP_MM,
  DEFAULT_LETTER_SIGNATURE_GAP_MM,
  DEMO_LETTER,
  EMPTY_LETTER,
  LETTER_STORAGE_KEY,
  MAX_LETTER_SIGNATURE_SPACING_MM,
  defaultLetterColors,
  emptyLetterDesign,
  letterAttachmentValues,
  normalizeLetterSpacingMm,
  normalizeLetterDesign,
  withLetterRoleFont,
  withLetterRoleFontSize,
  type LetterData,
  type LetterDesign,
  type LetterFlowImage,
  type LetterTemplateId,
  type SavedLetter,
} from "@/components/letter/types";

export const Route = createFileRoute("/anschreiben")({
  head: () => ({
    meta: [
      { title: "Motivationsschreiben für die Lehrstellenbewerbung" },
      {
        name: "description",
        content:
          "Persönliches Motivationsschreiben für deine Lehrstellenbewerbung – passend zu Titelblatt und Lebenslauf.",
      },
    ],
  }),
  component: Anschreiben,
});

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

/** Standard-Anrede und -Gruss allein bedeuten noch nicht, dass der Brief begonnen wurde. */
function letterHasStarted(data: LetterData): boolean {
  return [
    data.absenderName,
    data.absenderAdresse,
    data.absenderPlzOrt,
    data.absenderTelefon,
    data.absenderEmail,
    data.empfaengerFirma,
    data.empfaengerName,
    data.empfaengerAdresse,
    data.empfaengerPlzOrt,
    data.ort,
    data.datum,
    data.betreff,
    data.text,
    data.richTextHtml,
    data.unterschrift,
  ].some((value) => !!value?.trim());
}

function dossierHasMeaningfulSource(source: LetterDossierSource | null): boolean {
  return !!source && (source.hasPersonal || source.hasApplication || source.hasDesign);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-xs font-medium text-foreground">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}

function MillimeterField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  onChange: (value: number) => void;
}) {
  const resolvedValue = normalizeLetterSpacingMm(value, fallback);
  const [draft, setDraft] = useState(String(resolvedValue));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setDraft(String(normalizeLetterSpacingMm(value, fallback)));
    }
  }, [fallback, value]);

  const commitDraft = () => {
    editingRef.current = false;
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? Number.NaN : Number(trimmed);
    const next = Number.isFinite(parsed)
      ? normalizeLetterSpacingMm(parsed, fallback)
      : normalizeLetterSpacingMm(fallback, fallback);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <label className="block text-xs font-medium text-foreground">
      {label}
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_LETTER_SIGNATURE_SPACING_MM}
          step={1}
          value={draft}
          onFocus={(event) => {
            editingRef.current = true;
            event.currentTarget.select();
          }}
          onChange={(event) => {
            const nextDraft = event.currentTarget.value;
            setDraft(nextDraft);
            if (nextDraft.trim() === "") return;
            const parsed = Number(nextDraft);
            if (!Number.isFinite(parsed)) return;
            if (parsed < 0 || parsed > MAX_LETTER_SIGNATURE_SPACING_MM) return;
            onChange(normalizeLetterSpacingMm(parsed, fallback));
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={`${inputClass} pr-11`}
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted-foreground">
          mm
        </span>
      </span>
    </label>
  );
}

function Anschreiben() {
  const [data, setData] = useState<LetterData>(EMPTY_LETTER);
  const [design, setDesign] = useState<LetterDesign>(emptyLetterDesign);
  const chromeState = useSyncExternalStore(
    subscribeDossierChrome,
    getDossierChromeState,
    () => DEFAULT_DOSSIER_CHROME_STATE,
  );
  const chromeOptions = chromeState.sync ? chromeState.shared : chromeState.letter;
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [panelOpen, setPanelOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [letterPagination, setLetterPagination] = useState<LetterPaginationState>({
    ready: false,
    pageCount: 1,
    issue: null,
  });
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [source, setSource] = useState<LetterDossierSource | null>(null);
  const [transferNote, setTransferNote] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dossierExportRef = useRef<HTMLDivElement>(null);
  const visible = usePageVisible();
  const { markWritten, changedElsewhere } = useForeignWrite(LETTER_STORAGE_KEY);
  const [takeover, setTakeover] = useState({
    personal: true,
    application: true,
    design: true,
  });
  const [open, setOpen] = useState<Record<string, boolean>>({
    uebernehmen: true,
    absender: false,
    empfaenger: false,
    layout: false,
    chrome: false,
    brief: true,
    beilagen: false,
    vorlage: false,
    farben: false,
  });

  const chromeContact = useMemo(
    () => (chromeState.sync ? readDossierContact({ letter: data }) : undefined),
    [chromeState.sync, data],
  );

  const refreshSource = useCallback(() => {
    const next = readLetterDossierSource();
    setSource(next);
    return next;
  }, []);

  useEffect(() => {
    const dossier = refreshSource();
    setHistory(readHistory(HISTORY_KEYS.letter));
    let nextData: LetterData = { ...EMPTY_LETTER };
    let nextDesign: LetterDesign = emptyLetterDesign();
    let savedDataLoaded = false;

    try {
      const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
      if (raw) {
        markWritten(raw);
        const parsed = JSON.parse(raw) as Partial<SavedLetter>;
        if (parsed.data && typeof parsed.data === "object") {
          nextData = { ...EMPTY_LETTER, ...parsed.data };
          savedDataLoaded = true;
        }
        if (parsed.design) nextDesign = normalizeLetterDesign(parsed.design);
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
    }

    // Ein leerer Entwurf darf beim ersten Besuch gemeinsame Dossier-Daten nutzen.
    // Die Quellpriorität steckt zentral in readLetterDossierSource: Titelblatt vor CV.
    if ((!savedDataLoaded || !letterHasStarted(nextData)) && dossierHasMeaningfulSource(dossier)) {
      const automatic: string[] = [];
      if (dossier.hasPersonal) {
        nextData = mergeNonEmptyLetterData(nextData, dossier.personalData);
        automatic.push(
          `persönliche Angaben${dossier.personalSource ? ` aus ${dossier.personalSource}` : ""}`,
        );
      }
      if (dossier.hasApplication) {
        nextData = mergeNonEmptyLetterData(nextData, dossier.applicationData);
        automatic.push("Betriebsdaten aus Titelblatt");
      }
      if (dossier.design) {
        nextDesign = { ...nextDesign, ...dossier.design };
        automatic.push(`Design${dossier.designSource ? ` aus ${dossier.designSource}` : ""}`);
      }
      if (automatic.length) {
        setTransferNote({
          kind: "ok",
          text: `Automatisch aus dem Dossier übernommen: ${automatic.join(", ")}.`,
        });
      }
    }

    setData(nextData);
    setDesign(nextDesign);
    setHydrated(true);
  }, [refreshSource, markWritten]);

  useEffect(() => {
    const refresh = () => refreshSource();
    const onStorage = (event: StorageEvent) => {
      if (event.key === LETTER_STORAGE_KEY) return;
      refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshSource]);

  // Ein zweiter Motivationsschreiben-Tab darf beim Zurückkehren nicht seinen
  // älteren Zustand über den neueren Autosave schreiben. Im Hintergrund wird
  // deshalb nicht gespeichert; bei Fokuswechsel gewinnt der frischere Key.
  useEffect(() => {
    if (!visible || !hydrated || !changedElsewhere()) return;
    try {
      const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedLetter>;
      if (parsed.data && typeof parsed.data === "object") {
        setData({ ...EMPTY_LETTER, ...parsed.data });
      }
      if (parsed.design) setDesign(normalizeLetterDesign(parsed.design));
      markWritten(raw);
      setHistory(readHistory(HISTORY_KEYS.letter));
      setSaveState("saved");
      setTransferNote({
        kind: "ok",
        text: "Neuerer Stand aus einem anderen Fenster geladen.",
      });
    } catch {
      setSaveState("error");
    }
  }, [visible, hydrated, changedElsewhere, markWritten]);

  const snapshotPayload = useCallback(
    (): SavedLetter => ({ version: 1, data, design }),
    [data, design],
  );

  const historyPayload = useCallback(
    () => ({ ...snapshotPayload(), chrome: chromeState }) as unknown as Record<string, unknown>,
    [snapshotPayload, chromeState],
  );

  const keepSnapshot = useCallback(
    (label: string, force = false) => {
      const payload = historyPayload();
      if (!hasContent(payload)) return;
      setHistory(pushSnapshot(HISTORY_KEYS.letter, payload, label, force));
    },
    [historyPayload],
  );

  useEffect(() => {
    if (!hydrated || !visible) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        const saved = snapshotPayload();
        const raw = JSON.stringify(saved);
        window.localStorage.setItem(LETTER_STORAGE_KEY, raw);
        markWritten(raw);
        setSaveState("saved");
        keepSnapshot("Automatisch");
      } catch {
        setSaveState("error");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [hydrated, visible, snapshotPayload, markWritten, keepSnapshot]);

  useEffect(() => {
    if (!transferNote) return;
    const timer = window.setTimeout(() => setTransferNote(null), 6000);
    return () => window.clearTimeout(timer);
  }, [transferNote]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setHistoryOpen(false);
        setConfirmDemo(false);
        setConfirmWipe(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setHistoryOpen(false);
      setConfirmDemo(false);
      setConfirmWipe(false);
    }
  }, [menuOpen]);

  const template = useMemo(
    () =>
      design.template === "brief"
        ? null
        : (TEMPLATES.find((candidate) => candidate.id === design.template) ??
          TEMPLATES.find((candidate) => candidate.id === DEFAULTS.TEMPLATE) ??
          null),
    [design.template],
  );

  const storedCoverDocument = coverPdfDocumentFromSaved(readStoredDossierPart(COVER_STORAGE_KEY));
  const storedCvDocument = cvPdfDocumentFromSaved(readStoredDossierPart(CV_STORAGE_KEY));
  const coverReadyForDossier =
    !!storedCoverDocument && coverPdfHasContent(storedCoverDocument.data);
  const cvReadyForDossier = !!storedCvDocument && cvPdfHasContent(storedCvDocument.data);
  const letterReadyForDossier =
    letterHasStarted(data) && letterPagination.ready && !letterPagination.issue;
  const canDownloadDossierPdf =
    coverReadyForDossier && letterReadyForDossier && cvReadyForDossier;
  const dossierPdfHint = !coverReadyForDossier
    ? cvReadyForDossier
      ? "Zuerst das Titelblatt bearbeiten."
      : "Zuerst Titelblatt und Lebenslauf bearbeiten."
    : !cvReadyForDossier
      ? "Zuerst den Lebenslauf bearbeiten."
      : !letterHasStarted(data)
        ? "Zuerst das Motivationsschreiben bearbeiten."
        : letterPagination.issue
          ? letterPagination.issue.message
          : "Motivationsschreiben wird noch vorbereitet.";

  const patch = (value: Partial<LetterData>) => setData((current) => ({ ...current, ...value }));

  const addLetterImage = async (file?: File) => {
    if (!file) return;
    try {
      const src = await readPhoto(file);
      const image: LetterFlowImage = {
        id: `letter-image-${Date.now()}`,
        src,
        side: "right",
        topMm: 8,
        widthMm: 34,
        gapMm: 4,
      };
      setData((current) => ({ ...current, images: [...(current.images ?? []), image] }));
    } catch {
      setTransferNote({ kind: "error", text: "Foto oder Bild konnte nicht gelesen werden." });
    }
  };

  const patchLetterImage = (id: string, imagePatch: Partial<LetterFlowImage>) =>
    setData((current) => ({
      ...current,
      images: (current.images ?? []).map((image) =>
        image.id === id ? { ...image, ...imagePatch } : image,
      ),
    }));

  const removeLetterImage = (id: string) =>
    setData((current) => ({
      ...current,
      images: (current.images ?? []).filter((image) => image.id !== id),
    }));

  const toggle = (key: string) => setOpen((current) => ({ ...current, [key]: !current[key] }));

  const changeTemplate = (next: LetterTemplateId) => {
    setDesign((current) => ({
      ...current,
      template: next,
      colors: defaultLetterColors(next),
    }));
  };
  useTemplateQaTemplateSwitch(design.template, changeTemplate, "letter");

  const downloadMotivationLetter = async () => {
    if (
      pdfDownloading ||
      !letterPagination.ready ||
      letterPagination.issue ||
      !letterHasStarted(data)
    )
      return;
    setPdfError(null);
    setPdfDownloading(true);
    try {
      const root = document.querySelector<HTMLElement>(
        "[data-letter-standalone-export] [data-letter-document-root]",
      );
      if (!root) throw new Error("Exportansicht ist noch nicht bereit");
      const namePart = data.absenderName
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9ÄÖÜäöüß_-]/g, "");
      await downloadLetterPdf(root, `Motivationsschreiben-${namePart || "Bewerbung"}.pdf`, {
        title: data.betreff || "Motivationsschreiben",
        author: data.absenderName.trim(),
        subject: "Motivationsschreiben",
        keywords: "Bewerbung, Motivationsschreiben, Lehrstelle",
      });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "PDF konnte nicht erstellt werden.");
    } finally {
      setPdfDownloading(false);
    }
  };

  const downloadWholeDossier = async () => {
    if (!dossierExportRef.current || !canDownloadDossierPdf || pdfDownloading) return;
    setMenuOpen(false);
    setPdfError(null);
    setPdfDownloading(true);
    const name = data.absenderName.trim();
    try {
      await downloadCombinedDossierPdf(
        dossierExportRef.current,
        `Bewerbungsdossier-${name || "Bewerbung"}.pdf`,
        {
          title: name ? `Bewerbungsdossier – ${name}` : "Bewerbungsdossier",
          author: name,
        },
      );
      setTransferNote({ kind: "ok", text: "Ganzes Dossier als PDF heruntergeladen" });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Dossier-PDF konnte nicht erstellt werden.");
    } finally {
      setPdfDownloading(false);
    }
  };

  const downloadDossierProject = () => {
    setMenuOpen(false);
    const project = createDossierProject({
      cover: readStoredDossierPart(COVER_STORAGE_KEY),
      letter: snapshotPayload() as unknown as Record<string, unknown>,
      cv: readStoredDossierPart(CV_STORAGE_KEY),
    });
    downloadBlob(
      new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
      `Bewerbungsdossier-${data.absenderName.trim() || "Bewerbung"}.json`,
    );
    setTransferNote({ kind: "ok", text: "Dossier als JSON gespeichert" });
  };

  const importDossierProject = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () =>
      setTransferNote({ kind: "error", text: "Dossier-Datei konnte nicht gelesen werden." });
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const project = parseDossierProject(parsed);
        if (!project) throw new Error("Keine gültige Dossier-Datei.");
        keepSnapshot("Vor dem Laden", true);
        const loaded = storeDossierProject(project);
        if (loaded.letter && project.letter) {
          const saved = project.letter as Partial<SavedLetter>;
          if (saved.data && typeof saved.data === "object") {
            setData({ ...EMPTY_LETTER, ...saved.data });
          }
          if (saved.design) setDesign(normalizeLetterDesign(saved.design));
          const raw = window.localStorage.getItem(LETTER_STORAGE_KEY);
          if (raw) markWritten(raw);
        }
        refreshSource();
        setSaveState("saved");
        setMenuOpen(false);
        setTransferNote({
          kind: "ok",
          text: loaded.letter
            ? "Dossier geladen"
            : "Dossier geladen – Motivationsschreiben war in der Datei nicht enthalten.",
        });
      } catch (error) {
        setTransferNote({
          kind: "error",
          text: error instanceof Error ? error.message : "Dossier konnte nicht geladen werden.",
        });
      }
    };
    reader.readAsText(file);
  };

  const syncAllFromDossier = () => {
    const dossier = refreshSource();
    if (!dossierHasMeaningfulSource(dossier)) {
      setTransferNote({
        kind: "error",
        text: "Im Titelblatt oder Lebenslauf sind noch keine übernehmbaren Angaben gespeichert.",
      });
      return;
    }

    const done: string[] = [];
    if (dossier.hasPersonal) {
      setData((current) => mergeNonEmptyLetterData(current, dossier.personalData));
      done.push(
        `persönliche Angaben${dossier.personalSource ? ` aus ${dossier.personalSource}` : ""}`,
      );
    }
    if (dossier.hasApplication) {
      setData((current) => mergeNonEmptyLetterData(current, dossier.applicationData));
      done.push("Betriebsdaten aus Titelblatt");
    }
    if (dossier.design) {
      setDesign((current) => ({ ...current, ...dossier.design! }));
      done.push(`Design${dossier.designSource ? ` aus ${dossier.designSource}` : ""}`);
    }

    setTransferNote({
      kind: "ok",
      text: `Aus dem Dossier übernommen: ${done.join(", ")}. Dein Brieftext bleibt erhalten.`,
    });
  };

  const syncFromDossier = () => {
    const dossier = refreshSource();
    const done: string[] = [];

    if (takeover.personal && dossier.hasPersonal) {
      setData((current) => mergeNonEmptyLetterData(current, dossier.personalData));
      done.push("persönliche Angaben");
    }
    if (takeover.application && dossier.hasApplication) {
      setData((current) => mergeNonEmptyLetterData(current, dossier.applicationData));
      done.push("Betriebsdaten");
    }
    if (takeover.design && dossier.design) {
      setDesign((current) => ({ ...current, ...dossier.design! }));
      done.push("Design");
    }

    setTransferNote(
      done.length
        ? { kind: "ok", text: `Übernommen: ${done.join(", ")}. Dein Brieftext bleibt erhalten.` }
        : {
            kind: "error",
            text: "Für die Auswahl gibt es noch keine gespeicherten Angaben im Dossier.",
          },
    );
  };

  const loadDemo = () => {
    keepSnapshot("Vor den Beispieldaten", true);
    setData({
      ...DEMO_LETTER,
      beilagen: [...(DEMO_LETTER.beilagen ?? DEFAULT_LETTER_BEILAGEN)],
    });
    setMenuOpen(false);
    setConfirmDemo(false);
    setTransferNote({ kind: "ok", text: "Beispieldaten eingefügt" });
  };

  const resetLetter = () => {
    keepSnapshot("Vor dem Zurücksetzen", true);
    setData({
      ...EMPTY_LETTER,
      images: [],
      beilagen: [...DEFAULT_LETTER_BEILAGEN],
    });
    setDesign(emptyLetterDesign());
    setPdfError(null);
    setHistoryOpen(false);
    setConfirmDemo(false);
    setConfirmWipe(false);
    setMenuOpen(false);
    setTransferNote({
      kind: "ok",
      text: "Motivationsschreiben zurückgesetzt – frühere Stände im Menü oben rechts.",
    });
  };

  const restoreSnapshot = (snap: Snapshot) => {
    keepSnapshot("Vor dem Zurückholen", true);
    const saved = snap.payload as Partial<SavedLetter>;
    if (saved.data && typeof saved.data === "object") {
      setData({ ...EMPTY_LETTER, ...saved.data });
    }
    if (saved.design) setDesign(normalizeLetterDesign(saved.design));
    if (saved.chrome) applyPortableDossierChromeState(saved.chrome);
    setMenuOpen(false);
    setHistoryOpen(false);
    setTransferNote({
      kind: "ok",
      text: `Stand von ${formatWhen(snap.at)} geladen.`,
    });
  };

  const anySource = dossierHasMeaningfulSource(source);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <Link
          to="/"
          aria-label="Übersicht"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 py-2 text-sm font-medium hover:bg-accent sm:px-3"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M2.5 7.2 8 2.8l5.5 4.4v5.5a.8.8 0 0 1-.8.8H9.8V9.6H6.2v3.9H3.3a.8.8 0 0 1-.8-.8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">Übersicht</span>
        </Link>
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          className="rounded-md border px-2.5 py-1.5 text-xs font-medium md:hidden"
          aria-pressed={panelOpen}
        >
          Formular
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">Motivationsschreiben</h1>
        </div>
        <SaveStatus state={saveState} />
        <ThemeToggle />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            disabled={pdfDownloading}
            aria-expanded={menuOpen}
            data-editor-ready={hydrated ? "true" : "false"}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 sm:px-4"
          >
            {pdfDownloading ? "PDF…" : "Download"}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M3 4.5l3 3 3-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {menuOpen ? (
            <div
              data-editor-action-menu
              className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-md border bg-popover shadow-lg"
            >
              <button
                type="button"
                onClick={() => void downloadWholeDossier()}
                disabled={!canDownloadDossierPdf}
                title={canDownloadDossierPdf ? "Titelblatt, Motivationsschreiben und alle CV-Seiten gemeinsam herunterladen" : dossierPdfHint}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
              >
                <EditorMenuLabel icon={Files}>Ganzes Dossier als PDF</EditorMenuLabel>
                <span className="text-xs text-muted-foreground">
                  Titelblatt + Motivationsschreiben + CV
                </span>
              </button>
              {!canDownloadDossierPdf ? (
                <p className="border-t bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {dossierPdfHint}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void downloadMotivationLetter();
                }}
                disabled={
                  !letterPagination.ready || !!letterPagination.issue || !letterHasStarted(data)
                }
                className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
              >
                <EditorMenuLabel icon={FileDown}>Nur Motivationsschreiben als PDF</EditorMenuLabel>
                <span className="text-xs text-muted-foreground">.pdf</span>
              </button>
              <button
                type="button"
                onClick={downloadDossierProject}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <EditorMenuLabel icon={Save}>Dossier speichern</EditorMenuLabel>
                <span className="text-xs text-muted-foreground">
                  Titelblatt + Motivationsschreiben + CV
                </span>
              </button>
              <label className="flex cursor-pointer items-center justify-between border-t px-3 py-2 text-left text-sm hover:bg-accent">
                <EditorMenuLabel icon={FolderOpen}>Dossier laden</EditorMenuLabel>
                <span className="text-xs text-muted-foreground">.json</span>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    importDossierProject(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {confirmDemo ? (
                <div className="flex items-center gap-1 border-t bg-accent/40 px-3 py-2">
                  <span className="mr-auto text-xs font-medium">Beispieldaten übernehmen?</span>
                  <button
                    type="button"
                    onClick={loadDemo}
                    className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Ja
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDemo(false)}
                    className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent"
                  >
                    Nein
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDemo(true);
                    setConfirmWipe(false);
                  }}
                  className="flex w-full items-center border-t px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <EditorMenuLabel icon={Sparkles}>Beispieldaten übernehmen</EditorMenuLabel>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setHistoryOpen((value) => !value);
                  setConfirmWipe(false);
                }}
                disabled={history.length === 0}
                className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
              >
                <EditorMenuLabel icon={History}>Früheren Stand laden</EditorMenuLabel>
                <span className="text-xs text-muted-foreground">{history.length}</span>
              </button>
              {historyOpen && history.length > 0 ? (
                <div className="max-h-56 overflow-y-auto border-t bg-muted/20 p-1">
                  {history.slice(0, 8).map((snap) => (
                    <button
                      key={snap.id}
                      type="button"
                      data-letter-history-item
                      onClick={() => restoreSnapshot(snap)}
                      className="flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-xs hover:bg-accent"
                    >
                      <span className="truncate font-medium">{snap.label}</span>
                      <span className="shrink-0 text-muted-foreground">{formatWhen(snap.at)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {confirmWipe ? (
                <div className="flex items-center gap-1 border-t bg-destructive/5 px-3 py-2">
                  <span className="mr-auto text-xs font-medium text-destructive">
                    Motivationsschreiben wirklich zurücksetzen?
                  </span>
                  <button
                    type="button"
                    onClick={resetLetter}
                    className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                  >
                    Ja
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(false)}
                    className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmWipe(true);
                    setConfirmDemo(false);
                    setHistoryOpen(false);
                  }}
                  className="flex w-full items-center border-t px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <EditorMenuLabel icon={RotateCcw}>
                    Motivationsschreiben zurücksetzen
                  </EditorMenuLabel>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <ResizableEditorPanel open={panelOpen}>
          <div className="flex flex-col gap-3 p-3 pb-12 sm:p-4">
            <div className="rounded-lg border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
              Schreibe dein Motivationsschreiben hier. Das Layout bleibt bewusst ruhiger als beim
              Lebenslauf, damit längerer Text gut lesbar bleibt.
            </div>

            {letterPagination.issue ? (
              <div
                role="alert"
                data-letter-pagination-issue={letterPagination.issue.code}
                className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <div className="font-semibold">Inhalt kann nicht sicher umbrochen werden</div>
                <div>{letterPagination.issue.message}</div>
              </div>
            ) : null}

            {pdfError ? (
              <div
                role="status"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                {pdfError}
              </div>
            ) : null}

            <Section
              title="Vom Dossier übernehmen"
              open={open.uebernehmen}
              onToggle={() => toggle("uebernehmen")}
              hint={anySource ? "bereit" : "nichts verfügbar"}
            >
              <div className="grid gap-3 rounded-md border border-dashed p-2.5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Das Dossier nimmt persönliche Angaben bevorzugt vom Titelblatt, sonst aus dem
                  Lebenslauf. Betriebsdaten kommen vom Titelblatt; Design vom Titelblatt, sonst aus
                  dem Lebenslauf. Dein Brieftext wird nie überschrieben.
                </p>

                <button
                  type="button"
                  onClick={syncAllFromDossier}
                  disabled={!anySource}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Alles übernehmen
                </button>

                <div className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>
                    Persönliche Angaben: {source?.personalSource ?? "noch nicht verfügbar"}
                  </span>
                  <span>
                    Betrieb und Bewerbung: {source?.applicationSource ?? "noch nicht verfügbar"}
                  </span>
                  <span>Design: {source?.designSource ?? "noch nicht verfügbar"}</span>
                </div>

                <details className="rounded-md border bg-background">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium">
                    Auswahl anpassen
                  </summary>
                  <div className="grid gap-2.5 border-t p-3">
                    <label className="flex items-start gap-2 rounded-md border p-2.5 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={takeover.personal}
                        disabled={!source?.hasPersonal}
                        onChange={(event) =>
                          setTakeover((current) => ({
                            ...current,
                            personal: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block font-medium">Persönliche Angaben</span>
                        <span className="text-muted-foreground">
                          Name, Adresse und Kontakt
                          {source?.personalSource
                            ? ` · aus ${source.personalSource}`
                            : " · noch leer"}
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-2 rounded-md border p-2.5 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={takeover.application}
                        disabled={!source?.hasApplication}
                        onChange={(event) =>
                          setTakeover((current) => ({
                            ...current,
                            application: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block font-medium">Betrieb und Bewerbung</span>
                        <span className="text-muted-foreground">
                          Empfänger, Ort, Datum und Betreff
                          {source?.applicationSource
                            ? ` · aus ${source.applicationSource}`
                            : " · noch leer"}
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-2 rounded-md border p-2.5 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={takeover.design}
                        disabled={!source?.hasDesign}
                        onChange={(event) =>
                          setTakeover((current) => ({ ...current, design: event.target.checked }))
                        }
                      />
                      <span>
                        <span className="block font-medium">Design</span>
                        <span className="text-muted-foreground">
                          Vorlage, Farben und Schrift
                          {source?.designSource ? ` · aus ${source.designSource}` : " · noch leer"}
                        </span>
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={syncFromDossier}
                      disabled={!anySource}
                      className="mt-1 rounded-md border border-input px-3 py-2 text-xs font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Auswahl übernehmen
                    </button>
                  </div>
                </details>

                {transferNote && (
                  <div
                    role="status"
                    className={`rounded-md border px-3 py-2 text-xs ${
                      transferNote.kind === "error"
                        ? "border-destructive/40 text-destructive"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {transferNote.text}
                  </div>
                )}
              </div>
            </Section>

            <Section title="Briefinhalt" open={open.brief} onToggle={() => toggle("brief")}>
              <div className="grid gap-3">
                <div
                  data-letter-context-font-sizes="brief"
                  className="grid gap-2 rounded-md border bg-muted/20 p-2.5"
                >
                  <div>
                    <div className="text-xs font-semibold">Typografie</div>
                    <div className="text-[11px] text-muted-foreground">
                      Schriftart und Grösse lassen sich für jede Textrolle separat einstellen.
                    </div>
                  </div>
                  <LetterFontSizeControl
                    label="Ort & Datum"
                    value={design.dateFontSizePt}
                    font={design.dateFont}
                    fallbackSize={9.5}
                    onChange={(dateFontSizePt) =>
                      setDesign((current) => ({ ...current, dateFontSizePt }))
                    }
                    onFontChange={(dateFont) =>
                      setDesign((current) => ({ ...current, dateFont }))
                    }
                  />
                  <LetterFontSizeControl
                    label="Titel / Betreff"
                    value={design.subjectTypography?.fontSizePt}
                    font={design.subjectTypography?.font}
                    fallbackSize={12}
                    onChange={(fontSizePt) =>
                      setDesign((current) => ({
                        ...current,
                        subjectTypography: withLetterRoleFontSize(
                          current.subjectTypography,
                          fontSizePt,
                        ),
                      }))
                    }
                    onFontChange={(font) =>
                      setDesign((current) => ({
                        ...current,
                        subjectTypography: withLetterRoleFont(current.subjectTypography, font),
                      }))
                    }
                  />
                  <LetterFontSizeControl
                    label="Anrede"
                    value={design.salutationFontSizePt}
                    font={design.salutationFont}
                    fallbackSize={10.5}
                    onChange={(salutationFontSizePt) =>
                      setDesign((current) => ({ ...current, salutationFontSizePt }))
                    }
                    onFontChange={(salutationFont) =>
                      setDesign((current) => ({ ...current, salutationFont }))
                    }
                  />
                  <LetterFontSizeControl
                    label="Fliesstext"
                    value={design.bodyFontSizePt}
                    font={design.bodyFont}
                    fallbackSize={10.5}
                    onChange={(bodyFontSizePt) =>
                      setDesign((current) => ({ ...current, bodyFontSizePt }))
                    }
                    onFontChange={(bodyFont) =>
                      setDesign((current) => ({ ...current, bodyFont }))
                    }
                  />
                  <LetterFontSizeControl
                    label="Grussformel"
                    value={design.closingFontSizePt}
                    font={design.closingFont}
                    fallbackSize={10.5}
                    onChange={(closingFontSizePt) =>
                      setDesign((current) => ({ ...current, closingFontSizePt }))
                    }
                    onFontChange={(closingFont) =>
                      setDesign((current) => ({ ...current, closingFont }))
                    }
                  />
                  <LetterFontSizeControl
                    label="Unterschrift / Name"
                    value={design.signatureFontSizePt}
                    font={design.signatureFont}
                    fallbackSize={10.5}
                    onChange={(signatureFontSizePt) =>
                      setDesign((current) => ({ ...current, signatureFontSizePt }))
                    }
                    onFontChange={(signatureFont) =>
                      setDesign((current) => ({ ...current, signatureFont }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Ort" value={data.ort} onChange={(value) => patch({ ort: value })} />
                  <Field
                    label="Datum"
                    value={data.datum}
                    onChange={(value) => patch({ datum: value })}
                    placeholder="25.08.2026"
                  />
                </div>
                <Field
                  label="Titel / Betreff"
                  value={data.betreff}
                  onChange={(value) => patch({ betreff: value })}
                  placeholder="Bewerbung um eine Lehrstelle als …"
                />
                <Field
                  label="Anrede"
                  value={data.anrede}
                  onChange={(value) => patch({ anrede: value })}
                />
                <LetterRichTextEditor
                  text={data.text}
                  richTextHtml={data.richTextHtml}
                  onChange={({ text, richTextHtml }) => patch({ text, richTextHtml })}
                />
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2.5">
                  <label className="cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent">
                    + Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        void addLetterImage(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    Bild frei verschieben und proportional skalieren. Der Text weicht automatisch
                    aus.
                  </span>
                </div>
                <Field
                  label="Grussformel"
                  value={data.gruss}
                  onChange={(value) => patch({ gruss: value })}
                />
                <Field
                  label="Name unter der Unterschrift"
                  value={data.unterschrift}
                  onChange={(value) => patch({ unterschrift: value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <MillimeterField
                    label="Abstand vor Gruss"
                    value={data.grussAbstandMm}
                    fallback={DEFAULT_LETTER_CLOSING_GAP_MM}
                    onChange={(value) => patch({ grussAbstandMm: value })}
                  />
                  <MillimeterField
                    label="Platz für Unterschrift"
                    value={data.unterschriftAbstandMm}
                    fallback={DEFAULT_LETTER_SIGNATURE_GAP_MM}
                    onChange={(value) => patch({ unterschriftAbstandMm: value })}
                  />
                </div>
              </div>
            </Section>

            <Section
              title="Meine Kontaktdaten"
              open={open.absender}
              onToggle={() => toggle("absender")}
            >
              <div className="grid gap-3">
                <LetterFontSizeControl
                  label="Kontaktdaten"
                  value={
                    chromeOptions.headerMode === "contact"
                      ? (chromeOptions.headerFontSizePt ?? undefined)
                      : design.senderTypography?.fontSizePt
                  }
                  font={design.senderTypography?.font}
                  fallbackSize={chromeOptions.headerMode === "contact" ? 14 : 9.5}
                  min={chromeOptions.headerMode === "contact" ? 6 : undefined}
                  max={chromeOptions.headerMode === "contact" ? 30 : undefined}
                  hint={
                    chromeOptions.headerMode === "contact"
                      ? chromeState.sync
                        ? "Kontakt-Header · mit CV synchron"
                        : "Kontakt-Header"
                      : undefined
                  }
                  onChange={(fontSizePt) => {
                    if (chromeOptions.headerMode === "contact") {
                      patchDossierChrome("letter", { headerFontSizePt: fontSizePt ?? null });
                      return;
                    }
                    setDesign((current) => ({
                      ...current,
                      senderTypography: withLetterRoleFontSize(
                        current.senderTypography,
                        fontSizePt,
                      ),
                    }));
                  }}
                  onFontChange={(font) =>
                    setDesign((current) => ({
                      ...current,
                      senderTypography: withLetterRoleFont(current.senderTypography, font),
                    }))
                  }
                />
                <Field
                  label="Vorname und Nachname"
                  value={data.absenderName}
                  onChange={(value) => patch({ absenderName: value })}
                />
                <Field
                  label="Adresse"
                  value={data.absenderAdresse}
                  onChange={(value) => patch({ absenderAdresse: value })}
                />
                <Field
                  label="PLZ und Ort"
                  value={data.absenderPlzOrt}
                  onChange={(value) => patch({ absenderPlzOrt: value })}
                />
                <Field
                  label="Telefon"
                  value={data.absenderTelefon}
                  onChange={(value) => patch({ absenderTelefon: value })}
                  type="tel"
                />
                <Field
                  label="E-Mail"
                  value={data.absenderEmail}
                  onChange={(value) => patch({ absenderEmail: value })}
                  type="email"
                />
              </div>
            </Section>

            <Section
              title="Firma / Lehrbetrieb"
              open={open.empfaenger}
              onToggle={() => toggle("empfaenger")}
            >
              <div className="grid gap-3">
                <LetterFontSizeControl
                  label="Empfängeranschrift"
                  value={design.recipientTypography?.fontSizePt}
                  font={design.recipientTypography?.font}
                  fallbackSize={10}
                  onChange={(fontSizePt) =>
                    setDesign((current) => ({
                      ...current,
                      recipientTypography: withLetterRoleFontSize(
                        current.recipientTypography,
                        fontSizePt,
                      ),
                    }))
                  }
                  onFontChange={(font) =>
                    setDesign((current) => ({
                      ...current,
                      recipientTypography: withLetterRoleFont(current.recipientTypography, font),
                    }))
                  }
                />
                <Field
                  label="Lehrbetrieb"
                  value={data.empfaengerFirma}
                  onChange={(value) => patch({ empfaengerFirma: value })}
                />
                <Field
                  label="Ansprechperson"
                  value={data.empfaengerName}
                  onChange={(value) => patch({ empfaengerName: value })}
                  placeholder="z. B. Frau Anna Muster"
                />
                <Field
                  label="Adresse"
                  value={data.empfaengerAdresse}
                  onChange={(value) => patch({ empfaengerAdresse: value })}
                />
                <Field
                  label="PLZ und Ort"
                  value={data.empfaengerPlzOrt}
                  onChange={(value) => patch({ empfaengerPlzOrt: value })}
                />
              </div>
            </Section>

            <Section
              title="Beilagen"
              open={open.beilagen}
              onToggle={() => toggle("beilagen")}
              hint={data.showBeilagen !== false ? "angezeigt" : "ausgeblendet"}
            >
              <div className="flex flex-col gap-3">
                <LetterFontSizeControl
                  label="Beilagen"
                  value={
                    chromeOptions.footerMode === "details"
                      ? (chromeOptions.footerFontSizePt ?? undefined)
                      : design.attachmentsFontSizePt
                  }
                  font={design.attachmentsFont}
                  fallbackSize={chromeOptions.footerMode === "details" ? 8.5 : 10}
                  min={chromeOptions.footerMode === "details" ? 6 : undefined}
                  max={chromeOptions.footerMode === "details" ? 30 : undefined}
                  hint={
                    chromeOptions.footerMode === "details"
                      ? chromeState.sync
                        ? "Beilagen im Footer · mit CV synchron"
                        : "Beilagen im Footer"
                      : undefined
                  }
                  onChange={(fontSizePt) => {
                    if (chromeOptions.footerMode === "details") {
                      patchDossierChrome("letter", { footerFontSizePt: fontSizePt ?? null });
                      return;
                    }
                    setDesign((current) => ({
                      ...current,
                      attachmentsFontSizePt: fontSizePt,
                    }));
                  }}
                  onFontChange={(attachmentsFont) =>
                    setDesign((current) => ({ ...current, attachmentsFont }))
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.showBeilagen !== false}
                    onChange={(event) => patch({ showBeilagen: event.target.checked })}
                  />
                  <span>Im Motivationsschreiben anzeigen</span>
                </label>
                <AttachmentListEditor
                  values={letterAttachmentValues(data)}
                  onChange={(beilagen) => patch({ beilagen })}
                />
              </div>
            </Section>

            <Section title="Vorlage" open={open.vorlage} onToggle={() => toggle("vorlage")}>
              <LetterTemplatePicker
                value={design.template}
                onChange={changeTemplate}
                motifOpacity={design.bgOpacity}
                onMotifOpacityChange={(bgOpacity) =>
                  setDesign((current) => ({ ...current, bgOpacity }))
                }
              />
            </Section>

            <Section title="Header & Footer" open={open.chrome} onToggle={() => toggle("chrome")}>
              <DossierChromeControls
                scope="letter"
                onOptionsChange={(patch) =>
                  setDesign((current) => ({ ...current, ...legacyLetterChromePatch(patch) }))
                }
              />
              <DossierChromeDocumentContentControls
                value={design.chromeContent}
                defaultTitle="Motivationsschreiben"
                onChange={(chromeContent) =>
                  setDesign((current) => ({ ...current, chromeContent }))
                }
              />
            </Section>

            <Section title="Layout" open={open.layout} onToggle={() => toggle("layout")}>
              <LetterLayoutControls
                data={data}
                design={design}
                onChange={(value) => setDesign((current) => ({ ...current, ...value }))}
              />
            </Section>

            <Section title="Farben" open={open.farben} onToggle={() => toggle("farben")}>
              <div className="grid gap-4">
                <div
                  data-letter-paper-color-control
                  className="grid gap-2 rounded-md border border-input p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex min-w-0 items-center gap-2 text-xs font-medium">
                      <input
                        type="color"
                        aria-label="Seitenhintergrund des Anschreibens"
                        value={resolveLetterPaperColor(design)}
                        onChange={(event) =>
                          setDesign((current) => ({
                            ...current,
                            paperColor: event.target.value,
                          }))
                        }
                        className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <span>Seitenhintergrund</span>
                    </label>
                    <button
                      type="button"
                      disabled={!design.paperColor}
                      onClick={() => setDesign((current) => ({ ...current, paperColor: null }))}
                      className="text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-default disabled:no-underline disabled:opacity-45"
                    >
                      Automatisch
                    </button>
                  </div>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    Gilt bei jeder Vorlage für das Papier des Anschreibens. Ohne eigene Textfarbe
                    passt sich die Schrift automatisch an.
                  </span>
                </div>

                <DocumentTextColorControl
                  ariaLabel="Textfarbe des Anschreibens"
                  value={resolveLetterPalette(design).ink}
                  customValue={design.textColor}
                  paperColor={resolveLetterPaperColor(design)}
                  description="Gilt für den normalen Text im Anschreiben. Datum und Gestaltungselemente behalten ihre eigene Farbe."
                  onChange={(textColor) => setDesign((current) => ({ ...current, textColor }))}
                  onAuto={() => setDesign((current) => ({ ...current, textColor: null }))}
                />

                {design.template !== "brief" && template ? (
                  <div className="border-t pt-4">
                    <ColorChooser
                      slots={template.slots}
                      colors={design.colors}
                      onChange={(key, value) =>
                        setDesign((current) => ({
                          ...current,
                          colors: { ...current.colors, [key]: value },
                        }))
                      }
                      onApplyPalette={(colors) => setDesign((current) => ({ ...current, colors }))}
                      onReset={() =>
                        setDesign((current) => ({
                          ...current,
                          colors: defaultLetterColors(current.template),
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>
            </Section>

          </div>
        </ResizableEditorPanel>

        <main className="min-w-0 flex-1 overflow-auto bg-muted/40 p-3 sm:p-6">
          <div className="mx-auto w-full max-w-[980px] py-2 sm:py-4">
            <LetterDocument
              data={data}
              design={design}
              chromeOptions={chromeOptions}
              chromeContact={chromeContact}
              onPaginationChange={setLetterPagination}
              onImageChange={patchLetterImage}
              onImageRemove={removeLetterImage}
              scaledPreview
            />
          </div>
        </main>

        <div
          data-letter-standalone-export
          className="pointer-events-none fixed left-[-10000px] top-0"
          aria-hidden="true"
        >
          <LetterDocument
            data={data}
            design={design}
            chromeOptions={chromeOptions}
            chromeContact={chromeContact}
            exportMode
            ariaLabel="Exportansicht Motivationsschreiben"
          />
        </div>

        {canDownloadDossierPdf ? (
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: "-20000px",
              top: 0,
              pointerEvents: "none",
              zIndex: -1,
            }}
          >
            <DossierPdfCanvas
              ref={dossierExportRef}
              cover={storedCoverDocument}
              letter={{ data, design }}
              cv={storedCvDocument}
              chromeState={chromeState}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}