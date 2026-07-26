import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertCircle, CheckCircle, FileText, Upload } from "lucide-react";
import { uploadOperationShipmentsTxt } from "@/services/operationService";
import { cn } from "@/utils/cn";
import type { OperationShipmentTxtUploadResponse } from "@/types/backendSimulation.types";

interface ShipmentTxtUploadPanelProps {
  onUploaded?: () => Promise<void> | void;
  className?: string;
}

const ShipmentTxtUploadPanel = ({
  onUploaded,
  className,
}: ShipmentTxtUploadPanelProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [summary, setSummary] =
    useState<OperationShipmentTxtUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("Selecciona un archivo .txt.");
      setSummary(null);
      return;
    }

    setIsUploading(true);
    setSelectedFileName(file.name);
    setError(null);
    setSummary(null);

    try {
      const result = await uploadOperationShipmentsTxt(file);
      setSummary(result);
      await onUploaded?.();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo cargar el archivo."
      );
    } finally {
      setIsUploading(false);
      resetInput();
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  };

  return (
    <section className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-section-title mb-1">Carga por TXT</h3>
        <p className="text-body text-text-secondary">
          Usa el formato _envios_ICAO_.txt para registrar envios operativos.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "min-h-[184px] rounded-input border border-dashed px-4 py-5 transition-colors",
          "flex flex-col items-center justify-center text-center",
          isDragging
            ? "border-primary bg-primary-soft"
            : "border-border bg-field/50 hover:border-primary/60 hover:bg-field"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleInputChange}
          className="hidden"
        />
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary">
          {isUploading ? (
            <Upload size={18} aria-hidden="true" className="animate-pulse" />
          ) : (
            <FileText size={18} aria-hidden="true" />
          )}
        </span>
        <p className="mt-3 text-button text-text-primary">
          {isUploading ? "Cargando archivo..." : "Seleccionar TXT"}
        </p>
        <p className="mt-1 text-secondary text-text-tertiary">
          {selectedFileName ?? "Tambien puedes arrastrarlo aqui"}
        </p>
      </div>

      {(summary || error) && (
        <div
          className={cn(
            "rounded-input border px-3 py-2.5",
            error
              ? "border-danger/25 bg-danger-soft"
              : summary?.lineasOmitidas
                ? "border-warning/30 bg-warning-soft"
                : "border-success/25 bg-success-soft"
          )}
        >
          <div className="flex items-start gap-2">
            {error ? (
              <AlertCircle
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-danger"
              />
            ) : (
              <CheckCircle
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-success"
              />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  "text-secondary font-medium",
                  error ? "text-danger" : "text-text-primary"
                )}
              >
                {error ??
                  `${summary?.enviosRegistrados ?? 0} envios registrados`}
              </p>
              {summary && (
                <p className="mt-1 text-secondary text-text-secondary">
                  {summary.totalLineas} lineas leidas, {summary.lineasOmitidas} omitidas.
                </p>
              )}
              {summary?.errores?.length ? (
                <ul className="mt-2 space-y-1">
                  {summary.errores.map((item) => (
                    <li key={item} className="text-secondary text-text-tertiary">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ShipmentTxtUploadPanel;
