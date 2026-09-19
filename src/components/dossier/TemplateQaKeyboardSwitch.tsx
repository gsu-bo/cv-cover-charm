import { useEffect } from "react";
import { TEMPLATES } from "@/components/cover/types";

const TEMPLATE_DESCRIPTIONS = new Set(TEMPLATES.map((template) => template.description));
const SWITCH_ID = "template-qa-keyboard-switch";
const DEVTOOLS_CODE = "555";

function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function visibleTemplateButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[aria-pressed][title]")).filter(
    (button) => TEMPLATE_DESCRIPTIONS.has(button.title) && button.offsetParent !== null,
  );
}

/**
 * Small production-QA helper next to the Download button.
 *
 * Click "Dev Tools" and enter code 555 to enable:
 * Ctrl + ArrowLeft  = previous template
 * Ctrl + ArrowRight = next template
 *
 * Buttons are read directly from the rendered picker, so the QA order is
 * always exactly the same as the order currently shown in the GUI.
 */
export function TemplateQaKeyboardSwitch() {
  useEffect(() => {
    let active = false;

    const button = document.createElement("button");
    button.id = SWITCH_ID;
    button.type = "button";
    button.dataset.templateQaSwitch = "true";
    button.textContent = "Dev Tools";
    button.title = "QA-Tools aktivieren";
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.height = "36px";
    button.style.padding = "0 10px";
    button.style.border = "1px solid hsl(var(--border))";
    button.style.borderRadius = "6px";
    button.style.background = "hsl(var(--background))";
    button.style.color = "hsl(var(--foreground))";
    button.style.fontSize = "12px";
    button.style.fontWeight = "500";
    button.style.whiteSpace = "nowrap";
    button.style.cursor = "pointer";

    const attachNearDownload = () => {
      const downloadButton = document.querySelector<HTMLButtonElement>("button[data-editor-ready]");
      const host = downloadButton?.parentElement;
      if (!host || button.parentElement === host) return;
      host.insertBefore(button, downloadButton);
    };

    const activate = () => {
      if (active) return;
      const code = window.prompt("Dev Tools Code");
      if (code !== DEVTOOLS_CODE) return;
      active = true;
      button.dataset.templateQaActive = "true";
      button.textContent = "Dev Tools ✓";
      button.title = "QA-Tools aktiv: Ctrl + ← / → wechselt die Vorlage";
    };

    button.addEventListener("click", activate);
    attachNearDownload();
    const observer = new MutationObserver(attachNearDownload);
    observer.observe(document.body, { childList: true, subtree: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (!active) return;
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (editableTarget(event.target)) return;

      const buttons = visibleTemplateButtons();
      if (buttons.length < 2) return;

      const currentIndex = buttons.findIndex((candidate) => candidate.getAttribute("aria-pressed") === "true");
      if (currentIndex < 0) return;

      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[nextIndex]?.click();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      observer.disconnect();
      button.removeEventListener("click", activate);
      button.remove();
    };
  }, []);

  return null;
}
