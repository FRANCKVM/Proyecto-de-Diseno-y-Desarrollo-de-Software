import { Routes, Route, Navigate } from "react-router-dom";
import ManagementLayout from "@/layouts/ManagementLayout";
import SimulationLayout from "@/layouts/SimulationLayout";
import HomePage from "@/pages/HomePage";
import SimulacionConfigPage from "@/pages/SimulacionConfigPage";
import SimulacionEjecucionPage from "@/pages/SimulacionEjecucionPage";
import SimulacionColapsoPage from "@/pages/SimulacionColapsoPage";
import OperacionDiaADiaPage from "@/pages/OperacionDiaADiaPage";
import ResultadosPeriodoPage from "@/pages/ResultadosPeriodoPage";
import ResultadosColapsoPage from "@/pages/ResultadosColapsoPage";

/**
 * Configuracion de rutas del sistema Tasf.B2B.
 *
 * Pantallas de gestion (ManagementLayout, sidebar 220px):
 * - /                                              Home
 * - /simulacion/configurar                         Configuracion
 * - /simulacion/resultados/:id                     Resultados periodo
 * - /simulacion/resultados-colapso/:id             Resultados colapso
 *
 * Pantallas de simulacion (SimulationLayout, sidebar 56px):
 * - /simulacion/ejecucion                          Simulacion en ejecucion
 * - /simulacion/colapso                            Simulacion al colapso
 * - /envios/operacion                              Operacion dia a dia
 *
 * Cualquier ruta no reconocida redirige a Home.
 */
const App = () => (
  <Routes>
    <Route element={<ManagementLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/simulacion/configurar" element={<SimulacionConfigPage />} />
      <Route
        path="/simulacion/resultados/:id"
        element={<ResultadosPeriodoPage />}
      />
      <Route
        path="/simulacion/resultados-colapso/:id"
        element={<ResultadosColapsoPage />}
      />
    </Route>

    <Route element={<SimulationLayout />}>
      <Route
        path="/simulacion/ejecucion"
        element={<SimulacionEjecucionPage />}
      />
      <Route path="/simulacion/colapso" element={<SimulacionColapsoPage />} />
      <Route path="/envios/operacion" element={<OperacionDiaADiaPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
