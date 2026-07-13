import { useEffect, useState } from "react";
import { cancelFlightOccurrence } from "@/services/flightService";
import { resolveFlightCancellationTiming } from "@/utils/flightCancellation";
import type { VueloDetalle } from "@/types/flight.types";

interface CancelFlightInput {
  actionKey: string;
  idOcurrencia: number;
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

type CancelNoticeTone = "warning" | "error" | "success";

export const useFlightCancellationAction = ({
  idSimulacion,
  referenceMinute,
  simulationStart,
}: UseFlightCancellationActionOptions) => {
  const [cancellingFlightKey, setCancellingFlightKey] = useState<string | null>(
    null
  );
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<{
    actionKey: string;
    message: string;
    tone: CancelNoticeTone;
  } | null>(null);

  useEffect(() => {
    if (!cancelNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCancelNotice(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cancelNotice]);

  const cancelFlight = async ({
    actionKey,
    idOcurrencia,
    fechaSalida,
    departureMinute,
    onCancelled,
  }: CancelFlightInput) => {
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

      setCancellingFlightKey(actionKey);
      const updatedFlight = await cancelFlightOccurrence(idOcurrencia, idSimulacion);

      if (cancellationTiming.shiftedToNextDay) {
        const message =
          cancellationTiming.notice ??
          "El vuelo actual esta dentro de la ultima hora antes del despegue. Se cancelo la siguiente ocurrencia.";
        setCancelNotice({
          actionKey,
          tone: "warning",
          message,
        });
      } else {
        setCancelNotice({
          actionKey,
          tone: "success",
          message: "Vuelo cancelado correctamente.",
        });
      }

      onCancelled?.({
        updatedFlight,
        shiftedToNextDay: cancellationTiming.shiftedToNextDay,
      });
    } catch (error: any) {
      const message =
        typeof error?.response?.data === "string"
          ? error.response.data
          : "No se pudo cancelar el vuelo.";
      setCancelError(message);
      setCancelNotice({
        actionKey,
        tone: "error",
        message,
      });
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
