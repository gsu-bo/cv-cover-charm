import { useEffect } from "react";
import { TEMPLATES } from "@/components/cover/types";

const TEMPLATE_DESCRIPTIONS = new Set(TEMPLATES.map((template) => template.description));
const SWITCH_ID = "template-qa-keyboard-switch";

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
 * Hidden production-QA helper. It is inert until the checkbox is manually
 * revealed and enabled in DevTools.
 *
 * Ctrl + ArrowLeft  = previous template
 * Ctrl + ArrowRight = next template
 *
 * Buttons are read directly from the rendered picker, so the QA order is
 * always exactly the same as the order currently shown in the GUI.
 */
export function TemplateQaKeyboardSwitch() {
  useEffect(() => {
    const wrapper = document.createElement("label");
    wrapper.id = SWITCH_ID;
    wrapper.dataset.templateQaSwitch = "true";
    wrapper.style.display = "none";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";
    wrapper.style.marginRight = "8px";
    wrapper.style.fontSize = "12px";
    wrapper.style.whiteSpace = "nowrap";
    wrapper.title = "QA: Ctrl + Pfeil links/rechts wechselt die Vorlage";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.setAttribute("aria-label", "QA Template-Tastatursteuerung aktivieren");

    const text = document.createElement("span");
    text.textContent = "QA Ctrl+←/→";

    wrapper.append(toggle, text);

    const attachNearDownload = () => {
      const downloadButton = document.querySelector<HTMLButtonElement>("button[data-editor-ready]");
      const host = downloadButton?.parentElement;
      if (!host || wrapper.parentElement === host) return;
      host.insertBefore(wrapper, downloadButton);
    };

    attachNearDownload();
    const observer = new MutationObserver(attachNearDownload);
    observer.observe(document.body, { childList: true, subtree: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (!toggle.checked) return;
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (editableTarget(event.target)) return;

      const buttons = visibleTemplateButtons();
      if (buttons.length < 2) return;

      const currentIndex = buttons.findIndex((button) => button.getAttribute("aria-pressed") === "true");
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
      wrapper.remove();
    };
  }, []);

  return null;
}
