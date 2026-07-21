package pucp.edu.pe.tasfb2b.controllers.dto;

import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;

import java.util.List;
import java.util.Map;

public record OperacionHomeResumenResponse(
        int vuelosActivos,
        int vuelosIntercontinentalesActivos,
        int enviosEnCurso,
        int maletasEnCurso,
        int enviosDentroDePlazo,
        int totalEnvios,
        int cumplimiento,
        Map<String, Double> ocupacionPorAeropuerto,
        List<SolicitudEnvio> actividadReciente
) {
}
