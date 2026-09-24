import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronsUp } from "lucide-react";
import { ContextualFieldTypography } from "./ContextualFieldTypography";
import "./EditorPanelIntro.css";

const STORAGE_KEY = "bewerbungsdossier:editor-panel-width";
const MIN_WIDTH = 220;
const MAX_WIDTH = 1100;
const DEFAULT_WIDTH = 380;
const PREVIEW_MIN_WIDTH = 220;

function clampWidth(width: number): number {
  const viewportMaximum =
    typeof window === "undefined"
      ? MAX_WIDTH
      : Math.max(MIN_WIDTH, window.innerWidth - PREVIEW_MIN_WIDTH);
  return Math.round(Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH, viewportMaximum));
}

function storeWidth(width: number | null) {
  try {
    if (width === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // Die Breite bleibt für diese Sitzung trotzdem verstellbar.
  }
}

/** Gemeinsames, per Maus, Touch und Tastatur verstellbares Formularpanel. */
export function ResizableEditorPanel({ open, children }: { open: boolean; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const widthRef = useRef<number | null>(null);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [formScrolled, setFormScrolled] = useState(false);

  useEffect(() => {
    setClientReady(true);
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= MIN_WIDTH) {
        const next = clampWidth(stored);
        widthRef.current = next;
        setCustomWidth(next);
      }
    } catch {
      // Gespeicherte UI-Einstellungen sind optional.
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (widthRef.current === null) return;
      setCustomWidth(clampWidth(widthRef.current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizing]);

  const applyWidth = (width: number, persist = false) => {
    const next = clampWidth(width);
    widthRef.current = next;
    setCustomWidth(next);
    if (persist) storeWidth(next);
  };

  const resetWidth = () => {
    dragRef.current = null;
    widthRef.current = null;
    setCustomWidth(null);
    setResizing(false);
    storeWidth(null);
  };

  const collapseAllSections = () => {
    const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>(
      '[data-editor-section-toggle][aria-expanded="true"]',
    );
    buttons?.forEach((button) => button.click());
  };

  const style = {
    ...(customWidth === null ? {} : { "--editor-panel-width": `${customWidth}px` }),
    ...(resizing ? { transition: "none" } : {}),
  } as CSSProperties;
  const openWidthClass =
    customWidth === null
      ? "md:w-[320px] lg:w-[380px] xl:w-[420px] 2xl:w-[460px]"
      : "md:w-[var(--editor-panel-width)]";
  const currentWidth = customWidth ?? DEFAULT_WIDTH;

  return (
    <div
      ref={panelRef}
      data-editor-panel
      style={style}
      className={`absolute inset-y-0 left-0 z-20 w-full shrink-0 border-r bg-background transition-transform duration-300 ease-out md:static md:h-auto md:bg-muted md:transition-[width,transform] ${
        // Unter 768 px ist das Formular bewusst ein Overlay statt eines gequetschten Splits.
        // Ab Tablet/Desktop entscheidet der User selbst über das Verhältnis zur Vorschau.
        open ? `transform-none ${openWidthClass}` : "-translate-x-full md:w-0 md:border-r-0"
      }`}
    >
      <aside
        data-editor-form-scroll
        className={`h-full overscroll-contain overflow-y-auto overflow-x-hidden ${open ? "" : "md:overflow-hidden"}`}
        aria-hidden={!open}
        inert={!open}
        onScroll={(event) => setFormScrolled(event.currentTarget.scrollTop > 6)}
      >
        <div
          data-editor-panel-toolbar
          data-scrolled={formScrolled ? "true" : "false"}
          className="sticky top-0 z-40 flex h-10 items-center justify-between border-b border-border/70 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/85"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Formular
          </span>
          <button
            type="button"
            onClick={collapseAllSections}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Alle Bereiche zuklappen"
            title="Alle Bereiche zuklappen"
          >
            <ChevronsUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {children}
      </aside>

      {/*
        Scope detection inside the contextual typography helper needs the browser URL.
        Mount it only after hydration so server and first client markup stay identical.
      */}
      {clientReady ? <ContextualFieldTypography /> : null}

      {open ? (
        <div
          role="separator"
          data-editor-panel-resize-handle
          data-resizing={resizing ? "true" : "false"}
          aria-label="Formularbreite ändern"
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={currentWidth}
          aria-valuetext={`Formularbreite ${currentWidth} Pixel`}
          tabIndex={0}
          title="Ziehen zum Anpassen · Doppelklick: Standard · Pfeile: fein · Shift + Pfeile: grob"
          className={`group absolute inset-y-0 right-0 z-30 hidden w-8 translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none transition-colors md:flex ${
            resizing ? "bg-primary/10" : "hover:bg-primary/5 focus-visible:bg-primary/5"
          }`}
          onDoubleClick={resetWidth}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const startWidth = panelRef.current?.getBoundingClientRect().width ?? DEFAULT_WIDTH;
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startWidth,
            };
            widthRef.current = customWidth ?? startWidth;
            setResizing(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            applyWidth(drag.startWidth + event.clientX - drag.startX);
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            dragRef.current = null;
            setResizing(false);
            if (widthRef.current !== null) storeWidth(widthRef.current);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setResizing(false);
            if (widthRef.current !== null) storeWidth(widthRef.current);
          }}
          onKeyDown={(event) => {
            if (event.key === "Home") {
              event.preventDefault();
              resetWidth();
              return;
            }
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const current =
              customWidth ?? panelRef.current?.getBoundingClientRect().width ?? DEFAULT_WIDTH;
            const step = event.shiftKey ? 50 : 20;
            applyWidth(current + (event.key === "ArrowRight" ? step : -step), true);
          }}
        >
          <span
            aria-hidden
            className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
              resizing
                ? "bg-primary/60"
                : "bg-border/70 group-hover:bg-primary/35 group-focus-visible:bg-primary/35"
            }`}
          />
          <span
            aria-hidden
            className={`relative flex h-16 w-3 items-center justify-center rounded-full border bg-background shadow-sm transition-all ${
              resizing
                ? "scale-110 border-primary shadow-md"
                : "border-border group-hover:border-primary/70 group-hover:shadow-md group-focus-visible:border-primary/70"
            }`}
          >
            <span className="flex h-7 flex-col justify-between">
              <span className="h-1 w-1 rounded-full bg-muted-foreground/70" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground/70" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground/70" />
            </span>
          </span>
          {resizing && customWidth !== null ? (
            <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-lg">
              Formular {customWidth} px
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
