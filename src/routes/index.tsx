import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ThemeToggle } from "@/components/cover/ThemeToggle";
import {
  DossierExportDialog,
  type DossierExportFormat,
} from "@/components/dossier/DossierExportDialog";
import { DossierPdfCanvas } from "@/components/dossier/DossierPdfCanvas";
import { ProjectLoadButton } from "@/components/dossier/ProjectFileControls";
import type { CvLayoutWarning } from "@/components/cv/CvCanvas";
import {
  coverPdfDocumentFromSaved,
  coverPdfHasContent,
  cvPdfDocumentFromSaved,
  cvPdfHasContent,
  letterPdfDocumentFromSaved,
  letterPdfHasContent,
  type CoverPdfDocument,
  type CvPdfDocument,
  type LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { downloadCombinedDossierPdf } from "@/lib/dossier-pdf";
import { downloadDossierProjectFromBrowser } from "@/lib/dossier-project-file";
import { downloadDossierDocx, resolveDossierDocxProfile } from "@/lib/dossier-docx-export";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  LETTER_STORAGE_KEY,
  readStoredDossierPart,
} from "@/lib/dossier-project";
import {
  DEFAULT_DOSSIER_CHROME_STATE,
  getDossierChromeState,
  subscribeDossierChrome,
} from "@/lib/dossier-chrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bewerbungsdossier – Titelblatt, Motivationsschreiben und Lebenslauf" },
      {
        name: "description",
        content:
          "Titelblatt, Motivationsschreiben und Lebenslauf für deine Lehrstellenbewerbung in der Schweiz – im gleichen Design.",
      },
    ],
  }),
  component: Start,
});

type DossierDocuments = {
  cover: CoverPdfDocument | null;
  letter: LetterPdfDocument | null;
  cv: CvPdfDocument | null;
};

type DossierReadiness = {
  cover: boolean;
  letter: boolean;
  cv: boolean;
  complete: boolean;
};

function readDossierDocuments(): DossierDocuments {
  return {
    cover: coverPdfDocumentFromSaved(readStoredDossierPart(COVER_STORAGE_KEY)),
    letter: letterPdfDocumentFromSaved(readStoredDossierPart(LETTER_STORAGE_KEY)),
    cv: cvPdfDocumentFromSaved(readStoredDossierPart(CV_STORAGE_KEY)),
  };
}

function dossierReadiness(documents: DossierDocuments): DossierReadiness {
  const cover = !!documents.cover && coverPdfHasContent(documents.cover.data);
  const letter = !!documents.letter && letterPdfHasContent(documents.letter.data);
  const cv = !!documents.cv && cvPdfHasContent(documents.cv.data);
  return { cover, letter, cv, complete: cover && letter && cv };
}

function missingDossierParts(readiness: DossierReadiness): string[] {
  const parts: string[] = [];
  if (!readiness.cover) parts.push("Titelblatt");
  if (!readiness.letter) parts.push("Motivationsschreiben");
  if (!readiness.cv) parts.push("Lebenslauf");
  return parts;
}

/** Eine Kachel des Startbildschirms. */
function Card({
  to,
  onClick,
  title,
  text,
  hint,
  art,
  disabled = false,
}: {
  to?: string;
  onClick?: () => void;
  title: string;
  text: string;
  hint: string;
  art: ReactNode;
  disabled?: boolean;
}) {
  const content = (
    <>
      {/* Kleine Vorschau statt eines Symbols – man sieht, was einen erwartet. */}
      <div className="flex h-44 items-center justify-center border-b bg-muted/40 p-4">{art}</div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <span className="text-lg font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
        <span
          className={`mt-3 text-sm font-medium ${
            disabled ? "text-muted-foreground" : "text-primary group-hover:underline"
          }`}
        >
          {hint}
        </span>
      </div>
    </>
  );

  const className =
    "group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (disabled || (!to && !onClick)) {
    return (
      <div
        className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left opacity-75 shadow-sm"
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link to={to!} className={className}>
      {content}
    </Link>
  );
}

/** Miniatur eines Titelblatts: grosse Fläche, wenig Text. */
function CoverArt() {
  return (
    <svg viewBox="0 0 74 105" className="h-full w-auto drop-shadow" aria-hidden="true">
      <rect width="74" height="105" rx="2" fill="var(--color-background)" />
      <circle cx="52" cy="24" r="14" fill="var(--color-primary)" opacity="0.15" />
      <circle cx="52" cy="24" r="9" fill="var(--color-primary)" opacity="0.55" />
      <rect x="10" y="52" width="12" height="2.4" rx="1.2" fill="var(--color-primary)" />
      <rect x="10" y="59" width="44" height="6" rx="1" fill="var(--color-foreground)" />
      <rect
        x="10"
        y="69"
        width="26"
        height="3"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.6"
      />
      <rect
        x="10"
        y="88"
        width="22"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
      <rect
        x="10"
        y="92"
        width="18"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
      <rect
        x="44"
        y="88"
        width="20"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
      <rect
        x="44"
        y="92"
        width="16"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
    </svg>
  );
}

/** Miniatur eines Lebenslaufs: viel Text, blasser Hintergrund. */
function CvArt() {
  return (
    <svg viewBox="0 0 74 105" className="h-full w-auto drop-shadow" aria-hidden="true">
      <rect width="74" height="105" rx="2" fill="var(--color-background)" />
      <circle cx="60" cy="16" r="10" fill="var(--color-primary)" opacity="0.12" />
      <circle cx="13" cy="15" r="7" fill="var(--color-primary)" opacity="0.5" />
      <rect x="24" y="11" width="26" height="4" rx="1" fill="var(--color-foreground)" />
      <rect
        x="24"
        y="18"
        width="18"
        height="2.4"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.5"
      />
      {[30, 50, 70].map((y) => (
        <g key={y}>
          <rect x="10" y={y} width="14" height="2.4" rx="1.2" fill="var(--color-primary)" />
          {[0, 5, 10].map((d) => (
            <rect
              key={d}
              x="10"
              y={y + 6 + d}
              width={d === 10 ? 38 : 54}
              height="2"
              rx="1"
              fill="var(--color-foreground)"
              opacity="0.35"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Miniatur eines Motivationsschreibens: klare Briefstruktur und viel Fliesstext. */
function LetterArt() {
  return (
    <svg viewBox="0 0 74 105" className="h-full w-auto drop-shadow" aria-hidden="true">
      <rect width="74" height="105" rx="2" fill="var(--color-background)" />
      <rect x="8" y="8" width="58" height="6" rx="1" fill="var(--color-primary)" opacity="0.18" />
      <rect x="10" y="10" width="22" height="2" rx="1" fill="var(--color-primary)" />
      <rect
        x="10"
        y="23"
        width="24"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
      <rect
        x="10"
        y="27"
        width="20"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
      <rect
        x="44"
        y="34"
        width="20"
        height="2"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.3"
      />
      <rect
        x="10"
        y="43"
        width="42"
        height="3"
        rx="1"
        fill="var(--color-foreground)"
        opacity="0.75"
      />
      {[53, 58, 63, 71, 76, 81].map((y, index) => (
        <rect
          key={y}
          x="10"
          y={y}
          width={index === 2 || index === 5 ? 42 : 54}
          height="2"
          rx="1"
          fill="var(--color-foreground)"
          opacity="0.32"
        />
      ))}
      <rect x="10" y="92" width="18" height="2" rx="1" fill="var(--color-primary)" opacity="0.7" />
    </svg>
  );
}

/** Miniatur des Gesamtdossiers: mehrere zusammengehörige A4-Seiten. */
function DossierArt() {
  return (
    <svg viewBox="0 0 92 105" className="h-full w-auto drop-shadow" aria-hidden="true">
      <rect x="28" y="7" width="56" height="88" rx="2" fill="var(--color-muted)" />
      <rect x="18" y="11" width="56" height="88" rx="2" fill="var(--color-background)" />
      <rect
        x="8"
        y="15"
        width="56"
        height="88"
        rx="2"
        fill="var(--color-background)"
        stroke="var(--color-border)"
      />
      <rect x="15" y="25" width="10" height="2.5" rx="1" fill="var(--color-primary)" />
      <rect x="15" y="32" width="34" height="5" rx="1" fill="var(--color-foreground)" />
      {[48, 54, 60, 70, 76, 82].map((y, index) => (
        <rect
          key={y}
          x="15"
          y={y}
          width={index === 2 || index === 5 ? 30 : 40}
          height="2"
          rx="1"
          fill="var(--color-foreground)"
          opacity="0.28"
        />
      ))}
      <path
        d="M67 68v17m0 0-6-6m6 6 6-6"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Start() {
  const chromeState = useSyncExternalStore(
    subscribeDossierChrome,
    getDossierChromeState,
    () => DEFAULT_DOSSIER_CHROME_STATE,
  );
  const [documents, setDocuments] = useState<DossierDocuments>({
    cover: null,
    letter: null,
    cv: null,
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [warnings, setWarnings] = useState<CvLayoutWarning[] | null>(null);
  const [cvPageCount, setCvPageCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [dossierNote, setDossierNote] = useState<string | null>(null);
  const dossierExportRef = useRef<HTMLDivElement>(null);

  const refreshDocuments = useCallback(() => {
    setDocuments(readDossierDocuments());
  }, []);

  useEffect(() => {
    refreshDocuments();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === COVER_STORAGE_KEY ||
        event.key === LETTER_STORAGE_KEY ||
        event.key === CV_STORAGE_KEY
      ) {
        refreshDocuments();
      }
    };
    window.addEventListener("focus", refreshDocuments);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refreshDocuments);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshDocuments]);

  const readiness = useMemo(() => dossierReadiness(documents), [documents]);
  const missingParts = useMemo(() => missingDossierParts(readiness), [readiness]);
  const projectAvailable = !!(documents.cover || documents.letter || documents.cv);
  const docxProfile = useMemo(
    () => resolveDossierDocxProfile(documents.cover, documents.letter, documents.cv),
    [documents],
  );
  const docxAvailable = readiness.complete && docxProfile !== null;

  const openDossierReview = () => {
    const freshDocuments = readDossierDocuments();
    setDocuments(freshDocuments);
    setDossierNote(null);
    setWarnings(null);
    setCvPageCount(0);
    setReviewOpen(true);
  };

  const closeDossierReview = useCallback(() => {
    if (!downloading) setReviewOpen(false);
  }, [downloading]);

  const receiveWarnings = useCallback((next: CvLayoutWarning[]) => {
    setWarnings((current) => {
      const before = current?.map((warning) => `${warning.id}:${warning.message}`).join("|");
      const after = next.map((warning) => `${warning.id}:${warning.message}`).join("|");
      return before === after ? current : next;
    });
  }, []);

  const downloadDossier = async () => {
    const root = dossierExportRef.current;
    if (!root || !readiness.complete) {
      setDossierNote("Das Dossier ist noch nicht vollständig.");
      return;
    }

    const coverName = documents.cover
      ? [documents.cover.data.vorname, documents.cover.data.nachname].filter(Boolean).join(" ")
      : "";
    const cvName = documents.cv
      ? [documents.cv.data.person.vorname, documents.cv.data.person.nachname]
          .filter(Boolean)
          .join(" ")
      : "";
    const author = coverName || cvName || "Bewerbungsdossier";
    const fileName =
      author === "Bewerbungsdossier"
        ? "Bewerbungsdossier.pdf"
        : `Bewerbungsdossier-${author}.pdf`;

    setDownloading(true);
    try {
      await downloadCombinedDossierPdf(root, fileName, {
        title: `Bewerbungsdossier – ${author}`,
        author,
        subject: "Lehrstellenbewerbung",
        keywords: "Bewerbung, Titelblatt, Motivationsschreiben, Lebenslauf",
      });
      setReviewOpen(false);
      setDossierNote("Gesamtdossier wurde als PDF erstellt.");
    } catch (error) {
      setDossierNote(
        error instanceof Error ? error.message : "Das Gesamtdossier konnte nicht erstellt werden.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const downloadProject = () => {
    const project = downloadDossierProjectFromBrowser();
    if (!project) {
      setDossierNote("Noch keine Dossierdaten zum Sichern vorhanden.");
      return;
    }
    setReviewOpen(false);
    setDossierNote("Projekt wurde als JSON-Datei gespeichert.");
  };

  const downloadDocx = async () => {
    const { cover, letter, cv } = readDossierDocuments();
    if (
      !cover ||
      !letter ||
      !cv ||
      !coverPdfHasContent(cover.data) ||
      !letterPdfHasContent(letter.data) ||
      !cvPdfHasContent(cv.data)
    ) {
      setDossierNote(
        "Für DOCX müssen Titelblatt, Motivationsschreiben und Lebenslauf ausgefüllt sein.",
      );
      return;
    }

    const profile = resolveDossierDocxProfile(cover, letter, cv);
    if (!profile) {
      setDossierNote(
        "Für DOCX muss in Titelblatt, Motivationsschreiben und Lebenslauf dieselbe aktive Vorlage gewählt sein.",
      );
      return;
    }

    const author =
      [cover.data.vorname, cover.data.nachname].filter(Boolean).join(" ") ||
      [cv.data.person.vorname, cv.data.person.nachname].filter(Boolean).join(" ") ||
      "Bewerbungsdossier";
    const fileName =
      author === "Bewerbungsdossier"
        ? "Bewerbungsdossier.docx"
        : `Bewerbungsdossier-${author}.docx`;

    setDownloading(true);
    try {
      await downloadDossierDocx(cover, letter, cv, fileName);
      setReviewOpen(false);
      setDossierNote(`DOCX-Referenz ${profile.label} wurde erstellt.`);
    } catch (error) {
      setDossierNote(
        error instanceof Error ? error.message : "Das DOCX-Dossier konnte nicht erstellt werden.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const downloadExport = async (format: DossierExportFormat) => {
    if (format === "json") {
      downloadProject();
      return;
    }
    if (format === "docx") {
      await downloadDocx();
      return;
    }
    await downloadDossier();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold sm:text-base">Bewerbungsdossier</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Für die Lehrstellenbewerbung in der Schweiz
          </p>
        </div>
        <ProjectLoadButton />
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-6">
        <div>
          <h2 className="text-2xl font-semibold sm:text-3xl">Was möchtest du machen?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Titelblatt, Motivationsschreiben und Lebenslauf gehören zusammen und verwenden dieselbe
            Designsprache.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card
            to="/titelblatt"
            title="Titelblatt"
            text="Das Deckblatt deiner Bewerbung – mit Foto, Beruf und Empfänger."
            hint="Titelblatt gestalten →"
            art={<CoverArt />}
          />
          <Card
            to="/lebenslauf"
            title="Lebenslauf"
            text="Schule, Praktika, Sprachen und Hobbys – im gleichen Design."
            hint="Lebenslauf gestalten →"
            art={<CvArt />}
          />
          <Card
            to="/anschreiben"
            title="Motivationsschreiben"
            text="Dein persönliches Motivationsschreiben – passend zu Titelblatt und Lebenslauf."
            hint="Motivationsschreiben verfassen →"
            art={<LetterArt />}
          />
          <Card
            onClick={openDossierReview}
            title="Gesamtdossier herunterladen"
            text="PDF oder DOCX exportieren – oder den aktuellen Stand als JSON-Projektdatei sichern."
            hint="Format wählen →"
            art={<DossierArt />}
          />
        </div>

        {dossierNote ? (
          <p
            role="status"
            className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
          >
            {dossierNote}
          </p>
        ) : !readiness.complete ? (
          <p className="text-xs text-muted-foreground">
            PDF und DOCX sind verfügbar, sobald {missingParts.join(", ")} ausgefüllt
            {missingParts.length === 1 ? " ist" : " sind"}. Die JSON-Projektdatei kannst du jederzeit
            sichern.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Projektdateien und Exporte werden lokal erstellt. Es wird nichts hochgeladen.
        </p>
      </main>

      <DossierExportDialog
        open={reviewOpen}
        cvPageCount={cvPageCount}
        warnings={warnings}
        coverChanged={false}
        downloading={downloading}
        jsonAvailable={projectAvailable}
        pdfAvailable={readiness.complete}
        docxAvailable={docxAvailable}
        docxTemplateLabel={docxProfile?.label ?? null}
        onClose={closeDossierReview}
        onDownload={downloadExport}
      />

      {readiness.complete && (reviewOpen || downloading) ? (
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
            cover={documents.cover}
            letter={documents.letter}
            cv={documents.cv}
            chromeState={chromeState}
            onCvLayoutWarnings={receiveWarnings}
            onCvPageCount={setCvPageCount}
          />
        </div>
      ) : null}
    </div>
  );
}
