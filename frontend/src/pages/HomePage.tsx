import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiCard from "@/components/molecules/KpiCard";
import ActivityItem from "@/components/molecules/ActivityItem";
import ShipmentRegistrationForm from "@/components/organisms/ShipmentRegistrationForm";
import { useAirports } from "@/hooks/useAirports";
import { useUserStore } from "@/store/userStore";
import {
  buildHomeKpis,
  buildRecentActivity,
  type HomeKpis,
} from "@/services/homeService";
import { listOperationShipments } from "@/services/operationService";
import { ROUTES } from "@/utils/routes";
import type { ActividadReciente } from "@/types/activity.types";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";

const HOME_REFRESH_INTERVAL_MS = 15000;

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
  const {
    airports,
    isLoading: isLoadingAirports,
    error: airportsError,
  } = useAirports();

  const [envios, setEnvios] = useState<BackendSolicitudEnvio[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHomeData = async () => {
      try {
        const enviosActuales = await listOperationShipments();

        if (!isMounted) {
          return;
        }

        setEnvios(enviosActuales);
        setHomeError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setHomeError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los envios del panel principal."
        );
      } finally {
        if (isMounted) {
          setIsLoadingHome(false);
        }
      }
    };

    void loadHomeData();
    const intervalId = window.setInterval(() => {
      void loadHomeData();
    }, HOME_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const refreshHomeData = async () => {
    const enviosActuales = await listOperationShipments();
    setEnvios(enviosActuales);
    setHomeError(null);
  };

  const kpis: HomeKpis | null = useMemo(() => {
    if (isLoadingHome || isLoadingAirports || airportsError) {
      return null;
    }

    return buildHomeKpis({ airports, envios });
  }, [airports, airportsError, envios, isLoadingAirports, isLoadingHome]);

  const actividad: ActividadReciente[] = useMemo(() => {
    if (isLoadingHome) {
      return [];
    }

    if (homeError) {
      return [
        {
          id: "actividad-error",
          cuando: "Ahora",
          mensaje: homeError,
          severidad: "error",
        },
      ];
    }

    return buildRecentActivity(envios);
  }, [envios, homeError, isLoadingHome]);

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

      {/* Dos columnas: Registro + Actividad reciente */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <section className="bg-card border border-border rounded-card p-6 shadow-card">
          <h2 className="text-section-title mb-1">Registrar nuevo envio</h2>
          <p className="text-body text-text-secondary mb-4">
            Ingresa el envio desde la pantalla de inicio. El plazo maximo se
            calcula automaticamente segun la region del trayecto.
          </p>

          {isLoadingAirports ? (
            <p className="text-body text-text-secondary">
              Cargando aeropuertos...
            </p>
          ) : airportsError ? (
            <div className="rounded-input border border-danger/30 bg-danger-soft px-4 py-3">
              <p className="text-body text-danger">
                No se pudieron cargar los aeropuertos desde el backend.
              </p>
              <p className="text-secondary text-danger mt-1">
                {airportsError.message}
              </p>
            </div>
          ) : (
            <ShipmentRegistrationForm
              airports={airports}
              onCreated={refreshHomeData}
            />
          )}
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
    </div>
  );
};

export default HomePage;
