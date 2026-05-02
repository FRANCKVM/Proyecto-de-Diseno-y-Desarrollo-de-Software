# Tasf.B2B Frontend

Plataforma de gestion logistica para el traslado de equipajes extraviados entre aeropuertos de America del Sur, Europa y Asia.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** (tokens del estandar 61.std.GUI)
- **Zustand** para estado global
- **React Router v6** para navegacion
- **Leaflet** + **react-leaflet** para el mapa operativo
- **lucide-react** para iconos
- **Axios** para llamadas a la API

## Estructura

```
src/
├── assets/        # Imagenes, mapa raster (/assets/maps/world-map.jpg)
├── components/    # ui/, atoms/, molecules/, organisms/, map/, drawers/
├── hooks/         # Custom hooks
├── layouts/       # ManagementLayout, SimulationLayout
├── pages/         # Vistas principales
├── services/      # API + sources2.0/ (mocks asincronos)
├── store/         # Zustand stores
├── styles/        # globals.css, theme.ts
├── types/         # Interfaces TypeScript del dominio
└── utils/         # Constantes y helpers
```

## Comandos

```bash
npm install
npm run dev        # Levanta Vite en http://localhost:5173
npm run build      # Build de produccion
npm run preview    # Preview del build
```

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar segun necesidad:

- `VITE_API_BASE_URL`: URL del backend Spring Boot.
- `VITE_USE_MOCK`: Si es `true`, los servicios consumen `sources2.0/`.
  Cambiar a `false` cuando el backend este disponible.

## Estandares

- **GUI:** `61.std.GUI.estandard.v02` (paleta, tipografia, layouts).
- **Programacion:** `62.std.programacion.v01` (nombrado, estructura, JSDoc).

Ningun color hex debe usarse directamente en componentes. Todos los valores
visuales se consumen via tokens de Tailwind (`bg-primary`, `text-success`,
`rounded-card`, `w-sidebar-expanded`) o desde `@/styles/theme.ts` cuando se
requiera el valor en JS (Leaflet, charts).
