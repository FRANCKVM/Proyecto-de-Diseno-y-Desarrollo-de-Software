package pucp.edu.pe.tasfb2b.controllers.dto;

import java.util.List;

public record ResultadoPeriodoResponse(
        String id,
        String tipo,
        String rango,
        Integer totalMaletas,
        Integer cumplimiento,
        Integer vuelosEjecutados,
        Integer cancelaciones,
        Integer replanificaciones,
        List<DesempenoAeropuertoResponse> desempenoPorAeropuerto,
        ResumenOperativoResponse resumen,
        String conclusion,
        String atencion
) {
    public record DesempenoAeropuertoResponse(
            String icao,
            String nombre,
            Integer recibidas,
            Integer enviadas,
            Double ocupacionPromedio,
            Double ocupacionMaxima,
            String estado
    ) {
    }

    public record ResumenOperativoResponse(
            Integer maletasIntra,
            Integer maletasInter,
            Double tiempoPromedioIntra,
            Double tiempoPromedioInter,
            Integer aeropuertosEnRojo,
            List<String> icaosEnRojo,
            Long duracionMinutos
    ) {
    }
}
