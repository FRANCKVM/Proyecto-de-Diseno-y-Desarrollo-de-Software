import Tag, { type TagVariant } from "@/components/atoms/Tag";
import type { DesempenoAeropuerto } from "@/types/simulationResult.types";
import type { EstadoSemaforo } from "@/types/common.types";

interface ResultsTableProps {
  rows: DesempenoAeropuerto[];
}

const ESTADO_TAG: Record<EstadoSemaforo, TagVariant> = {
  normal: "normal",
  elevado: "elevado",
  critico: "critico",
};

const ESTADO_LABEL: Record<EstadoSemaforo, string> = {
  normal: "Normal",
  elevado: "Elevado",
  critico: "Critico",
};

const OCUPACION_COLOR: Record<EstadoSemaforo, string> = {
  normal: "text-success",
  elevado: "text-warning",
  critico: "text-danger",
};

/**
 * Tabla "Desempeno por aeropuerto" para resultados de simulacion.
 * Estandar 61 + mockup 07.
 *
 * Columnas: Aeropuerto, Recibidas, Enviadas, Ocup. promedio,
 * Ocup. maxima, Estado.
 */
const ResultsTable = ({ rows }: ResultsTableProps) => (
  <div className="bg-card border border-border rounded-card p-6 shadow-card">
    <h2 className="text-section-title mb-4">Desempeno por aeropuerto</h2>
    <table className="w-full text-body">
      <thead>
        <tr className="text-secondary text-text-secondary">
          <th className="text-left font-medium pb-2">Aeropuerto</th>
          <th className="text-left font-medium pb-2">Recib.</th>
          <th className="text-left font-medium pb-2">Enviad.</th>
          <th className="text-left font-medium pb-2">Ocup. prom.</th>
          <th className="text-left font-medium pb-2">Ocup. max.</th>
          <th className="text-left font-medium pb-2">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.icao} className="border-t border-border-subtle">
            <td className="py-2.5 text-text-primary">
              {r.icao} — {r.nombre}
            </td>
            <td className="py-2.5 text-text-primary">{r.recibidas}</td>
            <td className="py-2.5 text-text-primary">{r.enviadas}</td>
            <td className="py-2.5 text-text-primary">
              {r.ocupacionPromedio}%
            </td>
            <td className={`py-2.5 font-semibold ${OCUPACION_COLOR[r.estado]}`}>
              {r.ocupacionMaxima}%
            </td>
            <td className="py-2.5">
              <Tag variant={ESTADO_TAG[r.estado]}>
                {ESTADO_LABEL[r.estado]}
              </Tag>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ResultsTable;
