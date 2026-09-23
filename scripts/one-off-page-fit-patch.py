from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))


# page-fit.ts: runtime request only; legacy storage is cleanup-only.
p = Path("src/components/cv/page-fit.ts")
text = p.read_text()
start = text.index("export const CV_PAGE_FIT_STORAGE_KEY")
end = text.index("const textWeight")
new_state = '''/** Legacy key retained only so upgraded clients can remove stale persisted modes. */
export const CV_PAGE_FIT_STORAGE_KEY = "lebenslauf:page-fit:v1";
const CV_PAGE_FIT_EVENT = "lebenslauf-page-fit-change";

let runtimePageCount = 0;
let revision = 0;
let pendingMode: CvPageFitMode | null = null;

function clearLegacyPageFitStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CV_PAGE_FIT_STORAGE_KEY);
  } catch {
    // A blocked storage API must not prevent the in-memory action.
  }
}

function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CV_PAGE_FIT_EVENT));
}

export function getCvPageFitMode(): CvPageFitMode | null {
  clearLegacyPageFitStorage();
  return pendingMode;
}

/**
 * Page-fit is an action, not a saved preference. The requested mode exists
 * only until the live CV canvas has written the resulting section layout and
 * typography back into the real CV state.
 */
export function setCvPageFitMode(mode: CvPageFitMode | null) {
  clearLegacyPageFitStorage();
  pendingMode = mode;
  revision += 1;
  dispatchChange();
}

/** Consume exactly the request that was applied; newer clicks stay pending. */
export function consumeCvPageFitMode(mode: CvPageFitMode) {
  if (pendingMode !== mode) return;
  pendingMode = null;
  dispatchChange();
}

export function getCvPageFitRevision(): number {
  return revision;
}

export function publishCvPageFitPageCount(count: number) {
  const next = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  if (next === runtimePageCount) return;
  runtimePageCount = next;
  dispatchChange();
}

export function getCvPageFitPageCount(): number {
  return runtimePageCount;
}

export function subscribeCvPageFit(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const local = () => onChange();
  window.addEventListener(CV_PAGE_FIT_EVENT, local);
  return () => window.removeEventListener(CV_PAGE_FIT_EVENT, local);
}

'''
p.write_text(text[:start] + new_state + text[end:])

# portable-state.ts: legacy pageFitMode is deliberately ignored on read/load.
replace_once(
    "src/components/cv/portable-state.ts",
    'import { CV_PAGE_FIT_STORAGE_KEY, setCvPageFitMode, type CvPageFitMode } from "./page-fit";',
    'import { setCvPageFitMode } from "./page-fit";',
)
replace_once("src/components/cv/portable-state.ts", 'const PAGE_FIT_KEY = CV_PAGE_FIT_STORAGE_KEY;\n', "")
replace_once("src/components/cv/portable-state.ts", '  PAGE_FIT_KEY,\n', "")
replace_once("src/components/cv/portable-state.ts", '  pageFitMode?: CvPageFitMode;\n', "")
replace_once(
    "src/components/cv/portable-state.ts",
    '    const pageFitRaw = storage.getItem(PAGE_FIT_KEY);\n    const pageFitMode = pageFitRaw === "one" || pageFitRaw === "two" ? pageFitRaw : undefined;\n',
    "",
)
replace_once("src/components/cv/portable-state.ts", '      ...(pageFitMode ? { pageFitMode } : {}),\n', "")
replace_once(
    "src/components/cv/portable-state.ts",
    '  if (state.pageFitMode === "one" || state.pageFitMode === "two") {\n    setCvPageFitMode(state.pageFitMode);\n  }\n\n',
    "",
)

# CvCanvas.tsx: persist deterministic visible result, then consume action.
replace_once(
    "src/components/cv/CvCanvas.tsx",
    '  buildCvPageFitPlan,\n  getCvPageFitMode,',
    '  buildCvPageFitPlan,\n  consumeCvPageFitMode,\n  getCvPageFitMode,',
)
replace_once(
    "src/components/cv/CvCanvas.tsx",
    '  /** Hidden multi-document renderers must not seize the live html template scope. */\n  manageGlobalTemplateScope?: boolean;\n};',
    '  /** Hidden multi-document renderers must not seize the live html template scope. */\n  manageGlobalTemplateScope?: boolean;\n  /** Persist the one-shot page-fit typography into the real CV design state. */\n  onPageFitDesign?: (patch: Pick<CvDesign, "titleScale" | "headingScale" | "bodyScale">) => void;\n};',
)
replace_once(
    "src/components/cv/CvCanvas.tsx",
    '      pageFitMode\n        ? buildCvPageFitPlan(props.data, pageFitMode, {',
    '      pageFitMode && !props.exportMode\n        ? buildCvPageFitPlan(props.data, pageFitMode, {',
)

canvas = Path("src/components/cv/CvCanvas.tsx")
text = canvas.read_text()
start = text.index("  const design = useMemo<CvDesign>(() => {")
end = text.index("  const rubric = useMemo", start)
new_design = '''  const design = useMemo<CvDesign>(() => {
    if (!pageFitPlan) return baseDesign;
    // Page-fit actions are deterministic and idempotent: clicking the same
    // action again targets the same density instead of multiplying a prior fit.
    return {
      ...baseDesign,
      titleScale: clampCvScale(CV_TYPE_DEFAULTS.titleScale * pageFitPlan.titleScaleFactor),
      headingScale: clampCvScale(
        CV_TYPE_DEFAULTS.headingScale * pageFitPlan.headingScaleFactor,
      ),
      bodyScale: clampCvScale(CV_TYPE_DEFAULTS.bodyScale * pageFitPlan.bodyScaleFactor),
    };
  }, [baseDesign, pageFitPlan]);
'''
canvas.write_text(text[:start] + new_design + text[end:])

replace_once(
    "src/components/cv/CvCanvas.tsx",
    '''    for (const key of Object.keys(pageFitPlan.pageBySection) as CvLayoutSectionKey[]) {
      const page = pageFitPlan.pageBySection[key];
      if (!page) continue;
      props.onSectionLayout(key, {
        page,
        width: pageFitPlan.widthBySection[key] ?? "full",
        positioning: "flow",
        packing: pageFitPlan.packingBySection[key] ?? "rows",
        x: null,
        y: null,
        widthMm: null,
        heightMm: null,
      });
    }
  }, [pageFitPlan, pageFitRevision, props.exportMode, props.onSectionLayout]);''',
    '''    for (const key of Object.keys(pageFitPlan.pageBySection) as CvLayoutSectionKey[]) {
      const page = pageFitPlan.pageBySection[key];
      if (!page) continue;
      props.onSectionLayout(key, {
        page,
        width: pageFitPlan.widthBySection[key] ?? "full",
        positioning: "flow",
        packing: pageFitPlan.packingBySection[key] ?? "rows",
        x: null,
        y: null,
        widthMm: null,
        heightMm: null,
      });
    }

    props.onPageFitDesign?.({
      titleScale: clampCvScale(CV_TYPE_DEFAULTS.titleScale * pageFitPlan.titleScaleFactor),
      headingScale: clampCvScale(
        CV_TYPE_DEFAULTS.headingScale * pageFitPlan.headingScaleFactor,
      ),
      bodyScale: clampCvScale(CV_TYPE_DEFAULTS.bodyScale * pageFitPlan.bodyScaleFactor),
    });
    consumeCvPageFitMode(pageFitPlan.mode);
  }, [
    pageFitPlan,
    pageFitRevision,
    props.exportMode,
    props.onPageFitDesign,
    props.onSectionLayout,
  ]);''',
)

# Route owns persisted design state.
replace_once(
    "src/routes/lebenslauf.tsx",
    '  const sectionDisplayLabel = (key: CvLayoutSectionKey) => {',
    '''  const applyPageFitDesign = useCallback(
    (patch: Pick<CvDesign, "titleScale" | "headingScale" | "bodyScale">) => {
      setDesign((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const sectionDisplayLabel = (key: CvLayoutSectionKey) => {''',
)
replace_once(
    "src/routes/lebenslauf.tsx",
    '      onSectionLayout={setSectionLayout}\n      onLayoutWarnings={receiveLayoutWarnings}',
    '      onSectionLayout={setSectionLayout}\n      onPageFitDesign={applyPageFitDesign}\n      onLayoutWarnings={receiveLayoutWarnings}',
)

# Buttons are actions, not persistent toggles.
Path("src/components/cv/CvPageFitMenuPortal.tsx").write_text('''import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  getCvPageFitPageCount,
  setCvPageFitMode,
  subscribeCvPageFit,
  type CvPageFitMode,
} from "./page-fit";

const HOST_ATTR = "data-cv-page-fit-menu-host";

function findOrCreateHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const menu = document.querySelector<HTMLElement>("[data-editor-action-menu]");
  if (!menu) return null;

  const existing = menu.querySelector<HTMLElement>(`[${HOST_ATTR}]`);
  if (existing) return existing;

  const resetButton = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.includes("Positionen & Grössen zurücksetzen"),
  );
  if (!resetButton) return null;

  const host = document.createElement("div");
  host.setAttribute(HOST_ATTR, "true");
  menu.insertBefore(host, resetButton);
  return host;
}

/**
 * Whole-document page-fit actions live beside the other global layout actions.
 * They are buttons, not toggles: the result is written into the CV and the
 * transient request is forgotten immediately afterwards.
 */
export function CvPageFitMenuPortal() {
  const pageCount = useSyncExternalStore(subscribeCvPageFit, getCvPageFitPageCount, () => 0);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const refresh = () => setHost(findOrCreateHost());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!host) return null;

  const action = (next: CvPageFitMode, label: string) => (
    <button
      type="button"
      data-cv-page-fit-mode-control={next}
      onClick={() => setCvPageFitMode(next)}
      className="rounded-md border border-input bg-background px-2 py-2 text-xs font-semibold transition hover:bg-accent"
    >
      {label}
    </button>
  );

  return createPortal(
    <div data-cv-page-fit-control className="border-t bg-muted/20 p-2">
      <div className="grid grid-cols-2 gap-1.5">
        {action("one", "Alles auf 1 Seite")}
        {action("two", "Alles auf 2 Seiten")}
      </div>
      {pageCount > 0 ? (
        <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Aktuell {pageCount} {pageCount === 1 ? "Seite" : "Seiten"}
        </div>
      ) : null}
    </div>,
    host,
  );
}
''')

# Regression guard: request is ephemeral; old portable mode is ignored.
Path("tests/unit/cv-page-fit-one-shot.test.ts").write_text('''import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  consumeCvPageFitMode,
  getCvPageFitMode,
  getCvPageFitRevision,
  setCvPageFitMode,
} from "../../src/components/cv/page-fit";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("CV page-fit one-shot action", () => {
  test("consumes the runtime request without persisting an active mode", () => {
    setCvPageFitMode("one");
    const revision = getCvPageFitRevision();
    expect(getCvPageFitMode()).toBe("one");
    consumeCvPageFitMode("one");
    expect(getCvPageFitMode()).toBeNull();
    expect(getCvPageFitRevision()).toBe(revision);
  });

  test("does not serialize or restore pageFitMode in portable CV state", () => {
    const portable = read("src/components/cv/portable-state.ts");
    expect(portable).not.toContain("pageFitMode");
    expect(portable).not.toContain("PAGE_FIT_KEY");
    expect(portable).toContain("setCvPageFitMode(null)");
  });

  test("persists fitted typography before consuming the request", () => {
    const canvas = read("src/components/cv/CvCanvas.tsx");
    const route = read("src/routes/lebenslauf.tsx");
    expect(canvas).toContain("props.onPageFitDesign?.({");
    expect(canvas).toContain("consumeCvPageFitMode(pageFitPlan.mode)");
    expect(route).toContain("onPageFitDesign={applyPageFitDesign}");
  });
});
''')
