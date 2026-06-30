package pucp.edu.pe.tasfb2b.services;

import java.util.List;
import java.util.Map;

public class MapaSimulacionEstado {

    private final Integer idSimulacion;
    private final Map<String, Double> ocupacionPorAeropuerto;
    private final List<VueloMapa> vuelos;
    private final List<CancelacionVueloMapa> cancelacionesRecientes;

    public MapaSimulacionEstado(
            Integer idSimulacion,
            Map<String, Double> ocupacionPorAeropuerto,
            List<VueloMapa> vuelos
    ) {
        this(idSimulacion, ocupacionPorAeropuerto, vuelos, List.of());
    }

    public MapaSimulacionEstado(
            Integer idSimulacion,
            Map<String, Double> ocupacionPorAeropuerto,
            List<VueloMapa> vuelos,
            List<CancelacionVueloMapa> cancelacionesRecientes
    ) {
        this.idSimulacion = idSimulacion;
        this.ocupacionPorAeropuerto = ocupacionPorAeropuerto;
        this.vuelos = vuelos;
        this.cancelacionesRecientes = cancelacionesRecientes;
    }

    public Integer getIdSimulacion() {
        return idSimulacion;
    }

    public Map<String, Double> getOcupacionPorAeropuerto() {
        return ocupacionPorAeropuerto;
    }

    public List<VueloMapa> getVuelos() {
        return vuelos;
    }

    public List<CancelacionVueloMapa> getCancelacionesRecientes() {
        return cancelacionesRecientes;
    }

    public static class VueloMapa {
        private final String id;
        private final String code;
        private final String fromIcao;
        private final String toIcao;
        private final double progress;
        private final Double occupancyPct;
        private final Integer departureMinute;
        private final Integer arrivalMinute;
        private final Integer durationMinutes;

        public VueloMapa(String id, String fromIcao, String toIcao, double progress) {
            this(id, null, fromIcao, toIcao, progress, null, null, null, null);
        }

        public VueloMapa(
                String id,
                String code,
                String fromIcao,
                String toIcao,
                double progress,
                Double occupancyPct,
                Integer departureMinute,
                Integer arrivalMinute,
                Integer durationMinutes
        ) {
            this.id = id;
            this.code = code;
            this.fromIcao = fromIcao;
            this.toIcao = toIcao;
            this.progress = progress;
            this.occupancyPct = occupancyPct;
            this.departureMinute = departureMinute;
            this.arrivalMinute = arrivalMinute;
            this.durationMinutes = durationMinutes;
        }

        public String getId() {
            return id;
        }

        public String getCode() {
            return code;
        }

        public String getFromIcao() {
            return fromIcao;
        }

        public String getToIcao() {
            return toIcao;
        }

        public double getProgress() {
            return progress;
        }

        public Double getOccupancyPct() {
            return occupancyPct;
        }

        public Integer getDepartureMinute() {
            return departureMinute;
        }

        public Integer getArrivalMinute() {
            return arrivalMinute;
        }

        public Integer getDurationMinutes() {
            return durationMinutes;
        }
    }

    public static class CancelacionVueloMapa {
        private final String id;
        private final String airportIcao;
        private final String flightCode;

        public CancelacionVueloMapa(String id, String airportIcao, String flightCode) {
            this.id = id;
            this.airportIcao = airportIcao;
            this.flightCode = flightCode;
        }

        public String getId() {
            return id;
        }

        public String getAirportIcao() {
            return airportIcao;
        }

        public String getFlightCode() {
            return flightCode;
        }
    }
}
