/**
 * Tokens visuales del sistema Tasf.B2B en TypeScript.
 * Reflejan los mismos valores que tailwind.config.ts.
 *
 * Cuando usar este modulo:
 * - Configuracion de Leaflet (colores de marcadores, lineas).
 * - Charts y graficos (recharts, etc.) que requieran color en JS.
 * - Animaciones programaticas con valores numericos.
 *
 * Cuando NO usar este modulo:
 * - Estilos en JSX. Preferir clases de Tailwind (bg-primary, text-success, etc.).
 */

// ============================================================================
// COLORES
// ============================================================================
export const COLORS = {
  sidebar: {
    base: "#151825",
    hover: "#1E2232",
    icon: "#333847",
  },
  background: {
    page: "#F6F7F9",
    card: "#FFFFFF",
    field: "#F8F9FA",
    // Color base de CartoDB Positron, usado como fallback
    // para cualquier zona sin tile renderizado.
    map: "#F6F6F6",
  },
  border: {
    main: "#E0E2E7",
    subtle: "#F0F1F4",
  },
  text: {
    primary: "#181B27",
    secondary: "#6B707D",
    tertiary: "#969AA5",
    inverse: "#FFFFFF",
  },
  primary: {
    base: "#3774DA",
    soft: "#EBF1FD",
  },
  success: {
    base: "#229651",
    soft: "#E7F9EE",
  },
  warning: {
    base: "#DA9615",
    soft: "#FFF6E2",
  },
  danger: {
    base: "#D53030",
    soft: "#FDE9E9",
  },
} as const;

// ============================================================================
// TIPOGRAFIA
// ============================================================================
export const TYPOGRAPHY = {
  family: "Inter, system-ui, -apple-system, sans-serif",
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// ============================================================================
// LAYOUT
// ============================================================================
export const LAYOUT = {
  sidebar: {
    expanded: 220,
    collapsed: 56,
  },
  topbar: 48,
  legend: 40,
  drawer: 380,
  reference: { width: 1440, height: 900 },
} as const;

// ============================================================================
// MARCADOR DE AEROPUERTO
// Geometria de circulos concentricos (estandar 61, seccion 4.6).
// Para usar al renderizar markers en Leaflet.
// ============================================================================
export const AIRPORT_MARKER = {
  glow: { size: 28, opacity: 0.15 },
  ring: { size: 16, opacity: 0.35 },
  core: { size: 10, opacity: 1 },
} as const;
