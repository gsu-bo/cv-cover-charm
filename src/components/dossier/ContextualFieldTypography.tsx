import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DOSSIER_FIELD_TYPOGRAPHY_EVENT,
  DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY,
  clearDossierFieldTypography,
  dossierFieldTypographyKey,
  getDossierFieldTypography,
  getDossierFieldTypographyEntries,
  normalizeDossierFieldText,
  setDossierFieldTypography,
  type DossierFieldTypographyEntry,
  type DossierFieldTypographyMeta,
  type DossierFieldTypographyScope,
  type DossierFieldTypographyStyle,
} from "@/lib/dossier-field-typography";

type TextControl = HTMLInputElement | HTMLTextAreaElement;
type Bubble = { left: number; top: number; placement: "above" | "below" };

const TOOLBAR_GAP = 8;
const TOOLBAR_EDGE = 10;
const TOOLBAR_HEIGHT = 46;
const TOOLBAR_HALF_WIDTH = 116;

function currentScope(): DossierFieldTypographyScope | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path.endsWith("/lebenslauf")) return "cv";
  if (path.endsWith("/anschreiben")) return "letter";
  return null;
}

function isTextControl(target: EventTarget | null): target is TextControl {
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return ["text", "email", "tel", "url", "search"].includes(target.type);
}

function labelText(control: TextControl): string {
  const label = control.closest("label");
  if (!label) return control.getAttribute("aria-label") ?? control.name ?? "Textfeld";

  const directText = Array.from(label.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .trim();
  if (directText) return directText;

  const directSpan = label.querySelector(":scope > span");
  return (
    directSpan?.textContent?.trim() ||
    control.getAttribute("aria-label") ||
    control.name ||
    "Textfeld"
  );
}

function fieldMeta(
  control: TextControl,
  scope: DossierFieldTypographyScope,
): DossierFieldTypographyMeta | null {
  const value = normalizeDossierFieldText(control.value);
  if (!value) return null;
  const section =
    control.closest<HTMLElement>("[data-editor-section-title]")?.dataset.editorSectionTitle ??
    (scope === "cv" ? "Lebenslauf" : "Motivationsschreiben");
  return { scope, section, label: labelText(control), value };
}

function hasExplicitStyle(style: DossierFieldTypographyStyle): boolean {
  return (
    typeof style.bold === "boolean" ||
    typeof style.italic === "boolean" ||
    typeof style.underline === "boolean"
  );
}

function setTypographyAttributes(element: HTMLElement, style: DossierFieldTypographyStyle) {
  element.dataset.dossierFieldTypography = "true";
  if (typeof style.bold === "boolean") element.dataset.dossierFieldBold = String(style.bold);
  if (typeof style.italic === "boolean") element.dataset.dossierFieldItalic = String(style.italic);
  if (typeof style.underline === "boolean") {
    element.dataset.dossierFieldUnderline = String(style.underline);
  }
}

function clearTypographyAttributes(element: HTMLElement) {
  delete element.dataset.dossierFieldTypography;
  delete element.dataset.dossierFieldBold;
  delete element.dataset.dossierFieldItalic;
  delete element.dataset.dossierFieldUnderline;
}

function normalizedElementText(element: Element): string {
  return normalizeDossierFieldText(element.textContent ?? "");
}

function leafMatches(rootSelector: string, value: string): HTMLElement[] {
  const needle = normalizeDossierFieldText(value).toLocaleLowerCase("de-CH");
  if (!needle) return [];
  const candidates: HTMLElement[] = [];
  for (const root of document.querySelectorAll<HTMLElement>(rootSelector)) {
    candidates.push(root, ...Array.from(root.querySelectorAll<HTMLElement>("*")));
  }

  const pick = (contains: boolean) =>
    candidates.filter((element) => {
      const text = normalizedElementText(element).toLocaleLowerCase("de-CH");
      const matches = contains ? text.includes(needle) : text === needle;
      if (!matches) return false;
      return !Array.from(element.children).some((child) => {
        const childText = normalizedElementText(child).toLocaleLowerCase("de-CH");
        return contains ? childText.includes(needle) : childText === needle;
      });
    });

  const exact = pick(false);
  return exact.length ? exact : needle.length >= 2 ? pick(true) : [];
}

function directTargets(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

function letterTargets(entry: DossierFieldTypographyEntry): HTMLElement[] {
  const section = entry.section.toLocaleLowerCase("de-CH");
  const label = entry.label.toLocaleLowerCase("de-CH");

  if (section.includes("meine kontaktdaten")) {
    return leafMatches('[data-letter-pdf-text="sender"]', entry.value);
  }
  if (section.includes("firma / lehrbetrieb")) {
    return leafMatches('[data-letter-pdf-text="recipient"]', entry.value);
  }
  if (section.includes("briefinhalt")) {
    if (label === "ort" || label === "datum") {
      return directTargets('[data-letter-pdf-text="date"]');
    }
    if (label.includes("titel") || label.includes("betreff")) {
      return directTargets('[data-letter-pdf-text="subject"]');
    }
    if (label.includes("anrede")) return directTargets('[data-letter-pdf-text="salutation"]');
    if (label.includes("gruss")) return directTargets('[data-letter-pdf-text="closing"]');
    if (label.includes("unterschrift")) {
      return directTargets('[data-letter-pdf-text="signature"]');
    }
  }
  return leafMatches("[data-letter-page]", entry.value);
}

function cvTargets(entry: DossierFieldTypographyEntry): HTMLElement[] {
  const label = entry.label.toLocaleLowerCase("de-CH");
  if (label.includes("titel des dokuments")) return directTargets("[data-cv-doc-title]");
  if (label === "vorname" || label === "nachname") return directTargets("[data-cv-name]");
  if (label.includes("untertitel")) return directTargets("[data-cv-subtitle]");
  return leafMatches("[data-cv-page]", entry.value);
}

function applyPreviewTypography(scope: DossierFieldTypographyScope) {
  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-dossier-field-typography="true"]',
  )) {
    clearTypographyAttributes(element);
  }

  for (const entry of getDossierFieldTypographyEntries(scope)) {
    const targets = scope === "letter" ? letterTargets(entry) : cvTargets(entry);
    for (const target of targets) setTypographyAttributes(target, entry.style);
  }
}

function syncInputTypography(scope: DossierFieldTypographyScope) {
  const panel = document.querySelector<HTMLElement>("[data-editor-panel]");
  if (!panel) return;
  for (const control of panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="search"], textarea',
  )) {
    clearTypographyAttributes(control);
    const meta = fieldMeta(control, scope);
    if (!meta) continue;
    const style = getDossierFieldTypography(scope, dossierFieldTypographyKey(meta));
    if (hasExplicitStyle(style)) setTypographyAttributes(control, style);
  }
}

export function ContextualFieldTypography() {
  const scope = currentScope();
  const activeControlRef = useRef<TextControl | null>(null);
  const activeSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const keyByControlRef = useRef(new WeakMap<TextControl, string>());
  const frameRef = useRef<number | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [style, setStyle] = useState<DossierFieldTypographyStyle>({});

  const scheduleDecoration = useCallback(() => {
    if (!scope || typeof window === "undefined") return;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      syncInputTypography(scope);
      applyPreviewTypography(scope);
    });
  }, [scope]);

  const readSelection = useCallback(() => {
    if (!scope) return;
    const control = document.activeElement;
    if (!isTextControl(control) || !control.closest("[data-editor-panel]")) {
      setBubble(null);
      setActiveKey(null);
      return;
    }
    const start = control.selectionStart ?? 0;
    const end = control.selectionEnd ?? start;
    if (start === end || !control.value.slice(start, end).trim()) {
      setBubble(null);
      setActiveKey(null);
      return;
    }

    const meta = fieldMeta(control, scope);
    if (!meta) {
      setBubble(null);
      setActiveKey(null);
      return;
    }

    const key = dossierFieldTypographyKey(meta);
    keyByControlRef.current.set(control, key);
    activeControlRef.current = control;
    activeSelectionRef.current = { start, end };
    setActiveKey(key);
    setStyle(getDossierFieldTypography(scope, key));

    const rect = control.getBoundingClientRect();
    const placement: Bubble["placement"] =
      rect.top >= TOOLBAR_HEIGHT + TOOLBAR_GAP + TOOLBAR_EDGE ? "above" : "below";
    const rawTop = placement === "above" ? rect.top - TOOLBAR_GAP : rect.bottom + TOOLBAR_GAP;
    const minimumLeft = TOOLBAR_EDGE + TOOLBAR_HALF_WIDTH;
    const maximumLeft = Math.max(
      minimumLeft,
      window.innerWidth - TOOLBAR_EDGE - TOOLBAR_HALF_WIDTH,
    );
    setBubble({
      left: Math.min(Math.max(rect.left + rect.width / 2, minimumLeft), maximumLeft),
      top:
        placement === "above"
          ? Math.max(TOOLBAR_HEIGHT + TOOLBAR_EDGE, rawTop)
          : Math.min(rawTop, Math.max(TOOLBAR_EDGE, window.innerHeight - TOOLBAR_HEIGHT - TOOLBAR_EDGE)),
      placement,
    });
  }, [scope]);

  const preserveSelection = useCallback(() => {
    const control = activeControlRef.current;
    const selection = activeSelectionRef.current;
    if (!control || !selection) return;
    control.focus();
    control.setSelectionRange(selection.start, selection.end);
  }, []);

  const updateStyle = useCallback(
    (next: DossierFieldTypographyStyle | null) => {
      if (!scope || !activeKey) return;
      const control = activeControlRef.current;
      const meta = control ? fieldMeta(control, scope) : null;
      if (!meta) return;
      if (next) {
        const key = setDossierFieldTypography(meta, next, activeKey);
        keyByControlRef.current.set(control, key);
        setActiveKey(key);
        setStyle(next);
      } else {
        clearDossierFieldTypography(scope, activeKey);
        setStyle({});
      }
      scheduleDecoration();
      window.requestAnimationFrame(preserveSelection);
    },
    [activeKey, preserveSelection, scheduleDecoration, scope],
  );

  useEffect(() => {
    if (!scope) return;

    const onInput = (event: Event) => {
      if (!isTextControl(event.target) || !event.target.closest("[data-editor-panel]")) return;
      const control = event.target;
      const previousKey = keyByControlRef.current.get(control);
      const meta = fieldMeta(control, scope);
      if (meta) {
        const nextKey = dossierFieldTypographyKey(meta);
        if (previousKey && previousKey !== nextKey) {
          const previousStyle = getDossierFieldTypography(scope, previousKey);
          if (hasExplicitStyle(previousStyle)) {
            setDossierFieldTypography(meta, previousStyle, previousKey);
          }
        }
        keyByControlRef.current.set(control, nextKey);
      }
      scheduleDecoration();
      window.requestAnimationFrame(readSelection);
    };
    const onSelection = () => window.requestAnimationFrame(readSelection);
    const onStore = () => {
      scheduleDecoration();
      window.requestAnimationFrame(readSelection);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === DOSSIER_FIELD_TYPOGRAPHY_STORAGE_KEY) onStore();
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("select", onSelection, true);
    document.addEventListener("pointerup", onSelection, true);
    document.addEventListener("keyup", onSelection, true);
    document.addEventListener("focusin", onSelection, true);
    window.addEventListener("resize", onSelection);
    window.addEventListener("scroll", onSelection, true);
    window.addEventListener(DOSSIER_FIELD_TYPOGRAPHY_EVENT, onStore);
    window.addEventListener("storage", onStorage);

    const observer = new MutationObserver(scheduleDecoration);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scheduleDecoration();

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("select", onSelection, true);
      document.removeEventListener("pointerup", onSelection, true);
      document.removeEventListener("keyup", onSelection, true);
      document.removeEventListener("focusin", onSelection, true);
      window.removeEventListener("resize", onSelection);
      window.removeEventListener("scroll", onSelection, true);
      window.removeEventListener(DOSSIER_FIELD_TYPOGRAPHY_EVENT, onStore);
      window.removeEventListener("storage", onStorage);
      observer.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [readSelection, scheduleDecoration, scope]);

  if (!scope || !bubble || !activeKey || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style>{`
        [data-dossier-field-bold="true"] { font-weight: 700 !important; }
        [data-dossier-field-bold="false"] { font-weight: 400 !important; }
        [data-dossier-field-italic="true"] { font-style: italic !important; }
        [data-dossier-field-italic="false"] { font-style: normal !important; }
        [data-dossier-field-underline="true"] { text-decoration: underline !important; }
        [data-dossier-field-underline="false"] { text-decoration: none !important; }
      `}</style>
      <div
        data-dossier-field-selection-toolbar
        data-dossier-field-scope={scope}
        role="toolbar"
        aria-label="Textfeld formatieren"
        className="fixed z-[90] flex items-center gap-1 rounded-xl border bg-popover p-1 shadow-xl"
        style={{
          left: bubble.left,
          top: bubble.top,
          transform: bubble.placement === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        }}
        onPointerDown={(event) => event.preventDefault()}
      >
        <button
          type="button"
          aria-label="Feldformatierung entfernen"
          className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          onClick={() => updateStyle(null)}
        >
          Text
        </button>
        <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-border" />
        <button
          type="button"
          aria-label="Fett"
          aria-pressed={style.bold === true}
          className={`rounded-md px-2.5 py-1.5 text-xs font-bold hover:bg-muted ${style.bold === true ? "bg-primary text-primary-foreground" : ""}`}
          onClick={() => updateStyle({ ...style, bold: style.bold === true ? false : true })}
        >
          B
        </button>
        <button
          type="button"
          aria-label="Kursiv"
          aria-pressed={style.italic === true}
          className={`rounded-md px-2.5 py-1.5 text-xs italic hover:bg-muted ${style.italic === true ? "bg-primary text-primary-foreground" : ""}`}
          onClick={() => updateStyle({ ...style, italic: style.italic === true ? false : true })}
        >
          I
        </button>
        <button
          type="button"
          aria-label="Unterstrichen"
          aria-pressed={style.underline === true}
          className={`rounded-md px-2.5 py-1.5 text-xs underline hover:bg-muted ${style.underline === true ? "bg-primary text-primary-foreground" : ""}`}
          onClick={() =>
            updateStyle({ ...style, underline: style.underline === true ? false : true })
          }
        >
          U
        </button>
      </div>
    </>,
    document.body,
  );
}
