import { useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

const RESET_LABELS: Record<string, string> = {
  "/titelblatt": "Titelblatt zurücksetzen",
  "/lebenslauf": "Lebenslauf zurücksetzen",
  "/anschreiben": "Motivationsschreiben zurücksetzen",
};

export function EditorMenuLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const label =
    children === "Alles zurücksetzen" ? (RESET_LABELS[pathname] ?? children) : children;

  return (
    <span data-editor-menu-label className="flex min-w-0 items-center gap-2">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.7} />
      <span className="min-w-0 whitespace-normal break-words">{label}</span>
    </span>
  );
}
