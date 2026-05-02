# Tasf.B2B Frontend — Guía de integración para backend

Este documento describe lo que está construido en el frontend y cómo integrar el backend cuando esté disponible. Está pensado para que el equipo de backend pueda arrancar sin tener que leer el código.

---

## 1. Stack y arranque

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de producción
```

**Stack:** Vite + React 18 + TypeScript + Tailwind + Zustand + React Router v6 + Leaflet + Axios.

---

## 2. Variables de entorno

Hay un único switch que controla si el frontend consume mocks o backend real.

| Variable | Default | Descripción |
|---|---|---|
| `VITE_USE_MOCK` | `true` | Si es `true`, los servicios devuelven datos de `src/services/sources2.0/`. Si es `false`, atacan la API real. |
| `VITE_API_BASE_URL` | `http://localhost:8080/api` | URL base del backend. Se usa solo cuando `VITE_USE_MOCK=false`. |

**Para integrar:** crear `.env` con `VITE_USE_MOCK=false` y `VITE_API_BASE_URL=<url-backend>`. No hay nada más que cambiar en el código.

---

## 3. Pantallas implementadas

| Ruta | Layout | Estado | Mockup Figma |
|---|---|---|---|
| `/` | Management (sidebar 220px) | Completa | 01 |
| `/simulacion/configurar` | Management | Completa | 02 |
| `/simulacion/ejecucion` | Simulation (sidebar 56px) | Completa | 03, 04, 05, 06 |
| `/envios/operacion` | Simulation | Completa | 08 |
| `/simulacion/colapso` | Simulation | Completa | 09 |
| `/simulacion/resultados/:id` | Management | Completa | 07 |
| `/simulacion/resultados-colapso/:id` | Management | Completa | 10 |

---

## 4. Contrato de endpoints

Todos los servicios viven en `src/services/`. Cada uno tiene un comentario `Endpoint: ...` arriba de la función. Aquí va el resumen consolidado.

### 4.1. Aeropuertos (`airportService.ts`)

| Método | Endpoint | Devuelve |
|---|---|---|
| `GET` | `/aeropuertos` | `Airport[]` |
| `GET` | `/aeropuertos/{icao}` | `Airport` |
| `GET` | `/aeropuertos/{icao}/vuelos` | `VueloDetalle[]` |

**Shape `Airport`** (definido en `src/types/airport.types.ts`):

```typescript
{
  id: string;
  icao: string;          // 4 letras
  name: string;          // ciudad
  country: string;
  cityCode: string;      // 4 letras
  gmt: number;           // offset GMT entero
  capacity: number;      // capacidad almacén en maletas
  latDMS: string;        // "04° 42' 05\" N"
  lngDMS: string;        // "74° 08' 49\" W"
}
```

**Importante**: las coordenadas se envían en formato DMS. El frontend las parsea a decimal con `dmsToDecimal()` en `src/utils/geoUtils.ts`. Si el backend prefiere mandar decimales directamente, hay que tocar el parser; recomendamos mantener DMS por consistencia con el dataset original.

### 4.2. Vuelos (`flightService.ts`)

| Método | Endpoint | Devuelve |
|---|---|---|
| `GET` | `/vuelos/{codigo}` | `VueloDetalle` |
| `GET` | `/aeropuertos/{icao}/vuelos` | `VueloDetalle[]` |

**Shape `VueloDetalle`** (en `src/types/flight.types.ts`):

```typescript
{
  codigo: string;
  estado: "programado" | "abordando" | "en_vuelo" | "aterrizando" | "completado" | "cancelado";
  tipo: "intracontinental" | "intercontinental";
  capacidad: number;
  ocupacion: number;
  origenIcao: string;
  destinoIcao: string;
  fechaSalida: string;             // ISO 8601
  fechaLlegadaEstimada: string;    // ISO 8601
  envios: Array<{
    codigo: string;
    origenIcao: string;
    destinoIcao: string;
    maletasOcupadas: number;
    maletasTotales: number;
  }>;
}
```

### 4.3. Envíos (`shipmentService.ts`)

| Método | Endpoint | Devuelve |
|---|---|---|
| `GET` | `/envios/{codigo}` | `EnvioDetalle` |

**Shape `EnvioDetalle`** (en `src/types/shipment.types.ts`):

```typescript
{
  codigo: string;
  estado: "planificado" | "en_transito" | "en_escala" | "entregado" | "cancelado";
  aerolinea: string;
  origenIcao: string;
  destinoIcao: string;
  tipo: "intracontinental" | "intercontinental";
  plazoMaximoDias: number;
  fechaRegistro: string;            // ISO 8601
  cantidadMaletas: number;
  ruta: HitoRuta[];                 // ver tipo en shipment.types.ts
  paquetes: BloquePaquetes[];       // bloques contiguos de PKG codes
  tiempoRestante: string;           // texto legible "1 dia 6 horas"
  dentroDePlazo: boolean;
}
```

### 4.4. Resultados de simulación (`simulationService.ts`)

| Método | Endpoint | Devuelve |
|---|---|---|
| `GET` | `/simulaciones/periodo/{id}` | `ResultadoPeriodo` |
| `GET` | `/simulaciones/colapso/{id}` | `ResultadoColapso` |

Shapes en `src/types/simulationResult.types.ts`. Incluyen tabla de desempeño por aeropuerto, resumen operativo, conclusión narrativa, lista de aeropuertos críticos, etc.

### 4.5. Home (`homeService.ts`)

| Método | Endpoint | Devuelve |
|---|---|---|
| `GET` | `/home/kpis` | `HomeKpis` |
| `GET` | `/home/actividad-reciente` | `ActividadReciente[]` |

### 4.6. Carga de CSV (PENDIENTE de implementar en backend)

La pantalla de configuración (`/simulacion/configurar`) parsea el CSV en cliente con `parseCsvMock()` en `src/components/molecules/FileUploadZone.tsx`. Cuando el backend implemente el endpoint, hay que reemplazar esa función por una llamada a:

| Método | Endpoint | Body | Devuelve |
|---|---|---|---|
| `POST` | `/simulaciones/cargar-csv` | `multipart/form-data` con el archivo | `CsvSummary` |

**Shape `CsvSummary`** (en `src/store/simulationConfigStore.ts`):

```typescript
{
  fileName: string;
  totalRecords: number;
  aeropuertos: number;
  vuelosProgramados: number;
  envios: number;
  maletasTotales: number;
}
```

### 4.7. Ejecución de simulaciones (PENDIENTE)

Cuando el operador da click en "Simular" en `/simulacion/configurar`, hoy solo navega a la pantalla de ejecución y los aviones se animan localmente con datos mock. Cuando exista el motor de simulación en backend, se necesitan estos endpoints:

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/simulaciones/iniciar` | Arranca una corrida con la config actual. Devuelve `id`. |
| `GET` | `/simulaciones/{id}/estado` | Polling o WebSocket para el estado actual de aviones, ocupaciones, KPIs en vivo. |
| `POST` | `/simulaciones/{id}/detener` | Detiene la corrida. |

El frontend tiene preparado el lugar para conectarlos (ver sección 6).

---

## 5. Estructura del proyecto

```
src/
├── assets/              # imágenes y recursos estáticos
├── components/
│   ├── atoms/           # AvatarInitials, IconButton, KpiValue, ProgressBar, StatusDot, Tag
│   ├── molecules/       # ActivityItem, AlertBanner, FileUploadZone, InfoRow, KpiCard,
│   │                    # NavItem, PeriodTypeCard, SemaphoreRangeRow
│   ├── organisms/       # DrawerHost, LegendBar, ResultsTable, Sidebar,
│   │                    # SimulationControlPanel, TopBar
│   ├── map/             # AirportMarker, FlightMarker, RouteLine, WorldMap
│   └── drawers/         # AirportDrawer, DrawerBase, FlightDrawer, ShipmentDrawer
├── hooks/
│   ├── useAirports.ts          # carga aeropuertos del servicio
│   └── useFlightSimulation.ts  # animación de vuelos con rAF
├── layouts/
│   ├── ManagementLayout.tsx    # sidebar 220px (gestión)
│   └── SimulationLayout.tsx    # sidebar 56px (mapa)
├── pages/
│   ├── HomePage.tsx
│   ├── OperacionDiaADiaPage.tsx
│   ├── ResultadosColapsoPage.tsx
│   ├── ResultadosPeriodoPage.tsx
│   ├── SimulacionColapsoPage.tsx
│   ├── SimulacionConfigPage.tsx
│   └── SimulacionEjecucionPage.tsx
├── services/
│   ├── api.ts                       # Axios centralizado
│   ├── airportService.ts
│   ├── flightService.ts
│   ├── homeService.ts
│   ├── shipmentService.ts
│   ├── simulationService.ts
│   └── sources2.0/                  # mocks (se eliminan al integrar backend)
│       ├── airports.mock.ts
│       ├── demoOccupancy.mock.ts
│       ├── flightGenerator.mock.ts
│       ├── flightsDetail.mock.ts
│       ├── homeData.mock.ts
│       ├── shipments.mock.ts
│       ├── simulationResults.mock.ts
│       └── index.ts                 # helper mockResolve con latencia
├── store/                           # Zustand stores
│   ├── drawerStore.ts               # drawer activo
│   ├── simulationConfigStore.ts     # form de configuración
│   ├── simulationControlStore.ts    # velocidad/día/demanda
│   └── userStore.ts                 # usuario logueado
├── styles/
│   ├── globals.css                  # base + clases de markers Leaflet
│   └── theme.ts                     # tokens en JS (para Leaflet/charts)
├── types/                           # interfaces compartidas del dominio
└── utils/                           # constants, cn, geoUtils, routes, airportHelpers
```

---

## 6. Dónde reemplazar al integrar el backend

Esta es la lista práctica. Si haces solo estos cambios, el frontend pasa de mocks a backend real.

### 6.1. Crítico — bastan estos para arrancar la integración

1. **`.env`**: poner `VITE_USE_MOCK=false` y `VITE_API_BASE_URL=<url-backend>`.
2. **`src/services/sources2.0/`**: cuando el backend cubra todos los endpoints, esta carpeta entera se puede eliminar. Hasta entonces sirve de fallback parcial.

### 6.2. Carga de CSV en configuración

**Archivo:** `src/components/molecules/FileUploadZone.tsx`

**Reemplazar la función `parseCsvMock`** (líneas 14-40 aprox.) por:

```typescript
const uploadCsv = async (file: File): Promise<CsvSummary> => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<CsvSummary>(
    "/simulaciones/cargar-csv",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};
```

Y cambiar la línea `const result = await parseCsvMock(file);` por `const result = await uploadCsv(file);`.

### 6.3. Animación de vuelos → motor real

**Archivo:** `src/hooks/useFlightSimulation.ts`

Hoy genera vuelos aleatorios localmente. Para conectar al motor real:

1. Reemplazar el contenido del hook por un consumidor del estado del backend (WebSocket o polling).
2. La interfaz pública del hook (`AnimatedFlight[]`) puede permanecer igual; solo cambia la fuente.
3. Las páginas (`SimulacionEjecucionPage`, `OperacionDiaADiaPage`, `SimulacionColapsoPage`) no requieren cambios.

**Páginas afectadas:**
- `src/pages/SimulacionEjecucionPage.tsx`
- `src/pages/OperacionDiaADiaPage.tsx`
- `src/pages/SimulacionColapsoPage.tsx`

### 6.4. Datasets de ocupación demo

**Archivo:** `src/services/sources2.0/demoOccupancy.mock.ts`

Hoy las páginas pasan ocupaciones demo (`OCCUPANCY_NORMAL`, `OCCUPANCY_COLAPSO`) directamente al `WorldMap`. Cuando el motor real exista, las páginas reciben las ocupaciones del estado de la corrida.

Las páginas a modificar son las mismas tres del punto 6.3.

### 6.5. Botón "Registrar nuevo envío" en operación día a día

**Archivo:** `src/pages/OperacionDiaADiaPage.tsx`

Hoy `handleRegistrarEnvio` solo hace `console.info`. Hay que:

1. Crear un nuevo tipo en `drawerStore` (un drawer-form, no detalle de entidad). Ejemplo: `{ type: "register-shipment" }`.
2. Implementar `RegisterShipmentDrawer` con los campos del mockup 08 (origen, destino, cantidad maletas).
3. Conectar a un nuevo endpoint `POST /envios` y al servicio `shipmentService`.

### 6.6. Botones "Exportar reporte" en resultados

**Archivos:**
- `src/pages/ResultadosPeriodoPage.tsx`
- `src/pages/ResultadosColapsoPage.tsx`

Los botones existen pero no tienen handler. Cuando el backend exponga export (PDF/Excel), conectar al endpoint `GET /simulaciones/{id}/exportar`.

---

## 7. Convenciones que conviene respetar

### 7.1. Estado del semáforo

Toda la app usa los tres estados `EstadoSemaforo` de `src/types/common.types.ts`:

- `normal` (verde, < 60% por defecto)
- `elevado` (ámbar, 60-85% por defecto)
- `critico` (rojo, ≥ 85% por defecto)

Los umbrales son configurables por el operador en `/simulacion/configurar` y se guardan en `simulationConfigStore`. El backend debe respetar la misma trinaria al devolver estados.

### 7.2. Códigos ICAO, no IATA

Todo el sistema usa ICAO de 4 letras (SKBO, EDDI). Los mockups muestran IATA en algunas partes (BOG, MAD), pero los datos canónicos son ICAO. Si el backend tiene IATA, hay que mapear en el servicio.

### 7.3. Fechas en ISO 8601

Las APIs deben devolver fechas en ISO (`2026-04-09T10:00:00Z`). El frontend formatea con helpers en `src/utils/` y dentro de cada drawer.

### 7.4. Formato de coordenadas

DMS string (`"04° 42' 05\" N"`). Si el backend prefiere otro formato, ajustar `parseAirportCoords` en `src/utils/airportHelpers.ts`.

---

## 8. Lo que NO está implementado (TODOs visibles)

Buscables con grep `TODO` en el código:

| Archivo | TODO |
|---|---|
| `src/components/molecules/FileUploadZone.tsx` | Reemplazar `parseCsvMock` por POST a backend |
| `src/services/api.ts` | Inyección de token de auth en `request` interceptor |
| `src/pages/OperacionDiaADiaPage.tsx` | Drawer "Registrar nuevo envío" |
| `src/pages/SimulacionColapsoPage.tsx` | Handlers reales de "Detener" y "Continuar" |
| `src/pages/SimulacionEjecucionPage.tsx`, etc. | Conectar `useFlightSimulation` al motor del backend |

---

## 9. Estándares de programación

El proyecto sigue dos estándares internos:

- **`61.std.GUI.estandar.v02`** — paleta, tipografía, layouts, componentes.
- **`62.std.programacion.v01`** — naming, estructura, JSDoc.

**Decisiones que se tomaron y conviene documentar al revisar:**

- Se eligió **Zustand** sobre Context API/Redux por mejor DX y performance. Documentar como desviación autorizada del estándar 62 si no estaba contemplado.
- Se agregó **React Router v6** y **Vite** porque ninguno de los dos estándares los especificaba.
- **Tailwind tokens** en `tailwind.config.ts` mapean 1:1 los tokens del estándar 61. Ningún color hex se usa directamente en componentes (solo a través de utility classes o `theme.ts`).

---

## 10. Atribuciones legales del mapa

El mapa usa tiles de **CartoDB Positron** (vía OpenStreetMap). La atribución es obligatoria por términos de uso y aparece en la esquina inferior derecha del mapa. **No quitar.**

Si en el futuro se quiere reemplazar por un raster propio:

1. Dejar el archivo en `public/assets/maps/world-map.jpg`.
2. En `src/components/map/WorldMap.tsx`, reemplazar `<TileLayer />` por `<ImageOverlay url="/assets/maps/world-map.jpg" bounds={WORLD_BOUNDS} />`.

---

## 11. Pasos de integración recomendados

Para el equipo de backend, en orden de prioridad:

1. **Levantar API básica** con los endpoints de la sección 4.1 a 4.5 con datos seed (los mocks pueden servir como ejemplo del shape esperado).
2. **Conectar frontend** poniendo `VITE_USE_MOCK=false`. Verificar que las pantallas estáticas (Home, Configuración, Resultados) renderizan con datos reales.
3. **Implementar carga de CSV** (sección 4.6) y reemplazar `parseCsvMock` (sección 6.2).
4. **Implementar motor de simulación** (sección 4.7) y reemplazar `useFlightSimulation` (sección 6.3).
5. **Cerrar TODOs** de la sección 8.
