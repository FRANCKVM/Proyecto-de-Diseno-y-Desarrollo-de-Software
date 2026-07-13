package pucp.edu.pe.tasfb2b.controllers.dto;

public record HistorialSimulacionResponse(
        Integer id,
        String tipo,
        Integer k,
        Boolean activa,
        String fechaInicio,
        String fechaFin,
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
