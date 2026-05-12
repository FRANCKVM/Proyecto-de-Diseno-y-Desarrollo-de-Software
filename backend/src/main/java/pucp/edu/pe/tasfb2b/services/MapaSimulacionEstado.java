package pucp.edu.pe.tasfb2b.services;

import java.util.List;
import java.util.Map;

public class MapaSimulacionEstado {

    private final Integer idSimulacion;
    private final Map<String, Double> ocupacionPorAeropuerto;
    private final List<VueloMapa> vuelos;

    public MapaSimulacionEstado(
            Integer idSimulacion,
            Map<String, Double> ocupacionPorAeropuerto,
            List<VueloMapa> vuelos
    ) {
        this.idSimulacion = idSimulacion;
        this.ocupacionPorAeropuerto = ocupacionPorAeropuerto;
        this.vuelos = vuelos;
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

    public static class VueloMapa {
        private final String id;
        private final String fromIcao;
        private final String toIcao;
        private final double progress;

        public VueloMapa(String id, String fromIcao, String toIcao, double progress) {
            this.id = id;
            this.fromIcao = fromIcao;
            this.toIcao = toIcao;
            this.progress = progress;
        }

        public String getId() {
            return id;
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
    }
}
