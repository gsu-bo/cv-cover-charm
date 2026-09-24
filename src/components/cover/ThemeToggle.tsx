import { useEffect, useState } from "react";
import "./ThemeToggle.css";

type ThemeMode = "light" | "grey" | "dark";

const THEME_ORDER: ThemeMode[] = ["light", "grey", "dark"];
const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Hell",
  grey: "Grau",
  dark: "Dunkel",
};

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "grey" || value === "dark";
}

function nextTheme(mode: ThemeMode): ThemeMode {
  const index = THEME_ORDER.indexOf(mode);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length];
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "light") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }

  if (mode === "grey") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none" opacity="0.38" />
      </svg>
    );
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const preferred: ThemeMode = isThemeMode(stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    setMode(preferred);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.classList.toggle("grey", mode === "grey");
    root.dataset.themeMode = mode;
  }, [mode]);

  const next = nextTheme(mode);
  const cycleTheme = () => {
    setMode(next);
    localStorage.setItem("theme", next);
  };

  // Ein Button, drei Darstellungen: Hell → Grau → Dunkel → Hell.
  return (
    <button
      type="button"
      data-editor-theme-toggle
      data-theme-mode={mode}
      onClick={cycleTheme}
      aria-label={`Darstellung ${THEME_LABELS[mode]}. Zu ${THEME_LABELS[next]} wechseln`}
      title={`Darstellung: ${THEME_LABELS[mode]} · nächster Klick: ${THEME_LABELS[next]}`}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input text-foreground transition-[background-color,border-color,color,box-shadow] hover:border-foreground/20 hover:bg-accent hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9"
    >
      <ThemeIcon mode={mode} />
    </button>
  );
}
