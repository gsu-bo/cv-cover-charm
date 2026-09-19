import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/cover/ThemeToggle";
import {
  FileDown,
  Files,
  FolderOpen,
  History,
  MoveDiagonal2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { EditorMenuLabel } from "@/components/dossier/EditorMenuLabel";
import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";
import { DossierHyphenationControl } from "@/components/dossier/DossierHyphenationControl";
import { Section } from "@/components/cover/Section";
import { TemplatePicker } from "@/components/cover/TemplatePicker";
import { useTemplateQaTemplateSwitch } from "@/lib/template-qa-switch";
import { ColorChooser } from "@/components/cover/ColorChooser";
import { ScaledPreview } from "@/components/cover/ScaledPreview";
import { CvCanvas, type CvLayoutWarning } from "@/components/cv/CvCanvas";
import { ElementBar } from "@/components/cover/ElementBar";
import { AddElementMenu } from "@/components/cover/AddElementMenu";
import { DossierExportDialog } from "@/components/dossier/DossierExportDialog";
import { DossierPdfCanvas } from "@/components/dossier/DossierPdfCanvas";
import { ResizableEditorPanel } from "@/components/dossier/ResizableEditorPanel";
import {
  coverPdfDocumentFromSaved,
  coverPdfHasContent,
  cvPdfHasContent,
  type CoverPdfDocument,
  type CvPdfDocument,
} from "@/lib/dossier-pdf-document";
import { SaveStatus, type SaveState } from "@/components/dossier/SaveStatus";
import {
  newDrawnElement,
  newImageElement,
  newRuleElement,
  newShapeElement,
  newTextElement,
  type NewElement,
} from "@/components/cover/new-element";
import { buildCustomBlocks, type StyleOverrides } from "@/components/cover/layouts";
import {
  FormCvEntries,
  FormCvLines,
  FormCvPerson,
  FormCvReferenzen,
  FormCvSprachen,
  SectionLayoutControls,
  SectionOptions,
} from "@/components/cv/CvForm";
import {
  CV_SECTION_LABELS,
  CV_CUSTOM_SECTION_PRESETS,
  CV_DOC_TITLE_DEFAULTS,
  CV_DOC_TITLE_FONT_SIZE_MAX,
  CV_DOC_TITLE_FONT_SIZE_MIN,
  CV_DOC_TITLE_MARGIN_BOTTOM_MAX,
  CV_SECTION_TITLE_DEFAULTS,
  CV_SECTION_TITLE_FONT_SIZE_MAX,
  CV_SECTION_TITLE_FONT_SIZE_MIN,
  CV_SECTION_TITLE_MARGIN_BOTTOM_MAX,
  CV_SCALE_MAX,
  CV_SCALE_MIN,
  CV_TYPE_DEFAULTS,
  DEFAULT_CV_TITLE,
  DEMO_CV,
  customSectionKey,
  customSectionFromPreset,
  cvSectionLayout,
  cvSectionOrder,
  emptyCv,
  ensureFixedFamilySection,
  entryFilled,
  isCustomSectionKey,
  normalizeCvSectionLayout,
  type CvData,
  type CvCustomSectionPresetKey,
  type CvDesign,
  type CvLayoutSectionKey,
  type CvPerson,
  type CvPlacementKey,
  type CvSectionLayout,
  type CvSectionKey,
} from "@/components/cv/types";
import {
  coverDraftFingerprint,
  emptyCoverDraft,
  personFilled,
  readCoverDraft,
  type CoverDraft,
} from "@/lib/dossier";
import {
  customKind,
  FONT_LABELS,
  TEMPLATES,
  withoutBlockGeometry,
  type BlockStyle,
  type CustomField,
  type FontKey,
  type ShapeKind,
  type TemplateId,
} from "@/components/cover/types";
import { downloadBlob, safeFileName } from "@/lib/download";
import { downloadCombinedDossierPdf } from "@/lib/dossier-pdf";
import { registerCabinPdfFonts } from "@/lib/pdf-fonts";
import { readDossierContact } from "@/lib/dossier-contact";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  createDossierProject,
  parseDossierProject,
  readStoredDossierPart,
  storeDossierProject,
} from "@/lib/dossier-project";
import { DEFAULTS, PDF, PREVIEW, SHAPE } from "@/default-config";
import {
  describe,
  formatWhen,
  HISTORY_KEYS,
  pushSnapshot,
  readHistory,
  type Snapshot,
} from "@/lib/history";
import { readPhoto } from "@/lib/image";
import { useForeignWrite, usePageVisible } from "@/lib/autosave";
import { applyDossierTheme } from "@/lib/dossier-theme";
import { setCvPhotoStyle } from "@/components/cv/photo";
import {
  normalizeCvPaperColor,
  resolveCvPalette,
  resolveCvPaperColor,
} from "@/components/cv/cv-paper";
import { DocumentTextColorControl } from "@/components/dossier/DocumentTextColorControl";
import { SIDEBAR_PCT_MAX, SIDEBAR_PCT_MIN } from "@/components/cv/archetype";
import {
  DEFAULT_DOSSIER_CHROME_STATE,
  getDossierChromeState,
  subscribeDossierChrome,
} from "@/lib/dossier-chrome";

export const Route = createFileRoute("/lebenslauf")({
  head: () => ({
    meta: [
      { title: "Lebenslauf für die Lehrstellenbewerbung" },
      {
        name: "description",
        content:
          "Lebenslauf für deine Lehrstellenbewerbung – im gleichen Design wie dein Titelblatt, als PDF zum Herunterladen.",
      },
    ],
  }),
  component: Lebenslauf,
});

const STORAGE_KEY = CV_STORAGE_KEY;
const SAVE_VERSION = 6;
const DESIGN_MIGRATION_VERSION = 5;

/**
 * Vorgabe: 75 % Transparenz.
 *
 * Der Regler steuert nur noch die Zierde – Spalte, Band und Kartengrund einer
 * Bauform bleiben unabhängig davon voll deckend. Darum darf die Zierde wieder
 * sichtbar sein. Der frühere Wert von 6 % stammt aus der Zeit, als der
 * Hintergrund die Vorlage allein tragen musste und dabei unsichtbar wurde.
 */
const DEFAULT_BG_OPACITY = 0.25;
const LEGACY_DEFAULT_BG_OPACITIES = [0.06, 0.12];

function defaultColors(template: TemplateId): Record<string, string> {
  const t =
    TEMPLATES.find((x) => x.id === template) ?? TEMPLATES.find((x) => x.id === DEFAULTS.TEMPLATE)!;
  return Object.fromEntries(t.slots.map((s) => [s.key, s.default]));
}

type Saved = {
  version: number;
  data: CvData;
  design: CvDesign;
  elements: CustomField[];
  /**
   * Abweichungen vom Vorgabestil je eigenem Element.
   *
   * Das Titelblatt führt eine solche Ablage je Vorlage, weil dort jede Vorlage
   * ein anderes Raster hat. Der Lebenslauf hat nur eines, darum reicht hier
   * eine einzige.
   */
  elementStyles?: StyleOverrides;
  /** Titelblatt-Stand der letzten bewussten Übernahme. */
  coverFingerprint?: string | null;
};

/**
 * Alte Entwürfe trugen noch den deutlich kräftigeren damaligen Standardwert.
 * Nur diese bekannten Defaults werden migriert; bewusst gewählte Werte bleiben erhalten.
 */
function migratedDesign(current: CvDesign, incoming: CvDesign, version?: number): CvDesign {
  const merged = { ...current, ...incoming };
  merged.paperColor = normalizeCvPaperColor(incoming.paperColor);
  if (!merged.font || !(merged.font in FONT_LABELS)) delete merged.font;
  const isOldSave = (version ?? 1) < DESIGN_MIGRATION_VERSION;
  const usedOldDefault = LEGACY_DEFAULT_BG_OPACITIES.some(
    (value) => Math.abs(merged.bgOpacity - value) < 0.001,
  );
  if (isOldSave && usedOldDefault) merged.bgOpacity = DEFAULT_BG_OPACITY;
  return merged;
}

/** Trägt der Lebenslauf überhaupt Inhalt? Leere Stände sind nichts wert. */
function cvHasContent(d: CvData): boolean {
  if (!d) return false;
  const p = d.person ?? {};
  if (p.vorname?.trim() || p.nachname?.trim() || p.untertitel?.trim()) return true;
  return !!(
    d.schule?.length ||
    d.erfahrung?.length ||
    d.sprachen?.length ||
    d.hobbys?.length ||
    d.staerken?.length ||
    d.referenzen?.length ||
    d.customSections?.some((section) => section.entries.some((entry) => entryFilled(entry)))
  );
}

/**
 * Im schmalen Rubriken-Formular bleibt nur die Kurzform sichtbar. Der native
 * Auswahldialog verwendet trotzdem die verständlichen, ausgeschriebenen Namen.
 */
function CompactPageSelect({
  page,
  label,
  onChange,
}: {
  page: 1 | 2;
  label: string;
  onChange: (page: 1 | 2) => void;
}) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center rounded border border-input bg-background px-1.5 py-1 text-[11px] focus-within:ring-2 focus-within:ring-ring"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span aria-hidden="true">S. {page} ▾</span>
      <select
        value={page}
        onChange={(event) => onChange(Number(event.target.value) === 2 ? 2 : 1)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={`${label}: Seite`}
      >
        <option value={1}>Seite 1</option>
        <option value={2}>Seite 2</option>
      </select>
    </span>
  );
}

function Lebenslauf() {
  const chromeState = useSyncExternalStore(
    subscribeDossierChrome,
    getDossierChromeState,
    () => DEFAULT_DOSSIER_CHROME_STATE,
  );
  const chromeOptions = chromeState.sync ? chromeState.shared : chromeState.cv;
  const [data, setData] = useState<CvData>(emptyCv);
  const [design, setDesign] = useState<CvDesign>(() => {
    const d = emptyCoverDraft();
    return {
      template: d.template,
      colors: d.colors,
      paperColor: null,
      font: "freundlich",
      bgOpacity: DEFAULT_BG_OPACITY,
      useElements: false,
    };
  });
  useTemplateQaTemplateSwitch(
    design.template,
    (template) =>
      setDesign((current) => ({ ...current, template, colors: defaultColors(template) })),
    "cv",
  );
  const [elements, setElements] = useState<CustomField[]>([]);
  const [elementStyles, setElementStyles] = useState<StyleOverrides>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<CvLayoutSectionKey | null>(null);
  const [draggedSection, setDraggedSection] = useState<CvLayoutSectionKey | null>(null);
  const [layoutWarnings, setLayoutWarnings] = useState<CvLayoutWarning[]>([]);
  const [dossierWarnings, setDossierWarnings] = useState<CvLayoutWarning[] | null>(null);
  const [dossierCvPageCount, setDossierCvPageCount] = useState(0);
  const [dossierReviewOpen, setDossierReviewOpen] = useState(false);
  const [lastCoverFingerprint, setLastCoverFingerprint] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [cover, setCover] = useState<CoverDraft | null>(null);
  const [storedCoverDocument, setStoredCoverDocument] = useState<CoverPdfDocument | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [zoom, setZoom] = useState<number>(PREVIEW.ZOOM_DEFAULT);
  const [downloading, setDownloading] = useState(false);
  const [fitHeight, setFitHeight] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<{
    kind: "ok" | "error";
    text: string;
    /** Rücknahme, z. B. nach dem Löschen eines Elements. */
    undo?: () => void;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [open, setOpen] = useState<Record<string, boolean>>({
    uebernehmen: true,
    vorlage: false,
    chrome: false,
    farben: false,
    typo: false,
    rubriken: false,
    person: true,
    schule: false,
    erfahrung: false,
    sprachen: false,
    hobbys: false,
    staerken: false,
    referenzen: false,
  });

  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Zweiter Klick bestätigt "Alles zurücksetzen" – sonst wäre alles weg. */
  const [confirmWipe, setConfirmWipe] = useState(false);
  /** Beispieldaten überschreiben den aktuellen Inhalt und brauchen eine Rückfrage. */
  const [confirmDemo, setConfirmDemo] = useState(false);

  const visible = usePageVisible();
  const { markWritten, changedElsewhere } = useForeignWrite(STORAGE_KEY);

  const exportRef = useRef<HTMLDivElement>(null);
  const dossierExportRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  /** Einen gespeicherten oder importierten Lebenslauf übernehmen. */
  const applySaved = useCallback((p: Partial<Saved>) => {
    if (p.data)
      setData(
        ensureFixedFamilySection({
          ...emptyCv,
          ...p.data,
          person: { ...emptyCv.person, ...p.data.person },
        }),
      );
    if (p.design) setDesign((d) => migratedDesign(d, p.design!, p.version));
    if (Array.isArray(p.elements)) setElements(p.elements);
    if (p.elementStyles) setElementStyles(p.elementStyles);
    setLastCoverFingerprint(
      typeof p.coverFingerprint === "string"
        ? p.coverFingerprint
        : coverDraftFingerprint(readCoverDraft()),
    );
  }, []);

  const chromeContact = chromeState.sync ? readDossierContact({ cv: data }) : undefined;

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const patchData = (p: Partial<CvData>) => setData((d) => ({ ...d, ...p }));
  const patchPerson = (p: Partial<CvPerson>) =>
    setData((d) => ({ ...d, person: { ...d.person, ...p } }));

  const activeTemplate = useMemo(
    () =>
      TEMPLATES.find((t) => t.id === design.template) ??
      TEMPLATES.find((t) => t.id === DEFAULTS.TEMPLATE)!,
    [design.template],
  );

  /* ---------------------------------------------------------------------- */
  /* Eigene Elemente – dieselbe Bedienung wie auf dem Titelblatt            */
  /* ---------------------------------------------------------------------- */

  const blocks = useMemo(() => {
    const built = buildCustomBlocks(design.template, elements, elementStyles, activeTemplate.slots);
    if (!design.font) return built;
    return built.map((block) =>
      elementStyles[block.id]?.font
        ? block
        : { ...block, style: { ...block.style, font: design.font as FontKey } },
    );
  }, [design.template, design.font, elements, elementStyles, activeTemplate]);
  const selectedBlock = blocks.find((b) => b.id === selected) ?? null;
  const selectedCustom = elements.find((c) => c.id === selected) ?? null;
  const currentCvDocument = useMemo<CvPdfDocument>(
    () => ({ data, design, elements, elementStyles, coverFingerprint: lastCoverFingerprint }),
    [data, design, elements, elementStyles, lastCoverFingerprint],
  );
  const coverReadyForDossier =
    !!storedCoverDocument && coverPdfHasContent(storedCoverDocument.data);
  const cvReadyForDossier = cvPdfHasContent(data);
  const canDownloadDossierPdf = coverReadyForDossier && cvReadyForDossier;
  const dossierPdfHint = !coverReadyForDossier
    ? cvReadyForDossier
      ? "Zuerst das Titelblatt bearbeiten."
      : "Zuerst Titelblatt und Lebenslauf bearbeiten."
    : "Zuerst den Lebenslauf bearbeiten.";

  const patchStyle = useCallback(
    (id: string, p: Partial<BlockStyle>) =>
      setElementStyles((s) => ({ ...s, [id]: { ...(s[id] ?? {}), ...p } })),
    [],
  );
  const patchCustom = (id: string, p: Partial<CustomField>) =>
    setElements((c) => c.map((f) => (f.id === id ? { ...f, ...p } : f)));

  /** Ein fertig gebautes Element einhängen: Inhalt speichern, Stil anlegen. */
  const place = ({ field, style }: NewElement) => {
    setElements((c) => [...c, field]);
    if (style) patchStyle(field.id, style);
    setDesign((d) => (d.useElements ? d : { ...d, useElements: true }));
    setSelected(field.id);
  };

  const addCustom = (shape?: ShapeKind, pill = false) => {
    if (shape === "path") {
      setDrawing(true);
      setSelected(null);
      setStatus({ kind: "ok", text: "Form aufs Blatt zeichnen – Esc bricht ab." });
      return;
    }
    place(
      shape
        ? newShapeElement(elements, shape)
        : newTextElement(
            elements,
            pill
              ? (activeTemplate.slots[activeTemplate.slots.length - 1]?.key ?? "accent")
              : undefined,
          ),
    );
  };

  const addImage = () => {
    place(newImageElement(elements));
    setStatus({ kind: "ok", text: "Bild-Element eingefügt – unten „Bild wählen“." });
  };

  const addRule = () => place(newRuleElement(elements));

  const pickImage = async (id: string, file: File | null) => {
    if (!file) {
      patchCustom(id, { src: null });
      return;
    }
    try {
      patchCustom(id, { src: await readPhoto(file) });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "Bild nicht lesbar" });
    }
  };

  const removeElement = (id: string) => {
    const gone = elements.find((c) => c.id === id);
    setSelected(null);
    setElements((c) => c.filter((f) => f.id !== id));
    if (gone) {
      setStatus({
        kind: "ok",
        text: `${gone.label} gelöscht`,
        undo: () => {
          setElements((c) => (c.some((f) => f.id === gone.id) ? c : [...c, gone]));
          setStatus(null);
        },
      });
    }
  };

  const resetElement = (id: string) =>
    setElementStyles((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });

  const applyEverythingFromCover = useCallback((draft: CoverDraft) => {
    setCover(draft);
    setDesign((current) => ({
      ...current,
      template: draft.template,
      colors: draft.colors,
      font: draft.font ?? undefined,
      titleScale: draft.fontScale,
      headingScale: draft.fontScale,
      bodyScale: draft.fontScale,
    }));
    setCvPhotoStyle(draft.photoStyle);
    setData((current) => ({
      ...current,
      person: { ...current.person, ...draft.person },
    }));
    setLastCoverFingerprint(coverDraftFingerprint(draft));
  }, []);

  const loadFromStorage = useCallback((): Partial<Saved> | null => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!saved) return null;
    try {
      const p = JSON.parse(saved) as Partial<Saved>;
      applySaved(p);
      markWritten(saved);
      setSaveState("saved");
      return p;
    } catch {
      return null;
    }
  }, [markWritten, applySaved]);

  useEffect(() => {
    restored.current = true;
    setHistory(readHistory(HISTORY_KEYS.cv));
    const draft = readCoverDraft();
    setCover(draft);

    const stored = loadFromStorage();
    const storedData = stored?.data
      ? {
          ...emptyCv,
          ...stored.data,
          person: { ...emptyCv.person, ...stored.data.person },
        }
      : null;

    if (storedData && cvHasContent(storedData)) return;
    if (draft) applyEverythingFromCover(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyEverythingFromCover]);

  useEffect(() => {
    if (!visible || !restored.current) return;
    if (changedElsewhere()) {
      loadFromStorage();
      setHistory(readHistory(HISTORY_KEYS.cv));
      setStatus({ kind: "ok", text: "Neuerer Stand aus einem anderen Fenster geladen" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const refreshCover = () => {
      setCover(readCoverDraft());
      setStoredCoverDocument(coverPdfDocumentFromSaved(readStoredDossierPart(COVER_STORAGE_KEY)));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "titelblatt:v3") refreshCover();
    };
    window.addEventListener("focus", refreshCover);
    window.addEventListener("storage", onStorage);
    refreshCover();
    return () => {
      window.removeEventListener("focus", refreshCover);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const payload = useCallback(
    (): Saved => ({
      version: SAVE_VERSION,
      data,
      design,
      elements,
      elementStyles,
      coverFingerprint: lastCoverFingerprint,
    }),
    [data, design, elements, elementStyles, lastCoverFingerprint],
  );

  const keepSnapshot = useCallback(
    (label: string, force = false) => {
      const p = payload();
      if (!cvHasContent(p.data)) return;
      setHistory(
        pushSnapshot(HISTORY_KEYS.cv, p as unknown as Record<string, unknown>, label, force),
      );
    },
    [payload],
  );

  useEffect(() => {
    if (!restored.current) return;
    if (!visible) return;
    setSaveState("saving");
    const id = setTimeout(() => {
      try {
        const text = JSON.stringify(payload());
        localStorage.setItem(STORAGE_KEY, text);
        markWritten(text);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
      keepSnapshot("Automatisch");
    }, 400);
    return () => clearTimeout(id);
  }, [payload, keepSnapshot, visible, markWritten]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setSelected(null);
      setSelectedSection(null);
      setDrawing(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      setHistoryOpen(false);
      setConfirmWipe(false);
      setConfirmDemo(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    applyDossierTheme(design.template);
  }, [design.template]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), status.undo ? 9000 : 4000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    const update = () => setFitHeight(window.innerHeight - 230);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [takeover, setTakeover] = useState({
    template: true,
    colors: true,
    typography: true,
    photo: true,
    person: true,
  });

  const TAKEOVER_LABELS: Array<{ key: keyof typeof takeover; label: string; hint: string }> = [
    { key: "template", label: "Vorlage und Hintergrund", hint: "Bauform, Spalte, Band, Karte" },
    { key: "colors", label: "Farben", hint: "auch deine eigenen Änderungen" },
    {
      key: "typography",
      label: "Schrift und Grösse",
      hint: "globale Schrift sowie die Gesamtgrösse",
    },
    { key: "photo", label: "Foto", hint: "samt Rahmenform und Ausschnitt" },
    { key: "person", label: "Persönliche Angaben", hint: "Name, Adresse, Kontakt" },
  ];

  const syncAllFromCover = useCallback(() => {
    const draft = readCoverDraft();
    setCover(draft);
    if (!draft) {
      setStatus({ kind: "error", text: "Es gibt noch kein gespeichertes Titelblatt." });
      return;
    }

    keepSnapshot("Vor kompletter Titelblatt-Übernahme", true);
    applyEverythingFromCover(draft);
    setTakeover({
      template: true,
      colors: true,
      typography: true,
      photo: true,
      person: true,
    });
    const templateName =
      TEMPLATES.find((template) => template.id === draft.template)?.name ?? draft.template;
    setStatus({
      kind: "ok",
      text: `Alles vom Titelblatt übernommen · Vorlage ${templateName}`,
    });
  }, [applyEverythingFromCover, keepSnapshot]);

  const syncFromCover = useCallback(() => {
    const draft = readCoverDraft();
    setCover(draft);
    if (!draft) {
      setStatus({ kind: "error", text: "Es gibt noch kein gespeichertes Titelblatt." });
      return;
    }

    const done: string[] = [];

    if (takeover.template || takeover.colors || takeover.typography) {
      setDesign((d) => ({
        ...d,
        ...(takeover.template ? { template: draft.template } : {}),
        ...(takeover.colors ? { colors: draft.colors } : {}),
        ...(takeover.typography
          ? {
              font: draft.font ?? undefined,
              titleScale: draft.fontScale,
              headingScale: draft.fontScale,
              bodyScale: draft.fontScale,
            }
          : {}),
      }));
      if (takeover.template) done.push("Vorlage");
      if (takeover.colors) done.push("Farben");
      if (takeover.typography) done.push("Schrift");
    }

    if (takeover.photo && draft.person.foto) {
      setData((d) => ({ ...d, person: { ...d.person, foto: draft.person.foto } }));
      setCvPhotoStyle(draft.photoStyle);
      done.push("Foto");
    }

    if (takeover.person && personFilled(draft.person)) {
      const { foto: _foto, ...fields } = draft.person;
      setData((d) => ({ ...d, person: { ...d.person, ...fields } }));
      done.push("Angaben");
    }

    if (done.length) setLastCoverFingerprint(coverDraftFingerprint(draft));

    setStatus(
      done.length
        ? { kind: "ok", text: `Vom Titelblatt übernommen: ${done.join(", ")}` }
        : { kind: "error", text: "Nichts ausgewählt – oder im Titelblatt steht dazu nichts." },
    );
  }, [takeover]);

  const loadDemo = () => {
    keepSnapshot("Vor den Beispieldaten", true);
    setData(DEMO_CV);
    setMenuOpen(false);
    setConfirmDemo(false);
    setSelectedSection(null);
    setStatus({ kind: "ok", text: "Beispieldaten eingefügt" });
  };

  const resetPositionsOnly = () => {
    keepSnapshot("Vor dem Zurücksetzen der Positionen", true);
    setElementStyles((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, style]) => [id, withoutBlockGeometry(style)]),
      ),
    );
    setData((current) => ({
      ...current,
      sectionLayouts: Object.fromEntries(
        Object.entries(current.sectionLayouts ?? {}).map(([key, value]) => [
          key,
          normalizeCvSectionLayout({
            ...value,
            x: null,
            y: null,
            widthMm: null,
            heightMm: null,
          }),
        ]),
      ),
    }));
    setSelected(null);
    setSelectedSection(null);
    setMenuOpen(false);
    setStatus({ kind: "ok", text: "Positionen und Grössen zurückgesetzt" });
  };

  const resetEverything = () => {
    keepSnapshot("Vor dem Zurücksetzen", true);
    const draft = readCoverDraft();
    setData({ ...emptyCv, person: { ...emptyCv.person } });
    setElements([]);
    setElementStyles({});
    setSelected(null);
    setSelectedSection(null);
    setDesign((d) => ({
      template: draft?.template ?? d.template,
      colors: draft?.colors ?? d.colors,
      paperColor: null,
      font: draft ? (draft.font ?? undefined) : "freundlich",
      bgOpacity: DEFAULT_BG_OPACITY,
      useElements: false,
      titleScale: draft?.fontScale ?? CV_TYPE_DEFAULTS.titleScale,
      headingScale: draft?.fontScale ?? CV_TYPE_DEFAULTS.headingScale,
      bodyScale: draft?.fontScale ?? CV_TYPE_DEFAULTS.bodyScale,
    }));
    setLastCoverFingerprint(coverDraftFingerprint(draft));
    setConfirmWipe(false);
    setMenuOpen(false);
    setStatus({ kind: "ok", text: "Lebenslauf zurückgesetzt" });
  };

  const downloadDossier = () => {
    setMenuOpen(false);
    const project = createDossierProject({
      cover: readStoredDossierPart(COVER_STORAGE_KEY),
      cv: payload() as unknown as Record<string, unknown>,
    });
    downloadBlob(
      new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
      `${dossierFileBase()}.json`,
    );
    setStatus({ kind: "ok", text: "Bewerbungsdossier gespeichert" });
  };

  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const project = parseDossierProject(parsed);
      if (project) {
        keepSnapshot("Vor dem Laden", true);
        const loaded = storeDossierProject(project);
        if (loaded.cv) loadFromStorage();
        setCover(readCoverDraft());
        if (loaded.cover) setStoredCoverDocument(coverPdfDocumentFromSaved(project.cover));
        setSaveState("saved");
        setStatus({
          kind: "ok",
          text:
            loaded.cover && loaded.cv
              ? "Dossier geladen: Titelblatt und Lebenslauf"
              : loaded.cv
                ? "Lebenslauf aus dem Dossier geladen"
                : "Titelblatt gespeichert – öffne es über die Übersicht",
        });
        return;
      }
      const p = parsed as Partial<Saved>;
      if (!p || typeof p !== "object" || !p.data) throw new Error("kein Lebenslauf");
      keepSnapshot("Vor dem Laden", true);
      applySaved(p);
      setStatus({ kind: "ok", text: "Älteren Lebenslauf-Entwurf geladen" });
    } catch {
      setStatus({ kind: "error", text: "Datei konnte nicht gelesen werden." });
    }
  };

  const restoreSnapshot = (snap: Snapshot) => {
    keepSnapshot("Vor dem Zurückholen", true);
    const p = snap.payload as unknown as Partial<Saved>;
    const foto = data.person.foto;
    applySaved(p);
    if (foto) setData((d) => ({ ...d, person: { ...d.person, foto } }));
    setMenuOpen(false);
    setStatus({ kind: "ok", text: `Stand von ${formatWhen(snap.at)} geladen` });
  };

  const fileBase = () => {
    const n = [data.person.vorname, data.person.nachname].filter(Boolean).join("-");
    return safeFileName(n ? `Lebenslauf-${n}` : "Lebenslauf");
  };

  const dossierFileBase = () => {
    const n = [data.person.vorname, data.person.nachname].filter(Boolean).join("-");
    return safeFileName(n ? `Bewerbungsdossier-${n}` : "Bewerbungsdossier");
  };

  const downloadPdf = async () => {
    if (!exportRef.current || downloading) return;
    setDownloading(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const pages = Array.from(exportRef.current.querySelectorAll<HTMLElement>("[data-cv-page]"));
      if (!pages.length) throw new Error("keine Seiten");

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      await registerCabinPdfFonts(pdf);
      const name = [data.person.vorname, data.person.nachname].filter(Boolean).join(" ");
      pdf.setProperties({
        title: name ? `Lebenslauf – ${name}` : "Lebenslauf",
        author: name,
        subject: "Lebenslauf",
        creator: name,
      });

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: PDF.SCALE,
          backgroundColor: "#ffffff",
          useCORS: true,
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/jpeg", PDF.QUALITY),
          "JPEG",
          0,
          0,
          210,
          297,
          undefined,
          "FAST",
        );
      }
      downloadBlob(pdf.output("blob"), `${fileBase()}.pdf`);
      setStatus({ kind: "ok", text: `PDF mit ${pages.length} Seite(n) heruntergeladen` });
    } catch (e) {
      console.error(e);
      setStatus({ kind: "error", text: "PDF konnte nicht erstellt werden." });
    } finally {
      setDownloading(false);
    }
  };

  const downloadDossierPdf = async () => {
    if (!dossierExportRef.current || !canDownloadDossierPdf || downloading) return;
    setMenuOpen(false);
    setSelected(null);
    setSelectedSection(null);
    setDownloading(true);
    const name = [data.person.vorname, data.person.nachname].filter(Boolean).join(" ");
    try {
      await downloadCombinedDossierPdf(dossierExportRef.current, `${dossierFileBase()}.pdf`, {
        title: name ? `Bewerbungsdossier – ${name}` : "Bewerbungsdossier",
        author: name,
      });
      setStatus({ kind: "ok", text: "Ganzes Dossier als PDF heruntergeladen" });
      setDossierReviewOpen(false);
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", text: "Dossier-PDF konnte nicht erstellt werden." });
      setDossierReviewOpen(false);
    } finally {
      setDownloading(false);
    }
  };

  const sectionLabel = (key: CvSectionKey) => data.labels[key]?.trim() || CV_SECTION_LABELS[key];
  const setLabel = (key: CvPlacementKey, v: string) =>
    patchData({ labels: { ...data.labels, [key]: v } });
  const setHidden = (key: CvSectionKey, v: boolean) =>
    patchData({ hidden: { ...data.hidden, [key]: v } });

  const setSectionLayout = (key: CvLayoutSectionKey, patch: Partial<CvSectionLayout>) => {
    const currentLayout = cvSectionLayout(data, key);
    const nextPositioning = patch.positioning ?? currentLayout.positioning;
    setData((current) => {
      const previous = cvSectionLayout(current, key);
      const next = normalizeCvSectionLayout({ ...previous, ...patch });
      let order = cvSectionOrder(current);
      if (patch.page && patch.page !== previous.page) {
        order = order.filter((candidate) => candidate !== key);
        const lastOnTarget = [...order]
          .reverse()
          .find((candidate) => cvSectionLayout(current, candidate).page === next.page);
        const insertAt = lastOnTarget ? order.indexOf(lastOnTarget) + 1 : order.length;
        order.splice(insertAt, 0, key);
      }
      return {
        ...current,
        sectionOrder: order,
        sectionLayouts: { ...current.sectionLayouts, [key]: next },
      };
    });
    if (key === selectedSection && nextPositioning !== "free") setSelectedSection(null);
  };

  const sectionDisplayLabel = (key: CvLayoutSectionKey) => {
    if (key === "person") return "Persönliche Angaben";
    if (isCustomSectionKey(key)) {
      const id = key.slice("custom:".length);
      return (
        data.customSections?.find((section) => section.id === id)?.title.trim() || "Eigene Rubrik"
      );
    }
    return sectionLabel(key);
  };

  const reorderSection = (key: CvLayoutSectionKey, direction: -1 | 1) => {
    setData((current) => {
      const order = cvSectionOrder(current);
      const page = cvSectionLayout(current, key).page;
      const pageKeys = order.filter(
        (candidate) => cvSectionLayout(current, candidate).page === page,
      );
      const pageIndex = pageKeys.indexOf(key);
      const swapWith = pageKeys[pageIndex + direction];
      if (!swapWith) return current;
      const keyIndex = order.indexOf(key);
      const swapIndex = order.indexOf(swapWith);
      [order[keyIndex], order[swapIndex]] = [order[swapIndex], order[keyIndex]];
      return { ...current, sectionOrder: order };
    });
  };

  const dropSection = (key: CvLayoutSectionKey, page: 1 | 2, before: CvLayoutSectionKey | null) => {
    setData((current) => {
      const order = cvSectionOrder(current).filter((candidate) => candidate !== key);
      const beforeIndex = before ? order.indexOf(before) : -1;
      if (beforeIndex >= 0) {
        order.splice(beforeIndex, 0, key);
      } else {
        const lastOnPage = [...order]
          .reverse()
          .find((candidate) => cvSectionLayout(current, candidate).page === page);
        const insertAt = lastOnPage ? order.indexOf(lastOnPage) + 1 : order.length;
        order.splice(insertAt, 0, key);
      }
      const layout = normalizeCvSectionLayout({ ...cvSectionLayout(current, key), page });
      return {
        ...current,
        sectionOrder: order,
        sectionLayouts: { ...current.sectionLayouts, [key]: layout },
      };
    });
    setDraggedSection(null);
  };

  const addCustomSection = (preset: CvCustomSectionPresetKey = "eigene-rubrik") => {
    const section = customSectionFromPreset(preset);
    const key = customSectionKey(section.id);
    setData((current) => ({
      ...current,
      customSections: [...(current.customSections ?? []), section],
      sectionOrder: [...cvSectionOrder(current), key],
      sectionLayouts: {
        ...current.sectionLayouts,
        [key]: normalizeCvSectionLayout({ page: 1 }),
      },
    }));
    setOpen((current) => ({ ...current, [key]: true }));
    setStatus({ kind: "ok", text: `Rubrik „${section.title}“ hinzugefügt` });
  };

  const patchCustomSection = (
    id: string,
    patch: Partial<NonNullable<CvData["customSections"]>[number]>,
  ) =>
    setData((current) => ({
      ...current,
      customSections: (current.customSections ?? []).map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    }));

  const removeCustomSection = (id: string) => {
    const section = data.customSections?.find((candidate) => candidate.id === id);
    if (section?.preset === "familie") return;
    if (!section || !window.confirm(`Rubrik „${section.title || "Eigene Rubrik"}“ löschen?`))
      return;
    keepSnapshot("Vor dem Löschen einer Rubrik", true);
    const key = customSectionKey(id);
    setData((current) => {
      const sectionLayouts = { ...current.sectionLayouts };
      delete sectionLayouts[key];
      return {
        ...current,
        customSections: (current.customSections ?? []).filter((candidate) => candidate.id !== id),
        sectionOrder: cvSectionOrder(current).filter((candidate) => candidate !== key),
        sectionLayouts,
      };
    });
    if (selectedSection === key) setSelectedSection(null);
    setStatus({ kind: "ok", text: "Eigene Rubrik gelöscht" });
  };

  const opts = (key: CvSectionKey) => (
    <SectionOptions
      section={key}
      value={data.labels[key] ?? ""}
      placeholder={CV_SECTION_LABELS[key]}
      hidden={!!data.hidden[key]}
      layout={cvSectionLayout(data, key)}
      onLabel={(v) => setLabel(key, v)}
      onHidden={(v) => setHidden(key, v)}
      onLayout={(patch) => setSectionLayout(key, patch)}
    />
  );
  const editorSectionOrder = (key: CvLayoutSectionKey) => {
    const index = cvSectionOrder(data).indexOf(key);
    return index < 0 ? cvSectionOrder(data).length + 1 : index + 1;
  };

  const selectedSectionLayout = selectedSection ? cvSectionLayout(data, selectedSection) : null;
  const selectedSectionLabel = selectedSection ? sectionDisplayLabel(selectedSection) : "";
  const currentCoverFingerprint = useMemo(() => coverDraftFingerprint(cover), [cover]);
  const coverChanged =
    !!currentCoverFingerprint && currentCoverFingerprint !== lastCoverFingerprint;
  const receiveLayoutWarnings = useCallback((next: CvLayoutWarning[]) => {
    setLayoutWarnings((current) => {
      const currentShape = current.map((warning) => `${warning.id}:${warning.message}`).join("|");
      const nextShape = next.map((warning) => `${warning.id}:${warning.message}`).join("|");
      return currentShape === nextShape ? current : next;
    });
  }, []);
  const receiveDossierWarnings = useCallback((next: CvLayoutWarning[]) => {
    setDossierWarnings((current) => {
      const currentShape = current?.map((warning) => `${warning.id}:${warning.message}`).join("|");
      const nextShape = next.map((warning) => `${warning.id}:${warning.message}`).join("|");
      return currentShape === nextShape ? current : next;
    });
  }, []);
  const closeDossierReview = useCallback(() => setDossierReviewOpen(false), []);

  const canvas = (
    <CvCanvas
      data={data}
      design={design}
      chromeOptions={chromeOptions}
      chromeContact={chromeContact}
      elements={elements}
      elementStyles={elementStyles}
      selected={selected}
      onSelect={setSelected}
      selectedSection={selectedSection}
      onSelectSection={setSelectedSection}
      onMoveElement={patchStyle}
      onSectionLayout={setSectionLayout}
      onLayoutWarnings={receiveLayoutWarnings}
      drawing={drawing}
      onDrawn={(points, page) => {
        setDrawing(false);
        const drawn = newDrawnElement(elements, points, SHAPE.MIN_DRAW);
        place({ ...drawn, field: { ...drawn.field, page } });
      }}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
      <header className="z-30 shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
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
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M2 3.5h12M2 8h12M2 12.5h7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden sm:inline">
              {panelOpen ? "Formular schliessen" : "Formular"}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold sm:text-base">Lebenslauf</h1>
            <div className="flex min-w-0 items-center gap-2">
              <SaveStatus state={saveState} />
            </div>
          </div>

          {status && (
            <span
              role="status"
              className={`hidden min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs md:inline-flex ${
                status.kind === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <span className="truncate">{status.text}</span>
              {status.undo && (
                <button
                  type="button"
                  onClick={status.undo}
                  className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
                >
                  Rückgängig
                </button>
              )}
            </span>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <label className="hidden items-center gap-1 sm:inline-flex">
              <span className="sr-only">Zoom der Vorschau</span>
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                title="Zoom der Vorschau"
                className="rounded-md border border-input bg-background px-2 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PREVIEW.ZOOM_STEPS.map((z) => (
                  <option key={z} value={z}>
                    {Math.round(z * 100)} %
                  </option>
                ))}
              </select>
            </label>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={downloading}
                aria-expanded={menuOpen}
                data-editor-ready={saveState === "idle" ? "false" : "true"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 sm:px-4"
              >
                {downloading ? "PDF…" : "Download"}
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
              {menuOpen && (
                <div
                  data-editor-action-menu
                  className="absolute right-0 mt-2 w-72 overflow-hidden rounded-md border bg-popover shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setDossierWarnings(null);
                      setDossierReviewOpen(true);
                    }}
                    disabled={!canDownloadDossierPdf}
                    title={
                      canDownloadDossierPdf
                        ? "Titelblatt, Motivationsschreiben und alle CV-Seiten gemeinsam herunterladen"
                        : dossierPdfHint
                    }
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
                      downloadPdf();
                    }}
                    className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <EditorMenuLabel icon={FileDown}>Nur Lebenslauf als PDF</EditorMenuLabel>
                    <span className="text-xs text-muted-foreground">.pdf</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadDossier}
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
                      onChange={(e) => {
                        importJson(e.target.files?.[0]);
                        e.target.value = "";
                        setMenuOpen(false);
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
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDemo(true)}
                      className="flex w-full items-center border-t px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <EditorMenuLabel icon={Sparkles}>Beispieldaten übernehmen</EditorMenuLabel>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={resetPositionsOnly}
                    className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <EditorMenuLabel icon={MoveDiagonal2}>
                      Positionen &amp; Grössen zurücksetzen
                    </EditorMenuLabel>
                    <span className="text-xs text-muted-foreground">Layout</span>
                  </button>

                  {history.length === 0 ? (
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-sm opacity-45"
                    >
                      <EditorMenuLabel icon={History}>Früheren Stand laden</EditorMenuLabel>
                      <span className="text-xs text-muted-foreground">0</span>
                    </button>
                  ) : null}
                  {history.length > 0 && (
                    <div className="border-t">
                      <button
                        type="button"
                        onClick={() => setHistoryOpen((v) => !v)}
                        aria-expanded={historyOpen}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <EditorMenuLabel icon={History}>Früheren Stand laden</EditorMenuLabel>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {history.length}
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            aria-hidden="true"
                            style={{
                              transform: historyOpen ? "rotate(180deg)" : "none",
                              transition: "transform 150ms",
                            }}
                          >
                            <path
                              d="M3 4.5l3 3 3-3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </button>
                      {historyOpen && (
                        <div className="max-h-60 overflow-y-auto border-t bg-muted/30 pb-1">
                          <p className="px-3 pb-1 pt-2 text-xs text-muted-foreground">
                            Ohne Bilder – ein gewähltes Foto bleibt erhalten.
                          </p>
                          {history.map((snap) => (
                            <button
                              key={snap.id}
                              type="button"
                              onClick={() => restoreSnapshot(snap)}
                              className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                            >
                              <span className="truncate">{describe(snap.payload)}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatWhen(snap.at)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {confirmWipe ? (
                    <div className="flex items-center gap-1 border-t bg-destructive/5 px-3 py-2">
                      <span className="mr-auto text-xs font-medium text-destructive">
                        Wirklich alles?
                      </span>
                      <button
                        type="button"
                        onClick={resetEverything}
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
                      onClick={() => setConfirmWipe(true)}
                      className="flex w-full items-center border-t px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                    >
                      <EditorMenuLabel icon={RotateCcw}>Alles zurücksetzen</EditorMenuLabel>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <ResizableEditorPanel open={panelOpen}>
          <div className="flex w-[min(92vw,420px)] max-w-full flex-col gap-3 p-3 sm:w-full">
            {layoutWarnings.length ? (
              <div
                aria-live="polite"
                className="rounded-lg border border-amber-300/80 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <div className="text-xs font-semibold">Layout prüfen</div>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed">
                  {layoutWarnings.map((warning) => (
                    <li key={warning.id}>{warning.message}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] opacity-70">
                  Diese Hinweise erscheinen nicht im PDF.
                </p>
              </div>
            ) : null}

            <div data-cv-content-editor className="flex flex-col gap-3">
              <Section
                title="Vom Dossier übernehmen"
                open={open.uebernehmen}
                onToggle={() => toggle("uebernehmen")}
                order={0}
                hint={cover ? "Titelblatt bereit" : "nichts verfügbar"}
              >
                <div className="flex flex-col gap-3 rounded-md border border-dashed p-2.5">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Gemeinsame Angaben und Design kommen im Lebenslauf aus dem Titelblatt. Deine
                    CV-eigenen Inhalte wie Schule und Erfahrung bleiben erhalten.
                  </p>

                  <button
                    type="button"
                    onClick={syncAllFromCover}
                    disabled={!cover}
                    className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Alles übernehmen
                  </button>

                  {coverChanged ? (
                    <div
                      role="status"
                      className="rounded-md border border-sky-300/70 bg-sky-50 p-2.5 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
                    >
                      <div className="text-xs font-semibold">Titelblatt wurde geändert</div>
                      <p className="mt-1 text-[11px] leading-relaxed opacity-80">
                        Du kannst alles neu übernehmen oder unten nur die gewünschte Auswahl.
                      </p>
                    </div>
                  ) : null}

                  <details className="rounded-md border bg-background">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium">
                      Auswahl anpassen
                    </summary>
                    <div className="grid gap-2 border-t p-3">
                      {TAKEOVER_LABELS.map(({ key, label, hint }) => (
                        <label key={key} className="flex items-start gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={takeover[key]}
                            disabled={!cover}
                            onChange={(e) =>
                              setTakeover((t) => ({ ...t, [key]: e.target.checked }))
                            }
                          />
                          <span>
                            <span className="block font-medium">{label}</span>
                            <span className="block text-muted-foreground">{hint}</span>
                          </span>
                        </label>
                      ))}

                      <button
                        type="button"
                        onClick={syncFromCover}
                        disabled={!cover}
                        className="mt-1 self-start rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                      >
                        Auswahl übernehmen
                      </button>

                      <label className="mt-1 flex items-start gap-2 border-t pt-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={design.useElements}
                          onChange={(e) =>
                            setDesign((d) => ({ ...d, useElements: e.target.checked }))
                          }
                        />
                        <span>
                          Übernommene Formen anzeigen
                          <span className="block text-muted-foreground">
                            {elements.length > 0
                              ? `${elements.length} übernommen.`
                              : "Noch keine übernommen."}
                          </span>
                        </span>
                      </label>
                    </div>
                  </details>
                </div>
              </Section>

              <Section
                title="Persönliche Angaben"
                open={open.person}
                onToggle={() => toggle("person")}
                order={editorSectionOrder("person")}
                hint={data.person.vorname || data.person.nachname ? "gesetzt" : "leer"}
              >
                <div className="flex flex-col gap-3">
                  <SectionLayoutControls
                    section="person"
                    layout={cvSectionLayout(data, "person")}
                    onLayout={(patch) => setSectionLayout("person", patch)}
                  />

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Titel des Dokuments</span>
                    <input
                      type="text"
                      value={data.titel ?? ""}
                      placeholder={DEFAULT_CV_TITLE}
                      onChange={(e) => patchData({ titel: e.target.value })}
                      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-muted-foreground/80">
                      Steht über dem Namen. Leer lassen blendet ihn aus.
                    </span>
                  </label>

                  <div className="grid gap-3 rounded-md border bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold">Dokumenttitel gestalten</div>
                      <button
                        type="button"
                        onClick={() =>
                          setDesign((current) => ({
                            ...current,
                            docTitleFontSizePx: undefined,
                            docTitleColor: undefined,
                            docTitleBold: undefined,
                            docTitleItalic: undefined,
                            docTitleUnderline: undefined,
                            docTitleMarginBottomPx: undefined,
                          }))
                        }
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Vorlage
                      </button>
                    </div>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">
                        Schriftgrösse{" "}
                        {design.docTitleFontSizePx ?? CV_DOC_TITLE_DEFAULTS.fontSizePx} px
                      </span>
                      <input
                        type="range"
                        min={CV_DOC_TITLE_FONT_SIZE_MIN}
                        max={CV_DOC_TITLE_FONT_SIZE_MAX}
                        step={1}
                        value={design.docTitleFontSizePx ?? CV_DOC_TITLE_DEFAULTS.fontSizePx}
                        onChange={(event) =>
                          setDesign((current) => ({
                            ...current,
                            docTitleFontSizePx: Number(event.target.value),
                          }))
                        }
                        className="w-full accent-primary"
                        aria-label="Schriftgrösse Dokumenttitel"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Schriftfarbe</span>
                      <input
                        type="color"
                        value={design.docTitleColor ?? "#6b7280"}
                        onChange={(event) =>
                          setDesign((current) => ({
                            ...current,
                            docTitleColor: event.target.value,
                          }))
                        }
                        className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
                        aria-label="Schriftfarbe Dokumenttitel"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDesign((current) => ({ ...current, docTitleColor: undefined }))
                        }
                        className="text-muted-foreground underline hover:text-foreground"
                      >
                        Standardfarbe
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          ["docTitleBold", "Fett", CV_DOC_TITLE_DEFAULTS.bold, "font-bold"],
                          ["docTitleItalic", "Kursiv", CV_DOC_TITLE_DEFAULTS.italic, "italic"],
                          [
                            "docTitleUnderline",
                            "Unterstrichen",
                            CV_DOC_TITLE_DEFAULTS.underline,
                            "underline",
                          ],
                        ] as const
                      ).map(([key, label, fallback, textClass]) => {
                        const active = design[key] ?? fallback;
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setDesign((current) => ({
                                ...current,
                                [key]: !(current[key] ?? fallback),
                              }))
                            }
                            className={`rounded-md border px-2 py-1.5 text-xs ${textClass} ${
                              active
                                ? "border-foreground bg-accent"
                                : "border-input hover:border-foreground/40"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">
                        Abstand nach unten{" "}
                        {design.docTitleMarginBottomPx ?? CV_DOC_TITLE_DEFAULTS.marginBottomPx} px
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={CV_DOC_TITLE_MARGIN_BOTTOM_MAX}
                        step={1}
                        value={
                          design.docTitleMarginBottomPx ?? CV_DOC_TITLE_DEFAULTS.marginBottomPx
                        }
                        onChange={(event) =>
                          setDesign((current) => ({
                            ...current,
                            docTitleMarginBottomPx: Number(event.target.value),
                          }))
                        }
                        className="w-full accent-primary"
                        aria-label="Abstand unter Dokumenttitel"
                      />
                    </label>
                  </div>

                  <FormCvPerson
                    person={data.person}
                    onChange={patchPerson}
                    contactLabel={data.labels.kontakt ?? ""}
                    onContactLabel={(v) => setLabel("kontakt", v)}
                  />
                </div>
              </Section>

              <Section
                title={sectionLabel("schule")}
                open={open.schule}
                onToggle={() => toggle("schule")}
                order={editorSectionOrder("schule")}
                hint={`${data.schule.length}`}
              >
                {opts("schule")}
                <FormCvEntries
                  entries={data.schule}
                  onChange={(schule) => patchData({ schule })}
                  titelLabel="Schule / Stufe"
                  ortLabel="Schulhaus, Ort"
                />
              </Section>

              <Section
                title={sectionLabel("erfahrung")}
                open={open.erfahrung}
                onToggle={() => toggle("erfahrung")}
                order={editorSectionOrder("erfahrung")}
                hint={`${data.erfahrung.length}`}
              >
                {opts("erfahrung")}
                <FormCvEntries
                  entries={data.erfahrung}
                  onChange={(erfahrung) => patchData({ erfahrung })}
                  titelLabel="Was hast du gemacht?"
                  ortLabel="Betrieb, Ort"
                />
              </Section>

              <Section
                title={sectionLabel("sprachen")}
                open={open.sprachen}
                onToggle={() => toggle("sprachen")}
                order={editorSectionOrder("sprachen")}
                hint={`${data.sprachen.length}`}
              >
                {opts("sprachen")}
                <FormCvSprachen
                  list={data.sprachen}
                  onChange={(sprachen) => patchData({ sprachen })}
                />
              </Section>

              <Section
                title={sectionLabel("staerken")}
                open={open.staerken}
                onToggle={() => toggle("staerken")}
                order={editorSectionOrder("staerken")}
                hint={`${data.staerken.length}`}
              >
                {opts("staerken")}
                <FormCvLines
                  list={data.staerken}
                  onChange={(staerken) => patchData({ staerken })}
                  placeholder="z. B. Zuverlässig und pünktlich"
                  addLabel="+ Stärke"
                />
              </Section>

              <Section
                title={sectionLabel("hobbys")}
                open={open.hobbys}
                onToggle={() => toggle("hobbys")}
                order={editorSectionOrder("hobbys")}
                hint={`${data.hobbys.length}`}
              >
                {opts("hobbys")}
                <FormCvLines
                  list={data.hobbys}
                  onChange={(hobbys) => patchData({ hobbys })}
                  placeholder="z. B. Volleyball im Verein"
                  addLabel="+ Hobby"
                />
              </Section>

              <Section
                title={sectionLabel("referenzen")}
                open={open.referenzen}
                onToggle={() => toggle("referenzen")}
                order={editorSectionOrder("referenzen")}
                hint={`${data.referenzen.length}`}
              >
                {opts("referenzen")}
                <FormCvReferenzen
                  list={data.referenzen}
                  onChange={(referenzen) => patchData({ referenzen })}
                />
              </Section>

              {(data.customSections ?? []).map((section) => {
                const key = customSectionKey(section.id);
                return (
                  <Section
                    key={section.id}
                    title={section.title.trim() || "Eigene Rubrik"}
                    open={!!open[key]}
                    onToggle={() => toggle(key)}
                    order={editorSectionOrder(key)}
                    hint={`${section.entries.length}`}
                    action={
                      section.preset === "familie" ? undefined : (
                        <button
                          type="button"
                          onClick={() => removeCustomSection(section.id)}
                          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`${section.title || "Eigene Rubrik"} löschen`}
                          title="Rubrik löschen"
                        >
                          Löschen
                        </button>
                      )
                    }
                  >
                    <div className="mb-2 flex flex-col gap-2 border-b pb-2">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Rubriktitel</span>
                        <input
                          value={section.title}
                          onChange={(event) =>
                            patchCustomSection(section.id, { title: event.target.value })
                          }
                          placeholder="z. B. Projekte oder Kurse"
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                      <SectionLayoutControls
                        section={key}
                        layout={cvSectionLayout(data, key)}
                        onLayout={(patch) => setSectionLayout(key, patch)}
                      />
                    </div>
                    {section.preset === "familie" ? (
                      <p className="mb-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                        Optionaler Bereich. Sinnvolle Aufteilung: „Eltern“ mit Namen und Berufen
                        sowie „Geschwister“ mit Jahrgang und Tätigkeit. Die Angaben erscheinen erst
                        im CV, wenn du sie einträgst.
                      </p>
                    ) : section.preset === "digitale-kenntnisse" ? (
                      <p className="mb-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                        Programme und Technologien mit Niveau oder konkreter Anwendung angeben, z.
                        B. „Excel – Grundkenntnisse, einfache Formeln“. Allgemeine PC-Nutzung musst
                        du nicht aufführen.
                      </p>
                    ) : null}
                    <FormCvEntries
                      entries={section.entries}
                      onChange={(entries) => patchCustomSection(section.id, { entries })}
                      titelLabel={
                        section.preset === "familie"
                          ? "Bezug"
                          : section.preset === "digitale-kenntnisse"
                            ? "Programm / Technologie"
                            : "Titel"
                      }
                      ortLabel={
                        section.preset === "familie"
                          ? "Name / Beruf"
                          : section.preset === "digitale-kenntnisse"
                            ? "Niveau / Anwendung"
                            : "Ort / Organisation"
                      }
                      placement={null}
                    />
                  </Section>
                );
              })}
            </div>

            <Section
              title="Rubriken anordnen"
              open={open.rubriken}
              onToggle={() => toggle("rubriken")}
              hint={`${cvSectionOrder(data).length}`}
            >
              <div className="flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Ziehe ganze Rubriken in die gewünschte Reihenfolge oder verschiebe sie auf die
                  andere Seite.
                </p>
                {([1, 2] as const).map((page) => {
                  const pageKeys = cvSectionOrder(data).filter(
                    (key) => cvSectionLayout(data, key).page === page,
                  );
                  return (
                    <div key={page} className="rounded-md border bg-muted/20 p-2">
                      <div className="mb-2 text-xs font-semibold">Seite {page}</div>
                      <div
                        className="flex min-h-10 flex-col gap-1"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const key =
                            draggedSection ||
                            (event.dataTransfer.getData("text/plain") as CvLayoutSectionKey);
                          if (cvSectionOrder(data).includes(key)) dropSection(key, page, null);
                        }}
                      >
                        {pageKeys.map((key, index) => (
                          <div
                            key={key}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const dropped =
                                draggedSection ||
                                (event.dataTransfer.getData("text/plain") as CvLayoutSectionKey);
                              if (cvSectionOrder(data).includes(dropped) && dropped !== key) {
                                dropSection(dropped, page, key);
                              }
                            }}
                            className={`flex items-center gap-1.5 rounded border bg-background px-2 py-1.5 text-xs ${
                              draggedSection === key ? "opacity-50" : ""
                            }`}
                          >
                            <span
                              draggable
                              onDragStart={(event) => {
                                setDraggedSection(key);
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", key);
                              }}
                              onDragEnd={() => setDraggedSection(null)}
                              aria-hidden="true"
                              className="cursor-grab select-none text-base leading-none text-muted-foreground"
                              title="Rubrik ziehen"
                            >
                              ⋮⋮
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {sectionDisplayLabel(key)}
                            </span>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => reorderSection(key, -1)}
                              className="rounded px-1.5 py-1 hover:bg-accent disabled:opacity-30"
                              aria-label={`${sectionDisplayLabel(key)} nach oben`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === pageKeys.length - 1}
                              onClick={() => reorderSection(key, 1)}
                              className="rounded px-1.5 py-1 hover:bg-accent disabled:opacity-30"
                              aria-label={`${sectionDisplayLabel(key)} nach unten`}
                            >
                              ↓
                            </button>
                            <CompactPageSelect
                              page={page}
                              label={sectionDisplayLabel(key)}
                              onChange={(nextPage) => setSectionLayout(key, { page: nextPage })}
                            />
                          </div>
                        ))}
                        {!pageKeys.length && (
                          <div className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
                            Rubrik hier ablegen
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const preset = event.target.value as CvCustomSectionPresetKey;
                    if (preset) addCustomSection(preset);
                    event.target.value = "";
                  }}
                  className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Rubrik hinzufügen"
                >
                  <option value="" disabled>
                    + Rubrik hinzufügen …
                  </option>
                  {CV_CUSTOM_SECTION_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </Section>

            <div className="flex flex-col gap-3">
              <div className="mt-2 h-px bg-border" />

              <Section
                title="Vorlage"
                open={open.vorlage}
                onToggle={() => toggle("vorlage")}
                hint={activeTemplate.name}
              >
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-xs">
                    <span className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Hintergrund-Motiv {Math.round(design.bgOpacity * 100)} % sichtbar
                      </span>
                      <button
                        type="button"
                        onClick={() => setDesign((d) => ({ ...d, bgOpacity: DEFAULT_BG_OPACITY }))}
                        className="text-muted-foreground underline hover:text-foreground"
                      >
                        {Math.round(DEFAULT_BG_OPACITY * 100)} %
                      </button>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(design.bgOpacity * 100)}
                      onChange={(e) =>
                        setDesign((d) => ({ ...d, bgOpacity: Number(e.target.value) / 100 }))
                      }
                      className="w-full accent-primary"
                    />
                    <span className="text-muted-foreground/80">
                      Gilt für die Zierde – Kreise, Verläufe, Formen. Was die Vorlage ausmacht
                      (Spalte, Farbband, Karte), bleibt immer sichtbar, sonst wäre sie nicht
                      wiederzuerkennen.
                    </span>
                  </label>

                  <div>
                    <TemplatePicker
                      value={design.template}
                      onChange={(template) =>
                        setDesign((d) => ({ ...d, template, colors: defaultColors(template) }))
                      }
                    />
                  </div>
                </div>
              </Section>

              <Section title="Header & Footer" open={open.chrome} onToggle={() => toggle("chrome")}>
                <DossierChromeControls scope="cv" />
              </Section>

              <Section
                title="Farben"
                open={open.farben}
                onToggle={() => toggle("farben")}
                hint={`${activeTemplate.slots.length}`}
              >
                <div className="grid gap-4">
                  <div
                    data-cv-paper-color-control
                    className="grid gap-2 rounded-md border border-input p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex min-w-0 items-center gap-2 text-xs font-medium">
                        <input
                          type="color"
                          aria-label="Seitenhintergrund des Lebenslaufs"
                          value={resolveCvPaperColor(design)}
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
                      Gilt bei jeder Vorlage für das Papier des Lebenslaufs. Ohne eigene Textfarbe
                      passt sich die Schrift automatisch an.
                    </span>
                  </div>

                  <DocumentTextColorControl
                    ariaLabel="Textfarbe des Lebenslaufs"
                    value={resolveCvPalette(design).ink}
                    customValue={design.colors.cvInk}
                    paperColor={resolveCvPaperColor(design)}
                    description="Gilt für den normalen CV-Text. Sekundärtext und Rubriktitel können darunter separat angepasst werden."
                    onChange={(cvInk) =>
                      setDesign((current) => ({
                        ...current,
                        colors: { ...current.colors, cvInk },
                      }))
                    }
                    onAuto={() =>
                      setDesign((current) => ({
                        ...current,
                        colors: { ...current.colors, cvInk: "" },
                      }))
                    }
                  />

                  <div className="border-t pt-4">
                    <ColorChooser
                      slots={activeTemplate.slots}
                      colors={design.colors}
                      onChange={(key, value) =>
                        setDesign((d) => ({ ...d, colors: { ...d.colors, [key]: value } }))
                      }
                      onApplyPalette={(next) => setDesign((d) => ({ ...d, colors: next }))}
                      onReset={() =>
                        setDesign((d) => ({ ...d, colors: defaultColors(d.template) }))
                      }
                    />
                  </div>
                </div>
              </Section>

              <Section
                title="Schrift und Layout"
                open={open.typo}
                onToggle={() => toggle("typo")}
                hint={`${Math.round((design.bodyScale ?? CV_TYPE_DEFAULTS.bodyScale) * 100)} %`}
              >
                <div className="flex flex-col gap-3">
                  <DossierHyphenationControl />

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Schriftart gesamtes Dossier</span>
                    <select
                      value={design.font ?? "template"}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDesign((current) => ({
                          ...current,
                          font:
                            value !== "template" && value in FONT_LABELS
                              ? (value as FontKey)
                              : undefined,
                        }));
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="template">Passend zur Vorlage</option>
                      {(Object.entries(FONT_LABELS) as Array<[FontKey, string]>).map(
                        ([font, label]) => (
                          <option key={font} value={font}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <span className="text-muted-foreground/80">
                      Dieselbe Auswahl wie im Titelblatt. Freie Textfelder können einzeln abweichen.
                    </span>
                  </label>

                  <div className="grid gap-3 rounded-md border bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold">Rubriktitel gestalten</div>
                      <button
                        type="button"
                        onClick={() =>
                          setDesign((current) => ({
                            ...current,
                            sectionTitleFontSizePx: undefined,
                            sectionTitleColor: undefined,
                            sectionTitleBold: undefined,
                            sectionTitleItalic: undefined,
                            sectionTitleUnderline: undefined,
                            sectionTitleMarginBottomPx: undefined,
                            headingRule: CV_TYPE_DEFAULTS.headingRule,
                          }))
                        }
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Vorlage
                      </button>
                    </div>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">
                        Schriftgrösse{" "}
                        {design.sectionTitleFontSizePx ?? CV_SECTION_TITLE_DEFAULTS.fontSizePx} px
                      </span>
                      <input
                        type="range"
                        min={CV_SECTION_TITLE_FONT_SIZE_MIN}
                        max={CV_SECTION_TITLE_FONT_SIZE_MAX}
                        step={1}
                        value={
                          design.sectionTitleFontSizePx ?? CV_SECTION_TITLE_DEFAULTS.fontSizePx
                        }
                        onChange={(event) =>
                          setDesign((current) => ({
                            ...current,
                            sectionTitleFontSizePx: Number(event.target.value),
                          }))
                        }
                        className="w-full accent-primary"
                        aria-label="Schriftgrösse Rubriktitel"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Schriftfarbe</span>
                      <input
                        type="color"
                        value={
                          design.sectionTitleColor ??
                          design.colors.accent ??
                          design.colors.primary ??
                          "#6b7280"
                        }
                        onChange={(event) =>
                          setDesign((current) => ({
                            ...current,
                            sectionTitleColor: event.target.value,
                          }))
                        }
                        className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
                        aria-label="Schriftfarbe Rubriktitel"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDesign((current) => ({ ...current, sectionTitleColor: undefined }))
                        }
                        className="text-muted-foreground underline hover:text-foreground"
                      >
                        Standardfarbe
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          ["sectionTitleBold", "Fett", CV_SECTION_TITLE_DEFAULTS.bold, "font-bold"],
                          [
                            "sectionTitleItalic",
                            "Kursiv",
                            CV_SECTION_TITLE_DEFAULTS.italic,
                            "italic",
                          ],
                          [
                            "sectionTitleUnderline",
                            "Unterstrichen",
                            CV_SECTION_TITLE_DEFAULTS.underline,
                            "underline",
                          ],
                        ] as const
                      ).map(([key, label, fallback, textClass]) => {
                        const active = design[key] ?? fallback;
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setDesign((current) => ({
                                ...current,
                                [key]: !(current[key] ?? fallback),
                              }))
                            }
                            className={`rounded-md border px-2 py-1.5 text-xs ${textClass} ${
                              active
                                ? "border-foreground bg-accent"
                                : "border-input hover:border-foreground/40"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">
                        Abstand nach unten{" "}
                        {design.sectionTitleMarginBottomPx ??
                          CV_SECTION_TITLE_DEFAULTS.marginBottomPx}{" "}
                        px
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={CV_SECTION_TITLE_MARGIN_BOTTOM_MAX}
                        step={1}
                        value={
                          design.sectionTitleMarginBottomPx ??
                          CV_SECTION_TITLE_DEFAULTS.marginBottomPx
                        }
                        onChange={(event) =>
                          setDesign((current) => ({
                            ...current,
                            sectionTitleMarginBottomPx: Number(event.target.value),
                          }))
                        }
                        className="w-full accent-primary"
                        aria-label="Abstand unter Rubriktiteln"
                      />
                    </label>

                    <div className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Trennlinie nach Rubriktitel</span>
                      <div className="flex gap-1">
                        {(
                          [
                            ["full", "Ganze Breite"],
                            ["none", "Keine"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={(design.headingRule === "none" ? "none" : "full") === id}
                            onClick={() => setDesign((d) => ({ ...d, headingRule: id }))}
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
                              (design.headingRule === "none" ? "none" : "full") === id
                                ? "border-foreground bg-accent"
                                : "border-input hover:border-foreground/40"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="text-[11px] leading-relaxed text-muted-foreground/80">
                      Gilt gemeinsam für Schulbildung, Praktika, Sprachen, Stärken, Hobbys,
                      Referenzen und eigene Rubriken.
                    </span>
                  </div>

                  {(
                    [
                      ["titleScale", "Name", "Der Name oben."],
                      [
                        "headingScale",
                        "Untertitel / Rubriken-Basis",
                        "Untertitel sowie die Vorlagen-Grösse der Rubriken. Eine eigene Rubriktitel-Grösse überschreibt sie.",
                      ],
                      [
                        "bodyScale",
                        "Fliesstext",
                        "Alles Übrige. Mehr Text passt bei kleinerer Schrift auf eine Seite.",
                      ],
                    ] as const
                  ).map(([key, label, hint]) => (
                    <label key={key} className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">
                        {label} {Math.round((design[key] ?? CV_TYPE_DEFAULTS[key]) * 100)} %
                      </span>
                      <input
                        type="range"
                        min={Math.round(CV_SCALE_MIN * 100)}
                        max={Math.round(CV_SCALE_MAX * 100)}
                        step={5}
                        value={Math.round((design[key] ?? CV_TYPE_DEFAULTS[key]) * 100)}
                        onChange={(e) =>
                          setDesign((d) => ({ ...d, [key]: Number(e.target.value) / 100 }))
                        }
                        className="w-full accent-primary"
                      />
                      <span className="text-muted-foreground/80">{hint}</span>
                    </label>
                  ))}

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">
                      Seitenspalte{" "}
                      {Math.round((design.sidebarPct ?? CV_TYPE_DEFAULTS.sidebarPct) * 100)}
                      {" / "}
                      {100 - Math.round((design.sidebarPct ?? CV_TYPE_DEFAULTS.sidebarPct) * 100)}
                    </span>
                    <input
                      type="range"
                      min={Math.round(SIDEBAR_PCT_MIN * 100)}
                      max={Math.round(SIDEBAR_PCT_MAX * 100)}
                      step={1}
                      value={Math.round((design.sidebarPct ?? CV_TYPE_DEFAULTS.sidebarPct) * 100)}
                      onChange={(e) =>
                        setDesign((d) => ({ ...d, sidebarPct: Number(e.target.value) / 100 }))
                      }
                      className="w-full accent-primary"
                    />
                    <span className="text-muted-foreground/80">
                      Gilt für den Aufbau „Sidebar". Vorlagen mit eigener Farbspalte behalten deren
                      Breite vom Titelblatt.
                    </span>
                  </label>
                </div>
              </Section>
            </div>
          </div>
        </ResizableEditorPanel>

        {panelOpen && (
          <div
            aria-hidden
            onClick={() => setPanelOpen(false)}
            className="absolute inset-0 z-10 bg-foreground/20 sm:hidden"
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto px-2 pt-3 lg:px-6 lg:pt-4">
            <div className="mx-auto w-full max-w-[900px]">
              <ScaledPreview max={1} fitHeight={fitHeight} zoom={zoom}>
                {canvas}
              </ScaledPreview>
            </div>
          </div>

          <div className="shrink-0 px-2 pb-3 pt-2 lg:px-6">
            <div className="mx-auto w-full max-w-[900px]">
              {drawing ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-background px-4 py-3 text-sm">
                  <span className="font-medium">Freihand zeichnen</span>
                  <span className="text-muted-foreground">
                    Mit gedrückter Maustaste eine Form aufs Blatt ziehen.
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawing(false)}
                    className="ml-auto rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : selectedBlock ? (
                <ElementBar
                  block={selectedBlock}
                  slots={activeTemplate.slots}
                  colors={design.colors}
                  onChange={(p) => patchStyle(selectedBlock.id, p)}
                  onReset={() => resetElement(selectedBlock.id)}
                  onClose={() => setSelected(null)}
                  custom={selectedCustom ?? undefined}
                  onCustomChange={
                    selectedCustom ? (p) => patchCustom(selectedCustom.id, p) : undefined
                  }
                  allowPagePlacement
                  onDelete={() => removeElement(selectedBlock.id)}
                  onPickImage={
                    selectedCustom && customKind(selectedCustom) !== "shape"
                      ? (file) => pickImage(selectedCustom.id, file)
                      : undefined
                  }
                  onAddImage={addImage}
                />
              ) : selectedSection && selectedSectionLayout ? (
                <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-background px-4 py-2.5 shadow-lg">
                  <div className="mr-auto flex min-w-32 flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Rubrik
                    </span>
                    <span className="truncate text-sm font-semibold">{selectedSectionLabel}</span>
                  </div>

                  <label className="flex min-w-24 flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Seite
                    </span>
                    <select
                      value={selectedSectionLayout.page}
                      onChange={(event) =>
                        setSectionLayout(selectedSection, {
                          page: Number(event.target.value) === 2 ? 2 : 1,
                        })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value={1}>Seite 1</option>
                      <option value={2}>Seite 2</option>
                    </select>
                  </label>

                  <label className="flex min-w-32 flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Breite
                    </span>
                    <select
                      value={selectedSectionLayout.width}
                      onChange={(event) =>
                        setSectionLayout(selectedSection, {
                          width: event.target.value === "half" ? "half" : "full",
                        })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="full">Volle Breite</option>
                      <option value="half">Halbe Breite</option>
                    </select>
                  </label>

                  <label className="flex min-w-36 flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Positionierung
                    </span>
                    <select
                      value={selectedSectionLayout.positioning}
                      onChange={(event) =>
                        setSectionLayout(selectedSection, {
                          positioning: event.target.value === "free" ? "free" : "flow",
                        })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="flow">Automatisch</option>
                      <option value="free">Frei platzieren</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setSectionLayout(selectedSection, {
                        x: null,
                        y: null,
                        widthMm: null,
                        heightMm: null,
                      })
                    }
                    className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    Position &amp; Grösse zurücksetzen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSection(null)}
                    aria-label="Rubrik-Auswahl schliessen"
                    className="rounded-md border border-input px-2.5 py-1.5 text-sm hover:bg-accent"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">
                    Eigenes Element antippen zum Anpassen, ziehen zum Verschieben.
                  </span>
                  <AddElementMenu
                    onText={() => addCustom()}
                    onPill={() => addCustom(undefined, true)}
                    onImage={addImage}
                    onRule={addRule}
                    onShape={(sh) => addCustom(sh)}
                  />
                </div>
              )}
              {status && (
                <p
                  role="status"
                  className={`mt-2 flex flex-wrap items-center justify-center gap-2 text-center text-xs md:hidden ${
                    status.kind === "error" ? "text-destructive" : "text-primary"
                  }`}
                >
                  {status.text}
                  {status.undo && (
                    <button
                      type="button"
                      onClick={status.undo}
                      className="font-medium underline underline-offset-2"
                    >
                      Rückgängig
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>
        </main>
      </div>

      <div
        aria-hidden
        ref={exportRef}
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <CvCanvas
          data={data}
          design={design}
          chromeOptions={chromeOptions}
          chromeContact={chromeContact}
          elements={elements}
          elementStyles={elementStyles}
          exportMode
        />
      </div>

      <DossierExportDialog
        open={dossierReviewOpen}
        cvPageCount={dossierCvPageCount}
        warnings={dossierWarnings}
        coverChanged={coverChanged}
        downloading={downloading}
        onClose={closeDossierReview}
        onDownload={downloadDossierPdf}
      />

      {canDownloadDossierPdf && (dossierReviewOpen || downloading) ? (
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
            cv={currentCvDocument}
            chromeState={chromeState}
            onCvLayoutWarnings={receiveDossierWarnings}
            onCvPageCount={setDossierCvPageCount}
          />
        </div>
      ) : null}
    </div>
  );
}
