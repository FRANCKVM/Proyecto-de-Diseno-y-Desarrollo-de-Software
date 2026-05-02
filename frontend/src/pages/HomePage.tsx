import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiCard from "@/components/molecules/KpiCard";
import ActivityItem from "@/components/molecules/ActivityItem";
import { useUserStore } from "@/store/userStore";
import {
  getHomeKpis,
  listRecentActivity,
  type HomeKpis,
} from "@/services/homeService";
import { ROUTES } from "@/utils/routes";
import type { ActividadReciente } from "@/types/activity.types";

/**
 * Pantalla de inicio del sistema.
 * Estandar 61 + mockup 01.
 *
 * Tres bloques:
 * 1. 4 KPIs principales del sistema.
 * 2. Card "Escenarios de simulacion" con CTA hacia configuracion.
 * 3. Feed de actividad reciente.
 */
const HomePage = () => {
  const navigate = useNavigate();
  const { nombre } = useUserStore();
  const primerNombre = nombre.split(" ")[0];

  const [kpis, setKpis] = useState<HomeKpis | null>(null);
  const [actividad, setActividad] = useState<ActividadReciente[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHomeKpis(), listRecentActivity()]).then(
      ([kpisData, actData]) => {
        if (cancelled) return;
        setKpis(kpisData);
        setActividad(actData);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-8 max-w-ref-screen">
      {/* Encabezado */}
      <header className="mb-8">
        <h1 className="text-page-title">Bienvenido, {primerNombre}</h1>
        <p className="text-body text-text-secondary mt-1">
          Panel principal del sistema Tasf.B2B — Vista general de operaciones
        </p>
      </header>

      {/* 4 KPIs principales */}
      <section className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          dotVariant="primary"
          label="Aeropuertos"
          value={kpis?.aeropuertos.total ?? "—"}
          subtitulo={kpis?.aeropuertos.sublabel}
        />
        <KpiCard
          dotVariant="normal"
          label="Vuelos activos"
          value={kpis?.vuelosActivos.total ?? "—"}
          subtitulo={kpis?.vuelosActivos.sublabel}
        />
        <KpiCard
          dotVariant="elevado"
          label="Envios en curso"
          value={kpis?.enviosEnCurso.total ?? "—"}
          subtitulo={kpis?.enviosEnCurso.sublabel}
        />
        <KpiCard
          dotVariant="normal"
          label="Cumplimiento"
          value={kpis ? `${kpis.cumplimiento.porcentaje}%` : "—"}
          valueVariant="success"
          subtitulo={kpis?.cumplimiento.sublabel}
        />
      </section>

      {/* Dos columnas: Escenarios + Actividad reciente */}
      <div className="grid grid-cols-2 gap-5">
        {/* Escenarios de simulacion */}
        <section className="bg-card border border-border rounded-card p-6 shadow-card">
          <h2 className="text-section-title mb-1">Escenarios de simulacion</h2>
          <p className="text-body text-text-secondary mb-4">
            Configure y ejecute los escenarios operativos del sistema:
            simulacion de periodo, operacion dia a dia o colapso logistico.
          </p>

          <p className="text-secondary text-text-secondary mb-2">
            Escenarios disponibles:
          </p>
          <ul className="space-y-2 mb-5">
            <li className="bg-field rounded-input px-3 py-2 text-body text-text-primary">
              Sim. periodo (semanal)
            </li>
            <li className="bg-field rounded-input px-3 py-2 text-body text-text-primary">
              Sim. hasta colapso
            </li>
          </ul>

          <button
            type="button"
            onClick={() => navigate(ROUTES.SIMULACION_CONFIGURAR)}
            className="bg-primary hover:bg-primary/90 text-text-inverse text-button px-6 py-2.5 rounded-input transition-colors"
          >
            Configurar simulacion
          </button>
        </section>

        {/* Actividad reciente */}
        <section className="bg-card border border-border rounded-card p-6 shadow-card">
          <h2 className="text-section-title mb-3">Actividad reciente</h2>
          <div className="divide-y divide-border-subtle">
            {actividad.map((item) => (
              <ActivityItem
                key={item.id}
                cuando={item.cuando}
                mensaje={item.mensaje}
                severidad={item.severidad}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
