import { useMemo, useState, type FormEvent } from "react";
import { cn } from "@/utils/cn";
import { createOperationShipment } from "@/services/operationService";
import type { AirportWithCoords } from "@/types/airport.types";
import type { CreateOperationShipmentRequest } from "@/types/backendSimulation.types";

interface ShipmentRegistrationFormProps {
  airports: AirportWithCoords[];
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
  "w-full bg-field border border-border rounded-input px-3 py-2 text-body text-text-primary focus:outline-none focus:border-primary";

const ShipmentRegistrationForm = ({
  airports,
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

  const canSubmit =
    !isSubmitting &&
    form.origenIcao.trim() !== "" &&
    form.destinoIcao.trim() !== "" &&
    form.origenIcao !== form.destinoIcao &&
    form.contarBolsas > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError("Completa los campos requeridos antes de registrar el envio.");
      setSuccess(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createOperationShipment(form);
      setForm(INITIAL_FORM);
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

  return (
    <form className={cn("space-y-5", className)} onSubmit={handleSubmit}>
      <label className="block space-y-1.5">
        <span className="text-label-sm text-text-secondary">Origen</span>
        <select
          value={form.origenIcao}
          onChange={(event) => {
            setForm((current) => ({ ...current, origenIcao: event.target.value }));
            setError(null);
            setSuccess(null);
          }}
          className={inputClassName}
        >
          <option value="">Selecciona un aeropuerto</option>
          {airportOptions.map((airport) => (
            <option key={airport.icao} value={airport.icao}>
              {airport.icao} - {airport.name}, {airport.country}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-label-sm text-text-secondary">Destino</span>
        <select
          value={form.destinoIcao}
          onChange={(event) => {
            setForm((current) => ({ ...current, destinoIcao: event.target.value }));
            setError(null);
            setSuccess(null);
          }}
          className={inputClassName}
        >
          <option value="">Selecciona un aeropuerto</option>
          {airportOptions.map((airport) => (
            <option key={airport.icao} value={airport.icao}>
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
          value={form.contarBolsas}
          onChange={(event) => {
            setForm((current) => ({
              ...current,
              contarBolsas: Number(event.target.value),
            }));
            setError(null);
            setSuccess(null);
          }}
          className={inputClassName}
        />
      </label>

      <div className="rounded-input bg-primary-soft border border-primary/20 px-3 py-2">
        <p className="text-secondary text-text-primary">
          El plazo maximo se calcula automaticamente en backend segun si el
          envio es intracontinental o intercontinental.
        </p>
      </div>

      {form.origenIcao !== "" && form.origenIcao === form.destinoIcao && (
        <p className="text-secondary text-danger">
          El aeropuerto de origen debe ser distinto al de destino.
        </p>
      )}

      {error && <p className="text-secondary text-danger">{error}</p>}
      {success && <p className="text-secondary text-success">{success}</p>}

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
