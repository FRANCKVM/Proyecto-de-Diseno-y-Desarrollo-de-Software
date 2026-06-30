import { useState } from "react";
import { cancelFlightByCode } from "@/services/flightService";
import { useCancellationAnimationStore } from "@/store/cancellationAnimationStore";
import { resolveFlightCancellationTiming } from "@/utils/flightCancellation";
import type { VueloDetalle } from "@/types/flight.types";

interface CancelFlightInput {
  actionKey: string;
  codigo: string;
  fechaSalida: string;
  departureMinute?: number;
  fallbackAirportIcao?: string | null;
  fallbackFlightCode?: string | null;
  onCancelled?: (result: {
    updatedFlight: VueloDetalle;
    shiftedToNextDay: boolean;
  }) => void;
}

interface UseFlightCancellationActionOptions {
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
}

export const useFlightCancellationAction = ({
  idSimulacion,
  referenceMinute,
  simulationStart,
}: UseFlightCancellationActionOptions) => {
  const addFlightCancellationEvent = useCancellationAnimationStore(
    (s) => s.addFlightCancellationEvent
  );
  const [cancellingFlightKey, setCancellingFlightKey] = useState<string | null>(
    null
  );
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<{
    actionKey: string;
    message: string;
  } | null>(null);

  const cancelFlight = async ({
    actionKey,
    codigo,
    fechaSalida,
    departureMinute,
    fallbackAirportIcao,
    fallbackFlightCode,
    onCancelled,
  }: CancelFlightInput) => {
    setCancellingFlightKey(actionKey);
    setCancelError(null);
    setCancelNotice(null);

    try {
      const cancellationTiming = resolveFlightCancellationTiming({
        fechaSalida,
        idSimulacion,
        referenceMinute,
        departureMinute,
        simulationStart,
      });
      const updatedFlight = await cancelFlightByCode(
        codigo,
        cancellationTiming.fechaSalida,
        idSimulacion
      );

      if (cancellationTiming.shiftedToNextDay) {
        setCancelNotice({
          actionKey,
          message:
            cancellationTiming.notice ??
            "La cancelacion se programo para la ocurrencia del dia siguiente.",
        });
      }

      onCancelled?.({
        updatedFlight,
        shiftedToNextDay: cancellationTiming.shiftedToNextDay,
      });
      addFlightCancellationEvent({
        airportIcao: updatedFlight.origenIcao || fallbackAirportIcao || "",
        flightCode: updatedFlight.codigo || fallbackFlightCode,
      });
    } catch (error: any) {
      const message =
        typeof error?.response?.data === "string"
          ? error.response.data
          : "No se pudo cancelar el vuelo.";
      setCancelError(message);
    } finally {
      setCancellingFlightKey(null);
    }
  };

  return {
    cancelFlight,
    cancellingFlightKey,
    cancelError,
    cancelNotice,
  };
};
