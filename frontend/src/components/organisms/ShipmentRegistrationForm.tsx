import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/utils/cn";
import { createOperationShipment } from "@/services/operationService";
import { resolveBrowserOriginAirport } from "@/utils/browserOriginAirport";
import type { AirportWithCoords } from "@/types/airport.types";
import type { CreateOperationShipmentRequest } from "@/types/backendSimulation.types";

interface ShipmentRegistrationFormProps {
  airports: AirportWithCoords[];
  occupancyByIcao?: Record<string, number>;
  onCreated?: () => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}

const INITIAL_FORM: CreateOperationShipmentRequest = {
  origenIcao: "",
  destinoIcao: "",
  contarBolsas: 1,
};

const inputClassName =
  "w-full bg-field border border-border rounded-input px-3 py-2 text-body focus:outline-none focus:border-primary";

const selectPlaceholderClassName = "text-[#8A92A3] text-[12px] font-normal";
const DEFAULT_NOTICE = "Se planificara la mejor ruta para los envios.";
const NOTICE_VISIBLE_MS = 3500;

const ShipmentRegistrationForm = ({
  airports,
  occupancyByIcao = {},
  onCreated,
  onCancel,
  submitLabel = "Registrar envio",
  className,
}: ShipmentRegistrationFormProps) => {
  const [form, setForm] = useState<CreateOperationShipmentRequest>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const airportOptions = useMemo(
    () =>
      [...airports].sort((a, b) =>
        `${a.icao} ${a.name}`.localeCompare(`${b.icao} ${b.name}`, "es")
      ),
    [airports]
  );

  const originResolution = useMemo(
    () => resolveBrowserOriginAirport(airportOptions),
    [airportOptions]
  );
  const selectedOrigin = originResolution.airport;
  const selectedOriginIcao = selectedOrigin?.icao ?? "";
  const destinationOptions = useMemo(
    () => airportOptions.filter((airport) => airport.icao !== selectedOriginIcao),
    [airportOptions, selectedOriginIcao]
  );
  const originCapacity = selectedOrigin?.capacity ?? null;
  const originOccupancy = selectedOriginIcao
    ? occupancyByIcao[selectedOriginIcao]
    : undefined;
  const originAvailableBags =
    originCapacity !== null ? Math.max(0, Math.floor(originCapacity)) : null;
  const exceedsOriginCapacity =
    originAvailableBags !== null && form.contarBolsas > originAvailableBags;
  const capacityErrorMessage =
    "La cantidad de maletas excede la capacidad disponible del almacen de origen.";

  const canSubmit =
    !isSubmitting &&
    selectedOriginIcao !== "" &&
    form.destinoIcao.trim() !== "" &&
    selectedOriginIcao !== form.destinoIcao &&
    form.contarBolsas > 0 &&
    !exceedsOriginCapacity;

  useEffect(() => {
    setForm((current) => {
      if (
        current.origenIcao === selectedOriginIcao &&
        current.destinoIcao !== selectedOriginIcao
      ) {
        return current;
      }

      return {
        ...current,
        origenIcao: selectedOriginIcao,
        destinoIcao:
          current.destinoIcao === selectedOriginIcao ? "" : current.destinoIcao,
      };
    });
  }, [selectedOriginIcao]);

  useEffect(() => {
    if (!error && !success) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, NOTICE_VISIBLE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [error, success]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError(
        exceedsOriginCapacity
          ? `El almacen origen solo tiene ${originAvailableBags ?? 0} maletas disponibles.`
          : selectedOriginIcao === ""
            ? "No se pudo determinar el aeropuerto origen desde tu navegador."
            : "Completa los campos requeridos antes de registrar el envio."
      );
      setSuccess(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createOperationShipment({
        ...form,
        origenIcao: selectedOriginIcao,
      });
      setForm({
        ...INITIAL_FORM,
        origenIcao: selectedOriginIcao,
      });
      setSuccess("Envio registrado correctamente.");
      await onCreated?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo registrar el envio."
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const noticeError = error ?? (exceedsOriginCapacity ? capacityErrorMessage : null);
  const noticeMessage = noticeError ?? success ?? DEFAULT_NOTICE;

  return (
    <form className={cn("space-y-4", className)} onSubmit={handleSubmit}>
      <div
        className={cn(
          "rounded-input border px-3 py-2.5",
          exceedsOriginCapacity
            ? "bg-danger-soft border-danger/25"
            : "bg-field/50 border-border"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <MapPin size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label-sm text-text-secondary">Origen detectado</p>
              <p className="truncate text-body font-semibold text-text-primary">
                {selectedOrigin
                  ? `${selectedOrigin.icao} - ${selectedOrigin.name}, ${selectedOrigin.country}`
                  : "Detectando aeropuerto..."}
              </p>
              <p className="truncate text-secondary text-text-tertiary">
                {originResolution.timeZone
                  ? originResolution.timeZone
                  : "Zona horaria no disponible"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <div>
              <p className="text-secondary text-text-tertiary">Disponible</p>
              <p
                className={cn(
                  "text-body font-semibold",
                  exceedsOriginCapacity ? "text-danger" : "text-success"
                )}
              >
                {originAvailableBags ?? 0}
              </p>
            </div>
            <div>
              <p className="text-secondary text-text-tertiary">Ocupacion</p>
              <p className="text-body font-semibold text-text-primary">
                {originOccupancy !== undefined
                  ? `${Math.round(originOccupancy)}%`
                  : "Sin dato"}
              </p>
            </div>
          </div>
        </div>

        {!originResolution.isExactMatch && selectedOrigin && (
          <p className="mt-2 text-secondary text-text-tertiary">
            No se encontro una coincidencia configurada, se usa este origen por defecto.
          </p>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-label-sm text-text-secondary">Destino</span>
        <select
          value={form.destinoIcao}
          onChange={(event) => {
            setForm((current) => ({ ...current, destinoIcao: event.target.value }));
            setError(null);
            setSuccess(null);
          }}
          className={cn(
            inputClassName,
            form.destinoIcao === ""
              ? selectPlaceholderClassName
              : "text-text-primary"
          )}
        >
          <option value="" disabled className="text-[#8A92A3]">
            Selecciona un aeropuerto
          </option>
          {destinationOptions.map((airport) => (
            <option key={airport.icao} value={airport.icao} className="text-text-primary">
              {airport.icao} - {airport.name}, {airport.country}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-label-sm text-text-secondary">Maletas</span>
        <input
          type="number"
          min={1}
          max={originAvailableBags ?? undefined}
          value={form.contarBolsas}
          onChange={(event) => {
            setForm((current) => ({
              ...current,
              contarBolsas: Number(event.target.value),
            }));
            setError(null);
            setSuccess(null);
          }}
          className={cn(inputClassName, "text-text-primary")}
        />
      </label>

      <div
        className={cn(
          "rounded-input border px-3 py-2 transition-colors",
          noticeError
            ? "bg-danger-soft border-danger/25"
            : success
              ? "bg-success-soft border-success/25"
              : "bg-field/50 border-border-subtle"
        )}
      >
        <p
          className={cn(
            "text-secondary",
            noticeError
              ? "text-danger"
              : success
                ? "text-success"
                : "text-text-secondary"
          )}
        >
          {noticeMessage}
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-input border border-border text-button text-text-primary bg-card hover:bg-field transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-2 rounded-input text-button text-text-inverse bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Registrando..." : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default ShipmentRegistrationForm;
