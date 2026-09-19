import { useEffect } from "react";
import { TEMPLATES } from "@/components/cover/types";

const TEMPLATE_DESCRIPTIONS = new Set(TEMPLATES.map((template) => template.description));
const SWITCH_ID = "template-qa-keyboard-switch";
const DEVTOOLS_CODE = "555";
const OFFSET_STORAGE_KEY = "cv-cover-charm:qa-layout-offsets:v1";
const PAGE_SELECTOR = "[data-letter-page], [data-cv-page]";
const QA_TARGETS = [
  "[data-letter-section]",
  "[data-letter-pdf-richtext]",
  "[data-letter-pdf-text]",
  "[data-letter-flow-zone]",
  "[data-letter-warm-sender]",
  "[data-cv-free-section]",
  "[data-cv-rubric]",
  "[data-cv-section]",
  "[data-cv-doc-title]",
  "[data-cv-name]",
  "[data-cv-photo]",
  "[data-cv-personal-info]",
  "[data-block-id]",
  "[data-dossier-integrated-contact]",
  "[data-dossier-continuation-contact-header]",
  "[data-dossier-compact-header]",
  "[data-dossier-footer]",
] as const;
const QA_TARGET_SELECTOR = QA_TARGETS.join(", ");
const QA_ACTIVE_TARGET_SELECTOR = QA_TARGETS.map(
  (selector) => `html[data-template-qa-active='true'] ${selector}`,
).join(",\n");

const STABLE_ATTRIBUTES = [
  "data-letter-section",
  "data-letter-pdf-richtext",
  "data-letter-pdf-text",
  "data-cv-free-section",
  "data-cv-rubric",
  "data-cv-section",
  "data-cv-doc-title",
  "data-cv-name",
  "data-block-id",
  "data-dossier-footer",
  "data-dossier-integrated-contact",
  "data-dossier-continuation-contact-header",
  "data-dossier-compact-header",
] as const;

type Offset = { x: number; y: number };
type OffsetMap = Record<string, Offset>;

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function templateButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[aria-pressed][title]")).filter(
    (button) => TEMPLATE_DESCRIPTIONS.has(button.title),
  );
}

function readOffsets(): OffsetMap {
  try {
    const raw = sessionStorage.getItem(OFFSET_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OffsetMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOffsets(offsets: OffsetMap) {
  try {
    sessionStorage.setItem(OFFSET_STORAGE_KEY, JSON.stringify(offsets));
  } catch {
    // QA helper only: storage failure must never affect the editor.
  }
}

function pageIndex(page: HTMLElement): number {
  const root = page.closest<HTMLElement>("[data-dossier-document]") ?? page.parentElement;
  if (!root) return 0;
  const pages = Array.from(root.querySelectorAll<HTMLElement>(PAGE_SELECTOR));
  return Math.max(0, pages.indexOf(page));
}

function stableOffsetKey(element: HTMLElement, page: HTMLElement): string | null {
  const scope = page.matches("[data-letter-page]") ? "letter" : "cv";
  const index = pageIndex(page);
  for (const attribute of STABLE_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;
    const value = element.getAttribute(attribute) || "true";
    return `${scope}:${index}:${attribute}:${value}`;
  }
  if (element.hasAttribute("data-cv-photo")) return `${scope}:${index}:data-cv-photo:true`;
  if (element.hasAttribute("data-cv-personal-info"))
    return `${scope}:${index}:data-cv-personal-info:true`;
  if (element.hasAttribute("data-letter-flow-zone"))
    return `${scope}:${index}:data-letter-flow-zone:true`;
  if (element.hasAttribute("data-letter-warm-sender"))
    return `${scope}:${index}:data-letter-warm-sender:true`;
  return null;
}

function applyOffset(element: HTMLElement, offset: Offset) {
  element.style.setProperty("translate", `${offset.x}px ${offset.y}px`);
  element.dataset.templateQaMoved = "true";
}

function clearOffset(element: HTMLElement) {
  element.style.removeProperty("translate");
  delete element.dataset.templateQaMoved;
}

/**
 * Production-QA helper, intentionally dormant until code 555 is entered.
 *
 * Active mode:
 * - Ctrl + ArrowLeft / ArrowRight cycles templates in the exact GUI order.
 * - Visible semantic blocks inside CV/letter sheets can be clicked and dragged.
 * - The drag is clamped to the current paper and stored only for this browser tab.
 * - Arrow keys nudge the currently selected QA block; Escape clears selection.
 */
export function TemplateQaKeyboardSwitch() {
  useEffect(() => {
    let active = false;
    let selected: HTMLElement | null = null;
    let offsets = readOffsets();

    const button = document.createElement("button");
    button.id = SWITCH_ID;
    button.type = "button";
    button.dataset.templateQaSwitch = "true";
    button.textContent = "Dev Tools";
    button.title = "QA-Tools aktivieren";
    button.className =
      "flex w-full items-center justify-between border-t px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

    const qaStyle = document.createElement("style");
    qaStyle.dataset.templateQaStyle = "true";
    qaStyle.textContent = `
      ${QA_ACTIVE_TARGET_SELECTOR} {
        pointer-events: auto !important;
        cursor: grab !important;
      }
      html[data-template-qa-active='true'] [data-template-qa-selected='true'] {
        outline: 1px dashed #f59e0b !important;
        outline-offset: 2px !important;
        cursor: grabbing !important;
      }
    `;
    document.head.appendChild(qaStyle);

    const attachToDownloadMenu = () => {
      const menus = Array.from(
        document.querySelectorAll<HTMLElement>("[data-editor-action-menu]"),
      ).filter((menu) => menu.offsetParent !== null);
      const menu = menus.at(-1);
      if (!menu || button.parentElement === menu) return;
      menu.appendChild(button);
    };

    const selectElement = (element: HTMLElement | null) => {
      if (selected === element) return;
      if (selected) delete selected.dataset.templateQaSelected;
      selected = element;
      if (selected) selected.dataset.templateQaSelected = "true";
    };

    const applyStoredOffsets = () => {
      if (!active) return;
      for (const page of document.querySelectorAll<HTMLElement>(PAGE_SELECTOR)) {
        for (const element of page.querySelectorAll<HTMLElement>(QA_TARGET_SELECTOR)) {
          const key = stableOffsetKey(element, page);
          if (!key) continue;
          const offset = offsets[key];
          if (offset) applyOffset(element, offset);
        }
      }
    };

    const activate = () => {
      if (active) return;
      const code = window.prompt("Dev Tools Code");
      if (code !== DEVTOOLS_CODE) return;
      active = true;
      document.documentElement.dataset.templateQaActive = "true";
      button.dataset.templateQaActive = "true";
      button.textContent = "Dev Tools ✓";
      button.title = "QA aktiv: Ctrl+←/→ Vorlage · Dokumentblöcke ziehen";
      applyStoredOffsets();
    };

    const findQaTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return null;
      if (editableTarget(target)) return null;
      const page = target.closest<HTMLElement>(PAGE_SELECTOR);
      if (!page) return null;
      const element = target.closest<HTMLElement>(QA_TARGET_SELECTOR);
      if (!element || element === page) return null;
      return { element, page };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!active || event.button !== 0) return;
      const match = findQaTarget(event.target);
      if (!match) return;

      const { element, page } = match;
      const pageRect = page.getBoundingClientRect();
      const startRect = element.getBoundingClientRect();
      if (!pageRect.width || !pageRect.height || !startRect.width || !startRect.height) return;

      event.preventDefault();
      event.stopPropagation();
      selectElement(element);

      const key = stableOffsetKey(element, page);
      const startingOffset = key ? (offsets[key] ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
      const startX = event.clientX;
      const startY = event.clientY;
      let finalOffset = startingOffset;

      const move = (moveEvent: PointerEvent) => {
        const rawX = moveEvent.clientX - startX;
        const rawY = moveEvent.clientY - startY;
        const dx = Math.max(
          pageRect.left - startRect.left,
          Math.min(pageRect.right - startRect.right, rawX),
        );
        const dy = Math.max(
          pageRect.top - startRect.top,
          Math.min(pageRect.bottom - startRect.bottom, rawY),
        );
        finalOffset = { x: startingOffset.x + dx, y: startingOffset.y + dy };
        applyOffset(element, finalOffset);
      };

      const up = () => {
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", up, true);
        if (key) {
          offsets = { ...offsets, [key]: finalOffset };
          writeOffsets(offsets);
          applyStoredOffsets();
        }
      };

      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", up, true);
    };

    const resetOffsets = () => {
      offsets = {};
      try {
        sessionStorage.removeItem(OFFSET_STORAGE_KEY);
      } catch {
        // QA helper only.
      }
      for (const element of document.querySelectorAll<HTMLElement>("[data-template-qa-moved='true']")) {
        clearOffset(element);
      }
      selectElement(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!active) return;
      if (editableTarget(event.target)) return;

      if (event.key === "Escape") {
        selectElement(null);
        return;
      }

      if (event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const buttons = templateButtons();
        if (buttons.length < 2) return;
        const currentIndex = buttons.findIndex(
          (candidate) => candidate.getAttribute("aria-pressed") === "true",
        );
        if (currentIndex < 0) return;
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
        event.preventDefault();
        event.stopPropagation();
        buttons[nextIndex]?.click();
        requestAnimationFrame(applyStoredOffsets);
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetOffsets();
        return;
      }

      if (!selected || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
        return;
      const page = selected.closest<HTMLElement>(PAGE_SELECTOR);
      if (!page) return;
      const key = stableOffsetKey(selected, page);
      if (!key) return;
      const current = offsets[key] ?? { x: 0, y: 0 };
      const step = event.shiftKey ? 5 : 1;
      const next = { ...current };
      if (event.key === "ArrowLeft") next.x -= step;
      if (event.key === "ArrowRight") next.x += step;
      if (event.key === "ArrowUp") next.y -= step;
      if (event.key === "ArrowDown") next.y += step;
      event.preventDefault();
      offsets = { ...offsets, [key]: next };
      writeOffsets(offsets);
      applyOffset(selected, next);
      applyStoredOffsets();
    };

    button.addEventListener("click", activate);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);

    attachToDownloadMenu();
    const observer = new MutationObserver(() => {
      attachToDownloadMenu();
      applyStoredOffsets();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      observer.disconnect();
      button.removeEventListener("click", activate);
      selectElement(null);
      button.remove();
      qaStyle.remove();
      delete document.documentElement.dataset.templateQaActive;
    };
  }, []);

  return null;
}
