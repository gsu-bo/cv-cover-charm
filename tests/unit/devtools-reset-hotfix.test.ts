import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/components/dossier/TemplateQaKeyboardSwitch.tsx", import.meta.url),
  "utf8",
);

test("normal editor resets clear the hidden Dev Tools translation layer", () => {
  expect(source).toContain('sessionStorage.removeItem(OFFSET_STORAGE_KEY)');
  expect(source).toContain("offsets = {};");
  expect(source).toContain("[data-template-qa-moved='true']");
  expect(source).toContain("clearOffset(element)");
  expect(source).toContain("Positionen & Grössen zurücksetzen");
  expect(source).toContain("Wirklich alles?");
  expect(source).toContain('document.addEventListener("click", onEditorResetClick, true)');
  expect(source).toContain('document.removeEventListener("click", onEditorResetClick, true)');
});

test("opening the destructive reset confirmation alone does not clear QA positions", () => {
  expect(source).toContain('label === "Ja"');
  expect(source).not.toContain('label.includes("Alles zurücksetzen")');
});
