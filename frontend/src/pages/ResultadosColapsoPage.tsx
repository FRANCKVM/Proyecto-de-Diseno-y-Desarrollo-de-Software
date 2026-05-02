import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AlertBanner from "@/components/molecules/AlertBanner";
import KpiCard from "@/components/molecules/KpiCard";
import { getCollapseResult } from "@/services/simulationService";
import { ROUTES } from "@/utils/routes";
import type { ResultadoColapso } from "@/types/simulationResult.types";

/**
 * Pantalla de resultados de simulacion al colapso.
 * Estandar 61 + mockup 10.
 *
 * Layout de dos columnas:
 * - Izquierda (60%): "Analisis del colapso" en prosa.
 * - Derecha (40%):   tabla de "Aeropuertos criticos al colapso".
 * - Banner inferior: sugerencia + CTAs.
 */
const ResultadosColapsoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resultado, setResultado] = useState<ResultadoColapso | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCollapseResult(id).then((r) => !cancelled && setResultado(r));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!resultado) {
    return (
      <div className="p-8">
        <p className="text-body text-text-tertiary">
          Cargando resultados de simulacion...
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-ref-screen">
      {/* Encabezado */}
      <header className="mb-6">
        <h1 className="text-page-title">
          Resultados — Simulacion al colapso
        </h1>
        <p className="text-secondary text-text-tertiary mt-1">
          Simulacion &gt; Resultados &gt; {resultado.rango}
        </p>
      </header>

      {/* Banner critico */}
      <AlertBanner
        severity="error"
        mensaje={`Colapso detectado en dia ${resultado.diasHastaColapso} — ${resultado.plazosIncumplidos}% de plazos incumplidos (umbral: 10%)`}
        className="mb-6"
      />

      {/* 5 KPIs */}
      <section className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard
          dotVariant="critico"
          label="Dias hasta colapso"
          value={resultado.diasHastaColapso}
          valueVariant="danger"
        />
        <KpiCard
          dotVariant="primary"
          label="Maletas procesadas"
          value={resultado.maletasProcesadas.toLocaleString("es-PE")}
        />
        <KpiCard
          dotVariant="critico"
          label="Plazos incumplidos"
          value={`${resultado.plazosIncumplidos}%`}
          valueVariant="danger"
        />
        <KpiCard
          dotVariant="critico"
          label="Almacenes saturados"
          value={`${resultado.almacenesSaturados.cantidad} (${resultado.almacenesSaturados.porcentaje}%)`}
          valueVariant="danger"
        />
        <KpiCard
          dotVariant="elevado"
          label="Factor demanda max"
          value={`x${resultado.factorDemandaMax.toFixed(1)}`}
          valueVariant="warning"
        />
      </section>

      {/* Dos columnas */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-5 mb-6">
        {/* Analisis */}
        <section className="bg-card border border-border rounded-card p-6 shadow-card">
          <h2 className="text-section-title mb-3">Analisis del colapso</h2>
          <div className="space-y-3 text-body text-text-secondary">
            {resultado.analisis.map((parrafo, i) => (
              <p key={i} className="whitespace-pre-line">
                {parrafo}
              </p>
            ))}
          </div>
        </section>

        {/* Aeropuertos criticos */}
        <section className="bg-card border border-border rounded-card p-6 shadow-card">
          <h2 className="text-section-title mb-4">
            Aeropuertos criticos al colapso
          </h2>
          <table className="w-full text-body">
            <thead>
              <tr className="text-secondary text-text-secondary">
                <th className="text-left font-medium pb-2">Aeropuerto</th>
                <th className="text-right font-medium pb-2">Ocup. max</th>
              </tr>
            </thead>
            <tbody>
              {resultado.aeropuertosCriticos.map((a) => (
                <tr key={a.icao} className="border-t border-border-subtle">
                  <td className="py-2 text-text-primary">
                    {a.icao} — {a.nombre}
                  </td>
                  <td
                    className={`py-2 text-right font-semibold ${
                      a.ocupacionMaxima >= 85 ? "text-danger" : "text-warning"
                    }`}
                  >
                    {a.ocupacionMaxima}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Sugerencia + CTAs */}
      <div className="grid grid-cols-[1.5fr_auto] gap-5 items-center">
        <AlertBanner
          severity="advertencia"
          mensaje={`Sugerencia: ${resultado.sugerencia}`}
        />
        <div className="flex gap-3">
          <button
            type="button"
            className="px-6 py-2.5 rounded-input border border-border text-button text-text-primary bg-card hover:bg-field transition-colors"
          >
            Exportar reporte
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.SIMULACION_CONFIGURAR)}
            className="px-6 py-2.5 rounded-input text-button text-text-inverse bg-primary hover:bg-primary/90 transition-colors"
          >
            Nueva simulacion
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultadosColapsoPage;
