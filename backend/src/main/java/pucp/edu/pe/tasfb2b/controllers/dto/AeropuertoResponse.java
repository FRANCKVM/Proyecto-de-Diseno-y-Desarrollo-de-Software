package pucp.edu.pe.tasfb2b.controllers.dto;

public record AeropuertoResponse(
        String codigo,
        String ciudad,
        String region,
        String pais,
        String alias,
        Integer desplazamientoGMT,
        Integer capacidad,
        Integer capacidadDisponible,
        Double latitud,
        Double longitud
) {
}
