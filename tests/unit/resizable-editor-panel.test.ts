import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Resizable editor panel", () => {
  test("keeps 640–767 px in overlay mode and starts split view at md", () => {
    const panel = read("src/components/dossier/ResizableEditorPanel.tsx");
    expect(panel).toContain("md:static");
    expect(panel).toContain("md:w-[var(--editor-panel-width)]");
    expect(panel).toContain("md:flex");
    expect(panel).not.toContain("sm:static");
    expect(panel).not.toContain("sm:w-[var(--editor-panel-width)]");
  });

  test("gives users a wide split range with mouse, touch and pen resizing", () => {
    const panel = read("src/components/dossier/ResizableEditorPanel.tsx");
    expect(panel).toContain('event.pointerType === "mouse" && event.button !== 0');
    expect(panel).toContain("setPointerCapture(event.pointerId)");
    expect(panel).toContain('window.addEventListener("resize", handleResize)');
    expect(panel).toContain("data-editor-panel-resize-handle");
    expect(panel).toContain("const MIN_WIDTH = 220");
    expect(panel).toContain("const MAX_WIDTH = 1100");
    expect(panel).toContain("const PREVIEW_MIN_WIDTH = 220");
  });

  test("polishes dragging feedback and keyboard resizing", () => {
    const panel = read("src/components/dossier/ResizableEditorPanel.tsx");
    expect(panel).toContain('document.body.style.cursor = "col-resize"');
    expect(panel).toContain('document.body.style.userSelect = "none"');
    expect(panel).toContain("data-resizing={resizing ? \"true\" : \"false\"}");
    expect(panel).toContain("aria-valuetext={`Formularbreite ${currentWidth} Pixel`}");
    expect(panel).toContain("const step = event.shiftKey ? 50 : 20");
    expect(panel).toContain("w-8 translate-x-1/2 cursor-col-resize");
  });

  test("aligns route controls and backdrops with the md overlay breakpoint", () => {
    const cv = read("src/routes/lebenslauf.tsx");
    const cover = read("src/routes/titelblatt.tsx");
    const letter = read("src/routes/anschreiben.tsx");

    expect(cv).toContain("bg-foreground/20 md:hidden");
    expect(cover).toContain("bg-foreground/20 md:hidden");
    expect(letter).toContain("text-xs font-medium md:hidden");
  });
});
