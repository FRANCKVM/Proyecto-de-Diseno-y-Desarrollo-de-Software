import type { Config } from "tailwindcss";

/**
 * Configuracion de Tailwind para Tasf.B2B.
 * Mapea los tokens definidos en el estandar 61.std.GUI.estandar.v02.
 *
 * Regla: ningun color hex debe usarse directamente en componentes.
 * Siempre via estos tokens semanticos para mantener consistencia.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ========================================================================
      // COLORES (estandar 61, seccion 4.5)
      // ========================================================================
      colors: {
        // Estructurales (4.5.1)
        sidebar: {
          DEFAULT: "#151825",
          hover: "#1E2232",
          icon: "#333847",
        },
        page: "#F6F7F9",
        card: "#FFFFFF",
        field: "#F8F9FA",
        border: {
          DEFAULT: "#E0E2E7",
          subtle: "#F0F1F4",
        },
        text: {
          primary: "#181B27",
          secondary: "#6B707D",
          tertiary: "#969AA5",
          inverse: "#FFFFFF",
        },
        map: {
          // Color base de CartoDB Positron. Coincide con el color de fondo
          // de los tiles para que cualquier franja sin tile renderizado se
          // mimetice con el mapa.
          bg: "#F6F6F6",
        },

        // Semanticos y de estado (4.5.2)
        primary: {
          DEFAULT: "#3774DA",
          soft: "#EBF1FD",
        },
        success: {
          DEFAULT: "#229651",
          soft: "#E7F9EE",
        },
        warning: {
          DEFAULT: "#DA9615",
          soft: "#FFF6E2",
        },
        danger: {
          DEFAULT: "#D53030",
          soft: "#FDE9E9",
        },
      },

      // ========================================================================
      // TIPOGRAFIA (estandar 61, seccion 4.4)
      // ========================================================================
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        // Cada token define [size, { lineHeight, fontWeight }]
        "page-title": ["22px", { lineHeight: "28px", fontWeight: "700" }],
        "section-title": ["16px", { lineHeight: "22px", fontWeight: "600" }],
        "drawer-title": ["18px", { lineHeight: "24px", fontWeight: "700" }],
        "drawer-title-lg": ["20px", { lineHeight: "26px", fontWeight: "700" }],
        "kpi-large": ["26px", { lineHeight: "32px", fontWeight: "700" }],
        "kpi-medium": ["22px", { lineHeight: "28px", fontWeight: "700" }],
        label: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "label-sm": ["11px", { lineHeight: "14px", fontWeight: "500" }],
        nav: ["13px", { lineHeight: "18px" }],
        "nav-active": ["13px", { lineHeight: "18px", fontWeight: "600" }],
        body: ["12px", { lineHeight: "18px" }],
        secondary: ["11px", { lineHeight: "14px" }],
        "secondary-xs": ["10px", { lineHeight: "13px" }],
        button: ["13px", { lineHeight: "18px", fontWeight: "600" }],
      },

      // ========================================================================
      // BORDER RADIUS (estandar 61, secciones 4.7, 4.8, 4.9, 4.10)
      // ========================================================================
      borderRadius: {
        badge: "4px",
        input: "6px",
        "input-lg": "8px",
        card: "12px",
        banner: "10px",
        "banner-lg": "12px",
        "icon-nav": "6px",
      },

      // ========================================================================
      // SPACING (anchos fijos del layout, estandar 61 secciones 4.1, 4.12)
      // ========================================================================
      spacing: {
        "sidebar-expanded": "220px",
        "sidebar-collapsed": "56px",
        drawer: "380px",
        topbar: "48px",
        "topbar-sm": "44px",
        legend: "40px",
        "icon-nav": "22px",
      },

      // ========================================================================
      // SOMBRAS (suaves, sistema poco recargado)
      // ========================================================================
      boxShadow: {
        card: "0 1px 2px rgba(24, 27, 39, 0.04)",
        drawer: "-8px 0 24px rgba(24, 27, 39, 0.06)",
        "alert-critical": "0 4px 16px rgba(213, 48, 48, 0.12)",
      },

      // ========================================================================
      // TRANSICIONES (estandar 61, seccion 8: drawers slide-in 200ms)
      // ========================================================================
      transitionDuration: {
        drawer: "200ms",
      },

      // ========================================================================
      // BREAKPOINTS / SIZE (resolucion fija 1440x900, sin mobile)
      // ========================================================================
      maxWidth: {
        "ref-screen": "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
