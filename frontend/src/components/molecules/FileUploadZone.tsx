import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/utils/cn";
import type { CsvSummary } from "@/store/simulationConfigStore";

interface FileUploadZoneProps {
  onFileLoaded: (summary: CsvSummary) => void;
  summary: CsvSummary | null;
}

/**
 * Parsea un File CSV y devuelve un CsvSummary con conteo de filas.
 *
 * En modo MOCK genera valores demo plausibles. Cuando el backend
 * este listo, esta funcion se reemplaza por una llamada a un endpoint
 * POST /simulaciones/cargar-csv que devuelve el summary real.
 */
const parseCsvMock = (file: File): Promise<CsvSummary> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Contamos filas no vacias como proxy de "registros".
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      const totalRecords = Math.max(0, lines.length - 1); // descontando header

      resolve({
        fileName: file.name,
        totalRecords: totalRecords > 0 ? totalRecords : 4230,
        aeropuertos: 12,
        vuelosProgramados: 28,
        envios: 156,
        maletasTotales: totalRecords > 0 ? totalRecords : 4230,
      });
    };
    reader.onerror = () => {
      // Fallback demo si la lectura falla (ej: archivo binario)
      resolve({
        fileName: file.name,
        totalRecords: 4230,
        aeropuertos: 12,
        vuelosProgramados: 28,
        envios: 156,
        maletasTotales: 4230,
      });
    };
    reader.readAsText(file);
  });

/**
 * Zona de carga de archivo CSV.
 *
 * Estandar 61 + mockup 02:
 * - Estado vacio: zona dashed con texto de ayuda.
 * - Estado cargado: banner verde con nombre y conteo de registros.
 *
 * Soporta drag-and-drop y click para seleccionar.
 */
const FileUploadZone = ({ onFileLoaded, summary }: FileUploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) return;
    setIsProcessing(true);
    const result = await parseCsvMock(file);
    onFileLoaded(result);
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      {/* Zona drag-and-drop */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-card p-8 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary-soft"
            : "border-border hover:border-primary/40 hover:bg-field"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
        />
        <Upload
          size={20}
          className="mx-auto mb-2 text-text-tertiary"
          aria-hidden
        />
        <p className="text-body text-text-secondary">
          {isProcessing
            ? "Procesando archivo..."
            : "Arrastre un archivo CSV aqui o haga click para seleccionar"}
        </p>
        <p className="text-secondary text-text-tertiary mt-1">
          Formatos aceptados: .csv — Tamano max: 10 MB
        </p>
      </div>

      {/* Banner de archivo cargado */}
      {summary && (
        <div className="bg-success-soft border border-success/30 rounded-input px-4 py-2">
          <p className="text-body text-success font-medium">
            {summary.fileName} —{" "}
            {summary.totalRecords.toLocaleString("es-PE")} registros cargados
          </p>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;
