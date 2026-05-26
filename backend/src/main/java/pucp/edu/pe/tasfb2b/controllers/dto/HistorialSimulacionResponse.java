package pucp.edu.pe.tasfb2b.controllers.dto;

import java.time.LocalDateTime;

public record HistorialSimulacionResponse(
        Integer id,
        String tipo,
        Integer k,
        Boolean activa,
        LocalDateTime fechaInicio,
        LocalDateTime fechaFin,
        String rango,
        Integer totalMaletas,
        Integer cumplimiento,
        Integer vuelosEjecutados,
        Integer cancelaciones,
        Integer replanificaciones,
        Integer diasHastaColapso,
        Integer plazosIncumplidos,
        Integer almacenesSaturados,
        String mensajeResumen
) {
}
