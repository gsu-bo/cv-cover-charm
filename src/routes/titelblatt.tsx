import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  FormBeilagen,
  FormBetrieb,
  FormBewerbung,
  FormFoto,
  FormMeta,
  FormOrtDatum,
  FormPerson,
} from "@/components/cover/CoverForm";
import { CoverCanvas, type Point } from "@/components/cover/CoverCanvas";
import { TemplatePicker } from "@/components/cover/TemplatePicker";
import { normalizeActiveTemplateId } from "@/components/cover/fresh-templates";
import { useTemplateQaTemplateSwitch } from "@/lib/template-qa-switch";
import { ColorChooser } from "@/components/cover/ColorChooser";
import { ScaledPreview } from "@/components/cover/ScaledPreview";
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
import { ElementBar } from "@/components/cover/ElementBar";
import { AddElementMenu } from "@/components/cover/AddElementMenu";
import type { CvLayoutWarning } from "@/components/cv/CvCanvas";
import { DossierExportDialog } from "@/components/dossier/DossierExportDialog";
import { DossierPdfCanvas } from "@/components/dossier/DossierPdfCanvas";
import { ResizableEditorPanel } from "@/components/dossier/ResizableEditorPanel";
import {
  coverPdfHasContent,
  cvPdfDocumentFromSaved,
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
import { Section } from "@/components/cover/Section";
import { buildBlocks, type StyleOverrides } from "@/components/cover/layouts";
import { downloadBlob, safeFileName } from "@/lib/download";
import { downloadCombinedDossierPdf } from "@/lib/dossier-pdf";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  createDossierProject,
  parseDossierProject,
  readStoredDossierPart,
  storeDossierProject,
} from "@/lib/dossier-project";
import { readPhoto } from "@/lib/image";
import { coverDraftFingerprint } from "@/lib/dossier";
import { dossierPhotoStyleFromBlockStyle } from "@/lib/dossier-photo";
import { useForeignWrite, usePageVisible } from "@/lib/autosave";
import {
  describe,
  formatWhen,
  hasContent,
  HISTORY_KEYS,
  pushSnapshot,
  readHistory,
  type Snapshot,
} from "@/lib/history";
import { DEFAULTS, FONT, PAGE, PDF, PREVIEW, SHAPE } from "@/default-config";
import {
  DEFAULT_DOSSIER_CHROME_STATE,
  getDossierChromeState,
  subscribeDossierChrome,
} from "@/lib/dossier-chrome";

import {
  customKind,
  DEFAULT_COVER_BEILAGEN,
  DEMO_DATA,
  EMPTY_META,
  FONT_LABELS,
  TEMPLATES,
  withoutBlockGeometry,
  type Block,
  type BlockStyle,
  type CoverData,
  type CustomField,
  type FontKey,
  type PdfMeta,
  type ShapeKind,
  type TemplateId,
} from "@/components/cover/types";

export const Route = createFileRoute("/titelblatt")({
  head: () => ({
    meta: [
      { title: "Lehrstellen-Titelblatt Generator – Bewerbung Schweiz" },
      {
        name: "description",
        content:
          "Kostenloser Generator für das Deckblatt deiner Lehrstellenbewerbung in der Schweiz. Vorlagen wählen, Farben anpassen, als PDF herunterladen.",
      },
      { property: "og:title", content: "Lehrstellen-Titelblatt Generator – Bewerbung Schweiz" },
      {
        property: "og:description",
        content:
          "Kostenloser Generator für das Deckblatt deiner Lehrstellenbewerbung in der Schweiz. Vorlagen wählen, Farben anpassen, als PDF herunterladen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Titelblatt,
});

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const emptyData: CoverData = {
  meta: { ...EMPTY_META },
  kicker: "",
  eyebrow: "",
  beruf: "",
  lehrbeginn: "",
  vorname: "",
  nachname: "",
  adresse: "",
  plzOrt: "",
  telefon: "",
  email: "",
  geburtsdatum: "",
  lehrbetrieb: "",
  ansprechperson: "",
  betriebAdresse: "",
  showBetriebOnCover: false,
  showBeilagenOnCover: true,
  beilagen: [...DEFAULT_COVER_BEILAGEN],
  ort: "",
  datum: "",
  labelKontakt: "",
  labelEmpfaenger: "",
  foto: null,
};

const STORAGE_KEY = COVER_STORAGE_KEY;
/**
 * 5 = Bild-Elemente (`kind`/`src` an den eigenen Feldern).
 * 6 = eigene Titel (`labelKontakt`/`labelEmpfaenger`), acht Schriften,
 *     Farbverläufe an Formen, Trennlinien als Blöcke.
 * 7 = gemeinsame Dossier-Schrift für Titelblatt und Lebenslauf.
 * 8 = Sichtbarkeit Firma / Lehrbetrieb und native Beilagenrubrik.
 */
const SAVE_VERSION = 8;

const validFont = (value: unknown): FontKey | null =>
  typeof value === "string" && value in FONT_LABELS ? (value as FontKey) : null;

/** Ort und Datum vorbelegen, ohne Eingaben zu überschreiben. */
const prefill = (d: CoverData): CoverData => ({
  ...d,
  meta: { ...EMPTY_META, ...(d.meta ?? {}) },
  datum: d.datum || today(),
  ort: d.ort || DEFAULTS.LOCATION,
  kicker: d.kicker || DEFAULTS.KICKER,
  showBetriebOnCover: d.showBetriebOnCover === true,
  showBeilagenOnCover: d.showBeilagenOnCover !== false,
  beilagen: Array.isArray(d.beilagen) ? [...d.beilagen] : [...DEFAULT_COVER_BEILAGEN],
});

function defaultColors(templateId: TemplateId): Record<string, string> {
  const t = TEMPLATES.find((x) => x.id === templateId)!;
  return Object.fromEntries(t.slots.map((s) => [s.key, s.default]));
}

const allDefaultColors = () =>
  Object.fromEntries(TEMPLATES.map((t) => [t.id, defaultColors(t.id)])) as Record<
    TemplateId,
    Record<string, string>
  >;

const allEmptyLayouts = () =>
  Object.fromEntries(TEMPLATES.map((t) => [t.id, {}])) as Record<TemplateId, StyleOverrides>;

type SectionKey =
  | "vorlage"
  | "farben"
  | "typo"
  | "bewerbung"
  | "person"
  | "foto"
  | "betrieb"
  | "beilagen"
  | "ortDatum"
  | "meta";

const filled = (values: (string | null)[]) => values.filter((v) => v && v.trim()).length;

/**
 * Vorlagen-Titel, deren Wortlaut überschrieben werden darf.
 * Die Vorlagen schreiben unterschiedlich ("Kontakt", "An", "Für", …) – der
 * eigene Text gilt dann für alle.
 */
const TITLE_FIELDS: Record<string, "labelKontakt" | "labelEmpfaenger"> = {
  kontaktTitel: "labelKontakt",
  anTitel: "labelEmpfaenger",
};

/** Was die Vorlage an dieser Stelle schreiben würde – als Platzhalter im Feld. */
function templateTitle(block: Block): string {
  const first = block.lines[0];
  return typeof first === "string" ? first : "";
}

/** Importierte Elemente auf die erwartete Form bringen. */
function sanitizeCustoms(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c, i) => {
      const shape = (["circle", "rect", "line", "path"] as const).find((k) => k === c.shape);
      // Ältere Entwürfe kennen `kind` noch nicht – dort entscheidet `shape`.
      const kind =
        (["text", "shape", "image"] as const).find((k) => k === c.kind) ??
        (shape ? "shape" : "text");
      return {
        id: typeof c.id === "string" ? c.id : `custom-import-${i}`,
        label: typeof c.label === "string" ? c.label : "Eigenes Feld",
        text: typeof c.text === "string" ? c.text : "",
        page: c.page === 2 ? 2 : c.page === 1 ? 1 : undefined,
        kind,
        shape,
        path: typeof c.path === "string" ? c.path : undefined,
        // nur Data-URLs übernehmen: ein importierter http-Link würde beim
        // PDF-Export als leere Fläche enden
        src:
          typeof c.src === "string" && c.src.startsWith("data:")
            ? c.src
            : kind === "image"
              ? null
              : undefined,
      };
    });
}

function Titelblatt() {
  const chromeState = useSyncExternalStore(
    subscribeDossierChrome,
    getDossierChromeState,
    () => DEFAULT_DOSSIER_CHROME_STATE,
  );
  const [data, setData] = useState<CoverData>(emptyData);
  const [template, setTemplate] = useState<TemplateId>(DEFAULTS.TEMPLATE);
  useTemplateQaTemplateSwitch(template, setTemplate, "both");
  const [colorsByTemplate, setColorsByTemplate] =
    useState<Record<TemplateId, Record<string, string>>>(allDefaultColors);
  const [layoutByTemplate, setLayoutByTemplate] =
    useState<Record<TemplateId, StyleOverrides>>(allEmptyLayouts);
  const [customs, setCustoms] = useState<CustomField[]>([]);
  const [fontScale, setFontScale] = useState<number>(FONT.DEFAULT_SCALE);
  const [documentFont, setDocumentFont] = useState<FontKey | null>("freundlich");
  const [selected, setSelected] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawing, setDrawing] = useState(false);
  /** Zweiter Klick bestätigt das Leeren – das Formular ist sonst weg. */
  const [confirmReset, setConfirmReset] = useState(false);
  /** Dasselbe für "Alles zurücksetzen" im Menü oben rechts. */
  const [confirmWipe, setConfirmWipe] = useState(false);
  /** … und für die Demo-Daten, die alle Eingaben überschreiben. */
  const [confirmDemo, setConfirmDemo] = useState(false);
  /** Die Liste der früheren Stände ist zugeklappt, bis man sie aufruft. */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [zoom, setZoom] = useState<number>(PREVIEW.ZOOM_DEFAULT);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [storedCvDocument, setStoredCvDocument] = useState<CvPdfDocument | null>(null);
  const [dossierReviewOpen, setDossierReviewOpen] = useState(false);
  const [dossierWarnings, setDossierWarnings] = useState<CvLayoutWarning[] | null>(null);
  const [dossierCvPageCount, setDossierCvPageCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [status, setStatus] = useState<{
    kind: "ok" | "error";
    text: string;
    /** Optionale Sofort-Rücknahme, z. B. nach dem Entfernen eines Elements. */
    undo?: () => void;
  } | null>(null);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    vorlage: false,
    farben: false,
    typo: false,
    bewerbung: true,
    person: false,
    foto: false,
    betrieb: false,
    beilagen: false,
    ortDatum: false,
    meta: false,
  });
  const [fitHeight, setFitHeight] = useState<number | undefined>(undefined);

  const visible = usePageVisible();
  const { markWritten, changedElsewhere } = useForeignWrite(STORAGE_KEY);

  const menuRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const dossierExportRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  const activeTemplate = useMemo(() => TEMPLATES.find((t) => t.id === template)!, [template]);
  const colors = colorsByTemplate[template];
  const overrides = layoutByTemplate[template];
  const blocks = useMemo(() => {
    const built = buildBlocks(template, data, customs, overrides, activeTemplate.slots);
    if (!documentFont) return built;
    return built.map((block) =>
      overrides[block.id]?.font
        ? block
        : { ...block, style: { ...block.style, font: documentFont } },
    );
  }, [template, data, customs, overrides, activeTemplate, documentFont]);
  const selectedBlock = blocks.find((b) => b.id === selected) ?? null;
  const selectedCustom = customs.find((c) => c.id === selected) ?? null;
  const titleField = selectedBlock ? TITLE_FIELDS[selectedBlock.id] : undefined;
  const currentCoverDocument = useMemo<CoverPdfDocument>(
    () => ({ template, data, colors, blocks, fontScale }),
    [template, data, colors, blocks, fontScale],
  );
  const coverReadyForDossier = coverPdfHasContent(data, customs);
  const cvReadyForDossier = !!storedCvDocument && cvPdfHasContent(storedCvDocument.data);
  const canDownloadDossierPdf = coverReadyForDossier && cvReadyForDossier;
  const dossierPdfHint = !coverReadyForDossier
    ? cvReadyForDossier
      ? "Zuerst das Titelblatt bearbeiten."
      : "Zuerst Titelblatt und Lebenslauf bearbeiten."
    : "Zuerst den Lebenslauf bearbeiten.";

  const toggleSection = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const patch = (p: Partial<CoverData>) => setData((d) => ({ ...d, ...p }));
  const setColor = (key: string, value: string) =>
    setColorsByTemplate((c) => ({ ...c, [template]: { ...c[template], [key]: value } }));
  const resetColors = () =>
    setColorsByTemplate((c) => ({ ...c, [template]: defaultColors(template) }));

  const patchStyle = useCallback(
    (id: string, p: Partial<BlockStyle>) =>
      setLayoutByTemplate((l) => ({
        ...l,
        [template]: { ...l[template], [id]: { ...(l[template][id] ?? {}), ...p } },
      })),
    [template],
  );
  const resetBlock = (id: string) =>
    setLayoutByTemplate((l) => {
      const next = { ...l[template] };
      delete next[id];
      return { ...l, [template]: next };
    });
  const resetLayout = () => {
    setLayoutByTemplate((l) => ({ ...l, [template]: {} }));
    setFontScale(FONT.DEFAULT_SCALE);
    setDocumentFont("freundlich");
  };

  /**
   * Alle Positionen zurück auf die Vorlage – über *alle* Vorlagen hinweg.
   *
   * Die Überschreibungen enthalten auch `hidden`; entfernte Elemente wie der
   * Fotorahmen kommen damit von selbst zurück.
   */
  const resetAllLayouts = useCallback(() => {
    setLayoutByTemplate(allEmptyLayouts());
    setFontScale(FONT.DEFAULT_SCALE);
    setDocumentFont("freundlich");
    setSelected(null);
  }, []);

  /**
   * Trennlinie über die ganze Textbreite. Technisch dieselbe Form wie "Linie",
   * nur breit voreingestellt – als Trenner über Fussangaben der Normalfall.
   */
  /** Ein fertig gebautes Element einhängen: Inhalt speichern, Stil anlegen. */
  const place = ({ field, style }: NewElement) => {
    setCustoms((c) => [...c, field]);
    if (style) patchStyle(field.id, style);
    setSelected(field.id);
    return field.id;
  };

  const addRule = () => {
    place(newRuleElement(customs));
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
        ? newShapeElement(customs, shape)
        : newTextElement(
            customs,
            pill
              ? (activeTemplate.slots[activeTemplate.slots.length - 1]?.key ?? "accent")
              : undefined,
          ),
    );
  };

  /**
   * Bild-Element einfügen. Das Bewerbungsfoto bleibt ein eigener Block der
   * Vorlage; hierüber lassen sich beliebig viele weitere Bilder platzieren.
   */
  const addImage = () => {
    place(newImageElement(customs));
    setStatus({ kind: "ok", text: "Bild-Element eingefügt – unten „Bild wählen“." });
  };

  /** Datei in ein Bild-Element laden (null leert es wieder). */
  const pickImage = async (id: string, file: File | null) => {
    if (!file) {
      patchCustom(id, { src: null });
      return;
    }
    try {
      const src = await readPhoto(file);
      patchCustom(id, { src });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "Bild nicht lesbar" });
    }
  };

  const addDrawnShape = (points: Point[]) => {
    setDrawing(false);
    place(newDrawnElement(customs, points, SHAPE.MIN_DRAW));
  };
  const patchCustom = (id: string, p: Partial<CustomField>) =>
    setCustoms((c) => c.map((f) => (f.id === id ? { ...f, ...p } : f)));

  /**
   * Element entfernen – mit Rücknahme.
   *
   * Selbst eingefügte Elemente verschwinden ganz, Elemente der Vorlage werden
   * nur ausgeblendet und lassen sich jederzeit wieder einblenden. Damit das
   * niemand raten muss, sagt die Meldung es und bietet den Weg zurück an.
   */
  const removeBlock = (block: Block) => {
    setSelected(null);
    const own = customs.find((c) => c.id === block.id);
    if (own) {
      setCustoms((c) => c.filter((f) => f.id !== block.id));
      setStatus({
        kind: "ok",
        text: `${block.label} gelöscht`,
        undo: () => {
          setCustoms((c) => (c.some((f) => f.id === own.id) ? c : [...c, own]));
          setStatus(null);
        },
      });
      return;
    }
    patchStyle(block.id, { hidden: true });
    setStatus({
      kind: "ok",
      text: `${block.label} ausgeblendet – unter der Vorschau wieder einblendbar`,
      undo: () => {
        patchStyle(block.id, { hidden: false });
        setStatus(null);
      },
    });
  };

  const photoBlock = blocks.find((b) => b.kind === "photo") ?? null;
  const currentCoverTransferFingerprint = useMemo(
    () =>
      coverDraftFingerprint({
        template,
        colors,
        font: documentFont,
        fontScale: fontScale / FONT.DEFAULT_SCALE,
        person: {
          vorname: data.vorname,
          nachname: data.nachname,
          adresse: data.adresse,
          plzOrt: data.plzOrt,
          telefon: data.telefon,
          email: data.email,
          geburtsdatum: data.geburtsdatum,
          nationalitaet: "",
          untertitel: "",
          foto: data.foto,
        },
        photoStyle: dossierPhotoStyleFromBlockStyle(photoBlock?.style),
      }),
    [colors, data, documentFont, fontScale, photoBlock?.style, template],
  );
  const titleCoverChanged =
    !!storedCvDocument?.coverFingerprint &&
    currentCoverTransferFingerprint !== storedCvDocument.coverFingerprint;
  const receiveDossierWarnings = useCallback((next: CvLayoutWarning[]) => {
    setDossierWarnings((current) => {
      const currentShape = current?.map((warning) => `${warning.id}:${warning.message}`).join("|");
      const nextShape = next.map((warning) => `${warning.id}:${warning.message}`).join("|");
      return currentShape === nextShape ? current : next;
    });
  }, []);
  const closeDossierReview = useCallback(() => setDossierReviewOpen(false), []);

  /** Dokumentinfos, die im PDF landen, wenn das Feld leer bleibt. */
  const autoMeta: PdfMeta = useMemo(() => {
    const name = [data.vorname, data.nachname].filter(Boolean).join(" ");
    const titel = ["Titelblatt", name].filter(Boolean).join(" – ");
    const betreff = [data.kicker, data.beruf].filter(Boolean).join(" ").trim();
    return {
      title: data.beruf ? `${titel} – ${data.beruf}` : titel,
      author: name,
      subject: betreff || "Bewerbung",
      keywords: ["Bewerbung", "Lehrstelle", data.beruf, data.lehrbetrieb, data.ort]
        .filter(Boolean)
        .join(", "),
    };
  }, [data.vorname, data.nachname, data.beruf, data.kicker, data.lehrbetrieb, data.ort]);

  const hiddenBlocks = blocks.filter((b) => b.style.hidden);
  // Intern bleibt 1.2 der bewährte Vorlagen-Standard. Für Nutzende ist dieser
  // Wert aber schlicht 100 %, damit der Regler wie ein normaler Zoom/Skalierungsregler funktioniert.
  const fontScaleUi = fontScale / FONT.DEFAULT_SCALE;
  const fontScalePercent = Math.round(fontScaleUi * 100);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmWipe(false);
        setConfirmDemo(false);
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Menü zu heisst: beim nächsten Öffnen wieder mit zugeklappter Liste
  // starten. Deckt auch die Fälle ab, in denen sich das Menü selbst schliesst.
  useEffect(() => {
    if (!menuOpen) setHistoryOpen(false);
  }, [menuOpen]);

  useEffect(() => {
    if (!status) return;
    // Rücknahme braucht Lesezeit, blosse Bestätigungen nicht
    const t = setTimeout(() => setStatus(null), status.undo ? 9000 : 4000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setMenuOpen(false);
        setDrawing(false);
        setConfirmReset(false);
        setConfirmWipe(false);
        setConfirmDemo(false);
        setHistoryOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Vorschau soll ohne Scrollen ganz sichtbar sein.
  useEffect(() => {
    const update = () => setFitHeight(window.innerHeight - 230);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  /** Gespeicherten Entwurf in den Zustand holen. Gibt zurück, ob es einen gab. */
  const loadFromStorage = useCallback((): boolean => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!saved) return false;
    try {
      const p = JSON.parse(saved);
      if (p.data) setData(prefill({ ...emptyData, ...p.data }));
      if (p.template) setTemplate(normalizeActiveTemplateId(p.template));
      if (p.colors) setColorsByTemplate((c) => ({ ...c, ...p.colors }));
      if (p.layout) setLayoutByTemplate((l) => ({ ...l, ...p.layout }));
      setCustoms(sanitizeCustoms(p.customs));
      if (typeof p.fontScale === "number") setFontScale(p.fontScale);
      setDocumentFont(validFont(p.font));
      markWritten(saved);
      setSaveState("saved");
      return true;
    } catch {
      // beschädigter Entwurf – mit leerem Formular weitermachen
      return false;
    }
  }, [markWritten]);

  // Entwurf laden (nach der Hydration, damit Server und Client übereinstimmen).
  useEffect(() => {
    restored.current = true;
    setHistory(readHistory(HISTORY_KEYS.cover));
    if (!loadFromStorage()) setData(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Den gespeicherten CV für Vorschau und gemeinsamen PDF-Export aktuell halten. */
  useEffect(() => {
    const refresh = () =>
      setStoredCvDocument(cvPdfDocumentFromSaved(readStoredDossierPart(CV_STORAGE_KEY)));
    const onStorage = (event: StorageEvent) => {
      if (event.key === CV_STORAGE_KEY) refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /*
   * Zurück im Tab: hat inzwischen ein anderes Fenster geschrieben, gilt dessen
   * Stand. Ein schlafender Tab hat nichts Neues beizutragen – sein alter
   * Zustand würde die frischere Arbeit sonst überschreiben.
   */
  useEffect(() => {
    if (!visible || !restored.current) return;
    if (changedElsewhere()) {
      loadFromStorage();
      setHistory(readHistory(HISTORY_KEYS.cover));
      setStatus({ kind: "ok", text: "Neuerer Stand aus einem anderen Fenster geladen" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** Der laufende Entwurf, so wie er gespeichert bzw. exportiert wird. */
  const snapshotPayload = useCallback(
    () => ({
      version: SAVE_VERSION,
      template,
      colors: colorsByTemplate,
      layout: layoutByTemplate,
      customs,
      fontScale,
      font: documentFont,
      data,
    }),
    [template, colorsByTemplate, layoutByTemplate, customs, fontScale, documentFont, data],
  );

  /**
   * Aktuellen Stand in die Historie legen.
   *
   * `force` vor jedem Zurücksetzen: dort zählt jeder Stand, auch wenn eben
   * erst einer entstanden ist. Ein leeres Formular ist nichts wert und wird
   * übersprungen.
   */
  const keepSnapshot = useCallback(
    (label: string, force = false) => {
      const payload = snapshotPayload();
      if (!hasContent(payload)) return;
      setHistory(pushSnapshot(HISTORY_KEYS.cover, payload, label, force));
    },
    [snapshotPayload],
  );

  // Entwurf sichern
  useEffect(() => {
    if (!restored.current) return;
    // Im Hintergrund nicht speichern – sonst überschreibt ein schlafender Tab
    // die Arbeit des aktiven Fensters.
    if (!visible) return;
    setSaveState("saving");
    const id = setTimeout(() => {
      try {
        const text = JSON.stringify(snapshotPayload());
        localStorage.setItem(STORAGE_KEY, text);
        markWritten(text);
        setSaveState("saved");
      } catch {
        // Speicher voll (z. B. sehr grosses Foto) – Bearbeiten geht trotzdem weiter
        setSaveState("error");
      }
      // Nebenher einen Stand ohne Bilder ablegen. `pushSnapshot` bremst selbst,
      // sonst entstünde bei jedem Tastendruck ein Eintrag.
      keepSnapshot("Automatisch");
    }, 400);
    return () => clearTimeout(id);
  }, [snapshotPayload, keepSnapshot, visible, markWritten]);

  /*
   * Beide Knöpfe setzen auch das Layout zurück. Sonst wirkt ein frisch
   * gefülltes Blatt kaputt: verschobene Elemente von vorher bleiben stehen und
   * ein entfernter Fotorahmen fehlt weiter, obwohl "neu angefangen" wurde.
   */
  const loadDemo = () => {
    keepSnapshot("Vor den Demo-Daten", true);
    setData(prefill({ ...DEMO_DATA, datum: "", ort: "", kicker: "" }));
    resetAllLayouts();
    setMenuOpen(false);
    setConfirmDemo(false);
    setStatus({ kind: "ok", text: "Beispieldaten eingefügt, Positionen zurückgesetzt" });
  };
  const resetForm = () => {
    keepSnapshot("Vor dem Leeren", true);
    setData(prefill(emptyData));
    resetAllLayouts();
    setConfirmReset(false);
    setStatus({ kind: "ok", text: "Formular geleert – frühere Stände im Menü oben rechts" });
  };

  /** Werkseinstellung: Eingaben, Layout, Farben, eigene Elemente, Vorlage. */
  const resetEverything = () => {
    keepSnapshot("Vor dem Zurücksetzen", true);
    setData(prefill(emptyData));
    setColorsByTemplate(allDefaultColors());
    setCustoms([]);
    setTemplate(DEFAULTS.TEMPLATE);
    resetAllLayouts();
    setMenuOpen(false);
    setConfirmWipe(false);
    setStatus({ kind: "ok", text: "Alles zurückgesetzt – frühere Stände im Menü oben rechts" });
  };

  /**
   * Früheren Stand laden. Der aktuelle wandert vorher in die Historie, damit
   * das Zurückholen selbst nicht das Einzige ist, was man nicht rückgängig
   * machen kann. Bilder fehlen in der Historie und bleiben deshalb, wie sie
   * sind – sonst wäre ein hochgeladenes Foto beim Zurückholen plötzlich weg.
   */
  const restoreSnapshot = (snap: Snapshot) => {
    keepSnapshot("Vor dem Zurückholen", true);
    const p = snap.payload as {
      data?: Partial<CoverData>;
      template?: TemplateId;
      colors?: Partial<Record<TemplateId, Record<string, string>>>;
      layout?: Partial<Record<TemplateId, StyleOverrides>>;
      customs?: unknown;
      fontScale?: number;
      font?: FontKey | null;
    };
    if (p.data) setData(prefill({ ...emptyData, ...p.data, foto: data.foto }));
    if (p.template) setTemplate(normalizeActiveTemplateId(p.template));
    if (p.colors) setColorsByTemplate((c) => ({ ...c, ...p.colors }));
    setLayoutByTemplate({ ...allEmptyLayouts(), ...(p.layout ?? {}) });
    setCustoms(sanitizeCustoms(p.customs));
    if (typeof p.fontScale === "number") setFontScale(p.fontScale);
    setDocumentFont(validFont(p.font));
    setSelected(null);
    setMenuOpen(false);
    setStatus({ kind: "ok", text: `Stand von ${formatWhen(snap.at)} geladen` });
  };

  const resetPositionsOnly = () => {
    setLayoutByTemplate(
      (current) =>
        Object.fromEntries(
          Object.entries(current).map(([templateId, overrides]) => [
            templateId,
            Object.fromEntries(
              Object.entries(overrides).map(([blockId, style]) => [
                blockId,
                withoutBlockGeometry(style),
              ]),
            ),
          ]),
        ) as Record<TemplateId, StyleOverrides>,
    );
    setSelected(null);
    setMenuOpen(false);
    setStatus({ kind: "ok", text: "Alle Positionen und Grössen zurückgesetzt" });
  };

  const fileBase = () => {
    const n = [data.vorname, data.nachname].filter(Boolean).join("-");
    return safeFileName(n ? `Titelblatt-${n}` : "Titelblatt");
  };

  const dossierFileBase = () => {
    const n = [data.vorname, data.nachname].filter(Boolean).join("-");
    return safeFileName(n ? `Bewerbungsdossier-${n}` : "Bewerbungsdossier");
  };

  const downloadPdf = async () => {
    if (!exportRef.current || downloading) return;
    setMenuOpen(false);
    setSelected(null);
    setDownloading(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(exportRef.current, {
        scale: PDF.SCALE,
        backgroundColor: colors.bg ?? "#ffffff",
        useCORS: true,
        width: PAGE.WIDTH,
        height: PAGE.HEIGHT,
        windowWidth: PAGE.WIDTH,
        windowHeight: PAGE.HEIGHT,
        scrollX: 0,
        scrollY: 0,
      });
      const img = canvas.toDataURL("image/jpeg", PDF.QUALITY);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      pdf.setProperties({
        title: data.meta.title || autoMeta.title,
        author: data.meta.author || autoMeta.author,
        subject: data.meta.subject || autoMeta.subject,
        keywords: data.meta.keywords || autoMeta.keywords,
        creator: "Lehrstellen-Titelblatt",
      });
      pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      downloadBlob(pdf.output("blob"), `${fileBase()}.pdf`);
      setStatus({ kind: "ok", text: "PDF heruntergeladen" });
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
    setDownloading(true);
    const name = [data.vorname, data.nachname].filter(Boolean).join(" ");
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

  const downloadDossier = () => {
    setMenuOpen(false);
    const project = createDossierProject({
      cover: snapshotPayload(),
      cv: readStoredDossierPart(CV_STORAGE_KEY),
    });
    downloadBlob(
      new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
      `${dossierFileBase()}.json`,
    );
    setStatus({ kind: "ok", text: "Bewerbungsdossier gespeichert" });
  };

  const importJson = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setStatus({ kind: "error", text: "Datei konnte nicht gelesen werden." });
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const project = parseDossierProject(parsed);
        if (project) {
          keepSnapshot("Vor dem Laden", true);
          const loaded = storeDossierProject(project);
          if (loaded.cover) loadFromStorage();
          if (loaded.cv) setStoredCvDocument(cvPdfDocumentFromSaved(project.cv));
          setSaveState("saved");
          setStatus({
            kind: "ok",
            text:
              loaded.cover && loaded.cv
                ? "Dossier geladen: Titelblatt und Lebenslauf"
                : loaded.cover
                  ? "Titelblatt aus dem Dossier geladen"
                  : "Lebenslauf gespeichert – öffne ihn über die Übersicht",
          });
          return;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("kein Titelblatt-Entwurf");
        }
        const legacy = parsed as Record<string, unknown>;
        if (!legacy.data || typeof legacy.data !== "object") {
          throw new Error("kein Titelblatt-Entwurf");
        }
        keepSnapshot("Vor dem Laden", true);
        setData(prefill({ ...emptyData, ...(legacy.data as Partial<CoverData>) }));
        if (typeof legacy.template === "string") {
          setTemplate(normalizeActiveTemplateId(legacy.template));
        }
        if (legacy.colors)
          setColorsByTemplate((c) => ({
            ...c,
            ...(legacy.colors as Partial<Record<TemplateId, Record<string, string>>>),
          }));
        if (legacy.layout)
          setLayoutByTemplate((l) => ({
            ...l,
            ...(legacy.layout as Partial<Record<TemplateId, StyleOverrides>>),
          }));
        setCustoms(sanitizeCustoms(legacy.customs));
        if (typeof legacy.fontScale === "number") setFontScale(legacy.fontScale);
        setDocumentFont(validFont(legacy.font));
        setStatus({ kind: "ok", text: "Älteren Titelblatt-Entwurf geladen" });
      } catch {
        setStatus({ kind: "error", text: "Diese JSON-Datei ist kein gültiger Entwurf." });
      }
    };
    reader.readAsText(file);
  };

  const personCount = filled([
    data.vorname,
    data.nachname,
    data.adresse,
    data.plzOrt,
    data.telefon,
    data.geburtsdatum,
    data.email,
  ]);

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
            <h1 className="truncate text-sm font-semibold sm:text-base">Lehrstellen-Titelblatt</h1>
            <div className="flex min-w-0 items-center gap-2">
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Deckblatt für deine Bewerbung – Schweiz
              </p>
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
                className="rounded-md border border-input bg-background px-2 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                title="Zoom der Vorschau"
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
                    onClick={downloadPdf}
                    className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <EditorMenuLabel icon={FileDown}>Nur Titelblatt als PDF</EditorMenuLabel>
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
                  {/* Demo überschreibt Eingaben und Positionen – darum die Rückfrage */}
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

                  {/*
                    Ganz unten und zunächst zugeklappt: die Liste kann lang
                    werden und würde die eigentlichen Menüpunkte nach unten
                    drücken. Stände entstehen nebenher und vor jedem
                    Zurücksetzen – wer versehentlich leert, holt sie hier
                    zurück. Bilder sind darin nicht enthalten.
                  */}
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
                            Ohne Bilder – ein geladenes Foto bleibt erhalten.
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

                  {/* Werkseinstellung – zweistufig, weil dabei alles verloren geht */}
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
        {/* Formular-Panel: schiebt sich nach links raus, die Vorschau wächst nach */}
        <ResizableEditorPanel open={panelOpen}>
          <div className="flex w-[min(92vw,420px)] max-w-full flex-col gap-3 p-3 sm:w-full">
            <div className="flex items-center justify-between gap-2 px-1">
              {confirmReset ? (
                <>
                  <span className="text-xs font-medium text-destructive">
                    Alle Eingaben löschen?
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                    >
                      Ja, leeren
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                    >
                      Abbrechen
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    Alles ausfüllen, dann schliessen.
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Formular leeren
                  </button>
                </>
              )}
            </div>

            <Section
              title="Bewerbung"
              open={open.bewerbung}
              onToggle={() => toggleSection("bewerbung")}
              hint={`${filled([data.beruf, data.lehrbeginn])} / 2`}
            >
              <FormBewerbung data={data} onChange={patch} />
            </Section>

            <Section
              title="Firma / Lehrbetrieb"
              open={open.betrieb}
              onToggle={() => toggleSection("betrieb")}
              hint={
                data.showBetriebOnCover === true
                  ? `${filled([data.lehrbetrieb, data.ansprechperson, data.betriebAdresse])} / 3 · angezeigt`
                  : "ausgeblendet"
              }
            >
              <FormBetrieb data={data} onChange={patch} />
            </Section>

            <Section
              title="Persönliche Angaben"
              open={open.person}
              onToggle={() => toggleSection("person")}
              hint={`${personCount} / 7`}
            >
              <FormPerson data={data} onChange={patch} />
            </Section>

            <Section
              title="Foto"
              open={open.foto}
              onToggle={() => toggleSection("foto")}
              hint={data.foto ? "gesetzt" : "optional"}
            >
              <FormFoto
                data={data}
                onChange={(p) => {
                  patch(p);
                  // Wer ein Foto hochlädt, will es auch sehen – ein zuvor
                  // ausgeblendeter Fotorahmen kommt dafür zurück.
                  if (p.foto && photoBlock?.style.hidden) {
                    patchStyle(photoBlock.id, { hidden: false });
                  }
                }}
                onError={(text) => setStatus({ kind: "error", text })}
                photoStyle={photoBlock?.style}
                onPhotoStyle={photoBlock ? (p) => patchStyle(photoBlock.id, p) : undefined}
                onAddImage={addImage}
              />
            </Section>

            <Section
              title="Ort & Datum"
              open={open.ortDatum}
              onToggle={() => toggleSection("ortDatum")}
              hint={`${filled([data.ort, data.datum])} / 2`}
            >
              <FormOrtDatum data={data} onChange={patch} />
            </Section>

            <Section
              title="Beilagen"
              open={open.beilagen}
              onToggle={() => toggleSection("beilagen")}
              hint={data.showBeilagenOnCover !== false ? "angezeigt" : "ausgeblendet"}
            >
              <FormBeilagen data={data} onChange={patch} />
            </Section>

            <div className="mt-2 h-px bg-border" />

            <Section
              title="Vorlage"
              open={open.vorlage}
              onToggle={() => toggleSection("vorlage")}
              hint={activeTemplate.name}
            >
              <TemplatePicker value={template} onChange={setTemplate} />
            </Section>

            <Section
              title="Farben"
              open={open.farben}
              onToggle={() => toggleSection("farben")}
              hint={`${activeTemplate.slots.length}`}
            >
              <ColorChooser
                slots={activeTemplate.slots}
                colors={colors}
                onChange={setColor}
                onApplyPalette={(next) => setColorsByTemplate((c) => ({ ...c, [template]: next }))}
                onReset={resetColors}
              />
            </Section>

            <Section
              title="Schrift und Layout"
              open={open.typo}
              onToggle={() => toggleSection("typo")}
              hint={`${fontScalePercent} %`}
            >
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-xs">
                  <span className="text-muted-foreground">Schriftart gesamtes Dossier</span>
                  <select
                    value={documentFont ?? "template"}
                    onChange={(event) => setDocumentFont(validFont(event.target.value))}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                    Wird beim Übernehmen auch im Lebenslauf verwendet. Einzelne freie Textfelder
                    dürfen weiterhin abweichen.
                  </span>
                </label>

                <label className="flex flex-col gap-2 text-xs">
                  <span className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Schriftgrösse gesamt {fontScalePercent} %
                    </span>
                    <button
                      type="button"
                      onClick={() => setFontScale(FONT.DEFAULT_SCALE)}
                      className="text-muted-foreground underline hover:text-foreground"
                    >
                      100 %
                    </button>
                  </span>
                  <input
                    type="range"
                    min={Math.min(FONT.SCALE_MIN, fontScaleUi)}
                    max={Math.max(FONT.SCALE_MAX, fontScaleUi)}
                    step={0.05}
                    value={fontScaleUi}
                    onChange={(e) => setFontScale(Number(e.target.value) * FONT.DEFAULT_SCALE)}
                    className="w-full accent-primary"
                  />
                  <span className="text-muted-foreground/80">
                    Skaliert alle Texte. Einzelne Elemente stellst du direkt in der Vorschau ein.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={resetLayout}
                  className="self-start text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Layout zurücksetzen
                </button>

                {hiddenBlocks.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-md border border-dashed p-2">
                    <span className="text-xs text-muted-foreground">Ausgeblendet</span>
                    <div className="flex flex-wrap gap-1">
                      {hiddenBlocks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => patchStyle(b.id, { hidden: false })}
                          className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                        >
                          {b.label} einblenden
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            <Section
              title="PDF-Angaben"
              open={open.meta}
              onToggle={() => toggleSection("meta")}
              hint={filled(Object.values(data.meta)) ? "angepasst" : "automatisch"}
            >
              <FormMeta
                meta={data.meta}
                auto={autoMeta}
                onChange={(p) => patch({ meta: { ...data.meta, ...p } })}
              />
            </Section>
          </div>
        </ResizableEditorPanel>

        {/* Backdrop auf kleinen Screens – bedienbar ist auch der Button oben */}
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
                <CoverCanvas
                  template={template}
                  data={data}
                  colors={colors}
                  blocks={blocks}
                  selected={selected}
                  onSelect={setSelected}
                  onMove={patchStyle}
                  fontScale={fontScale}
                  drawing={drawing}
                  onDrawn={addDrawnShape}
                />
              </ScaledPreview>
            </div>
          </div>

          {/* Werkzeugleiste unter dem Blatt – verdeckt nie das Element selbst */}
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
                  colors={colors}
                  onChange={(p) => patchStyle(selectedBlock.id, p)}
                  onReset={() => resetBlock(selectedBlock.id)}
                  onClose={() => setSelected(null)}
                  custom={selectedCustom ?? undefined}
                  onCustomChange={
                    selectedCustom ? (p) => patchCustom(selectedCustom.id, p) : undefined
                  }
                  onDelete={() => removeBlock(selectedBlock)}
                  hasPhoto={!!data.foto}
                  // eigene Elemente dürfen ein Bild tragen – beim Textfeld
                  // liegt es hinter dem Text, beim Bild-Element ist es das
                  // Element selbst
                  onPickImage={
                    selectedCustom && customKind(selectedCustom) !== "shape"
                      ? (file) => pickImage(selectedCustom.id, file)
                      : undefined
                  }
                  onAddImage={addImage}
                  title={titleField ? data[titleField] : undefined}
                  titlePlaceholder={titleField ? templateTitle(selectedBlock) : undefined}
                  onTitleChange={titleField ? (v) => patch({ [titleField]: v }) : undefined}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">
                    Element antippen zum Anpassen, ziehen zum Verschieben.
                  </span>

                  {/*
                    Ausgeblendetes direkt hier anbieten und nicht nur tief im
                    Formular: Wer ein Element entfernt, sucht den Weg zurück
                    genau an dieser Stelle.
                  */}
                  {hiddenBlocks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      {hiddenBlocks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => patchStyle(b.id, { hidden: false })}
                          className="rounded-full border border-dashed border-input px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          title={`${b.label} wieder einblenden`}
                        >
                          + {b.label}
                        </button>
                      ))}
                    </div>
                  )}
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

      {/* Unskalierte 1:1-Kopie für den PDF-Export */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: `${PAGE.WIDTH}px`,
          height: `${PAGE.HEIGHT}px`,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <CoverCanvas
          ref={exportRef}
          template={template}
          data={data}
          colors={colors}
          blocks={blocks}
          selected={null}
          onSelect={() => {}}
          onMove={() => {}}
          fontScale={fontScale}
          editable={false}
        />
      </div>

      <DossierExportDialog
        open={dossierReviewOpen}
        cvPageCount={dossierCvPageCount}
        warnings={dossierWarnings}
        coverChanged={titleCoverChanged}
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
            cover={currentCoverDocument}
            cv={storedCvDocument}
            chromeState={chromeState}
            onCvLayoutWarnings={receiveDossierWarnings}
            onCvPageCount={setDossierCvPageCount}
          />
        </div>
      ) : null}
    </div>
  );
}
