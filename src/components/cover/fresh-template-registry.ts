import type { ColorSlot } from "./types";

export type FreshTemplateRegistryEntry = {
  id: string;
  name: string;
  description: string;
  slots: readonly ColorSlot[];
};

/**
 * Canonical, side-effect-free definitions for dossier templates 21-42.
 *
 * Runtime registration, renderers, contracts and Node-side tests all derive
 * their Fresh ids/names/default palettes from this module. Keep CSS imports and
 * TEMPLATES mutation out of here so it remains safe in browser and Node code.
 */
export const FRESH_TEMPLATE_REGISTRY = [
  {
    id: "edge",
    name: "Edge",
    description: "Klare Seitenkante, viel Ruhe, präzise Akzente",
    slots: [
      { key: "bg", label: "Papier", default: "#f7f7f4" },
      { key: "primary", label: "Kante", default: "#182433" },
      { key: "secondary", label: "Signal", default: "#4da3ff" },
      { key: "accent", label: "Akzent", default: "#2f7de1" },
      { key: "ink", label: "Text", default: "#18202a" },
    ],
  },
  {
    id: "glow",
    name: "Glow",
    description: "Weiche Farbräume, modern und freundlich",
    slots: [
      { key: "bg", label: "Papier", default: "#f7f9ff" },
      { key: "primary", label: "Glow 1", default: "#6d5dfb" },
      { key: "secondary", label: "Glow 2", default: "#7dd3fc" },
      { key: "accent", label: "Akzent", default: "#4f46e5" },
      { key: "ink", label: "Text", default: "#172033" },
    ],
  },
  {
    id: "frame",
    name: "Frame",
    description: "Geometrischer Rahmen, ruhig und markant",
    slots: [
      { key: "bg", label: "Papier", default: "#f6f3ed" },
      { key: "primary", label: "Rahmen", default: "#26352f" },
      { key: "secondary", label: "Kontrast", default: "#d8894a" },
      { key: "accent", label: "Akzent", default: "#b96b32" },
      { key: "ink", label: "Text", default: "#1e2722" },
    ],
  },
  {
    id: "monoLuxe",
    name: "Mono Luxe",
    description: "Reduziert, typografisch, mit feinem Metallakzent",
    slots: [
      { key: "bg", label: "Papier", default: "#f8f6f1" },
      { key: "primary", label: "Schwarz", default: "#171717" },
      { key: "secondary", label: "Metall", default: "#b08d57" },
      { key: "accent", label: "Akzent", default: "#8e6f42" },
      { key: "ink", label: "Text", default: "#171717" },
    ],
  },
  {
    id: "horizon",
    name: "Horizon",
    description: "Ruhiger Blauverlauf, klar und professionell",
    slots: [
      { key: "bg", label: "Papier", default: "#f6f9ff" },
      { key: "primary", label: "Navy", default: "#11233f" },
      { key: "secondary", label: "Royal Blue", default: "#2f6dff" },
      { key: "accent", label: "Sky Blue", default: "#6fc3ff" },
      { key: "ink", label: "Text", default: "#152033" },
    ],
  },
  {
    id: "sunrise",
    name: "Sunrise",
    description: "Warmer Verlauf, freundlich und optimistisch",
    slots: [
      { key: "bg", label: "Papier", default: "#fff8f2" },
      { key: "primary", label: "Coral", default: "#ff7a59" },
      { key: "secondary", label: "Peach", default: "#ffb27a" },
      { key: "accent", label: "Soft Gold", default: "#f4c76a" },
      { key: "ink", label: "Text", default: "#3a2a24" },
    ],
  },
  {
    id: "forestFlow",
    name: "Forest Flow",
    description: "Tiefe Grüntöne, ruhig und elegant",
    slots: [
      { key: "bg", label: "Papier", default: "#f5f8f4" },
      { key: "primary", label: "Deep Green", default: "#1f4d43" },
      { key: "secondary", label: "Teal", default: "#2e8b7f" },
      { key: "accent", label: "Sage", default: "#9abf9c" },
      { key: "ink", label: "Text", default: "#1d2b27" },
    ],
  },
  {
    id: "violetPulse",
    name: "Violet Pulse",
    description: "Digitaler Violettverlauf, frisch und markant",
    slots: [
      { key: "bg", label: "Papier", default: "#faf7ff" },
      { key: "primary", label: "Indigo", default: "#4338ca" },
      { key: "secondary", label: "Violet", default: "#7c3aed" },
      { key: "accent", label: "Magenta", default: "#d946ef" },
      { key: "ink", label: "Text", default: "#1f1733" },
    ],
  },
  {
    id: "studio2",
    name: "Studio 2",
    description: "Klarer Studio-Split mit starkem Signal-Farbblock",
    slots: [
      { key: "bg", label: "Papier", default: "#fbfbf8" },
      { key: "primary", label: "Spalte", default: "#202a3b" },
      { key: "secondary", label: "Signalband", default: "#f2c84b" },
      { key: "accent", label: "Akzent", default: "#e78a2f" },
      { key: "ink", label: "Text", default: "#1b2430" },
    ],
  },
  {
    id: "studio3",
    name: "Studio 3",
    description: "Asymmetrischer Editorial-Look mit Teal-Flächen",
    slots: [
      { key: "bg", label: "Papier", default: "#f7fbfa" },
      { key: "primary", label: "Spalte", default: "#173d3a" },
      { key: "secondary", label: "Farbfläche", default: "#5ec6b6" },
      { key: "accent", label: "Akzent", default: "#e2a94b" },
      { key: "ink", label: "Text", default: "#18302d" },
    ],
  },
  {
    id: "warm2",
    name: "Warm 2",
    description: "Weiterentwicklung von Warm: Teal-Kopffläche, Amber-Kreis und organische Kante",
    slots: [
      { key: "bg", label: "Papier", default: "#fffaf2" },
      { key: "primary", label: "Teal", default: "#0f766e" },
      { key: "secondary", label: "Amber", default: "#f3b24d" },
      { key: "accent", label: "Coral", default: "#d96c50" },
      { key: "ink", label: "Text", default: "#16312d" },
    ],
  },
  {
    id: "warm3",
    name: "Warm 3",
    description: "Erwachsener Warm-Look mit Teal, Amber und organischer Kante",
    slots: [
      { key: "bg", label: "Papier", default: "#fbf7ef" },
      { key: "primary", label: "Teal", default: "#1e6f68" },
      { key: "secondary", label: "Amber", default: "#e5a84f" },
      { key: "accent", label: "Terracotta", default: "#c86648" },
      { key: "ink", label: "Text", default: "#24312e" },
    ],
  },
  {
    id: "warm4",
    name: "Warm 4",
    description: "Rosé und Sand mit asymmetrischem Portrait-Fokus",
    slots: [
      { key: "bg", label: "Papier", default: "#fff8f5" },
      { key: "primary", label: "Rosé", default: "#a84f62" },
      { key: "secondary", label: "Sand", default: "#e6b89c" },
      { key: "accent", label: "Clay", default: "#c77a5b" },
      { key: "ink", label: "Text", default: "#37272c" },
    ],
  },
  {
    id: "warm5",
    name: "Warm 5",
    description: "Olive, Honig und Clay in einer ruhigen, modernen Warm-Komposition",
    slots: [
      { key: "bg", label: "Papier", default: "#fbf8ee" },
      { key: "primary", label: "Olive", default: "#687454" },
      { key: "secondary", label: "Honig", default: "#d7aa52" },
      { key: "accent", label: "Clay", default: "#b8674f" },
      { key: "ink", label: "Text", default: "#2b3026" },
    ],
  },
  {
    id: "verlauf2",
    name: "Verlauf 2",
    description: "Kühler Blau-Cyan-Verlauf mit ruhiger Lichttiefe",
    slots: [
      { key: "bg", label: "Papier", default: "#f5f9ff" },
      { key: "primary", label: "Tiefblau", default: "#2447b8" },
      { key: "secondary", label: "Cyan", default: "#35b7c8" },
      { key: "accent", label: "Licht", default: "#9be7e5" },
      { key: "ink", label: "Text", default: "#ffffff" },
    ],
  },
  {
    id: "verlauf3",
    name: "Verlauf 3",
    description: "Satter Berry-Orange-Verlauf mit warmer Tiefe",
    slots: [
      { key: "bg", label: "Papier", default: "#fff8f5" },
      { key: "primary", label: "Berry", default: "#7b315d" },
      { key: "secondary", label: "Orange", default: "#e77b52" },
      { key: "accent", label: "Pfirsich", default: "#f4bb8a" },
      { key: "ink", label: "Text", default: "#ffffff" },
    ],
  },
  {
    id: "ledger",
    name: "Ledger",
    description: "Editoriales Raster mit Masthead und ruhiger Indexspalte",
    slots: [
      { key: "bg", label: "Papier", default: "#f7f4ee" },
      { key: "primary", label: "Masthead", default: "#1f2933" },
      { key: "secondary", label: "Indexfläche", default: "#d8c9b2" },
      { key: "accent", label: "Kupfer", default: "#b56a43" },
      { key: "ink", label: "Text", default: "#20262c" },
    ],
  },
  {
    id: "prism",
    name: "Prism",
    description: "Klarer diagonaler Two-Tone-Look mit starker Hierarchie",
    slots: [
      { key: "bg", label: "Papier", default: "#f5f7fc" },
      { key: "primary", label: "Navy", default: "#172554" },
      { key: "secondary", label: "Royal", default: "#2f66e6" },
      { key: "accent", label: "Blue Accent", default: "#6f95f2" },
      { key: "ink", label: "Text", default: "#18223a" },
    ],
  },
  {
    id: "gallery",
    name: "Gallery",
    description: "Ruhiger Portrait-Turm mit warmer Editorial-Fläche",
    slots: [
      { key: "bg", label: "Papier", default: "#fbf7f2" },
      { key: "primary", label: "Plum", default: "#4b2f40" },
      { key: "secondary", label: "Sand", default: "#d6b7a4" },
      { key: "accent", label: "Warm Accent", default: "#a97d6d" },
      { key: "ink", label: "Text", default: "#2b2429" },
    ],
  },
  {
    id: "orbit",
    name: "Orbit",
    description: "Kontrollierte Kreisflächen in einer ruhigen Indigo-Familie",
    slots: [
      { key: "bg", label: "Papier", default: "#f7f8fc" },
      { key: "primary", label: "Midnight", default: "#24204f" },
      { key: "secondary", label: "Indigo", default: "#625fe8" },
      { key: "accent", label: "Soft Indigo", default: "#8d8af0" },
      { key: "ink", label: "Text", default: "#19182d" },
    ],
  },
  {
    id: "ribbon",
    name: "Ribbon",
    description: "Tiefe Forest-Fläche mit einem klaren Goldband",
    slots: [
      { key: "bg", label: "Papier", default: "#fafbf7" },
      { key: "primary", label: "Forest", default: "#174d3f" },
      { key: "secondary", label: "Gold", default: "#d5a13d" },
      { key: "accent", label: "Deep Gold", default: "#a57a2d" },
      { key: "ink", label: "Text", default: "#1a302a" },
    ],
  },
  {
    id: "cove",
    name: "Cove",
    description: "Plum-Masthead mit einer klaren Coral-Bucht",
    slots: [
      { key: "bg", label: "Papier", default: "#fff8f5" },
      { key: "primary", label: "Plum", default: "#5a244f" },
      { key: "secondary", label: "Coral", default: "#e36d5a" },
      { key: "accent", label: "Deep Coral", default: "#b84959" },
      { key: "ink", label: "Text", default: "#2b1f2a" },
    ],
  },
] as const satisfies readonly FreshTemplateRegistryEntry[];

export type FreshTemplateId = (typeof FRESH_TEMPLATE_REGISTRY)[number]["id"];

export const FRESH_TEMPLATE_IDS = FRESH_TEMPLATE_REGISTRY.map(({ id }) => id) as FreshTemplateId[];

export function isFreshTemplateId(value: string): value is FreshTemplateId {
  return (FRESH_TEMPLATE_IDS as readonly string[]).includes(value);
}