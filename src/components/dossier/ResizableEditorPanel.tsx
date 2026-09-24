import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

  const style = {
    ...(customWidth === null ? {} : { "--editor-panel-width": `${customWidth}px` }),
    ...(resizing ? { transition: "none" } : {}),
  } as CSSProperties;
  const openWidthClass =
    customWidth === null
      ? "md:w-[320px] lg:w-[380px] xl:w-[420px] 2xl:w-[460px]"
      : "md:w-[var(--editor-panel-width)]";

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
      >
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
          aria-label="Formularbreite ändern"
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={customWidth ?? DEFAULT_WIDTH}
          tabIndex={0}
          title="Mit Maus oder Touch ziehen · Doppelklick zum Zurücksetzen"
          className="group absolute inset-y-0 right-0 z-30 hidden w-6 translate-x-1/2 cursor-col-resize touch-none items-center justify-center outline-none md:flex"
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
            applyWidth(current + (event.key === "ArrowRight" ? 20 : -20), true);
          }}
        >
          <span className="h-16 w-1.5 rounded-full bg-border transition-colors group-hover:bg-primary group-focus:bg-primary group-active:bg-primary" />
          {resizing && customWidth !== null ? (
            <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] font-medium text-background shadow-lg">
              Formular: {customWidth} px
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
