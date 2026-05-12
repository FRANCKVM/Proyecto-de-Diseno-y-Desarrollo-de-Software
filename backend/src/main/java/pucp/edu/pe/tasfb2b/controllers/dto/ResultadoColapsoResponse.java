package pucp.edu.pe.tasfb2b.controllers.dto;

import java.util.List;

public record ResultadoColapsoResponse(
        String id,
        String rango,
        Integer diasHastaColapso,
        Integer maletasProcesadas,
        Integer plazosIncumplidos,
        AlmacenesSaturadosResponse almacenesSaturados,
        Double factorDemandaMax,
        List<String> analisis,
        List<AeropuertoCriticoResponse> aeropuertosCriticos,
        String sugerencia
) {
    public record AlmacenesSaturadosResponse(
            Integer cantidad,
            Integer porcentaje
    ) {
    }

    public record AeropuertoCriticoResponse(
            String icao,
            String nombre,
            Double ocupacionMaxima
    ) {
    }
}
