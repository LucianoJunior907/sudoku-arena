export type BoardThemeId = "emerald" | "ocean" | "sunset" | "rose" | "monochrome";

export interface BoardTheme {
  id: BoardThemeId;
  name: { "pt-BR": string; en: string };
  /** CSS custom properties to override on the board wrapper. */
  vars: Record<string, string>;
  swatch: string; // gradient for the picker preview
}

/**
 * Board themes override the cell-state CSS variables locally (scoped to the
 * board wrapper). The global theme (light/dark) still applies; these just
 * recolor the board's accents.
 */
export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "emerald",
    name: { "pt-BR": "Esmeralda", en: "Emerald" },
    swatch: "linear-gradient(135deg, oklch(0.55 0.14 168), oklch(0.6 0.12 195))",
    vars: {},
  },
  {
    id: "ocean",
    name: { "pt-BR": "Oceano", en: "Ocean" },
    swatch: "linear-gradient(135deg, oklch(0.6 0.14 220), oklch(0.55 0.16 250))",
    vars: {
      "--cell-bg-selected": "oklch(0.4 0.1 220)",
      "--cell-bg-same": "oklch(0.42 0.12 220)",
      "--cell-bg-peer": "oklch(0.3 0.04 220)",
      "--cell-border-thick": "oklch(0.6 0.14 220)",
    },
  },
  {
    id: "sunset",
    name: { "pt-BR": "Pôr do Sol", en: "Sunset" },
    swatch: "linear-gradient(135deg, oklch(0.7 0.16 50), oklch(0.6 0.18 15))",
    vars: {
      "--cell-bg-selected": "oklch(0.42 0.13 45)",
      "--cell-bg-same": "oklch(0.44 0.15 40)",
      "--cell-bg-peer": "oklch(0.32 0.04 40)",
      "--cell-border-thick": "oklch(0.6 0.16 40)",
    },
  },
  {
    id: "rose",
    name: { "pt-BR": "Rosa", en: "Rose" },
    swatch: "linear-gradient(135deg, oklch(0.65 0.18 350), oklch(0.6 0.16 10))",
    vars: {
      "--cell-bg-selected": "oklch(0.42 0.14 350)",
      "--cell-bg-same": "oklch(0.44 0.16 350)",
      "--cell-bg-peer": "oklch(0.32 0.04 350)",
      "--cell-border-thick": "oklch(0.6 0.18 350)",
    },
  },
  {
    id: "monochrome",
    name: { "pt-BR": "Monocromático", en: "Monochrome" },
    swatch: "linear-gradient(135deg, oklch(0.5 0 0), oklch(0.3 0 0))",
    vars: {
      "--cell-bg-selected": "oklch(0.4 0 0)",
      "--cell-bg-same": "oklch(0.42 0 0)",
      "--cell-bg-peer": "oklch(0.3 0 0)",
      "--cell-border-thick": "oklch(0.5 0 0)",
    },
  },
];

export function getBoardTheme(id: BoardThemeId | string | undefined): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
